# UCE Alumni & Employment Platform

Nx monorepo (TypeScript + Go) with five microservices deployed on AWS via automated CI/CD.

---

## Microservices

| Service | Port | Language | Description |
|---------|------|----------|-------------|
| `auth-service` | 3000 | Node.js + TypeScript | GitHub OAuth 2.0 + JWT (access 15min / refresh 7d via Redis) |
| `jobs-service` | 3001 | Node.js + TypeScript | Job listings CRUD — CQRS with PostgreSQL + Redis cache |
| `web-app` | 3002 | Next.js 16 + React 19 | Frontend — served behind Nginx |
| `profile-service` | 3003 | Node.js + TypeScript | Alumni profile management — PostgreSQL |
| `notification-service` | 3004 | Node.js + TypeScript | RabbitMQ consumer — persists and serves notifications |
| `matching-service` | 3005 | Go 1.22 | Kafka consumer — cosine similarity matching → RabbitMQ |

---

## Structure

```
uce-platform/
├── apps/
│   ├── auth-service/           # Node.js + TypeScript — 8 tests
│   ├── jobs-service/           # Node.js + TypeScript — 6 tests
│   ├── profile-service/        # Node.js + TypeScript
│   ├── notification-service/   # Node.js + TypeScript
│   ├── matching-service/       # Go 1.22 — 6 tests
│   └── web-app/                # Next.js 16
├── infra/
│   ├── terraform/              # QA + PROD environments
│   ├── ansible/                # deploy-qa.yml, deploy-prod.yml
│   └── nginx/                  # nginx.conf — reverse proxy
└── .github/workflows/
    ├── deploy-qa.yml           # push to QA branch
    └── deploy-prod.yml         # merge to master
```

---

## Event-Driven Architecture

```
jobs-service
  └── POST /jobs → Kafka topic: job.created
                          │
                          ▼
                  matching-service (Go)
                    ├── Reads profiles from PostgreSQL
                    ├── CosineSimilarity(jobText, profileSkills)
                    └── score >= 0.1 → RabbitMQ queue: new_match
                                              │
                                              ▼
                                  notification-service
                                    └── Persists + delivers notification
```

---

## CI/CD

```
push → QA branch
  → npm test (auth, jobs, profile, notification)
  → docker build + push :qa (Docker Hub)
  → ansible deploy → EC2 QA via self-hosted runner

approved PR → master
  → npm test (auth, jobs, profile, notification)
  → docker build + push :latest (Docker Hub)
  → ansible deploy → EC2 PROD via SSH ProxyCommand through Bastion
```

---

## Messaging Infrastructure

| Component | Image | Purpose |
|-----------|-------|---------|
| Zookeeper | `confluentinc/cp-zookeeper:7.4.0` | Kafka coordination |
| Kafka | `confluentinc/cp-kafka:7.4.0` | Event bus — `job.created` topic |
| RabbitMQ | `rabbitmq:3.12-management-alpine` | Queue — `new_match`, `job_created` |

---

## AWS Infrastructure

| Environment | Bastion EIP | Domain | Orchestration |
|-------------|-------------|--------|---------------|
| QA | `52.20.54.196` | — | Docker via Ansible (self-hosted runner) |
| PROD | `54.88.140.158` | `josheponcepro1.distribuidauce.org` | Docker via Ansible + ELB |

- All service EC2s run in **private subnets** — access only via Bastion
- Docker network: `uce-network`
- Terraform state: remote S3 + DynamoDB lock (separate per environment)
- Secrets: injected via Ansible at deploy time, never hardcoded

---

## Tests

```bash
# auth-service (8/8)
cd apps/auth-service && npm test

# jobs-service (6/6)
cd apps/jobs-service && npm test

# profile-service
cd apps/profile-service && npm test

# notification-service
cd apps/notification-service && npm test

# matching-service (6/6 — Go)
cd apps/matching-service && go test ./internal/matcher/...
```

---

## Health Checks

```bash
# QA
curl http://52.20.54.196/api/auth/health
curl http://52.20.54.196/api/jobs/health
curl http://52.20.54.196/api/profile/health
curl http://52.20.54.196/api/matching/health

# PROD
curl http://josheponcepro1.distribuidauce.org/api/auth/health
curl http://josheponcepro1.distribuidauce.org/api/jobs/health
```

---

## Nginx Routing

All traffic enters on port 80 — Nginx routes internally:

| Path | Service | Port |
|------|---------|------|
| `/api/auth/*` | auth-service | 3000 |
| `/api/jobs/*` | jobs-service | 3001 |
| `/api/profile/*` | profile-service | 3003 |
| `/api/matching/*` | matching-service | 3005 |
| `/*` | web-app | 3002 |
