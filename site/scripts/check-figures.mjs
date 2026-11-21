#!/usr/bin/env node
/**
 * Post-build publishing checks over dist/ (PB-2, DS-2, accessibility hygiene).
 *  1. No uncited figures: currency amounts, durations and percentages must sit inside an element
 *     carrying data-fact (bound to a published fact) or data-figure-ok (our own published policy).
 *  2. Every data-fact token refers to a published fact (or a documented computed token).
 *  3. Every external link targets an allowlisted official domain.
 *  4. Element ids are unique and every in-page #anchor resolves.
 * Exits 1 with a list of findings.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'node-html-parser';

const DIST = new URL('../dist/', import.meta.url).pathname;
const store = JSON.parse(readFileSync(join(DIST, 'facts.json'), 'utf8'));
const factIds = new Set(store.facts.map((f) => f.id));
const COMPUTED_TOKENS = new Set(['user-input', 'computed', 'none']);

// Allowlisted host patterns, read from the published store's sources plus the allowlist module text.
const allowSrc = readFileSync(new URL('../src/data/allowlist.ts', import.meta.url), 'utf8');
const patterns = [...allowSrc.matchAll(/pattern: '([^']+)'/g)].map((m) => m[1]);
const hostAllowed = (host) =>
  patterns.some((p) =>
    p.startsWith('*.') ? host.endsWith(p.slice(1)) && host.length > p.length - 1 : host === p || host.endsWith('.' + p),
  );

export const FIGURE = new RegExp(
  [
    String.raw`(?:S\$|US\$|CA\$|A\$|NZ\$|£|€|¥|₹)\s?\d`,
    String.raw`\b(?:AUD|NZD|AED|SGD|USD|GBP|CAD|EUR|JPY|INR)\s?\d`,
    String.raw`\b\d+(?:[.,]\d+)?[\s-]?(?:hours?|hrs?|h|months?|mo|years?|yrs?|days?|weeks?|wks?)\b`,
    String.raw`\b\d+(?:\.\d+)?\s?%`,
    // Bare large numbers (caps, amounts without a symbol) and spelled-out durations.
    String.raw`\b\d{1,3}(?:,\d{3})+\b`,
    String.raw`\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen|twenty|thirty|forty|forty-eight)[\s-](?:hours?|days?|weeks?|months?|years?)\b`,
  ].join('|'),
  'i',
);

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith('.html') ? [p] : [];
  });
}

const findings = [];
for (const file of htmlFiles(DIST)) {
  const rel = relative(DIST, file);
  const root = parse(readFileSync(file, 'utf8'));
  const body = root.querySelector('body');
  if (!body) continue;

  // 4. ids and anchors
  const ids = new Map();
  for (const el of body.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) findings.push(`${rel}: duplicate id "${id}" (${n}×)`);
  for (const a of body.querySelectorAll('a[href^="#"]')) {
    const target = a.getAttribute('href').slice(1);
    if (target && !ids.has(target)) findings.push(`${rel}: anchor #${target} has no target`);
  }

  // 3. external links
  for (const a of body.querySelectorAll('a[href^="http"]')) {
    const href = a.getAttribute('href');
    let url;
    try {
      url = new URL(href);
    } catch {
      findings.push(`${rel}: invalid link ${href}`);
      continue;
    }
    if (url.protocol !== 'https:') findings.push(`${rel}: non-HTTPS link ${href}`);
    else if (!hostAllowed(url.hostname.toLowerCase())) findings.push(`${rel}: link to non-allowlisted domain ${href}`);
  }

  // 2. fact tokens
  for (const el of body.querySelectorAll('[data-fact]')) {
    for (const token of el.getAttribute('data-fact').split(/\s+/).filter(Boolean))
      if (!factIds.has(token) && !COMPUTED_TOKENS.has(token))
        findings.push(`${rel}: data-fact "${token}" is not a published fact`);
  }

  // 1. uncited figures
  for (const el of body.querySelectorAll('script, style, noscript, template, [data-fact], [data-figure-ok]')) el.remove();
  const text = body.textContent.replace(/\s+/g, ' ');
  const re = new RegExp(FIGURE.source, 'gi');
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    findings.push(`${rel}: uncited figure "${m[0]}" in “…${text.slice(Math.max(0, at - 50), at + 30).trim()}…”`);
  }
}

if (findings.length) {
  console.error(`Publishing check failed with ${findings.length} finding(s):\n  ` + findings.join('\n  '));
  process.exit(1);
}
console.log('Publishing check passed: no uncited figures, all fact references valid, all links allowlisted, anchors resolve.');
