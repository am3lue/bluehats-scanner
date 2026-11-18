export interface BrandEntry {
  name: string;
  domains: string[];
  tokens: string[];
  category: 'finance' | 'tech' | 'retail' | 'shipping' | 'crypto' | 'social' | 'demo';
}

export const BRANDS: BrandEntry[] = [
  { name: 'PayPal', domains: ['paypal.com'], tokens: ['paypal'], category: 'finance' },
  { name: 'Apple', domains: ['apple.com', 'icloud.com'], tokens: ['apple', 'icloud'], category: 'tech' },
  { name: 'Microsoft', domains: ['microsoft.com', 'office.com', 'live.com'], tokens: ['microsoft', 'office365', 'outlook'], category: 'tech' },
  { name: 'Google', domains: ['google.com', 'gmail.com'], tokens: ['google', 'gmail'], category: 'tech' },
  { name: 'Amazon', domains: ['amazon.com'], tokens: ['amazon'], category: 'retail' },
  { name: 'Netflix', domains: ['netflix.com'], tokens: ['netflix'], category: 'tech' },
  { name: 'Meta', domains: ['facebook.com', 'instagram.com', 'whatsapp.com'], tokens: ['facebook', 'instagram', 'whatsapp'], category: 'social' },
  { name: 'LinkedIn', domains: ['linkedin.com'], tokens: ['linkedin'], category: 'social' },
  { name: 'Dropbox', domains: ['dropbox.com'], tokens: ['dropbox'], category: 'tech' },
  { name: 'Adobe', domains: ['adobe.com'], tokens: ['adobe'], category: 'tech' },
  { name: 'Docusign', domains: ['docusign.com'], tokens: ['docusign'], category: 'tech' },
  { name: 'DHL', domains: ['dhl.com'], tokens: ['dhl'], category: 'shipping' },
  { name: 'FedEx', domains: ['fedex.com'], tokens: ['fedex'], category: 'shipping' },
  { name: 'UPS', domains: ['ups.com'], tokens: ['ups'], category: 'shipping' },
  { name: 'USPS', domains: ['usps.com'], tokens: ['usps'], category: 'shipping' },
  { name: 'Chase', domains: ['chase.com'], tokens: ['chase'], category: 'finance' },
  { name: 'Wells Fargo', domains: ['wellsfargo.com'], tokens: ['wellsfargo'], category: 'finance' },
  { name: 'Bank of America', domains: ['bankofamerica.com'], tokens: ['bankofamerica'], category: 'finance' },
  { name: 'HSBC', domains: ['hsbc.com'], tokens: ['hsbc'], category: 'finance' },
  { name: 'Coinbase', domains: ['coinbase.com'], tokens: ['coinbase'], category: 'crypto' },
  { name: 'Binance', domains: ['binance.com'], tokens: ['binance'], category: 'crypto' },
  { name: 'MetaMask', domains: ['metamask.io'], tokens: ['metamask'], category: 'crypto' },
  { name: 'Steam', domains: ['steampowered.com', 'steamcommunity.com'], tokens: ['steam', 'steamcommunity'], category: 'retail' },
  { name: 'Roblox', domains: ['roblox.com'], tokens: ['roblox'], category: 'retail' },
  { name: 'Northwind Bank', domains: ['northwind-bank.example'], tokens: ['northwind', 'northwindbank'], category: 'demo' },
  { name: 'Acme Cloud', domains: ['acme-cloud.example'], tokens: ['acme', 'acmecloud'], category: 'demo' },
];

export const BRAND_BY_TOKEN = new Map<string, BrandEntry>();
for (const brand of BRANDS) {
  for (const token of brand.tokens) BRAND_BY_TOKEN.set(token, brand);
}

export const DIGIT_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'l',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'l',
};

export const HOMOGLYPHS: Record<string, string> = {
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  х: 'x',
  у: 'y',
  і: 'i',
  ѕ: 's',
  ԁ: 'd',
  ӏ: 'l',
  α: 'a',
  ο: 'o',
  ρ: 'p',
  ν: 'v',
  τ: 't',
  'ı': 'i',
  'ɡ': 'g',
  'ⅼ': 'l',
  'ⅰ': 'i',
};

export const SUSPICIOUS_TLDS = new Set([
  'zip',
  'mov',
  'top',
  'xyz',
  'click',
  'link',
  'live',
  'cf',
  'gq',
  'tk',
  'ml',
  'ga',
  'work',
  'rest',
  'cam',
  'buzz',
  'quest',
  'sbs',
  'icu',
  'cyou',
  'monster',
  'lol',
  'autos',
  'boats',
  'hair',
  'skin',
  'makeup',
]);

export const SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'rb.gy',
  'shorturl.at',
  'rebrand.ly',
  'tiny.cc',
  'lnkd.in',
  's.id',
  'v.gd',
  'clck.ru',
  'short.gy',
]);

export const LURE_WORDS = [
  'login',
  'signin',
  'sign-in',
  'verify',
  'verification',
  'secure',
  'security',
  'account',
  'update',
  'confirm',
  'wallet',
  'support',
  'billing',
  'invoice',
  'unlock',
  'bonus',
  'prize',
  'claim',
  'alert',
  'suspended',
  'recovery',
  'refund',
  'gift',
  'reward',
];

export function detectBrandsInText(text: string): { brand: BrandEntry; count: number } | null {
  const lower = text.toLowerCase();
  let best: { brand: BrandEntry; count: number } | null = null;
  for (const brand of BRANDS) {
    let count = 0;
    for (const token of brand.tokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = lower.match(new RegExp(`\\b${escaped}\\b`, 'g'));
      count += matches ? matches.length : 0;
    }
    if (count > 0 && (!best || count > best.count)) best = { brand, count };
  }
  return best;
}

export function normalizeLeet(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((char) => HOMOGLYPHS[char] ?? DIGIT_MAP[char] ?? char)
    .join('');
}

export function demojibakeHost(host: string): string {
  // URL.hostname returns punycode (xn--). Decode it so confusable characters can be inspected.
  try {
    return decodeURIComponent(new URL(`https://${host}`).hostname);
  } catch {
    return host;
  }
}
