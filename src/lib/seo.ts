import { useEffect } from 'react';
import { SITE_NAME, SITE_URL } from './api';

function upsertMeta(selector: string, attributes: Record<string, string>): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
}

function upsertLink(rel: string, href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
}

export function useSeo({ title, description, path, noindex, jsonLd }: SeoOptions): void {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
    document.title = fullTitle;
    const canonical = `${SITE_URL}${path === '/' ? '/' : path}`;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' });
    upsertLink('canonical', canonical);
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });

    const scriptId = 'bluehats-page-jsonld';
    document.getElementById(scriptId)?.remove();
    if (jsonLd?.length) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = scriptId;
      script.text = JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd);
      document.head.appendChild(script);
    }
  }, [title, description, path, noindex, jsonLd]);
}
