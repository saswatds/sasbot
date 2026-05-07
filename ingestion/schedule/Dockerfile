# Schedule ingestion container — runs on cron / manual trigger
FROM oven/bun:1.3.10 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

FROM oven/bun:1.3.10-slim

WORKDIR /app

COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/ingestion/schedule ./ingestion/schedule
COPY --from=builder --chown=bun:bun /app/package.json ./

USER bun

CMD ["bun", "run", "ingestion/schedule/index.ts"]
