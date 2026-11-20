import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { runScan } from './engine/pipeline.js';
import { SafetyError } from './engine/safeFetch.js';
import { loadFeeds } from './engine/feeds.js';
import { publicDemoCases } from './fixtures/index.js';
import { FIXTURE_PAGES } from './fixtures/html.js';
import { getStore } from './store.js';
import { normalizeInputUrl } from './engine/utils.js';
import type { ReportRecord } from './types.js';

const scanSchema = z
  .object({
    url: z.string().trim().max(2048).optional(),
    brand: z.string().trim().max(253).optional(),
    demoCase: z.string().trim().max(60).optional(),
  })
  .refine((value) => Boolean(value.url || value.demoCase), {
    message: 'Provide a url or a demoCase.',
    path: ['url'],
  })
  .superRefine((value, ctx) => {
    if (!value.url || value.demoCase) return;
    try {
      normalizeInputUrl(value.url);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: error instanceof Error ? error.message : 'That does not look like a valid link.',
      });
    }
  });

const reportSchema = z.object({
  url: z.string().trim().min(4).max(2048),
  host: z.string().trim().min(1).max(253),
  verdict: z.enum(['safe', 'caution', 'suspicious', 'dangerous']),
  score: z.number().int().min(0).max(100),
  note: z.string().max(1200).optional(),
});

const reportPatchSchema = z.object({
  status: z.enum(['new', 'reviewing', 'confirmed', 'false_positive']).optional(),
  note: z.string().max(1200).optional(),
});

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
          'font-src': ["'self'"],
          'connect-src': ["'self'"],
          'form-action': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'object-src': ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  const scanLimiter = rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { message: 'Too many scans in a minute. Give the engine a moment to breathe.' } },
  });
  const reportLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { message: 'Too many report actions. Try again in a minute.' } },
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), version: '1.0.0' });
  });

  app.get('/api/meta', async (_req, res) => {
    const feeds = await loadFeeds();
    res.json({
      version: '1.0.0',
      store: getStore().driver,
      feeds: {
        loaded: feeds.loaded,
        generatedAt: feeds.db.generatedAt,
        domains: feeds.db.domains.length,
        urls: feeds.db.urls.length,
        sources: feeds.db.sources,
      },
      demoCases: publicDemoCases(),
    });
  });

  app.get('/api/demo/cases', (_req, res) => {
    res.json({ cases: publicDemoCases() });
  });

  app.post('/api/scan', scanLimiter, async (req, res, next) => {
    try {
      const parsed = scanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { message: parsed.error.issues[0]?.message ?? 'Invalid request.' } });
        return;
      }
      const url = parsed.data.url!;
      // Fallback: check if this URL has already been scanned and stored
      const existing = await getStore().findByUrl(url);
      if (existing) {
        res.json({ fromCache: true, ...existing });
        return;
      }
      const result = await runScan(parsed.data);
      // Store the new scan result in the database for future fallbacks
      await getStore().add({
        url,
        host: new URL(url).hostname,
        verdict: result.verdict,
        score: result.score,
        note: '',
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/scan/stream', scanLimiter, async (req, res, next) => {
    const parsed = scanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: parsed.error.issues[0]?.message ?? 'Invalid request.' } });
      return;
    }
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const send = (payload: unknown) => {
      if (closed) return;
      try {
        res.write(`${JSON.stringify(payload)}\n`);
      } catch {
        closed = true;
      }
    };

    try {
      const result = await runScan({
        ...parsed.data,
        emit: (log) => send({ type: 'log', log }),
      });
      send({ type: 'result', result });
      res.end();
    } catch (error) {
      if (error instanceof SafetyError) {
        send({ type: 'error', error: { message: error.message, code: 'blocked_target' } });
        res.end();
        return;
      }
      const message = error instanceof Error ? error.message : 'Scan failed.';
      send({ type: 'error', error: { message, code: 'scan_failed' } });
      res.end();
      if (!res.headersSent) next(error);
    }
  });

  app.get('/api/reports', async (_req, res, next) => {
    try {
      res.json({ reports: await getStore().list() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/reports', reportLimiter, async (req, res, next) => {
    try {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { message: parsed.error.issues[0]?.message ?? 'Invalid report.' } });
        return;
      }
      const report = await getStore().add(parsed.data);
      res.status(201).json({ report });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/reports/:id', reportLimiter, async (req, res, next) => {
    try {
      const parsed = reportPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: { message: 'Invalid review update.' } });
        return;
      }
      const report = await getStore().update(String(req.params.id), parsed.data as { status?: ReportRecord['status']; note?: string });
      if (!report) {
        res.status(404).json({ error: { message: 'Report not found.' } });
        return;
      }
      res.json({ report });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/reports/:id', reportLimiter, async (req, res, next) => {
    try {
      const removed = await getStore().remove(String(req.params.id));
      if (!removed) {
        res.status(404).json({ error: { message: 'Report not found.' } });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/reports', reportLimiter, async (_req, res, next) => {
    try {
      await getStore().clear();
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  if (process.env.DEMO_FIXTURES !== '0') {
    app.get('/demo-fixtures', (_req, res) => {
      res.type('html').send(
        `<!doctype html><meta charset="utf-8"><title>BlueHats demo fixtures</title><body style="font-family:system-ui;padding:32px;background:#f4eadd;color:#0f4c48"><h1>BlueHats demo fixtures</h1><p>Safe local pages for scanner testing. Fictional brands only.</p><ul>${Object.keys(
          FIXTURE_PAGES,
        )
          .map((name) => `<li><a href="/demo-fixtures/${name}">/demo-fixtures/${name}</a></li>`)
          .join('')}</ul></body>`,
      );
    });
    app.get('/demo-fixtures/go/:step', (req, res) => {
      const step = Number(req.params.step);
      const next = step === 1 ? 'claim' : 'typosquat';
      res.redirect(302, `/demo-fixtures/${next}`);
    });
    app.get('/demo-fixtures/:name', (req, res) => {
      const page = FIXTURE_PAGES[req.params.name];
      if (!page) {
        res.status(404).type('text').send('Unknown demo fixture.');
        return;
      }
      res.type('html').send(page());
    });
  }

  const dist = path.resolve(process.cwd(), 'dist');
  if (!process.env.VERCEL && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(
      express.static(dist, {
        index: 'index.html',
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.get(/^\/(?!api\/|demo-fixtures\/).*/, (req, res) => {
      if (!req.accepts('html')) {
        res.status(404).json({ error: { message: 'Not found.' } });
        return;
      }
      const notFound = path.join(dist, '404.html');
      if (fs.existsSync(notFound) && req.path !== '/') {
        res.status(404).sendFile(notFound);
        return;
      }
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Not found.' } });
  });

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof SafetyError) {
      res.status(400).json({ error: { message: error.message, code: 'blocked_target' } });
      return;
    }
    const status = (error as Error & { status?: number }).status;
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ error: { message: error.message } });
      return;
    }
    console.error('[bluehats]', error);
    res.status(500).json({ error: { message: 'Something went wrong while scanning. Try again.' } });
  });

  return app;
}
