#!/usr/bin/env node
/**
 * Re-verification loop (Verifier agent, req.md §6/§8.2) for sourced facts.
 *
 * For every fact in src/data/sourced/*.json: fetch its official page, extract the visible text, and confirm the
 * quoted passage still appears in it (whitespace-insensitive). Prints a report; exits 1 if any passage is missing.
 * With --stamp, writes today's date as `verifiedAt` on every fact whose passage was found, so the site shows it
 * as freshly checked. Facts whose passage is gone are never stamped: they age into "re-check due" on their own.
 *
 * Needs network access to the official hosts (run it on a schedule where egress allows). Uses curl so the
 * environment's HTTPS proxy and CA bundle apply.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../src/data/sourced/', import.meta.url).pathname;
const UA = 'Mozilla/5.0 (compatible; PathfinderFactCheck/0.1; +https://pathfinder.example/how-we-verify)';
const stamp = process.argv.includes('--stamp');
const today = new Date().toISOString().slice(0, 10);

const NAMED = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  pound: '£',
  euro: '€',
  yen: '¥',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  copy: '©',
  reg: '®',
  deg: '°',
  middot: '·',
  bull: '•',
  times: '×',
  eacute: 'é',
  egrave: 'è',
  aacute: 'á',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
};
function decodeEntity(e) {
  if (e[0] === '#') {
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code === 160 ? 32 : code) : null;
  }
  return NAMED[e.toLowerCase()] ?? null;
}

export function visibleText(html) {
  return html
    .replace(/<(script|style|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div|tr|td|th|dt|dd)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => decodeEntity(e) ?? m);
}

/** Whitespace- and quote-insensitive form used for comparison. */
export function norm(s) {
  return s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
}

const pages = new Map();
function page(url) {
  // URLs come from data files; only plain https URLs are fetched, never anything curl could read as an option.
  if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|\?|$)/i.test(url)) return null;
  if (!pages.has(url)) {
    try {
      const html = execFileSync(
        'curl',
        ['--proto', '=https', '--proto-redir', '=https', '-sL', '--max-time', '40', '-A', UA, '--', url],
        { encoding: 'utf8', maxBuffer: 50e6 },
      );
      pages.set(url, norm(visibleText(html)));
    } catch {
      pages.set(url, null);
    }
  }
  return pages.get(url);
}

let missing = 0;
let checked = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const path = join(DIR, file);
  const items = JSON.parse(readFileSync(path, 'utf8'));
  for (const item of items) {
    checked++;
    const text = page(item.url);
    const ok = text !== null && text.includes(norm(item.passage));
    if (!ok) missing++;
    if (ok && stamp) item.verifiedAt = today;
    console.log(`${ok ? 'OK     ' : text === null ? 'NO PAGE' : 'MISSING'} ${item.id}  ${item.url}`);
  }
  if (stamp) writeFileSync(path, JSON.stringify(items, null, 2) + '\n');
}
console.log(`\n${checked - missing}/${checked} passages found on their official pages${stamp ? `; stamped ${today}` : ''}`);
process.exit(missing ? 1 : 0);
