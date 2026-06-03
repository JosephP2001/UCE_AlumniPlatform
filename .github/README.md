# CI/CD Pipeline

GitHub Actions workflows for the UCE Alumni & Employment Platform.

Implements a GitOps pipeline: code changes flow from feature branches → QA → master (PROD), with automated testing, Docker image publishing, and Ansible deployment at each stage.

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

## deploy-qa.yml

**Trigger:** Push to `QA` branch  
**Environment:** QA (AWS Account #2)  
**Docker tags:** `:qa`

### Pipeline Steps

```
push to QA
  │
  ├── 1. Checkout code
  ├── 2. Set up Node.js 24
  ├── 3. npm install (root)
  │
  ├── 4. Run tests — jobs-service (6/6) ✅
  ├── 5. Run tests — auth-service (8/8) ✅
  │
  ├── 6. Login to Docker Hub
  ├── 7. Build + push josephp2001/uce-auth-service:qa
  ├── 8. Build + push josephp2001/uce-jobs-service:qa
  │
  ├── 9. Setup SSH key (QA_SSH_KEY → ~/.ssh/QA.pem)
  │       ssh-keyscan QA_BASTION_IP → known_hosts
  │
  └── 10. Deploy via Ansible
          ansible-playbook infra/ansible/deploy-qa.yml
            -i QA_BASTION_IP
            -e jwt_secret, oauth_client_id, oauth_client_secret, pg_password
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_TOKEN` | Docker Hub access token |
| `QA_BASTION_IP` | QA Bastion public IP — update each session |
| `QA_SSH_KEY` | Contents of QA.pem private key |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `OAUTH_CLIENT_ID` | GitHub OAuth App Client ID |
| `OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `PG_PASSWORD` | PostgreSQL password |

---

## deploy-prod.yml

**Trigger:** Push to `master` branch (merge of approved PR)  
**Environment:** PROD (AWS Account #1)  
**Docker tags:** `:latest`

### Pipeline Steps

```
merge to master
  │
  ├── 1. Checkout code
  ├── 2. Set up Node.js 24
  ├── 3. npm install (root)
  │
  ├── 4. Run tests — jobs-service (6/6) ✅
  ├── 5. Run tests — auth-service (8/8) ✅
  │
  ├── 6. Login to Docker Hub
  ├── 7. Build + push josephp2001/uce-auth-service:latest
  ├── 8. Build + push josephp2001/uce-jobs-service:latest
  │
  ├── 9. Setup SSH key (PROD_SSH_KEY → ~/.ssh/PROD.pem)
  │       ssh-keyscan PROD_BASTION_IP → known_hosts
  │
  └── 10. Deploy via Ansible
          ansible-playbook infra/ansible/deploy-prod.yml
            -i PROD_BASTION_IP (54.88.140.158 — Elastic IP, fixed)
            -e jwt_secret, oauth_client_id, oauth_client_secret, pg_password
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_TOKEN` | Docker Hub access token |
| `PROD_BASTION_IP` | PROD Bastion Elastic IP — `54.88.140.158` (fixed) |
| `PROD_SSH_KEY` | Contents of PROD.pem private key |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `OAUTH_CLIENT_ID` | GitHub OAuth App Client ID |
| `OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `PG_PASSWORD` | PostgreSQL password |

---

## Docker Images

| Image | Tag | Environment | Registry |
|-------|-----|-------------|----------|
| `josephp2001/uce-auth-service` | `:qa` | QA | Docker Hub |
| `josephp2001/uce-auth-service` | `:latest` | PROD | Docker Hub |
| `josephp2001/uce-jobs-service` | `:qa` | QA | Docker Hub |
| `josephp2001/uce-jobs-service` | `:latest` | PROD | Docker Hub |

---

## Pipeline Run History

| Run | Branch | Result | Duration | Description |
|-----|--------|--------|----------|-------------|
| QA #30 | QA | ✅ | 2m 50s | feat(prod): Elastic IP, NAT Gateway, Target Groups |
| PROD #8 | master | ✅ | ~4m | feat(prod): Elastic IP, NAT Gateway, Target Groups |
| QA #16 | QA | ✅ | 2m 56s | feat(prod): Ansible PROD pipeline + Terraform fix |
| QA #15 | QA | ✅ | 2m 25s | fix(jobs-service): salary column schema |
| QA #14 | QA | ✅ | 2m 43s | fix(jobs-service): DB migration + Redis init |
| QA #13 | QA | ✅ | 3m 43s | feat(databases): PostgreSQL + Redis containers |

---

## Validated Endpoints — PROD

```bash
# Connect to PROD
ssh -i PROD.pem ubuntu@54.88.140.158

# Health checks
curl http://localhost:3000/health
# {"status":"ok","service":"auth-service"}

curl http://localhost:3001/health
# {"status":"ok","service":"jobs-service"}

# Create job (writes to PostgreSQL)
curl -X POST http://localhost:3001/jobs \
  -H "Content-Type: application/json" \
  -d '{"title":"Software Engineer","company":"UCE","location":"Quito","salary":"$3000"}'

# Read jobs — first call: source: database
curl http://localhost:3001/jobs

# Read jobs — second call: source: cache (Redis)
curl http://localhost:3001/jobs
```
