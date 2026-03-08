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
 *   NEO4J_HOST - injected by neo4j knowledge store host
 *   NEO4J_PORT - injected by neo4j knowledge store port
 *   NEO4J_URL - injected by neo4j knowledge store URL
 *   OLLAMA_BASE_URL - injected by ollama model base URL
 *   OLLAMA_HOST - injected by ollama model host
 *   OLLAMA_MODEL - injected by ollama model model name
 *   OLLAMA_PORT - injected by ollama model port
 *   OLLAMA_URL - injected by ollama model URL
 *   QDRANT_HOST - injected by qdrant knowledge store host
 *   QDRANT_PORT - injected by qdrant knowledge store port
 *   QDRANT_URL - injected by qdrant knowledge store URL
 */

import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { serve } from '@astropods/adapter-mastra';
import { createOllama } from 'ollama-ai-provider-v2';
import { CloudflareVoice } from '@mastra/voice-cloudflare';

// Tools
import { saveNote, searchNotes, listNotes } from './tools/notes';
import { addTask, listTasks, completeTask } from './tools/tasks';
import { setReminder, listReminders } from './tools/reminders';
import { webSearch, fetchUrl } from './tools/web';
import { githubNotifications, githubPrs, githubIssues } from './tools/github';
import { currentDatetime } from './tools/datetime';
import { semanticSearch, ingestDocument } from './tools/knowledge';
import { addEntity, addRelationship, queryGraph, searchGraph } from './tools/graph';
import { ensureCollection } from './lib/qdrant';

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
- **Knowledge (Qdrant)**: Semantic search over ingested documents and store new knowledge
- **Graph (Neo4j)**: Add entities, relationships, and query the knowledge graph

## Behavior Guidelines
- When asked for a summary or status update, pull from multiple sources (tasks, reminders, GitHub notifications).
- For tasks with due dates, use the current_datetime tool to reason about relative dates ("tomorrow", "next week").
- When setting reminders, convert relative times to absolute ISO timestamps using the current time above.
- Use semantic-search to find relevant knowledge before answering factual questions.
- Use the graph tools to track entities and relationships Saswat mentions (people, projects, tools, etc.).
- Keep responses focused and actionable. Use bullet points for lists.
- If a tool errors (e.g., missing API key), tell Saswat plainly what's not configured.`;

const agent = new Agent({
  id: 'sasbot',
  name: 'Sasbot',
  instructions: systemPrompt,
  model: createOllama({
    baseURL: process.env.OLLAMA_BASE_URL,
  })('qwen3.5:2b'),
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
    semanticSearch,
    ingestDocument,
    addEntity,
    addRelationship,
    queryGraph,
    searchGraph,
  },
});

// Ensure Qdrant collection exists, then serve
ensureCollection()
  .then(() => serve(agent))
  .catch((err) => {
    console.error('Failed to initialize Qdrant collection, starting without it:', err.message);
    serve(agent);
  });
