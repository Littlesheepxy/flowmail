ARG NODE_VERSION=20-alpine
ARG APP_NAME=web

# ── Stage 1: Base ──
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# ── Stage 2: Prune the monorepo for the target app ──
FROM base AS pruner
ARG APP_NAME
COPY . .
RUN npx turbo prune ${APP_NAME} --docker

# ── Stage 3: Install dependencies (skip postinstall — source files not yet available) ──
FROM base AS deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 4: Build ──
FROM base AS builder
ARG APP_NAME
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm install --frozen-lockfile
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm turbo build --filter=${APP_NAME}
RUN mkdir -p /app/apps/${APP_NAME}/public

# ── Stage 5: Runner ──
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

COPY --from=builder /app/apps/${APP_NAME}/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static

USER nextjs

ARG PORT=3000
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD node apps/${APP_NAME}/server.js
