# Build stage
FROM oven/bun:1.3.10 AS builder

WORKDIR /app

# Install dependencies
COPY package.json .npmrc ./
RUN bun install

# Copy source
COPY . .

# Runtime stage
FROM oven/bun:1.3.10-slim

WORKDIR /app

# Copy from builder (set ownership inline to avoid expensive recursive chown)
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/agent ./agent
COPY --from=builder --chown=bun:bun /app/package.json ./

USER bun

# Run the agent
CMD ["bun", "run", "agent/index.ts"]
