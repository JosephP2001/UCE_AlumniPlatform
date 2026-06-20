# GitHub Actions — CI/CD Workflows

Implements a GitOps pipeline: code changes flow from feature branches → QA → master (PROD), with automated testing, parallel Docker image builds, and Ansible deployment at each stage.

---

## Workflows

```
.github/
└── workflows/
    ├── deploy-qa.yml    # Triggered on push to QA branch
    └── deploy-prod.yml  # Triggered on merge to master
```

---

## Branch Strategy

```
feature/* ──► QA (merge direct) ──► master (PR + reviewer approval)
                  │                        │
                  ▼                        ▼
            deploy-qa.yml           deploy-prod.yml
          (QA environment)        (PROD environment)
```

| Branch | Purpose | Protection |
|--------|---------|------------|
| `master` | Production — source of truth | PR required + JuanGuevara90 approval |
| `QA` | Integration / QA environment | Direct push allowed |
| `feature/*` | Per-feature development | Merged directly to QA |

---

## Job Architecture

Both workflows split work into independent jobs instead of one long sequential job. Each microservice has its own build job, so the 6 Docker images build **in parallel** rather than one after another:

```
            ┌─────────────────────┐
            │  test                │
            │  (npm test x4 svcs)  │
            └──────────┬───────────┘
                        │
        ┌───────┬───────┼───────┬───────┬───────┐
        ▼       ▼       ▼       ▼       ▼       ▼
   build-auth build-jobs build-profile build-notification build-matching build-web
        │       │       │       │       │       │
        └───────┴───────┴───────┴───────┴───────┘
                        │
                        ▼
                  ┌──────────┐
                  │  deploy  │
                  └──────────┘
```

`deploy` only starts once **all six** build jobs succeed. This change reduced total QA pipeline time from ~8–12 minutes to **~4m 33s**.

---

## deploy-qa.yml

**Trigger:** Push to `QA` branch
**Environment:** QA (`98.86.126.222` — Elastic IP, fixed)
**Docker tags:** `:qa`
**Deploy runner:** `self-hosted` (runs on the QA Bastion)

### Pipeline Steps

```
push to QA
  │
  ├── JOB: test
  │     ├── Checkout code
  │     ├── Set up Node.js 24
  │     ├── npm install (root)
  │     ├── Run tests — auth-service (8/8) ✅
  │     ├── Run tests — jobs-service (6/6) ✅
  │     ├── Run tests — profile-service ✅
  │     └── Run tests — notification-service ✅
  │
  ├── JOBS (parallel, each needs: test):
  │     ├── build-auth         → josephp2001/uce-auth-service:qa
  │     ├── build-jobs         → josephp2001/uce-jobs-service:qa
  │     ├── build-profile      → josephp2001/uce-profile-service:qa
  │     ├── build-notification → josephp2001/uce-notification-service:qa
  │     ├── build-matching     → josephp2001/uce-matching-service:qa
  │     └── build-web          → josephp2001/uce-web-app:qa
  │           (NEXT_PUBLIC_*_URL build-args — routed through Nginx)
  │
  └── JOB: deploy (needs: all 6 build-* jobs)
        ├── Checkout code
        ├── Install Ansible if missing (skips reinstall — runner is persistent)
        ├── Create Ansible inventory
        └── Deploy via Ansible
             ansible-playbook infra/ansible/deploy-qa.yml
               -i /tmp/qa_inventory.ini
               -e jwt_secret, oauth_client_id, oauth_client_secret,
                  pg_password, rabbitmq_password,
                  postgres_replicator_password, bastion_ip, ec2_private_ip
```

