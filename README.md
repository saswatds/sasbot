# sasbot

A personal assistant bot that helps with daily tasks and assistance

## Quick start

```bash
# Install dependencies
bun install

# Start the agent locally
ast dev
```

## Project structure

```
sasbot/
├── agent/
│   └── index.ts          # Agent entry point
├── ingestion/
│   ├── webhook/
│   │   ├── index.ts      # webhook ingestion pipeline
│   │   └── Dockerfile
├── astropods.yml             # Agent specification
├── Dockerfile            # Agent container
├── .env                  # Environment variables (set via ast configure; not committed)
└── package.json
```

## Configuration

The agent is configured in `astropods.yml`. Key sections:

### Model

Self-hosted **ollama** provider running `qwen3.5:2b`.

### Integrations

| Integration | Type      | Environment variable |
| ----------- | --------- | -------------------- |
| Anthropic   | Model API | `ANTHROPIC_API_KEY`  |
| GitHub      | Tool      | `GITHUB_TOKEN`       |

### Knowledge stores
- **Qdrant** — vector store for semantic search and embeddings
- **Neo4j** — graph database for relationship data

### Interfaces
- **Web** — HTTP/SSE endpoint (playground available at `localhost:3000` during dev)
- **Slack** — bot integration via Socket Mode

### Ingestion

Data pipeline triggered via **webhook**. Edit `ingestion/index.ts` to define how data flows into your knowledge stores.

## Sandbox

Each conversation gets its own Linux machine, an Astro sandbox, wired in as a
Mastra workspace (`agent/lib/sandbox.ts`). The agent passes `workspace` to the
`Agent` constructor and Mastra injects its own workspace tools at execution
time: `execute_command`, `get_process_output`, `kill_process`, and
`lsp_inspect`. Files are read and written through the shell.

The sandbox is named after the thread, so a conversation that resumes finds
its own files and no other conversation can see them. That name comes from
`threadId` on the request context, which the messaging adapter sets from the
conversation id.

With no `ASTRO_AUTHZ_TOKEN` or no thread id, `workspaceFor` returns
`undefined` and the agent runs with its other tools rather than failing. That
is the local `bun dev` case.

### Testing it

Message sasbot, one per conversation so you can see isolation:

| Ask | Proves |
|---|---|
| "run `uname -a` in your sandbox" | The machine is real and arm64 |
| "write hello to /tmp/note.txt, then read it back" | Files work, and round-trip |
| "start `sleep 60` in the background, then check on it" | Background processes, poll and status |
| "what files are in /tmp?" | `ls` through `execute_command` |
| Ask in a *second* conversation: "read /tmp/note.txt" | It should not exist. Two threads, two machines |

To see it end to end, watch the control plane while you do the above:

```sh
kubectl --context preview-primary -n astro-server \
  logs deploy/astro-server -f | grep sandboxes
```

An attach appears as `PUT /api/v1/sandboxes/sasbot-<thread>`. The first one
launches a MicroVM, later ones reuse or resume it.
