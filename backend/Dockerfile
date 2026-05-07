# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN npm install -g pnpm

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# ─── Stage 3: Production Runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only prod deps
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/dist ./dist
# Create public/uploads folder
RUN mkdir -p public/uploads

# Copy tsconfig for tsconfig-paths at runtime
COPY tsconfig.json drizzle.config.ts ./
COPY src/db/schema ./src/db/schema
COPY src/db/seed ./src/db/seed

EXPOSE 3000

CMD ["node", "-r", "tsconfig-paths/register", "dist/main"]
