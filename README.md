# UCE Alumni & Employment Platform

Nx monorepo (TypeScript + Go) — distributed microservices system for Universidad Central del Ecuador alumni and job matching, deployed on AWS via automated CI/CD.

**Current state:** 9 microservices in production (8 Node.js/TypeScript + 1 Go), plus `n8n` automation, reaching the 10-microservice target. `messaging-service` is the only service still pending migration to the shared `@uce-platform/auth-shared` package (its JWT `userId`/`id` mismatch bug was already fixed separately in `fix/messaging-userid-mismatch`).

---

## Microservices — In Production

| Service | Port | Language | Description |
|---------|------|----------|--------------|
| `auth-service` | 3000 | Node.js + TypeScript | GitHub OAuth 2.0 + JWT (access 15min / refresh 7d via Redis) |
| `jobs-service` | 3001 | Node.js + TypeScript | Job listings CRUD — CQRS with PostgreSQL + Redis cache |
| `web-app` | 3002 | Next.js 16 + React 19 | Frontend — served behind Nginx |
| `profile-service` | 3003 | Node.js + TypeScript | Alumni profile management — PostgreSQL |
| `notification-service` | 3004 | Node.js + TypeScript | RabbitMQ + MQTT consumer — persists and delivers notifications |
| `matching-service` | 3005 | Go 1.22 | Kafka consumer — cosine similarity matching → RabbitMQ |
| `audit-service` | 3006* | Node.js + TypeScript | Audit log query API — reads `audit_logs` from PostgreSQL |
| `analytics-service` | 3007* | Node.js + TypeScript | Aggregated stats (jobs, users, matches, profiles) — PostgreSQL + MongoDB |
| `admin-service` | 3009* | Node.js + TypeScript | Admin user management (list/update role/soft-delete) — PostgreSQL |
| `messaging-service` | — | Node.js + TypeScript | ⚠️ Pending migration to `@uce-platform/auth-shared` |

`*` — puertos tomados de los Dockerfiles actuales; **pendiente de confirmar** que coinciden con el mapeo real de Nginx/Ansible en QA y PROD.

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
│   ├── audit-service/          # Node.js + TypeScript
│   ├── analytics-service/      # Node.js + TypeScript
│   ├── admin-service/          # Node.js + TypeScript
│   ├── messaging-service/      # Node.js + TypeScript — pending auth-shared migration
│   └── web-app/                # Next.js 16
├── packages/
│   └── auth-shared/            # @uce-platform/auth-shared — shared JWT auth middleware
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
                                    ├── Persists notification in PostgreSQL
                                    └── Publishes to MQTT topic: uce/notifications/new_match
                                              │
                                              ▼
                                    any subscribed client
```

End-to-end flow verified in QA across all three message brokers (Kafka → RabbitMQ → MQTT) with matching timestamps in `matching-service`, `notification-service`, and PostgreSQL logs.

---

## CI/CD

Both pipelines split work into a test job followed by **ten parallel build jobs** (one per service: `auth`, `jobs`, `profile`, `notification`, `matching`, `audit`, `admin`, `analytics`, `messaging`, `web`), which all feed into a single deploy job.

The test job also runs Nx's dependency-aware build/test graph, so `packages/auth-shared` is built before any service that depends on it (`admin-service`, `analytics-service`, `audit-service` today — see `packages/auth-shared/README.md` for migration status).

```
push → QA branch
  → test (npm install → nx affected build → nx affected test)
  → 10x parallel docker build + push :qa (Docker Hub)
  → ansible deploy → EC2 QA via self-hosted runner

approved PR → master
  → test (npm install → nx affected build → nx affected test)
  → 10x parallel docker build + push :latest (Docker Hub)
  → ansible deploy → EC2 PROD via SSH ProxyCommand through Bastion
