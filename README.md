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
