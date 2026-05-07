/**
 * sasbot — Startup ingestion
 *
 * Runs once when the agent starts. Use this for one-shot setup tasks like
 * schema migrations, cache warming, or seeding initial data.
 */

import pg from 'pg';
import Redis from 'ioredis';

async function ensureSchema() {
  const client = new pg.Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id SERIAL PRIMARY KEY,
        kind TEXT NOT NULL,
        ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        details JSONB
      )
    `);
    await client.query(
      'INSERT INTO ingestion_runs (kind, details) VALUES ($1, $2)',
      ['startup', JSON.stringify({ pid: process.pid })],
    );
    console.log('✓ startup ingestion: schema ensured, run recorded');
  } finally {
    await client.end();
  }
}

async function pingCache() {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });
  await redis.connect();
  await redis.set('sasbot:last_startup', new Date().toISOString());
  await redis.quit();
  console.log('✓ startup ingestion: cache primed');
}

await ensureSchema();
await pingCache();
console.log('startup ingestion complete');
