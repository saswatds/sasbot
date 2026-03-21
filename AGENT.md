---
description: A personal productivity agent that manages notes, tasks, reminders, and knowledge
tags:
  - productivity
  - personal-assistant
  - knowledge-management
  - task-management
authors:
  - name: Saswat
capabilities:
  - Save and search personal notes
  - Manage tasks with priorities and due dates
  - Set and list reminders
  - Search the web and fetch URLs
  - Query GitHub notifications, PRs, and issues
  - Ingest documents and perform semantic search
  - Build and query a knowledge graph
integrations:
  - github
  - cloudflare
---

# sasbot

A personal productivity agent that manages notes, tasks, reminders, and knowledge. Built with [Mastra](https://mastra.ai) and deployed via [Astropods](https://astropods.ai).

## What it does

sasbot acts as a personal assistant that can:

- **Take and retrieve notes** — save freeform notes and search them later by keyword or meaning
- **Manage tasks** — create tasks with priorities and due dates, list them, and mark them complete
- **Set reminders** — schedule timed reminders so nothing falls through the cracks
- **Search the web** — look things up via Brave Search or fetch the contents of a URL
- **Monitor GitHub** — check notifications, review open PRs, and browse issues across your repositories
- **Build a knowledge base** — ingest documents for semantic search and maintain a knowledge graph of entities and relationships
- **Understand voice messages** — transcribe audio input via Cloudflare Workers AI (Whisper)

## How to use it

Send sasbot natural language messages. It determines which tools to use based on your request.

- "Save a note: the deploy key rotates every 90 days"
- "What were my notes about deploy keys?"
- "Add a task to update the API docs, due Friday, high priority"
- "What's on my task list?"
- "Set a reminder to check CI in 30 minutes"
- "What are my GitHub notifications?"
- "Show me open PRs on sasbot"
- "Search the web for Bun 1.2 release notes"
- "What do I know about the onboarding flow?" (semantic search over ingested documents)

Voice messages are automatically transcribed and handled as text.

## Limitations

- Notes, tasks, and reminders are personal to a single user — there is no multi-user or sharing support
- Reminders are best-effort and depend on the agent process being available at trigger time
- Semantic search quality depends on the configured embedding model and the documents that have been ingested
- GitHub access is scoped to the permissions of the configured token
- Voice transcription requires a Cloudflare Workers AI key and is limited to supported audio formats
