/**
 * sasbot — Schedule ingestion
 *
 * Runs on cron / manual trigger (`ast project trigger schedule`).
 * Use for periodic data pulls — e.g. fetching GitHub notifications,
 * RSS feeds, or syncing external state into Postgres.
 */

import pg from 'pg';

async function recordRun() {
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
      ['schedule', JSON.stringify({ at: new Date().toISOString() })],
    );
    console.log('✓ schedule ingestion: run recorded');
  } finally {
    await client.end();
  }
}

await recordRun();
console.log('schedule ingestion complete');
