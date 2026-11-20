import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { ReportRecord } from './types.js';

export interface ReportInput {
  url: string;
  host: string;
  verdict: ReportRecord['verdict'];
  score: number;
  note?: string;
}

export interface ReportStore {
  driver: 'turso' | 'local';
  list(): Promise<ReportRecord[]>;
  add(input: ReportInput): Promise<ReportRecord>;
  update(id: string, patch: { status?: ReportRecord['status']; note?: string }): Promise<ReportRecord | null>;
  remove(id: string): Promise<boolean>;
  clear(): Promise<void>;
  findByUrl(url: string): Promise<ReportRecord | null>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const MAX_REPORTS = 500;

class LocalStore implements ReportStore {
  driver = 'local' as const;

  private async read(): Promise<ReportRecord[]> {
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as { reports?: ReportRecord[] };
      return Array.isArray(parsed.reports) ? parsed.reports : [];
    } catch {
      return [];
    }
  }

  private async write(reports: ReportRecord[]): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify({ reports: reports.slice(0, MAX_REPORTS) }, null, 2), 'utf8');
  }

  async list(): Promise<ReportRecord[]> {
    return (await this.read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async add(input: ReportInput): Promise<ReportRecord> {
    const now = new Date().toISOString();
    const record: ReportRecord = {
      id: crypto.randomUUID(),
      url: input.url,
      host: input.host,
      verdict: input.verdict,
      score: input.score,
      status: 'new',
      note: input.note ?? '',
      createdAt: now,
      updatedAt: now,
    };
    const reports = await this.read();
    reports.unshift(record);
    await this.write(reports);
    return record;
  }

  async update(id: string, patch: { status?: ReportRecord['status']; note?: string }): Promise<ReportRecord | null> {
    const reports = await this.read();
    const index = reports.findIndex((report) => report.id === id);
    if (index === -1) return null;
    reports[index] = { ...reports[index], ...patch, updatedAt: new Date().toISOString() };
    await this.write(reports);
    return reports[index];
  }

  async remove(id: string): Promise<boolean> {
    const reports = await this.read();
    const next = reports.filter((report) => report.id !== id);
    if (next.length === reports.length) return false;
    await this.write(next);
    return true;
  }

  async findByUrl(url: string): Promise<ReportRecord | null> {
    const reports = await this.read();
    const report = reports.find((report) => report.url === url);
    return report ?? null;
  }

  async clear(): Promise<void> {
    await this.write([]);
  }
}

class TursoStore implements ReportStore {
  driver = 'turso' as const;
  private clientPromise: Promise<{ execute: (input: { sql: string; args?: unknown[] }) => Promise<unknown> }> | null = null;

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import('@libsql/client/web').then(({ createClient }) => {
        const client = createClient({
          url: process.env.TURSO_DATABASE_URL!,
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        return {
          execute: (input: { sql: string; args?: unknown[] }) =>
            client.execute({ sql: input.sql, args: (input.args ?? []) as never }),
        };
      });
    }
    return this.clientPromise;
  }

  private async ready(): Promise<void> {
    const client = await this.client();
    await client.execute({
      sql: `CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        host TEXT NOT NULL,
        verdict TEXT NOT NULL,
        score INTEGER NOT NULL,
        status TEXT NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    });
  }

  private rowToRecord(row: Record<string, unknown>): ReportRecord {
    return {
      id: String(row.id),
      url: String(row.url),
      host: String(row.host),
      verdict: String(row.verdict) as ReportRecord['verdict'],
      score: Number(row.score),
      status: String(row.status) as ReportRecord['status'],
      note: String(row.note ?? ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async list(): Promise<ReportRecord[]> {
    await this.ready();
    const client = await this.client();
    const result = (await client.execute({
      sql: 'SELECT * FROM reports ORDER BY created_at DESC LIMIT 200',
    })) as { rows: Record<string, unknown>[] };
    return result.rows.map((row) => this.rowToRecord(row));
  }

  async add(input: ReportInput): Promise<ReportRecord> {
    await this.ready();
    const now = new Date().toISOString();
    const record: ReportRecord = {
      id: crypto.randomUUID(),
      url: input.url,
      host: input.host,
      verdict: input.verdict,
      score: input.score,
      status: 'new',
      note: input.note ?? '',
      createdAt: now,
      updatedAt: now,
    };
    const client = await this.client();
    await client.execute({
      sql: 'INSERT INTO reports (id,url,host,verdict,score,status,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [record.id, record.url, record.host, record.verdict, record.score, record.status, record.note, record.createdAt, record.updatedAt],
    });
    return record;
  }

  async update(id: string, patch: { status?: ReportRecord['status']; note?: string }): Promise<ReportRecord | null> {
    await this.ready();
    const client = await this.client();
    const existing = (await client.execute({ sql: 'SELECT * FROM reports WHERE id = ?', args: [id] })) as {
      rows: Record<string, unknown>[];
    };
    if (!existing.rows.length) return null;
    const current = this.rowToRecord(existing.rows[0]);
    const next = {
      status: patch.status ?? current.status,
      note: patch.note ?? current.note,
      updatedAt: new Date().toISOString(),
    };
    await client.execute({
      sql: 'UPDATE reports SET status = ?, note = ?, updated_at = ? WHERE id = ?',
      args: [next.status, next.note, next.updatedAt, id],
    });
    return { ...current, ...next };
  }

  async remove(id: string): Promise<boolean> {
    await this.ready();
    const client = await this.client();
    const result = (await client.execute({ sql: 'DELETE FROM reports WHERE id = ?', args: [id] })) as { rowsAffected?: number };
    return (result.rowsAffected ?? 0) > 0;
  }

  async findByUrl(url: string): Promise<ReportRecord | null> {
    await this.ready();
    const client = await this.client();
    const result = (await client.execute({ sql: 'SELECT * FROM reports WHERE url = ?', args: [url] })) as { rows: Record<string, unknown>[] };
    if (!result.rows.length) return null;
    return {
      id: String(result.rows[0].id),
      url: String(result.rows[0].url),
      host: String(result.rows[0].host),
      verdict: String(result.rows[0].verdict) as ReportRecord['verdict'],
      score: Number(result.rows[0].score),
      status: String(result.rows[0].status) as ReportRecord['status'],
      note: String(result.rows[0].note ?? ''),
      createdAt: String(result.rows[0].created_at),
      updatedAt: String(result.rows[0].updated_at),
    };
  }

  async clear(): Promise<void> {
    await this.ready();
    const client = await this.client();
    await client.execute({ sql: 'DELETE FROM reports' });
  }
}

let store: ReportStore | null = null;

export function getStore(): ReportStore {
  if (!store) {
    store = process.env.TURSO_DATABASE_URL ? new TursoStore() : new LocalStore();
  }
  return store;
}
