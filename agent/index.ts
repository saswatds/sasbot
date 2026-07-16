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

import { serveFrontend } from './frontend';

import { astroGateway } from './lib/astro-gateway';

// Tools
import { saveNote, searchNotes, listNotes } from './tools/notes';
import { addTask, listTasks, completeTask } from './tools/tasks';
import { setReminder, listReminders } from './tools/reminders';
import { webSearch, fetchUrl } from './tools/web';
import { githubNotifications, githubPrs, githubIssues } from './tools/github';
import { currentDatetime } from './tools/datetime';

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
  model: astroGateway('claude-sonnet-4-6'),
  memory,
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

serve(agent);
serveFrontend();
