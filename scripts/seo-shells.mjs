#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { ROUTES, SITE_URL, canonical, outputFile, shellMarkup } from './seo-routes.mjs';

const DIST = path.resolve(process.cwd(), 'dist');
const BASE = path.join(DIST, 'index.html');

const baseHtml = await fs.readFile(BASE, 'utf8');

for (const route of ROUTES) {
  if (route.file === 'index.html') {
    const $ = cheerio.load(baseHtml);
    applyHead($, route);
    $('#root').html(shellMarkup(route));
    await fs.writeFile(BASE, $.html(), 'utf8');
    continue;
  }

  const $ = cheerio.load(baseHtml);
  applyHead($, route);
  $('#root').html(shellMarkup(route));
  const target = outputFile(route);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, $.html(), 'utf8');
}

function applyHead($, route) {
  const url = canonical(route.path);
  $('title').text(route.title);
  $('meta[name="description"]').attr('content', route.description);
  $('meta[name="robots"]').attr('content', route.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large');
  $('link[rel="canonical"]').attr('href', url);
  $('meta[property="og:title"]').attr('content', route.title);
  $('meta[property="og:description"]').attr('content', route.description);
  $('meta[property="og:url"]').attr('content', url);
  $('meta[name="twitter:title"]').attr('content', route.title);
  $('meta[name="twitter:description"]').attr('content', route.description);
  if ($('meta[property="og:image"]').attr('content')?.endsWith('/og-image.svg')) {
    $('meta[property="og:image"]').attr('content', `${SITE_URL}/og-image.png`);
  }
  if ($('meta[name="twitter:image"]').attr('content')?.endsWith('/og-image.svg')) {
    $('meta[name="twitter:image"]').attr('content', `${SITE_URL}/og-image.png`);
  }
}

console.log(`[seo] wrote ${ROUTES.length} route shells for ${SITE_URL}`);
