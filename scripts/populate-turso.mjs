#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const FEEDS_PATH = path.resolve(process.cwd(), 'server/data/feeds.json');
const DB_URL = process.env.TURSO_DATABASE_URL;
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!DB_URL || !DB_TOKEN) {
  console.error('ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env');
  process.exit(1);
}

async function main() {
  console.log('Loading feeds from', FEEDS_PATH);
  const raw = await fs.readFile(FEEDS_PATH, 'utf8');
  const feeds = JSON.parse(raw);

  const domains = feeds.domains || [];
  const urls = feeds.urls || [];
  const sources = feeds.sources || [];

  console.log('Found', domains.length, 'domains and', urls.length, 'urls from', sources.length, 'sources');

  if (domains.length === 0 && urls.length === 0) {
    console.error('No domains or URLs found in feeds.json');
    process.exit(1);
  }

  // Use the @libsql/client to connect
  import('@libsql/client/web').then(async ({ createClient }) => {
    try {
      const client = createClient({
        url: DB_URL,
        authToken: DB_TOKEN,
      });

      // Create table if not exists
      await client.execute({
        sql: "CREATE TABLE IF NOT EXISTS phishing_urls (id TEXT PRIMARY KEY, url TEXT, domain TEXT NOT NULL, source_id TEXT NOT NULL, source_name TEXT NOT NULL, feed_type TEXT NOT NULL, inserted_at TEXT NOT NULL)"
      });

      console.log('Table phishing_urls ensured.');

      // Insert domains one by one (or in very small batches)
      if (domains.length > 0) {
        const now = new Date().toISOString();
        let inserted = 0;
        
        for (let d of domains) {
          await client.execute({
            sql: "INSERT INTO phishing_urls (id, url, domain, source_id, source_name, feed_type, inserted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            args: [crypto.randomUUID(), '', d, sources[0]?.id || 'unknown', sources[0]?.name || 'unknown', 'domain', now]
          });
          inserted++;
          if (inserted % 100 === 0) {
            console.log('Inserted', inserted, '/', domains.length, 'domains');
          }
        }
        console.log('Inserted', domains.length, 'domains');
      }

      // Insert URLs one by one
      if (urls.length > 0) {
        const now = new Date().toISOString();
        let inserted = 0;
        
        for (let u of urls) {
          await client.execute({
            sql: "INSERT INTO phishing_urls (id, url, domain, source_id, source_name, feed_type, inserted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            args: [crypto.randomUUID(), u, '', sources[0]?.id || 'unknown', sources[0]?.name || 'unknown', 'url', now]
          });
          inserted++;
          if (inserted % 100 === 0) {
            console.log('Inserted', inserted, '/', urls.length, 'urls');
          }
        }
        console.log('Inserted', urls.length, 'urls');
      }

      // Verify count
      const result = await client.execute({ sql: 'SELECT COUNT(*) as cnt FROM phishing_urls' });
      const row = result.rows[0];
      const count = row && row.cnt !== undefined ? Number(row.cnt) : (Array.isArray(row) ? Number(row[0]) : 0);
      console.log('Total rows in phishing_urls:', count);

    } catch (error) {
      console.error('Error populating Turso:', error);
    }
  }).catch(err => {
    console.error('Failed to import libsql client:', err);
  });
}

main();