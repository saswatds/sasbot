# Webhook ingestion container — long-running HTTP server on port 3001
FROM oven/bun:1.3.10 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

FROM oven/bun:1.3.10-slim

WORKDIR /app

COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/ingestion/webhook ./ingestion/webhook
COPY --from=builder --chown=bun:bun /app/package.json ./

USER bun

EXPOSE 3001

CMD ["bun", "run", "ingestion/webhook/index.ts"]
