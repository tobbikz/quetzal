# Quetzal — multi-stage Next.js (standalone) production image
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Next expects a public/ dir; repo may ship without static assets.
RUN mkdir -p public data
# Ephemeral SQLite for `next build` page-data collection (lib/sqlitePath.ts).
# Prefer host seed copied into context; otherwise bootstrap via TypeScript imports.
RUN if [ -f data/quetzal.build.db ] || [ -f data/quetzal.db ]; then \
      test -f data/quetzal.build.db || cp data/quetzal.db data/quetzal.build.db; \
    else \
      QUETZAL_SQLITE_PATH=/app/data/quetzal.build.db npx --yes tsx scripts/bootstrap-build-db.ts; \
    fi
ENV QUETZAL_SQLITE_PATH=/app/data/quetzal.build.db
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3210 \
    HOSTNAME=0.0.0.0

RUN addgroup -S quetzal && adduser -S quetzal -G quetzal

COPY --from=builder /app/public ./public
COPY --from=builder --chown=quetzal:quetzal /app/.next/standalone ./
COPY --from=builder --chown=quetzal:quetzal /app/.next/static ./.next/static

RUN mkdir -p data/uploads && chown -R quetzal:quetzal data

USER quetzal
EXPOSE 3210
CMD ["node", "server.js"]
