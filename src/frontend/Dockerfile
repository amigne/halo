# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig.json vite.config.ts eslint.config.js index.html ./
COPY src/ src/

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
# nginx-unprivileged runs as non-root by default, listens on 8080 (T-153)
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config: serve SPA (all routes → index.html).
# /api routing is handled by the Caddy reverse proxy (specs/03 §1), not here.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
