/**
 * Open data: the published fact store as JSON, so anyone can audit what we show.
 */
import type { APIRoute } from 'astro';
import { BUILD_DATE, FACTS, INDIA_FACTS, SIGNALS } from '../lib/store';

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ generated: BUILD_DATE, facts: [...FACTS, ...INDIA_FACTS], signals: SIGNALS }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