> The `deploy` job runs on the **self-hosted** runner living on the QA Bastion, so Ansible is only installed once — subsequent runs check `which ansible` first and skip reinstallation if already present.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_TOKEN` | Docker Hub access token |
| `QA_BASTION_IP` | QA Bastion Elastic IP (fixed) |
| `QA_AUTH_JOBS_IP` | QA private EC2 IP (services host) |
| `QA_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID (QA app) |
| `QA_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret (QA app) |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `PG_PASSWORD` | PostgreSQL password |
| `RABBITMQ_PASSWORD` | RabbitMQ admin password |
| `POSTGRES_REPLICATOR_PASSWORD` | Password for the PostgreSQL `replicator` role (streaming replication) |

---

## deploy-prod.yml

**Trigger:** Push to `master` branch (merge of approved PR)
**Environment:** PROD (`54.88.140.158` — Elastic IP, fixed / `josheponcepro1.distribuidauce.org`)
**Docker tags:** `:latest`
**Deploy runner:** `ubuntu-latest` (GitHub-hosted, ephemeral)

### Pipeline Steps

```
merge to master
  │
  ├── JOB: test
  │     ├── Checkout code
  │     ├── Set up Node.js 24
  │     ├── npm install (root)
  │     ├── Run tests — auth-service (8/8) ✅
  │     ├── Run tests — jobs-service (6/6) ✅
  │     ├── Run tests — profile-service ✅
  │     └── Run tests — notification-service ✅
  │
  ├── JOBS (parallel, each needs: test):
  │     ├── build-auth         → josephp2001/uce-auth-service:latest
  │     ├── build-jobs         → josephp2001/uce-jobs-service:latest
  │     ├── build-profile      → josephp2001/uce-profile-service:latest
  │     ├── build-notification → josephp2001/uce-notification-service:latest
  │     ├── build-matching     → josephp2001/uce-matching-service:latest
  │     └── build-web          → josephp2001/uce-web-app:latest
  │
  └── JOB: deploy (needs: all 6 build-* jobs)
        ├── Checkout code
        ├── Setup SSH keys (PROD_SSH_KEY → ~/.ssh/PROD.pem)
        │     ssh-keyscan PROD_BASTION_IP → known_hosts
        │     ssh jump → ssh-keyscan PROD_AUTH_JOBS_IP → known_hosts
        ├── Install Ansible (always — ephemeral runner, nothing persists)
        ├── Create Ansible inventory (SSH ProxyCommand through Bastion)
        └── Deploy via Ansible
             ansible-playbook infra/ansible/deploy-prod.yml
               -i /tmp/prod_inventory.ini
               -e jwt_secret, oauth_client_id, oauth_client_secret,
                  pg_password, bastion_ip, rabbitmq_password
```

> Unlike QA, the PROD `deploy` job runs on a **GitHub-hosted** runner (`ubuntu-latest`) — a fresh machine every run, so Ansible is reinstalled every time. There is no persistence to take advantage of here.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_TOKEN` | Docker Hub access token |
| `PROD_BASTION_IP` | PROD Bastion Elastic IP — `54.88.140.158` (fixed) |
| `PROD_AUTH_JOBS_IP` | PROD private EC2 IP (services host) |
| `PROD_SSH_KEY` | Contents of PROD.pem private key |
| `OAUTH_CLIENT_ID` | GitHub OAuth App Client ID (PROD app) |
| `OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret (PROD app) |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `PG_PASSWORD` | PostgreSQL password |
| `RABBITMQ_PASSWORD` | RabbitMQ admin password |

> **Known gap:** PROD's Terraform defines an Auto Scaling Group + ELB + Launch Template for `auth-service`, `jobs-service`, and `profile-service`, but the `deploy` job above still targets a single fixed private EC2 via direct SSH — it does not yet trigger an ASG instance refresh. This means PROD deploys still briefly stop/restart containers on every push to `master`, rather than achieving zero-downtime rolling deployment. This is tracked as pending work.

---

## Docker Images

| Image | Tag | Environment | Registry |
|-------|-----|-------------|----------|
| `josephp2001/uce-auth-service` | `:qa` / `:latest` | QA / PROD | Docker Hub |
| `josephp2001/uce-jobs-service` | `:qa` / `:latest` | QA / PROD | Docker Hub |
| `josephp2001/uce-profile-service` | `:qa` / `:latest` | QA / PROD | Docker Hub |
| `josephp2001/uce-notification-service` | `:qa` / `:latest` | QA / PROD | Docker Hub |
| `josephp2001/uce-matching-service` | `:qa` / `:latest` | QA / PROD | Docker Hub |
| `josephp2001/uce-web-app` | `:qa` / `:latest` | QA / PROD | Docker Hub |