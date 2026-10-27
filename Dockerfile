# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Only the manifests needed to build the server. apps/web is deliberately
# excluded so the Next.js/React dependency tree is never installed here.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/game-core/package.json packages/game-core/

RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/game-core packages/game-core
COPY apps/server apps/server

# Build order matters: shared -> game-core -> server.
RUN npm run build --workspace packages/shared \
 && npm run build --workspace packages/game-core \
 && npm run build --workspace apps/server

# ---- runtime stage ---------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Re-install production dependencies for the server workspace only. The
# workspace filter keeps apps/web (Next.js, React, ...) out of the image.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/game-core/package.json packages/game-core/

RUN npm ci --omit=dev --workspace @volga/server --ignore-scripts \
 && npm cache clean --force \
 && rm -rf /root/.npm

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/game-core/dist packages/game-core/dist
COPY --from=builder /app/apps/server/dist apps/server/dist

# npm workspaces link node_modules/@volga/* to these directories, so the
# packages resolve at runtime without copying sources.

USER node

EXPOSE 8080

CMD ["node", "apps/server/dist/index.js"]