```

> PROD's Terraform defines an Auto Scaling Group + ELB for zero-downtime deployment, but the pipeline above has not yet been migrated to use it — see `infra/README.md` for details.

> `admin-service`, `analytics-service`, and `audit-service` build from the monorepo root context (`context: .`) rather than their own folder, since their Dockerfiles need visibility into `packages/auth-shared` to resolve the npm workspace symlink correctly.

---

## Messaging Infrastructure

| Component | Image | Purpose |
|-----------|-------|---------|
| Zookeeper | `confluentinc/cp-zookeeper:7.4.0` | Kafka coordination |
| Kafka | `confluentinc/cp-kafka:7.4.0` | Event bus — `job.created` topic |
| RabbitMQ | `rabbitmq:3.12-management-alpine` | Queue — `new_match`, `job.created`, `user.registered`, `profile.updated` |
| Mosquitto (MQTT) | `eclipse-mosquitto:2.0` | Real-time delivery — `uce/notifications/*` topics |

---

## Databases

| Database | Engine | Used by |
|----------|--------|---------|
| `jobs_db` (tables: jobs, profiles, notifications, audit_logs) | PostgreSQL 15 | jobs-service, profile-service, notification-service, admin-service, analytics-service, audit-service |
| Redis | Redis 7 | jobs-service (cache), auth-service (sessions) |
| `profiles_db` | MongoDB 7 | analytics-service (profile aggregation), planned for `messaging-service` |

> PostgreSQL streaming replication is configured on the primary (QA) — a dedicated `replicator` role with `pg_hba.conf` access from the Docker network. The replica container itself is not yet implemented.

---

## AWS Infrastructure

| Environment | Bastion EIP | Domain | Orchestration |
|-------------|-------------|--------|---------------|
| QA | `98.86.126.222` | — | Docker via Ansible (self-hosted runner) |
| PROD | `54.88.140.158` | `josheponcepro1.distribuidauce.org` | Docker via Ansible (direct SSH) |

- All service EC2s run in **private subnets** — access only via Bastion
- Docker network: `uce-network`
- Terraform state: remote S3 (separate per environment)
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

# admin-service (7/7)
cd apps/admin-service && npm test

# analytics-service (7/7)
cd apps/analytics-service && npm test

# audit-service (11/11)
cd apps/audit-service && npm test

# auth-shared
npx nx test auth-shared

# matching-service (6/6 — Go)
cd apps/matching-service && go test ./internal/matcher/...
```

---

## Health Checks

```bash
# QA
curl http://98.86.126.222/api/auth/health
curl http://98.86.126.222/api/jobs/health
curl http://98.86.126.222/api/profile/health
curl http://98.86.126.222/api/notification/health
curl http://98.86.126.222/api/matching/health
curl http://98.86.126.222/api/admin/health
curl http://98.86.126.222/api/analytics/health
curl http://98.86.126.222/api/audit/health

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
| `/api/notification/*` | notification-service | 3004 |
| `/api/matching/*` | matching-service | 3005 |
| `/api/audit/*` | audit-service | 3006* |
| `/api/analytics/*` | analytics-service | 3007* |
| `/api/admin/*` | admin-service | 3009* |
| `/rabbitmq/*` | RabbitMQ Management UI | 15672 |
| `/*` | web-app | 3002 |

`*` — **pendiente de confirmar** contra la config real de `infra/nginx/nginx.conf`.

---

## Mandatory Requirements — Status

| Requirement | Status |
|--------------|--------|
| Kafka, RabbitMQ, MQTT | ✅ Implemented |
| CI/CD (GitHub Actions) | ✅ Implemented — parallelized, 10 services |
| Terraform (S3 remote state) | ✅ Implemented |
| Database (3+ types, 1 cache) | ✅ PostgreSQL + Redis + MongoDB |
| ASG (PROD) | ⚠️ Defined in Terraform, not yet wired into the deploy pipeline |
| Multi-AZ (PROD) | ✅ VPC spans 2 AZs |
| Automated DB backups | ❌ Not started |
| On-premise connection | ⚠️ Self-hosted runner exists; formal backup destination not yet defined |
| Data persistence | ✅ Verified — `pg_data`, `redis_data`, `mongo_data` survive restarts |

See `PLAN-MAESTRO-v2.md` for the full implementation roadmap.
