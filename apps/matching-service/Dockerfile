FROM golang:1.22-alpine AS builder

# Install build dependencies for confluent-kafka-go (requires librdkafka)
RUN apk add --no-cache gcc musl-dev git librdkafka-dev pkgconf

WORKDIR /app

COPY go.mod ./
RUN go mod download || true

COPY . .

# Generate go.sum and tidy if needed
RUN go mod tidy

RUN CGO_ENABLED=1 GOOS=linux go build -o matching-service ./cmd/server

# ── Runner stage ──────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates librdkafka

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/matching-service .

RUN chown appuser:appgroup matching-service

USER appuser

EXPOSE 3005

CMD ["./matching-service"]
