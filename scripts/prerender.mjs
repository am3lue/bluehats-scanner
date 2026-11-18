#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROUTES, SITE_URL, version } from './seo-routes.mjs';

const DIST = path.resolve(process.cwd(), 'dist');
const DATE = new Date().toISOString().slice(0, 10);

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
}

const entries = ROUTES.filter((route) => route.inSitemap)
  .map((route) => {
    const url = `${SITE_URL}${route.path === '/' ? '/' : route.path.replace(/\/$/, '')}`;
    return `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${DATE}</lastmod>\n    <changefreq>${route.path === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${route.path === '/' ? '1.0' : '0.7'}</priority>\n  </url>`;
  })
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');
await fs.writeFile(
  path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  'utf8',
);

await fs.writeFile(
  path.join(DIST, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'BlueHats Scanner',
      short_name: 'BlueHats',
      description: 'Explainable phishing and brand-impersonation link scanning.',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#f4eadd',
      theme_color: '#0f4c48',
      icons: [
        { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

const seoFiles = ['index.html', 'demo/index.html', 'how-to/index.html', 'docs/index.html', 'history/index.html'];
for (const file of seoFiles) {
  const html = await fs.readFile(path.join(DIST, file), 'utf8');
  if (!html.includes('BlueHats Scanner')) throw new Error(`[prerender] ${file} is missing the BlueHats shell`);
  if (html.includes('og-image.svg')) throw new Error(`[prerender] ${file} still references the SVG social image`);
  if (!html.includes('/assets/')) throw new Error(`[prerender] ${file} is missing built asset references`);
}
for (const asset of ['og-image.png', 'favicon.svg', 'site.webmanifest', 'sitemap.xml', 'robots.txt']) {
  await fs.access(path.join(DIST, asset));
}

console.log(`[prerender] sitemap, robots, manifest and route-shell checks passed · v${version}`);
