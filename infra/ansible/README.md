# Ansible

Automates software deployment on AWS EC2 instances — installs Docker, deploys containers, and injects secrets at runtime.

Ansible runs from **GitHub Actions** via SSH through the Bastion Host. Secrets are never hardcoded.

---

## How It Works

```
GitHub Actions
  └── ansible-playbook deploy-qa.yml -i "BASTION_IP,"
        └── SSH → Bastion Host (public subnet)
              └── Tasks executed on Bastion:
                    ├── Install Docker (if not present)
                    ├── Create Docker network: uce-network
                    ├── docker stop/rm postgres  → docker run postgres
                    ├── docker stop/rm redis     → docker run redis
                    ├── Wait for PostgreSQL to be ready
                    ├── docker pull auth-service
                    ├── docker pull jobs-service
                    ├── docker stop/rm auth-service → docker run auth-service
                    ├── docker stop/rm jobs-service → docker run jobs-service
                    └── docker ps (verify all containers running)
```

Secrets (`JWT_SECRET`, `PG_PASSWORD`, etc.) flow like this:

```
GitHub Secrets → GitHub Actions → Ansible -e vars → Docker -e ENV_VAR
```

---

## Playbooks

### deploy-qa.yml — QA Environment

**Target:** QA Bastion (`QA_BASTION_IP`)  
**Docker image tags:** `:qa`  
**Triggered by:** Push to `QA` branch via GitHub Actions

| Container | Image | Port | Network |
|-----------|-------|------|---------|
| postgres | postgres:15-alpine | 5432 (internal) | uce-network |
| redis | redis:7-alpine | 6379 (internal) | uce-network |
| auth-service | josephp2001/uce-auth-service:qa | 3000 | uce-network |
| jobs-service | josephp2001/uce-jobs-service:qa | 3001 | uce-network |

**Run manually:**
```bash
ansible-playbook infra/ansible/deploy-qa.yml \
  -i "QA_BASTION_IP," \
  --private-key ~/.ssh/QA.pem \
  -u ubuntu \
  -e "jwt_secret=YOUR_SECRET" \
  -e "oauth_client_id=YOUR_ID" \
  -e "oauth_client_secret=YOUR_SECRET" \
  -e "pg_password=YOUR_PASSWORD"
```

---

### deploy-prod.yml — PROD Environment

**Target:** PROD Bastion (`54.88.140.158` — Elastic IP, fixed)  
**Docker image tags:** `:latest`  
**Triggered by:** Merge to `master` via GitHub Actions

| Container | Image | Port | Network |
|-----------|-------|------|---------|
| postgres | postgres:15-alpine | 5432 (internal) | uce-network |
| redis | redis:7-alpine | 6379 (internal) | uce-network |
| auth-service | josephp2001/uce-auth-service:latest | 3000 | uce-network |
| jobs-service | josephp2001/uce-jobs-service:latest | 3001 | uce-network |

**Run manually:**
```bash
ansible-playbook infra/ansible/deploy-prod.yml \
  -i "54.88.140.158," \
  --private-key ~/.ssh/PROD.pem \
  -u ubuntu \
  -e "jwt_secret=YOUR_SECRET" \
  -e "oauth_client_id=YOUR_ID" \
  -e "oauth_client_secret=YOUR_SECRET" \
  -e "pg_password=YOUR_PASSWORD"
```

---

## Docker Network

Both services and databases share a Docker bridge network called `uce-network`. This allows containers to reach each other by name:

| From | To | Hostname |
|------|----|----------|
| auth-service | Redis | `redis` |
| jobs-service | Redis | `redis` |
| jobs-service | PostgreSQL | `postgres` |

No container exposes database ports to the host — only service ports (3000, 3001) are mapped externally.

---

## Persistent Volumes

| Volume | Used by | Data |
|--------|---------|------|
| `pg_data` | postgres | PostgreSQL data — survives container restarts |
| `redis_data` | redis | Redis AOF persistence |

---

## Secret Injection

Secrets are passed as Ansible extra vars and injected as Docker environment variables at container start. Example for jobs-service:

```yaml
- name: Run jobs-service container
  shell: |
    docker run -d \
      --name jobs-service \
      --network uce-network \
      -e PG_HOST=postgres \
      -e PG_PASSWORD="{{ pg_password }}" \
      -e REDIS_HOST=redis \
      josephp2001/uce-jobs-service:qa
```

The `{{ pg_password }}` is replaced by Ansible at runtime with the value passed via `-e "pg_password=..."` from GitHub Actions — which reads it from GitHub Secrets.
