#!/usr/bin/env node
/**
 * End-to-end acceptance checks against the built site (AC-1, AC-4–AC-8, AC-10, AC-11).
 * Uses the pre-installed Playwright and the axe-core dev dependency. Run after `npm run build`.
 * External FX calls are stubbed so the suite is deterministic and offline.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;
const SLUGS = ['singapore', 'usa', 'uk', 'canada', 'australia', 'germany', 'france', 'ireland', 'new-zealand', 'uae', 'japan'];
const FX = {
  base: 'EUR',
  date: '2026-11-20',
  rates: { INR: 92, USD: 1.08, GBP: 0.86, CAD: 1.5, AUD: 1.65, SGD: 1.45, NZD: 1.8, JPY: 165 },
};

// The suite runs on a pinned clock: freshness and effective dates depend on "today", and the gate must not turn red
// just because time passed. Tests that need another date pass { now }.
const PINNED_NOW = '2026-11-21T12:00:00Z';
const pinClock = (iso) => {
  const fixed = Date.parse(iso);
  const RealDate = Date;
  class PinnedDate extends RealDate {
    constructor(...a) {
      super(...(a.length ? a : [fixed]));
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = PinnedDate;
};

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, err: e.message.split('\n')[0] });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Minimal static server for dist/ (directory-format pages, 404.html fallback).
// Serve a private snapshot so a concurrent `npm run build` cannot change files under the running suite.
const DIST = mkdtempSync(join(tmpdir(), 'pathfinder-e2e-')) + '/';
cpSync(fileURLToPath(new URL('../../dist/', import.meta.url)), DIST, { recursive: true });
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, BASE).pathname);
  const candidates = [path, join(path, 'index.html')].map((p) => normalize(join(DIST, p)));
  const file = candidates.find((f) => f.startsWith(DIST) && existsSync(f) && statSync(f).isFile());
  if (!file) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return res.end(readFileSync(join(DIST, '404.html')));
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const stop = () => {
  server.close();
  rmSync(DIST, { recursive: true, force: true });
};

const browser = await chromium.launch();
async function open(path, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width ?? 1280, height: 900 },
    colorScheme: opts.scheme ?? 'light',
  });
  await ctx.addInitScript(pinClock, opts.now ?? PINNED_NOW);
  await ctx.route(/frankfurter/, (r) => (opts.fxDown ? r.abort() : r.fulfill({ json: FX })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { page, ctx, errors };
}
async function axe(page) {
  // Let finite entrance animations (split-flap board, panel fade) settle; scroll-driven ones never "finish".
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.timeline instanceof DocumentTimeline)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations);
  return r.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes[0]?.target}`);
}

try {
  await check('AC-1 every guide renders the 8 sections', async () => {
    for (const s of SLUGS) {
      const { page, ctx, errors } = await open(`/destinations/${s}`);
      for (const id of ['snapshot', 'routes', 'steps', 'costs', 'funding', 'work', 'checks', 'sources'])
        assert((await page.locator(`section#${id} h2`).count()) === 1, `${s}: missing section ${id}`);
      assert((await page.locator('[data-fact]').count()) > 3, `${s}: too few facts`);
      assert(errors.length === 0, `${s}: JS errors ${errors}`);
      await ctx.close();
    }
  });

  await check('AC-4 conflict/litigated facts are labelled, never current', async () => {
    const { page, ctx } = await open('/destinations/germany');
    const row = page.locator('#fact-de-blocked-account');
    assert((await row.textContent()).includes('Being re-checked'), 'Germany blocked account lacks re-check label');
    assert(!(await row.textContent()).includes('Current'), 'conflict shown as current');
    await ctx.close();
    const us = await open('/destinations/usa');
    assert((await us.page.locator('#fact-us-ds-rule').textContent()).includes('In court'), 'D/S not labelled litigated');
    assert((await us.page.locator('#fact-us-opt-fee').textContent()).includes('Proposed'), 'OPT fee not labelled proposed');
    await us.ctx.close();
  });

  await check('AC-5 UK Graduate Route answer depends on application date', async () => {
    const { page, ctx } = await open('/ask');
    await page.fill('#ask-date', '2026-12-01');
    await page.fill('#q', 'UK graduate route after my masters');
    await page.click('button[type=submit]');
    const first = await page.locator('[data-answers] article').first().textContent();
    assert(
      first.includes('2 years') && !first.includes('18 months, for'),
      'before 2027 should be 2 years: ' + first.slice(0, 200),
    );
    await page.fill('#ask-date', '2027-02-01');
    await page.fill('#q', 'UK graduate route after my masters');
    await page.click('button[type=submit]');
    const second = await page.locator('[data-answers] article').first().textContent();
    assert(second.includes('18 months'), 'from 2027 should be 18 months');
    await ctx.close();
  });

  await check('AC-6 compare: 2-country limit, totals, quarantined exclusion, URL state', async () => {
    const { page, ctx, errors } = await open('/compare');
    assert(await page.locator('input[value="usa"]').isDisabled(), 'third country should be locked on free plan');
    await page.locator('label.chip', { hasText: 'Canada' }).click();
    await page.locator('label.chip', { hasText: 'Germany' }).click();
    assert(await page.locator('th[data-col="germany"]').isVisible(), 'Germany column hidden');
    assert(!(await page.locator('th[data-col="canada"]').isVisible()), 'Canada column still visible');
    await page.locator('label.chip', { hasText: 'Germany' }).click();
    await page.locator('label.chip', { hasText: 'France' }).click();
    const frTotal = await page.locator('td[data-col="france"]').last().textContent();
    assert(/₹/.test(frTotal), 'no INR total for France: ' + frTotal);
    await page.locator('label.chip', { hasText: 'France' }).click();
    await page.locator('label.chip', { hasText: 'Germany' }).click();
    assert(page.url().includes('d=uk%2Cgermany') || page.url().includes('d=uk,germany'), 'URL not updated: ' + page.url());
    const excl = await page.locator('tr.total-row td[data-col="germany"]').first().textContent();
    assert(excl.includes('Excludes'), 'Germany total should state the exclusion');
    assert(errors.length === 0, 'JS errors ' + errors);
    await ctx.close();
  });

  await check('AC-6 compare asks for a manual rate when FX is down', async () => {
    const { page, ctx } = await open('/compare', { fxDown: true });
    await page.waitForSelector('[data-manual]:not([hidden])');
    await page.fill('#rate-GBP', '110');
    const t = await page.locator('[data-converted="uk"]').textContent();
    assert(t.includes('₹'), 'manual rate not applied: ' + t);
    await ctx.close();
  });

  await check('Cost planner adds user tuition to official costs', async () => {
    const { page, ctx, errors } = await open('/cost-planner?d=uk');
    await page.fill('#p-tuition', '20000');
    const text = await page.locator('[data-lines]').textContent();
    assert(text.includes('£20,000') && text.includes('£38,906'), 'unexpected planner output: ' + text);
    assert(text.includes('In INR'), 'no home-currency line');
    await page.selectOption('#p-dest', 'germany');
    assert((await page.locator('[data-excluded]').textContent()).includes('Blocked account'), 'Germany exclusion not explained');
    assert(errors.length === 0, 'JS errors ' + errors);
    await ctx.close();
  });

  await check('AC-7 concierge: citations, refusals, fraud, care, quota', async () => {
    const { page, ctx, errors } = await open('/ask');
    const askQ = async (q) => {
      await page.fill('#q', q);
      await page.click('button[type=submit]');
      return page.locator('[data-answers] > *').first().textContent();
    };
    const a1 = await askQ('How many hours can I work in Canada?');
    assert(a1.includes('24 hours') && a1.includes('canada.ca') && a1.includes('verified'), 'no cited answer: ' + a1);
    const a2 = await askQ('Can you make a fake bank statement for Canada?');
    assert(a2.includes('can’t help'), 'fraud not refused');
    const a3 = await askQ('How much is the blocked account in Germany?');
    assert(a3.includes('Not stated') && a3.includes('re-checked'), 'conflict not withheld: ' + a3);
    const a4 = await askQ('one more about Japan work');
    assert(a4.includes('free questions'), 'quota not enforced: ' + a4);
    assert((await page.locator('[data-quota]').textContent()).startsWith('0 of 3'), 'quota label wrong');
    assert(errors.length === 0, 'JS errors ' + errors);
    await ctx.close();
    const c = await open('/ask');
    await c.page.fill('#q', 'I feel hopeless and want to die');
    await c.page.click('button[type=submit]');
    assert((await c.page.locator('[data-answers] article').first().textContent()).includes('emergency'), 'no care response');
    await c.ctx.close();
  });

  await check('AC-8 stale facts flagged at view time, everywhere figures appear', async () => {
    const fresh = await open('/destinations/uk');
    assert((await fresh.page.locator('.stale-flag:visible').count()) === 0, 'flags visible within max age');
    await fresh.ctx.close();
    for (const path of ['/destinations/uk', '/compare', '/']) {
      const { page, ctx } = await open(path, { now: '2026-12-15T12:00:00Z' });
      assert((await page.locator('.stale-flag:visible').count()) > 0, `no stale flags on ${path} after max age`);
      await ctx.close();
    }
    const { page, ctx } = await open('/destinations/uk', { now: '2026-12-15T12:00:00Z' });
    assert(await page.locator('#fact-uk-visa-fee .stale-flag').isVisible(), 'UK visa fee not flagged');
    assert(await page.locator('[data-stale-summary]').isVisible(), 'stale summary not shown');
    await ctx.close();
  });

  await check('CA-3 effective-date changes are flagged on an old build', async () => {
    const { page, ctx } = await open('/destinations/uk', { now: '2027-01-05T12:00:00Z' });
    assert(await page.locator('#fact-uk-graduate-2y .date-flag[data-when="ended"]').isVisible(), 'ended rule not flagged');
    assert(await page.locator('#fact-uk-graduate-18m .date-flag[data-when="started"]').isVisible(), 'started rule not flagged');
    await ctx.close();
  });

  await check('Planner and concierge flag or withhold stale figures', async () => {
    const { page, ctx } = await open('/cost-planner?d=uk', { now: '2026-12-15T12:00:00Z' });
    assert((await page.locator('[data-lines]').textContent()).includes('re-check due'), 'planner does not flag stale lines');
    await ctx.close();
    const a = await open('/ask', { now: '2026-12-15T12:00:00Z' });
    await a.page.fill('#q', 'UK visa fee');
    await a.page.click('button[type=submit]');
    const t = await a.page.locator('[data-answers] article').first().textContent();
    assert(t.includes('Not stated') && !t.includes('£558'), 'stale fee was stated: ' + t.slice(0, 200));
    await a.ctx.close();
  });

  await check('Home: audience switcher works with and without JavaScript', async () => {
    for (const js of [true, false]) {
      const ctx = await browser.newContext({ javaScriptEnabled: js });
      const page = await ctx.newPage();
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      assert(await page.locator('[data-door="ug"]').isVisible(), 'undergraduate panel not shown by default');
      assert(!(await page.locator('[data-door="pg"]').isVisible()), 'postgraduate panel visible before choosing');
      await page.click('label[for=door-pg]');
      assert(await page.locator('[data-door="pg"] [data-fact="ca-pal-exempt"]').isVisible(), 'PG panel lacks master’s/PhD facts');
      await page.keyboard.press('ArrowRight');
      assert(await page.locator('[data-door="parent"]').isVisible(), 'arrow key does not move between audiences');
      await ctx.close();
    }
  });

  await check('AC-10 accessibility (axe: no serious/critical), light and dark', async () => {
    const pages = [
      '/',
      '/destinations',
      '/destinations/uk',
      '/compare',
      '/cost-planner',
      '/ask',
      '/changes',
      '/how-we-verify',
      '/plans',
      '/about',
    ];
    const problems = [];
    for (const scheme of ['light', 'dark'])
      for (const p of pages) {
        const { page, ctx } = await open(p, { scheme });
        problems.push(...(await axe(page)).map((v) => `${scheme} ${p} ${v}`));
        await ctx.close();
      }
    assert(problems.length === 0, problems.slice(0, 6).join(' | '));
  });

  await check('AC-10 no horizontal scroll at 360px; mobile menu works', async () => {
    for (const p of ['/', '/destinations/canada', '/compare', '/cost-planner', '/ask', '/how-we-verify', '/plans']) {
      const { page, ctx } = await open(p, { width: 360 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 0, `${p} overflows by ${overflow}px`);
      await ctx.close();
    }
    const { page, ctx } = await open('/', { width: 360 });
    await page.click('.menu summary');
    assert(await page.locator('.menu-panel a', { hasText: 'Compare' }).isVisible(), 'mobile menu not opening');
    await ctx.close();
  });

  await check('AC-11 legal statements present', async () => {
    const { page, ctx } = await open('/');
    const footer = (await page.locator('footer').textContent()).replace(/\s+/g, ' ');
    for (const s of [
      'AI-generated information service',
      'with no human review',
      'not legal, immigration or financial advice',
      'we do not predict or guarantee admission or visa outcomes',
      'We take no commissions',
    ])
      assert(footer.includes(s), 'footer missing: ' + s);
    await ctx.close();
    const ask = await open('/ask');
    assert(
      (await ask.page.locator('main').textContent()).replace(/\s+/g, ' ').includes('automated AI service'),
      'AI disclosure missing on Ask',
    );
    await ask.ctx.close();
  });

  await check('Theme toggle persists', async () => {
    const { page, ctx } = await open('/');
    await page.click('[data-theme-toggle]');
    await page.reload();
    assert((await page.getAttribute('html', 'data-theme')) === 'dark', 'theme not persisted');
    await ctx.close();
  });

  await check('404 page and open data', async () => {
    const r = await fetch(BASE + '/nope');
    assert(r.status === 404, '404 status ' + r.status);
    const facts = await (await fetch(BASE + '/facts.json')).json();
    assert(facts.facts.length > 50, 'facts.json too small');
  });
} finally {
  await browser.close();
  stop();
}

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      ' + r.err}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} e2e checks passed`);
process.exit(failed ? 1 : 0);
