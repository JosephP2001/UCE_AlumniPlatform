# GitHub Actions — CI/CD Workflows

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
**Environment:** QA (`52.20.54.196` — Elastic IP, fixed)
**Docker tags:** `:qa`

### Pipeline Steps

```
push to QA
  │
  ├── 1. Checkout code
  ├── 2. Set up Node.js 24
  ├── 3. npm install (root)
  │
  ├── 4. Run tests — auth-service (8/8) ✅
  ├── 5. Run tests — jobs-service (6/6) ✅
  ├── 6. Run tests — profile-service ✅
  │
  ├── 7. Login to Docker Hub
  ├── 8. Build + push josephp2001/uce-auth-service:qa
  ├── 9. Build + push josephp2001/uce-jobs-service:qa
  ├── 10. Build + push josephp2001/uce-profile-service:qa
  ├── 11. Build + push josephp2001/uce-web-app:qa
  │        (NEXT_PUBLIC_AUTH_URL and NEXT_PUBLIC_JOBS_URL — no port, routed through Nginx)
  │
  ├── 12. Setup SSH key (QA_SSH_KEY → ~/.ssh/QA.pem)
  │        ssh-keyscan QA_BASTION_IP → known_hosts
  │
  └── 13. Deploy via Ansible
           ansible-playbook infra/ansible/deploy-qa.yml
             -i QA_BASTION_IP
             -e jwt_secret, oauth_client_id, oauth_client_secret, pg_password
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Docker Hub username |
| `DOCKER_TOKEN` | Docker Hub access token |
| `QA_BASTION_IP` | QA Bastion Elastic IP — `52.20.54.196` (fixed) |
| `QA_SSH_KEY` | Contents of QA.pem private key |
| `QA_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID (QA app) |
| `QA_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret (QA app) |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `PG_PASSWORD` | PostgreSQL password |

---

## deploy-prod.yml

**Trigger:** Push to `master` branch (merge of approved PR)
**Environment:** PROD (`54.88.140.158` — Elastic IP, fixed / `josheponcepro1.distribuidauce.org`)
**Docker tags:** `:latest`

### Pipeline Steps

```
merge to master
  │
  ├── 1. Checkout code
  ├── 2. Set up Node.js 24
  ├── 3. npm install (root)
  │
  ├── 4. Run tests — auth-service (8/8) ✅
  ├── 5. Run tests — jobs-service (6/6) ✅
  ├── 6. Run tests — profile-service ✅
  │
  ├── 7. Login to Docker Hub
  ├── 8. Build + push josephp2001/uce-auth-service:latest
  ├── 9. Build + push josephp2001/uce-jobs-service:latest
  ├── 10. Build + push josephp2001/uce-profile-service:latest
  ├── 11. Build + push josephp2001/uce-web-app:latest
  │
  ├── 12. Setup SSH keys
  │        PROD_SSH_KEY → ~/.ssh/PROD.pem
  │        ssh-keyscan PROD_BASTION_IP → known_hosts
  │        ssh jump → ssh-keyscan PROD_AUTH_JOBS_IP → known_hosts
  │
  ├── 13. Create Ansible inventory (SSH ProxyCommand through Bastion)
  │
  └── 14. Deploy via Ansible
           ansible-playbook infra/ansible/deploy-prod.yml
             -i /tmp/prod_inventory.ini
             -e jwt_secret, oauth_client_id, oauth_client_secret, pg_password, bastion_ip
```

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

---

## Docker Images

| Image | Tag | Environment | Registry |
|-------|-----|-------------|----------|
| `josephp2001/uce-auth-service` | `:qa` | QA | Docker Hub |
| `josephp2001/uce-auth-service` | `:latest` | PROD | Docker Hub |
| `josephp2001/uce-jobs-service` | `:qa` | QA | Docker Hub |
| `josephp2001/uce-jobs-service` | `:latest` | PROD | Docker Hub |
| `josephp2001/uce-profile-service` | `:qa` | QA | Docker Hub |
| `josephp2001/uce-profile-service` | `:latest` | PROD | Docker Hub |
| `josephp2001/uce-web-app` | `:qa` | QA | Docker Hub |
| `josephp2001/uce-web-app` | `:latest` | PROD | Docker Hub |