# Stage 1: Build
FROM oven/bun:1.3 AS builder
WORKDIR /app

# Only copy lock and package files to leverage cache
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Stage 2: Run
FROM oven/bun:1.3 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/lib ./lib

EXPOSE 3000
CMD ["bun", "run", "start"]
