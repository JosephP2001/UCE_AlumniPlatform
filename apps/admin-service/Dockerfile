FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/auth-shared/package.json ./packages/auth-shared/package.json
COPY apps/admin-service/package.json ./apps/admin-service/package.json
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY packages/auth-shared ./packages/auth-shared
COPY apps/admin-service ./apps/admin-service
RUN npm run build --workspace=packages/auth-shared
RUN npm run build --workspace=apps/admin-service

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/auth-shared/dist ./packages/auth-shared/dist
COPY --from=builder /app/packages/auth-shared/package.json ./packages/auth-shared/package.json
COPY --from=builder /app/apps/admin-service/dist ./dist
COPY apps/admin-service/package.json ./package.json

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3009
ENV PORT=3009
CMD ["node", "dist/index.js"]