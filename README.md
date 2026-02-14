# sasbot

An AI-powered agent

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
│   └── index.ts          # Data ingestion pipeline
├── astro.yml             # Agent specification
├── Dockerfile            # Agent container
├── Dockerfile.ingestion  # Ingestion container
├── .env                  # Environment variables (not committed)
└── package.json
```

## Configuration

The agent is configured in `astro.yml`. Key sections:

### Integrations

| Integration | Type | Environment variable |
|------------|------|---------------------|
| Anthropic | Model API | `ANTHROPIC_API_KEY` |

### Knowledge stores
- **Redis** — key-value store for caching and fast lookups

### Interfaces
- **Web** — HTTP/SSE endpoint (playground available at `localhost:3000` during dev)
- **Slack** — bot integration via Socket Mode

### Ingestion

Data pipeline triggered via **webhook**. Edit `ingestion/index.ts` to define how data flows into your knowledge stores.

