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
                    ├── Free disk space (Docker prune, apt clean, log truncation)
                    ├── Install Docker (if not present)
                    ├── Create Docker network: uce-network
                    ├── docker stop/rm postgres  → docker run postgres
                    ├── docker stop/rm redis     → docker run redis
                    ├── Wait for PostgreSQL to be ready
                    ├── docker stop/rm auth-service, jobs-service, profile-service, web-app
                    ├── docker pull auth-service, jobs-service, profile-service, web-app
                    ├── docker run auth-service, jobs-service, profile-service, web-app
                    ├── Copy nginx.conf → docker run nginx
                    └── docker ps (verify all containers running)
```

Secrets (`JWT_SECRET`, `PG_PASSWORD`, etc.) flow like this:

```
GitHub Secrets → GitHub Actions → Ansible -e vars → Docker -e ENV_VAR
```

---

## Playbooks

### deploy-qa.yml — QA Environment

**Target:** QA Bastion (`52.20.54.196` — Elastic IP, fixed)
**Docker image tags:** `:qa`
**Triggered by:** Push to `QA` branch via GitHub Actions

| Container | Image | Port | Network |
|-----------|-------|------|---------|
| postgres | postgres:15-alpine | 5432 (internal) | uce-network |
| redis | redis:7-alpine | 6379 (internal) | uce-network |
| auth-service | josephp2001/uce-auth-service:qa | 3000 | uce-network |
| jobs-service | josephp2001/uce-jobs-service:qa | 3001 | uce-network |
| profile-service | josephp2001/uce-profile-service:qa | 3003 | uce-network |
| web-app | josephp2001/uce-web-app:qa | 3002 | uce-network |
| nginx | nginx:alpine | 80 (public) | uce-network |

**Run manually:**
```bash
ansible-playbook infra/ansible/deploy-qa.yml \
  -i "52.20.54.196," \
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
| profile-service | josephp2001/uce-profile-service:latest | 3003 | uce-network |
| web-app | josephp2001/uce-web-app:latest | 3002 | uce-network |
| nginx | nginx:alpine | 80 (public) | uce-network |

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

## Disk Space Management

The playbook runs three cleanup tasks **before** any `apt` or `docker pull` to prevent `no space left on device` failures:

```yaml
- docker system prune -af --volumes   # removes unused images, containers, volumes, build cache
- apt-get clean                        # clears apt package cache
- journalctl --vacuum-size=50M         # truncates system logs to 50MB
```

These run every deploy and are safe — only unused resources are removed. Active containers and their volumes (`pg_data`, `redis_data`) are preserved because the stop/remove tasks run after cleanup.

---

## Docker Network

All services share a Docker bridge network called `uce-network`. Containers reach each other by name:

| From | To | Hostname |
|------|----|----------|
| auth-service | Redis | `redis` |
| jobs-service | Redis | `redis` |
| jobs-service | PostgreSQL | `postgres` |
| profile-service | PostgreSQL | `postgres` |
| nginx | auth-service | `auth-service` |
| nginx | jobs-service | `jobs-service` |
| nginx | profile-service | `profile-service` |
| nginx | web-app | `web-app` |

No database ports are exposed to the host. Only port `80` (nginx) is public.

---

## Persistent Volumes

| Volume | Used by | Data |
|--------|---------|------|
| `pg_data` | postgres | PostgreSQL data — survives container restarts |
| `redis_data` | redis | Redis AOF persistence |

---

## Secret Injection

Secrets are passed as Ansible extra vars and injected as Docker environment variables at container start:

```yaml
- name: Run profile-service container
  shell: |
    docker run -d \
      --name profile-service \
      --network uce-network \
      -e PORT=3003 \
      -e POSTGRES_HOST=postgres \
      -e POSTGRES_PASSWORD="{{ pg_password }}" \
      -e JWT_SECRET="{{ jwt_secret }}" \
      josephp2001/uce-profile-service:qa
```

The `{{ pg_password }}` is replaced by Ansible at runtime with the value passed via `-e "pg_password=..."` from GitHub Actions — which reads it from GitHub Secrets.