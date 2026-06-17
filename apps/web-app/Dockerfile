FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_JOBS_URL
ARG NEXT_PUBLIC_PROFILE_URL
ARG NEXT_PUBLIC_NOTIFICATIONS_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_JOBS_URL=$NEXT_PUBLIC_JOBS_URL
ENV NEXT_PUBLIC_PROFILE_URL=$NEXT_PUBLIC_PROFILE_URL
ENV NEXT_PUBLIC_NOTIFICATIONS_URL=$NEXT_PUBLIC_NOTIFICATIONS_URL
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3002
ENV PORT=3002
CMD ["node", "server.js"]
