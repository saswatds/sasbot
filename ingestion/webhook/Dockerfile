# Ingestion container — webhook
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json .npmrc ./
RUN bun install

# Copy ingestion source
COPY ingestion/webhook ./ingestion/webhook

# Runtime stage
FROM oven/bun:1-slim

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/ingestion/webhook ./ingestion/webhook
COPY --from=builder /app/package.json ./

# Use non-root user already present in oven/bun image (bun:1000)
RUN chown -R bun:bun /app
USER bun

# Run the ingestion script
CMD ["bun", "run", "ingestion/webhook/index.ts"]
