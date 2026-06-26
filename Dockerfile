# Single image for the self-hosted MySQL deployment: builds the React frontend
# (MySQL backend) and the Express API, then serves both from one origin on :3001.

# ── Stage 1: build the frontend (VITE_DATA_BACKEND=mysql, same-origin API) ────
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Empty VITE_API_URL = same-origin: the API serves these static files, so the
# browser talks to the API/socket on its own host with no CORS.
ARG VITE_API_URL=""
ENV VITE_DATA_BACKEND=mysql
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Stage 2: build the server (Prisma client from the MySQL schema + tsc) ─────
FROM node:20-alpine AS server
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate --schema prisma/schema.mysql.prisma
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=server /app/server/node_modules ./node_modules
COPY --from=server /app/server/dist ./dist
COPY --from=server /app/server/prisma ./prisma
COPY server/package.json ./
# Frontend build served as static files (SPA fallback handled in app.ts).
COPY --from=frontend /app/dist ./public
ENV STATIC_DIR=/app/server/public
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh
EXPOSE 3001
CMD ["/app/start.sh"]
