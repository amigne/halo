# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY tsconfig.json vite.config.ts eslint.config.js index.html ./
COPY src/ src/

RUN npm run build

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

# Non-root user (T-153)
RUN addgroup -S halo && adduser -S halo -G halo

COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config: serve SPA (all routes → index.html) + proxy /api to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

USER halo

CMD ["nginx", "-g", "daemon off;"]
