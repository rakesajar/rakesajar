import type { APIRoute } from 'astro';
import { DESTINATIONS } from '../data/destinations';

const STATIC = [
  '/',
  '/destinations',
  '/compare',
  '/cost-planner',
  '/ask',
  '/changes',
  '/how-we-verify',
  '/plans',
  '/about',
  '/terms',
  '/privacy',
];

export const GET: APIRoute = ({ site }) => {
  const urls = [...STATIC, ...DESTINATIONS.map((d) => `/destinations/${d.slug}`)];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${new URL(u, site)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
