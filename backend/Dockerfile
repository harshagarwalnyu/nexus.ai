# Use bun:1.3 (debian-based) for native module compatibility (duckdb)
FROM oven/bun:1.3 AS builder
WORKDIR /app

# Optimize layer caching
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Stage 2: Final image
FROM oven/bun:1.3 AS runner
WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["bun", "index.js"]
