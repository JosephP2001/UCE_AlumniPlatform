FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Runner stage ──────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Transfer ownership before switching user
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3003

CMD ["node", "dist/index.js"]
