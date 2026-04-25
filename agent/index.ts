/**
 * sasbot - A personal assistant bot that helps with daily tasks and assistance
 *
 * This agent uses Mastra's Agent class with the Astro adapter to connect
 * to the Astro messaging service via gRPC.
 *
 * Environment variables (automatically injected by 'astro dev'):
 *   ANTHROPIC_API_KEY - injected by anthropic model
 *   GITHUB_TOKEN - injected by github tool
 *   GRPC_SERVER_ADDR - injected by Astro messaging service
 */

import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { serve } from '@astropods/adapter-mastra';
import { CloudflareVoice } from '@mastra/voice-cloudflare';
import pg from 'pg';
import { getRedis } from './lib/redis';

// Tools
import { saveNote, searchNotes, listNotes } from './tools/notes';
import { addTask, listTasks, completeTask } from './tools/tasks';
import { setReminder, listReminders } from './tools/reminders';
import { webSearch, fetchUrl } from './tools/web';
import { githubNotifications, githubPrs, githubIssues } from './tools/github';
import { currentDatetime } from './tools/datetime';

const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'ASTRO_AGENT_HOST',
  'ASTRO_AGENT_URL',
  'ASTRO_AGENT_BUILD',
  'ASTRO_AGENT_NAME',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_AI_API_KEY',
  'GITHUB_TOKEN',
  'GRPC_SERVER_ADDR',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'POSTGRES_DB',
  'POSTGRES_HOST',
  'POSTGRES_PASSWORD',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_USERS_DB',
  'POSTGRES_USERS_HOST',
  'POSTGRES_USERS_PASSWORD',
  'POSTGRES_USERS_PORT',
  'POSTGRES_USERS_USER',
  'REDIS_HOST',
  'REDIS_PASSWORD',
  'REDIS_PORT',
  'REDIS_URL',
];

for (const name of requiredEnvVars) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const voice = new CloudflareVoice({
  listeningModel: {
    apiKey: process.env.CLOUDFLARE_AI_API_KEY,
    model: '@cf/openai/whisper-tiny-en',
    account_id: process.env.CLOUDFLARE_ACCOUNT_ID,
  },
});

const memory = new Memory({
  storage: new LibSQLStore({
    id: 'memory',
    url: ':memory:',
  }),
});

const now = new Date();
const systemPrompt = `You are sasbot, Saswat's personal productivity agent.

## Identity & Tone
- You are concise, direct, and no-fluff. Saswat values efficiency.
- You have a dry sense of humor but keep it brief.
- When in doubt, do the useful thing rather than asking for clarification.

## Current Context
- Date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
- Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

## Capabilities
You have tools for:
- **Notes**: Save, search, and list personal notes (Redis-backed)
- **Tasks**: Add, list, and complete tasks with priority and due dates
- **Reminders**: Set timed reminders that fire proactively
- **Web**: Search the web (Brave Search) and fetch URL content
- **GitHub**: Check notifications, list PRs, and search issues
- **DateTime**: Get current date/time for time-based reasoning

## Behavior Guidelines
- When asked for a summary or status update, pull from multiple sources (tasks, reminders, GitHub notifications).
- For tasks with due dates, use the current_datetime tool to reason about relative dates ("tomorrow", "next week").
- When setting reminders, convert relative times to absolute ISO timestamps using the current time above.
- Keep responses focused and actionable. Use bullet points for lists.
- If a tool errors (e.g., missing API key), tell Saswat plainly what's not configured.`;

const agent = new Agent({
  id: 'sasbot',
  name: 'Sasbot',
  instructions: systemPrompt,
  model: 'anthropic/claude-sonnet-4-20250514',
  memory,
  voice,
  tools: {
    saveNote,
    searchNotes,
    listNotes,
    addTask,
    listTasks,
    completeTask,
    setReminder,
    listReminders,
    webSearch,
    fetchUrl,
    githubNotifications,
    githubPrs,
    githubIssues,
    currentDatetime,
  },
});

async function checkPostgres(name: string, prefix: string) {
  const host = process.env[`${prefix}_HOST`];
  const port = process.env[`${prefix}_PORT`];
  const user = process.env[`${prefix}_USER`];
  const password = process.env[`${prefix}_PASSWORD`];
  const database = process.env[`${prefix}_DB`];
  if (!host) {
    console.warn(`⚠ Postgres [${name}] — ${prefix}_HOST not set, skipping`);
    return;
  }
  const client = new pg.Client({
    host,
    port: port ? parseInt(port, 10) : 5432,
    user,
    password,
    database,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT NOW() AS time');
    console.log(`✓ Postgres [${name}] connected — ${host}:${port}/${database} — server time: ${res.rows[0].time}`);
  } catch (err: any) {
    console.error(`✗ Postgres [${name}] failed — ${host}:${port}/${database} — ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkRedis() {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || '6379';
  const redis = new (await import('ioredis')).default({
    host,
    port: parseInt(port, 10),
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 5000,
    maxRetriesPerRequest: 0,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    console.log(`✓ Redis [cache] connected — ${host}:${port} — PING ${pong}`);
  } catch (err: any) {
    console.error(`✗ Redis [cache] failed — ${host}:${port} — ${err.message}`);
  } finally {
    await redis.disconnect().catch(() => {});
  }
}

async function checkConnections() {
  console.log('Checking service connections...');
  await Promise.allSettled([
    checkPostgres('postgres', 'POSTGRES'),
    checkPostgres('users', 'POSTGRES_USERS'),
    checkRedis(),
  ]);
}

await checkConnections();
serve(agent);
