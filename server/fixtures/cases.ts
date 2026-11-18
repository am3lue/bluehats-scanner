import type { DemoCase, RedirectHop } from '../types.js';
import type { BrandReference } from '../engine/brand.js';

export interface FixtureCase extends DemoCase {
  targetPath: string;
  reference?: BrandReference;
  redirects?: RedirectHop[];
  expectedScore: [number, number];
}

export const DEMO_CASES: FixtureCase[] = [
  {
    id: 'safe-blog',
    label: 'Official bank blog',
    blurb: 'A calm, well-formed article on the bank’s real domain. No credential form, matching brand, clean certificate story.',
    kind: 'safe',
    displayUrl: 'https://northwind-bank.example/insights/spotting-phishing',
    targetPath: '/demo-fixtures/safe',
    brand: 'Northwind Bank',
    brandDomain: 'northwind-bank.example',
    highlights: ['Readable article', 'No credential form', 'Brand domain matches'],
    expectedScore: [0, 30],
  },
  {
    id: 'typosquat-login',
    label: 'Typosquat login clone',
    blurb: 'A fake sign-in page for Northwind Bank hosted on a look-alike domain, posting credentials to a collector.',
    kind: 'dangerous',
    displayUrl: 'http://northwind-bank-secure.verify-login.example/signin',
    targetPath: '/demo-fixtures/typosquat',
    brand: 'Northwind Bank',
    brandDomain: 'northwind-bank.example',
    highlights: ['Brand in wrong domain', 'Cross-origin password form', 'Plain HTTP'],
    reference: {
      brand: 'Northwind Bank',
      domain: 'northwind-bank.example',
      title: 'Northwind Bank — Personal banking, loans and support',
      text: 'Northwind Bank helps you manage personal banking, savings, loans and cards. Sign in to your Northwind account to check balances, pay bills and manage your card. Need help? Contact support through the official app or the number on the back of your card.',
    },
    expectedScore: [75, 100],
  },
  {
    id: 'homoglyph',
    label: 'Homoglyph domain',
    blurb: 'A Cyrillic letter hides inside the domain, so it looks like the bank at a glance but resolves somewhere else.',
    kind: 'dangerous',
    displayUrl: 'https://nоrthwind-bank.example/login',
    targetPath: '/demo-fixtures/homoglyph',
    brand: 'Northwind Bank',
    brandDomain: 'northwind-bank.example',
    highlights: ['Cyrillic “о” in the host', 'Punycode encoding', 'Fake login'],
    reference: {
      brand: 'Northwind Bank',
      domain: 'northwind-bank.example',
      title: 'Northwind Bank — Personal banking, loans and support',
      text: 'Northwind Bank helps you manage personal banking, savings, loans and cards. Sign in to your Northwind account to check balances, pay bills and manage your card.',
    },
    expectedScore: [75, 100],
  },
  {
    id: 'redirect-chain',
    label: 'Short link redirect chain',
    blurb: 'A “claim your bonus” link that bounces through several hosts before landing on a fake rewards form.',
    kind: 'dangerous',
    displayUrl: 'https://northwind-bonus.example/claim',
    targetPath: '/demo-fixtures/claim',
    brand: 'Northwind Bank',
    brandDomain: 'northwind-bank.example',
    highlights: ['Multiple redirect hops', 'Reward-bait copy', 'Credential form at the end'],
    redirects: [
      { url: 'https://northwind-bonus.example/claim', status: 302, location: 'https://track.go.example/r/9f2' },
      { url: 'https://track.go.example/r/9f2', status: 302, location: 'https://northwind-bank-secure.verify-login.example/claim' },
      { url: 'https://northwind-bank-secure.verify-login.example/claim', status: 200 },
    ],
    reference: {
      brand: 'Northwind Bank',
      domain: 'northwind-bank.example',
      title: 'Northwind Bank — Personal banking, loans and support',
      text: 'Northwind Bank helps you manage personal banking, savings, loans and cards. Sign in to your Northwind account to check balances, pay bills and manage your card.',
    },
    expectedScore: [75, 100],
  },
  {
    id: 'brand-clone',
    label: 'Cloned cloud console',
    blurb: 'A pixel-thin clone of Acme Cloud’s session page with the real brand name and a collector form.',
    kind: 'dangerous',
    displayUrl: 'https://acme-cloud-login.example/session',
    targetPath: '/demo-fixtures/clone',
    brand: 'Acme Cloud',
    brandDomain: 'acme-cloud.example',
    highlights: ['Copied brand wording', 'Mismatched domain', 'Form posts elsewhere'],
    reference: {
      brand: 'Acme Cloud',
      domain: 'acme-cloud.example',
      title: 'Acme Cloud — Sign in to your workspace',
      text: 'Acme Cloud keeps your team files, notes and projects in one workspace. Sign in with your Acme ID to open your dashboard, manage members and review activity. Forgot your password? Reset it from the official sign-in page.',
    },
    expectedScore: [75, 100],
  },
  {
    id: 'parked-domain',
    label: 'Parked look-alike',
    blurb: 'An old look-alike domain that now shows a parking page. Not an active attack, but not a place to type anything.',
    kind: 'caution',
    displayUrl: 'https://northwind-refunds.example/',
    targetPath: '/demo-fixtures/parked',
    brand: 'Northwind Bank',
    brandDomain: 'northwind-bank.example',
    highlights: ['Parked page text', 'Brand name in domain', 'No working service'],
    expectedScore: [25, 70],
  },
];

export function findDemoCase(id: string): FixtureCase | undefined {
  return DEMO_CASES.find((item) => item.id === id);
}

export function publicDemoCases(): DemoCase[] {
  return DEMO_CASES.map(({ targetPath: _targetPath, reference: _reference, redirects: _redirects, expectedScore: _expected, ...rest }) => rest);
}
