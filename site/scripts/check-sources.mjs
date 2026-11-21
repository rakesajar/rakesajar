#!/usr/bin/env node
/**
 * Checks that every source URL in the built fact store and destination pages responds (Source Registry health, §6).
 * Needs outbound network to the official domains. Run after `npm run build`. Not part of the offline gate.
 */
import { readFileSync } from 'node:fs';

const store = JSON.parse(readFileSync(new URL('../dist/facts.json', import.meta.url), 'utf8'));
const urls = [...new Set([...store.facts.flatMap((f) => f.sources.map((s) => s.url)), ...store.signals.map((s) => s.watch.url)])];
let bad = 0;
for (const url of urls) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const moved = res.url !== url ? ` → ${res.url}` : '';
    if (!res.ok) bad++;
    console.log(`${res.ok ? 'OK  ' : 'FAIL'} ${res.status} ${url}${moved}`);
  } catch (e) {
    bad++;
    console.log(`FAIL ERR ${url} (${e.cause?.code ?? e.message})`);
  }
}
console.log(`\n${urls.length - bad}/${urls.length} source URLs reachable`);
process.exit(bad ? 1 : 0);
