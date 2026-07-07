# Build context esperado: raíz del monorepo (context: .)
# igual que admin-service / analytics-service / audit-service,
# porque necesita visibilidad de packages/auth-shared.

FROM node:24-slim AS deps
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/insights-service/package.json apps/insights-service/package.json
COPY packages/auth-shared/package.json packages/auth-shared/package.json
RUN npm ci

FROM deps AS builder
WORKDIR /workspace
COPY packages/auth-shared packages/auth-shared
COPY apps/insights-service apps/insights-service
RUN npm run build --workspace=packages/auth-shared
RUN npm run build --workspace=apps/insights-service

FROM node:24-slim AS runner
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/packages/auth-shared/dist ./packages/auth-shared/dist
COPY --from=builder /workspace/packages/auth-shared/package.json ./packages/auth-shared/package.json
COPY --from=builder /workspace/apps/insights-service/dist ./apps/insights-service/dist
COPY --from=builder /workspace/apps/insights-service/package.json ./apps/insights-service/package.json

WORKDIR /workspace/apps/insights-service
EXPOSE 3010
CMD ["node", "dist/index.js"]
