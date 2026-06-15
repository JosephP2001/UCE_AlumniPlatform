# matching-service

Alumni-job matching microservice for the UCE Alumni & Employment Platform.

Written in **Go 1.22**. Consumes `job.created` events from Kafka, scores alumni profiles using cosine similarity, and publishes `new_match` events to RabbitMQ for the notification-service to deliver.

---

## Responsibilities

| Concern | Detail |
|---------|--------|
| Event consumption | Kafka consumer — listens on `job.created` topic |
| Matching algorithm | Cosine similarity between job text and alumni profile skills/career |
| Event publishing | RabbitMQ producer — publishes `new_match` to notification-service |
| Data source | PostgreSQL `profiles` table (shared with profile-service) |
| Health check | `GET /health` — HTTP endpoint on port 3005 |

---

## Architecture

```
jobs-service
  └── POST /jobs → Kafka topic: job.created
                          │
                          ▼
                  matching-service (Go)
                    ├── Reads all profiles from PostgreSQL
                    ├── CosineSimilarity(jobText, profileSkills)
                    └── score >= 0.1 → RabbitMQ queue: new_match
                                              │
                                              ▼
                                  notification-service
                                    └── Persists + delivers notification
```

---

## Matching Algorithm

Cosine similarity between two text vectors built from word frequency maps.

```
jobText     = job.title + " " + job.company
profileText = profile.skills + " " + profile.career

score = dot(tfA, tfB) / (|tfA| * |tfB|)
```

A match is published when `score >= ScoreThreshold (0.1)`.

**Example:**
```
Job:     "Backend Developer Node.js AWS"
Profile: skills="Node.js TypeScript AWS Docker", career="Sistemas de Información"
Score:   0.47 → MATCH ✅

Job:     "Graphic Designer Photoshop"
Profile: skills="Node.js TypeScript AWS Docker", career="Sistemas de Información"
Score:   0.00 → NO MATCH ✗
```

---

## Events

### Consumed — Kafka `job.created`
```json
{
  "jobId": 42,
  "title": "Backend Developer",
  "company": "Tech Corp"
}
```

### Published — RabbitMQ `new_match`
```json
{
  "jobId": 42,
  "userId": "204424189",
  "username": "JosephP2001",
  "title": "Backend Developer",
  "company": "Tech Corp",
  "score": 0.47
}
```

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check |

**Health response:**
```json
{
  "status": "ok",
  "service": "matching-service",
  "timestamp": "2026-06-15T00:00:00Z"
}
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3005` |
| `POSTGRES_HOST` | PostgreSQL host | `postgres` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `jobs_db` |
| `POSTGRES_USER` | PostgreSQL user | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | injected via Ansible |
| `KAFKA_BROKER` | Kafka broker address | `kafka:9092` |
| `RABBITMQ_PASSWORD` | RabbitMQ password | injected via Ansible |

---

## Project Structure

```
matching-service/
├── cmd/
│   └── server/
│       └── main.go              # Entry point — wires DB, Kafka, RabbitMQ, HTTP
├── internal/
│   ├── consumer/
│   │   └── consumer.go          # Kafka consumer — job.created handler
│   ├── matcher/
│   │   ├── matcher.go           # Cosine similarity algorithm
│   │   └── matcher_test.go      # Unit tests (6 cases)
│   ├── producer/
│   │   └── producer.go          # RabbitMQ producer — new_match publisher
│   └── handler/
│       └── handler.go           # HTTP health check
├── pkg/
│   └── models/
│       └── models.go            # Shared types: JobCreatedEvent, Profile, MatchResult
├── Dockerfile
├── go.mod
└── README.md
```

---

## Tests

```bash
cd apps/matching-service
go test ./internal/matcher/...
```

**6 test cases:**
- Identical texts → score 1.0
- No word overlap → score 0.0
- Partial overlap → score between 0 and 1
- Empty string → score 0.0
- Case insensitive matching
- ScoreThreshold in valid range

---

## Docker

**Build:**
```bash
docker build -t josephp2001/uce-matching-service:qa ./apps/matching-service
```

**Run** (requires Kafka, RabbitMQ, PostgreSQL on uce-network):
```bash
docker run -d \
  --name matching-service \
  --network uce-network \
  -e PORT=3005 \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_PORT=5432 \
  -e POSTGRES_DB=jobs_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your-password \
  -e KAFKA_BROKER=kafka:9092 \
  -e RABBITMQ_PASSWORD=your-password \
  josephp2001/uce-matching-service:qa
```

**Docker Hub images:**
- QA: `josephp2001/uce-matching-service:qa`
- PROD: `josephp2001/uce-matching-service:latest`

---

## CI/CD

```
push to QA → docker build → docker push :qa → ansible deploy QA
merge to master → docker build → docker push :latest → ansible deploy PROD
```

---

## Health Check — QA

```bash
curl http://98.86.126.222/api/matching/health
```

Expected:
```json
{"status":"ok","service":"matching-service","timestamp":"..."}
```
