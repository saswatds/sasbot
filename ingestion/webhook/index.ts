/**
 * sasbot — Webhook ingestion
 *
 * Long-running HTTP server. Receives webhook POSTs and writes payloads
 * into Postgres for the agent to query later.
 */

import pg from 'pg';

const PORT = Number(process.env.PORT || 3001);

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    source TEXT,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response('ok');
    }

    if (req.method === 'POST' && url.pathname === '/webhook') {
      try {
        const body = await req.json();
        const source = req.headers.get('x-source') || url.searchParams.get('source') || 'unknown';
        await pool.query(
          'INSERT INTO webhook_events (source, payload) VALUES ($1, $2)',
          [source, body],
        );
        console.log(`webhook accepted [${source}] ${JSON.stringify(body).slice(0, 120)}`);
        return Response.json({ status: 'accepted' }, { status: 202 });
      } catch (err) {
        console.error('webhook error:', err);
        return Response.json({ error: 'invalid payload' }, { status: 400 });
      }
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  },
});

console.log(`webhook ingestion listening on port ${server.port}`);
