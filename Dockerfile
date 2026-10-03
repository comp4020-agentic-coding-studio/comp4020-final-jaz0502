# syntax = docker/dockerfile:1

# Node 24 runs TypeScript directly (type stripping, no build step) as long as
# syntax stays erasable, which is why src/ has no compiled dist/ output.
# tsc --noEmit (pnpm typecheck) is the only place TypeScript is actually
# checked; it never produces the files this image runs.

FROM node:24.21.0-alpine AS prod-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable \
    && corepack prepare pnpm@11.9.0 --activate \
    && pnpm install --frozen-lockfile --prod

FROM node:24.21.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY README.md ./README.md

EXPOSE 8080
CMD ["node", "src/server.ts"]
