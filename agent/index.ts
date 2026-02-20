/**
 * sasbot - Saswat's personal productivity agent
 *
 * Environment variables (automatically injected by 'astro dev'):
 *   GRPC_SERVER_ADDR - Messaging service address (default: localhost:9090)
 *   ANTHROPIC_API_KEY - Anthropic API key for Claude models
 *   REDIS_HOST / REDIS_PORT / REDIS_URL - Redis connection
 *   BRAVE_SEARCH_API_KEY - Brave Search API key
 *   GITHUB_TOKEN - GitHub personal access token
 */

import { AstroAgent } from '@saswatds/astro-agent';
import type { AgentStep } from '@saswatds/astro-types';
import {
  MessagingClient,
  type AgentConfig,
  type AgentResponse,
  type Message,
} from '@astromode-ai/astro-messaging';

// Tools
import { saveNote, searchNotes, listNotes } from './tools/notes';
import { addTask, listTasks, completeTask } from './tools/tasks';
import { setReminder, listReminders, initReminders } from './tools/reminders';
import { webSearch, fetchUrl } from './tools/web';
import { githubNotifications, githubPrs, githubIssues } from './tools/github';
import { currentDatetime } from './tools/datetime';

const AGENT_NAME = 'sasbot';
const GRPC_SERVER_ADDR = process.env.GRPC_SERVER_ADDR || 'localhost:9090';

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

// Configure the agent with all tools
const agent = new AstroAgent()
  .meta({ title: 'sasbot', description: "Saswat's personal productivity agent" })
  .model('ollama/qwen2.5:1.5b')
  .instructions(systemPrompt)
  .tool({ type: 'graph', graph: saveNote })
  .tool({ type: 'graph', graph: searchNotes })
  .tool({ type: 'graph', graph: listNotes })
  .tool({ type: 'graph', graph: addTask })
  .tool({ type: 'graph', graph: listTasks })
  .tool({ type: 'graph', graph: completeTask })
  .tool({ type: 'graph', graph: setReminder })
  .tool({ type: 'graph', graph: listReminders })
  .tool({ type: 'graph', graph: webSearch })
  .tool({ type: 'graph', graph: fetchUrl })
  .tool({ type: 'graph', graph: githubNotifications })
  .tool({ type: 'graph', graph: githubPrs })
  .tool({ type: 'graph', graph: githubIssues })
  .tool({ type: 'graph', graph: currentDatetime });

// Create the messaging client
const client = new MessagingClient(GRPC_SERVER_ADDR);

async function main() {
  console.log('🚀 Starting ' + AGENT_NAME + '...');
  console.log('   gRPC Server:', GRPC_SERVER_ADDR);

  // Connect to the messaging service
  console.log('📡 Connecting to messaging service...');
  await client.connect();
  console.log('✓ Connected');

  // Check service health
  const health = await client.healthCheck();
  console.log('✓ Service health:', health.status);

  // Create a bidirectional conversation stream
  console.log('🌊 Creating conversation stream...');
  const stream = client.createConversationStream();

  // Initialize reminders with a message sender bound to the stream
  initReminders((content: string) => {
    stream.sendMessage({
      conversationId: 'proactive',
      platform: 'grpc',
      content,
      user: {
        id: AGENT_NAME.toLowerCase(),
        username: AGENT_NAME,
      },
    });
  });

  // Send agent config so the playground can display it
  stream.sendAgentConfig(agent.getConfig() as AgentConfig);
  console.log('✓ Agent config sent');

  // Handle incoming messages
  stream.on('response', async (response: AgentResponse) => {
    const message = (response as { incomingMessage?: Message }).incomingMessage;
    if (!message) return;

    const username = message.user?.username || message.user?.id || 'Anonymous User';
    console.log(`📨 ${username}: ${message.content}`);

    // Signal start of streaming response
    stream.sendContentChunk(message.conversationId, { type: 'START', content: '' });

    agent.stream({
      prompt: message.content,
      threadId: message.conversationId,
      userId: message.user?.id ?? 'anonymous',
      onReasoningStart: () => {
        stream.sendStatusUpdate(message.conversationId, { status: 'THINKING' });
      },
      onReasoningEnd: () => {
        stream.sendStatusUpdate(message.conversationId, { status: 'GENERATING' });
      },
      onStepStart: (step: AgentStep) => {
        stream.sendStatusUpdate(message.conversationId, {
          status: 'PROCESSING',
          customMessage: `Running ${step.name}`,
          emoji: '🔧',
        });
      },
      onStepEnd: (step: AgentStep) => {
        stream.sendStatusUpdate(message.conversationId, {
          status: 'ANALYZING',
          customMessage: `Finished ${step.name}`,
        });
      },
      onChunk: (chunk: string) => {
        stream.sendContentChunk(message.conversationId, { type: 'DELTA', content: chunk });
      },
      onFinish: (result: string) => {
        stream.sendContentChunk(message.conversationId, { type: 'END', content: '' });
        console.log('📤 Response sent');
      },
      onError: (error: Error) => {
        console.error('❌ Error handling message:', error);
      },
    });
  });

  stream.on('error', (error: Error) => {
    console.error('❌ Stream error:', error);
  });

  stream.on('end', () => {
    console.log('Stream ended');
  });

  // Register the agent
  console.log('📝 Registering agent...');
  stream.sendMessage({
    conversationId: 'agent-registration',
    platform: 'grpc',
    content: 'Agent ready',
    user: {
      id: AGENT_NAME.toLowerCase(),
      username: AGENT_NAME,
    },
  });

  console.log('✅ ' + AGENT_NAME + ' is ready and listening for messages!\n');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  client.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  client.close();
  process.exit(0);
});

// Start the agent
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
