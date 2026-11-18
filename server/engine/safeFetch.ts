import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import type { RedirectHop } from '../types.js';
import { isIpHost, isPublicIp } from './utils.js';

export class SafetyError extends Error {
  readonly code = 'blocked_target';
}

export interface FetchOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
  allowPrivate?: boolean;
  method?: 'GET' | 'HEAD';
}

export interface FetchResult {
  finalUrl: string;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  hops: RedirectHop[];
  contentType: string;
  truncated: boolean;
}

const USER_AGENT =
  'BlueHatsScanner/1.0 (defensive phishing analysis; +https://bluehats-scanner.vercel.app)';

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 5500;
const MAX_BYTES = 1_400_000;

async function resolvePinned(host: string, allowPrivate: boolean): Promise<{ address: string; family: number }> {
  const bare = host.replace(/^\[|\]$/g, '');
  if (isIpHost(bare)) {
    if (!allowPrivate && !isPublicIp(bare)) {
      throw new SafetyError(`Refusing to connect to a private or reserved address (${bare}).`);
    }
    return { address: bare, family: bare.includes(':') ? 6 : 4 };
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(bare, { all: true, verbatim: true });
  } catch {
    throw new SafetyError(`Could not resolve ${bare}.`);
  }
  if (!addresses.length) throw new SafetyError(`Could not resolve ${bare}.`);
  if (!allowPrivate) {
    const blocked = addresses.find((entry) => !isPublicIp(entry.address));
    if (blocked) {
      throw new SafetyError(
        `Refusing to connect: ${bare} resolves to a private or reserved address (${blocked.address}).`,
      );
    }
  }
  return addresses[0];
}

export async function safeFetch(input: string, options: FetchOptions = {}): Promise<FetchResult> {
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  const hops: RedirectHop[] = [];
  let current = input;
  let method = options.method ?? 'GET';

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    const url = new URL(current);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new SafetyError('Only http and https targets can be fetched.');
    }
    const pinned = await resolvePinned(url.hostname, options.allowPrivate === true);
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
    if (!options.allowPrivate && port !== 80 && port !== 443) {
      throw new SafetyError(`Refusing to connect to non-standard port ${port}.`);
    }

    const client = url.protocol === 'https:' ? https : http;
    const response = await new Promise<{
      status: number;
      headers: http.IncomingHttpHeaders;
      body: Buffer;
      truncated: boolean;
    }>((resolve, reject) => {
      const request = client.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port,
          path: `${url.pathname}${url.search}`,
          method,
          headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.2',
            'accept-encoding': 'identity',
            'accept-language': 'en',
            connection: 'close',
          },
          lookup: (_hostname, options, callback) => {
            if (options && typeof options === 'object' && (options as { all?: boolean }).all) {
              (callback as unknown as (error: null, addresses: { address: string; family: number }[]) => void)(null, [
                { address: pinned.address, family: pinned.family },
              ]);
              return;
            }
            (callback as unknown as (error: null, address: string, family: number) => void)(
              null,
              pinned.address,
              pinned.family,
            );
          },
          servername: url.hostname,
        } as https.RequestOptions,
        (res) => {
          const status = res.statusCode ?? 0;
          const headers = res.headers;
          const encoding = String(headers['content-encoding'] ?? '').toLowerCase();
          let stream: NodeJS.ReadableStream = res;
          if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
          else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
          else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

          const chunks: Buffer[] = [];
          let total = 0;
          let truncated = false;

          stream.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total <= maxBytes) chunks.push(chunk);
            else {
              truncated = true;
              res.destroy();
            }
          });
          stream.on('end', () => resolve({ status, headers, body: Buffer.concat(chunks), truncated }));
          stream.on('error', (error) => reject(error));
        },
      );
      request.setTimeout(timeoutMs, () => request.destroy(new Error('Request timed out')));
      request.on('error', (error) => reject(error));
      request.end();
    });

    const location = response.headers.location;
    hops.push({
      url: safeDisplayUrl(current),
      status: response.status,
      location: typeof location === 'string' ? safeDisplayUrl(new URL(location, current).toString()) : undefined,
    });

    if (response.status >= 300 && response.status < 400 && location) {
      if (redirect === maxRedirects) break;
      current = new URL(String(location), current).toString();
      if (response.status === 303) method = 'GET';
      continue;
    }

    const charset = /charset=([\w-]+)/i.exec(String(response.headers['content-type'] ?? ''))?.[1];
    const body = response.body.toString(charset === 'iso-8859-1' ? 'latin1' : 'utf8');
    return {
      finalUrl: current,
      status: response.status,
      headers: response.headers,
      body,
      hops,
      contentType: String(response.headers['content-type'] ?? ''),
      truncated: response.truncated,
    };
  }

  throw new Error('Too many redirects.');
}

function safeDisplayUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return value;
  }
}

export async function assertPublicTarget(host: string): Promise<{ address: string; family: number }> {
  return resolvePinned(host, false);
}
