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
ARG NEXT_PUBLIC_INVITE_CODE_REQUIRED="true"
ENV NEXT_PUBLIC_INVITE_CODE_REQUIRED=${NEXT_PUBLIC_INVITE_CODE_REQUIRED}
ARG NEXT_PUBLIC_SITE_URL="https://flowmail.work"
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN pnpm turbo build --filter=${APP_NAME}
RUN mkdir -p /app/apps/${APP_NAME}/public

# 提取 pdfjs worker 到固定路径，方便 runner stage 单 COPY 而无需 wildcard
RUN set -e; \
    mkdir -p /app/extras/pdfjs-worker; \
    find /app/node_modules/.pnpm -path '*pdfjs-dist*/legacy/build/pdf.worker.mjs' 2>/dev/null | while read src; do \
        rel="${src#/app/}"; \
        dest="/app/extras/$rel"; \
        mkdir -p "$(dirname "$dest")"; \
        cp "$src" "$dest"; \
    done; \
    echo "Extracted pdfjs workers:" && find /app/extras -name '*.mjs'

# ── Stage 5: Runner ──
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ARG APP_NAME
ENV APP_NAME=${APP_NAME}

# Standalone server chdir()s to apps/<app>/; public must be apps/<app>/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static

# pdfjs-dist 5.x 在 Node 环境通过 dynamic import 加载 pdf.worker.mjs；
# nft 静态分析漏掉这个文件，导致 OCR 时报 "Cannot find module 'pdf.worker.mjs'"。
# outputFileTracingIncludes 是首选修法；这里作为 Docker 层兜底。
# /app/extras 里的目录结构与原 .pnpm 完全一致，可以直接合并到 /app。
COPY --from=builder --chown=nextjs:nodejs /app/extras/ ./

ARG PORT=3000
ENV PORT=${PORT}
# Standalone defaults to localhost; without this, reverse proxies see connection refused → 502.
ENV HOSTNAME=0.0.0.0
EXPOSE ${PORT}

CMD node apps/${APP_NAME}/server.js
