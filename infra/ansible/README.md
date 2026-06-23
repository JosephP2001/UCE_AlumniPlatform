# Ansible

Automates software deployment on AWS EC2 instances — installs Docker, deploys all containers, configures PostgreSQL replication, and injects secrets at runtime.

Ansible runs from **GitHub Actions** via SSH through the Bastion Host. Secrets are never hardcoded.

---

## How It Works

```
GitHub Actions
  └── ansible-playbook deploy-qa.yml -i inventory
        └── SSH → Bastion Host (public subnet)
              └── Tasks executed on EC2:
                    ├── Free disk space (Docker prune, apt clean, log truncation)
                    ├── Install Docker (if not present)
                    ├── Create Docker network: uce-network
                    │
                    ├── Databases (idempotent — only starts if not running)
                    │     ├── postgres
                    │     └── redis
                    │
                    ├── PostgreSQL replication setup (idempotent)
                    │     ├── Create replicator role (REPLICATION privilege)
                    │     ├── Allow replication from Docker network in pg_hba.conf
                    │     └── Reload PostgreSQL config
                    │
                    ├── Messaging infrastructure (idempotent)
                    │     ├── zookeeper
                    │     ├── kafka
                    │     ├── rabbitmq
                    │     └── mongodb
                    │
                    ├── Services (always stopped → pulled → restarted)
                    │     ├── auth-service
                    │     ├── jobs-service
                    │     ├── profile-service
                    │     ├── notification-service
                    │     ├── matching-service
                    │     └── web-app
                    │
                    ├── Copy nginx.conf → docker run nginx
                    └── docker ps (verify all containers running)
```

Secrets flow like this:

```
GitHub Secrets → GitHub Actions → Ansible -e vars → Docker -e ENV_VAR
```

---

## PostgreSQL Replication Setup

Added between the database startup tasks and the messaging infrastructure tasks. All steps are idempotent — safe to run on every deploy without side effects on an already-configured primary.

```yaml
- name: Ensure replication user exists in PostgreSQL
  shell: |
    docker exec postgres psql -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='replicator'" | grep -q 1 || \
    docker exec postgres psql -U postgres -c "CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD '{{ postgres_replicator_password }}';"

- name: Ensure pg_hba.conf allows replication from Docker network
  shell: |
    docker exec postgres grep -q "host replication replicator 172.18.0.0/16" /var/lib/postgresql/data/pg_hba.conf || \
    docker exec postgres bash -c "echo 'host replication replicator 172.18.0.0/16 md5' >> /var/lib/postgresql/data/pg_hba.conf"

- name: Reload PostgreSQL config to apply pg_hba.conf changes
  shell: docker exec postgres psql -U postgres -c "SELECT pg_reload_conf();"
```

**Verified state (QA primary):**

```bash
docker exec postgres psql -U postgres -c "SELECT usename, userepl FROM pg_user;"
#   usename   | userepl
# ------------+---------
#  postgres   | t
#  replicator | t

docker exec postgres cat /var/lib/postgresql/data/pg_hba.conf | grep replicator
# host replication replicator 172.18.0.0/16 md5
```

> The Docker network CIDR (`172.18.0.0/16`) is specific to `uce-network` — confirmed via `docker network inspect uce-network`. The default `bridge` network uses `172.17.0.0/16`, which is different.

> **Status:** the primary is fully configured to accept a streaming replica. The replica container itself (using `pg_basebackup` at startup, no custom AMI required) is not yet implemented.

---

## Playbooks

### deploy-qa.yml — QA Environment

**Target:** QA EC2 via self-hosted runner (Bastion `98.86.126.222` — Elastic IP)
**Docker image tags:** `:qa`
**Triggered by:** Push to `QA` branch

#### Databases & Messaging

| Container | Image | Port |
|-----------|-------|------|
| `postgres` | `postgres:15-alpine` | 5432 (internal) |
| `redis` | `redis:7-alpine` | 6379 (internal) |
| `zookeeper` | `confluentinc/cp-zookeeper:7.4.0` | 2181 (internal) |
| `kafka` | `confluentinc/cp-kafka:7.4.0` | 9092 (internal) |
| `rabbitmq` | `rabbitmq:3.12-management-alpine` | 5672 / 15672 (internal) |
| `mongodb` | `mongo:7-jammy` | 27017 (internal) |
| `mosquitto` | `eclipse-mosquitto:2.0` | 1883 (public) |

#### Services

| Container | Image | Port |
|-----------|-------|------|
| `auth-service` | `josephp2001/uce-auth-service:qa` | 3000 (internal) |
| `jobs-service` | `josephp2001/uce-jobs-service:qa` | 3001 (internal) |
| `web-app` | `josephp2001/uce-web-app:qa` | 3002 (internal) |
| `profile-service` | `josephp2001/uce-profile-service:qa` | 3003 (internal) |
| `notification-service` | `josephp2001/uce-notification-service:qa` | 3004 (internal) |
| `matching-service` | `josephp2001/uce-matching-service:qa` | 3005 (internal) |
| `nginx` | `nginx:alpine` | **80 (public)** |

**Run manually:**
```bash
ansible-playbook infra/ansible/deploy-qa.yml \
  -i "98.86.126.222," \
  --private-key ~/.ssh/QA-new.pem \
  -u ubuntu \
  -e "jwt_secret=YOUR_SECRET" \
  -e "oauth_client_id=YOUR_ID" \
  -e "oauth_client_secret=YOUR_SECRET" \
  -e "pg_password=YOUR_PASSWORD" \
  -e "rabbitmq_password=YOUR_PASSWORD" \
  -e "postgres_replicator_password=YOUR_PASSWORD" \
  -e "bastion_ip=98.86.126.222" \
  -e "ec2_private_ip=YOUR_PRIVATE_IP"
```

---

### deploy-prod.yml — PROD Environment

**Target:** PROD private EC2 via SSH ProxyCommand through Bastion (`54.88.140.158` — Elastic IP)
**Docker image tags:** `:latest`
**Triggered by:** Merge to `master`

#### Databases & Messaging

| Container | Image | Port |
|-----------|-------|------|
| `postgres` | `postgres:15-alpine` | 5432 (internal) |
| `redis` | `redis:7-alpine` | 6379 (internal) |
| `zookeeper` | `confluentinc/cp-zookeeper:7.4.0` | 2181 (internal) |
| `kafka` | `confluentinc/cp-kafka:7.4.0` | 9092 (internal) |
| `rabbitmq` | `rabbitmq:3.12-management-alpine` | 5672 / 15672 (internal) |
| `mongodb` | `mongo:7-jammy` | 27017 (internal) |

#### Services

| Container | Image | Port |
|-----------|-------|------|
| `auth-service` | `josephp2001/uce-auth-service:latest` | 3000 (internal) |
| `jobs-service` | `josephp2001/uce-jobs-service:latest` | 3001 (internal) |
| `web-app` | `josephp2001/uce-web-app:latest` | 3002 (internal) |
| `profile-service` | `josephp2001/uce-profile-service:latest` | 3003 (internal) |
| `notification-service` | `josephp2001/uce-notification-service:latest` | 3004 (internal) |
| `matching-service` | `josephp2001/uce-matching-service:latest` | 3005 (internal) |
| `nginx` | `nginx:alpine` | **80 (public)** |

> **Known gap:** the `postgres_replicator_password` task block has not yet been ported to `deploy-prod.yml`. Currently only QA's PostgreSQL primary is configured for replication.

**Run manually:**
```bash
ansible-playbook infra/ansible/deploy-prod.yml \
  -i /tmp/prod_inventory.ini \
  --private-key ~/.ssh/PROD.pem \
  -e "jwt_secret=YOUR_SECRET" \
  -e "oauth_client_id=YOUR_ID" \
  -e "oauth_client_secret=YOUR_SECRET" \
  -e "pg_password=YOUR_PASSWORD" \
  -e "rabbitmq_password=YOUR_PASSWORD" \
  -e "bastion_ip=54.88.140.158"
```

> PROD uses SSH ProxyCommand through Bastion — services run on a private EC2, not the Bastion itself. The inventory is generated by the CI/CD workflow at deploy time.

---

## Disk Space Management

Three cleanup tasks run **before** any `apt` or `docker pull` to prevent `no space left on device` failures:

```bash
docker system prune -af --volumes   # removes unused images, containers, volumes, build cache
apt-get clean                        # clears apt package cache
journalctl --vacuum-size=50M         # truncates system logs to 50MB
```

These run on every deploy and are safe — only unused resources are removed. Active containers and persistent volumes (`pg_data`, `redis_data`, `mongo_data`) are preserved.

---

## Startup Order

Databases, replication setup, and messaging infrastructure use idempotent checks (`docker ps | grep -q name || docker run`, or `SELECT ... | grep -q 1 || CREATE`) — they only run if not already in the desired state. Services always stop, pull, and restart on every deploy.

```
1. postgres, redis              (databases)
2. Wait for PostgreSQL ready
3. PostgreSQL replication setup (replicator role + pg_hba.conf + reload)
4. zookeeper
5. Wait 10s
6. kafka, rabbitmq, mongodb, mosquitto (messaging)
7. Wait 15s for Kafka
8. auth, jobs, profile, notification, matching, web-app, nginx
```

---

## Docker Network

All containers share `uce-network` (subnet `172.18.0.0/16` in QA). They communicate by container name:

| From | To | Hostname |
|------|----|----------|
| `auth-service` | Redis | `redis` |
| `jobs-service` | PostgreSQL, Redis, Kafka | `postgres`, `redis`, `kafka` |
| `profile-service` | PostgreSQL | `postgres` |
| `notification-service` | PostgreSQL, RabbitMQ, Mosquitto | `postgres`, `rabbitmq`, `mosquitto` |
| `matching-service` | PostgreSQL, Kafka, RabbitMQ | `postgres`, `kafka`, `rabbitmq` |
| `nginx` | All services | `auth-service`, `jobs-service`, etc. |

No database or messaging ports are exposed to the host, except Mosquitto (`1883`, required for external MQTT clients). Only port `80` (nginx) and `1883` (mosquitto) are public in QA.

---

## Persistent Volumes

| Volume | Used by | Data |
|--------|---------|------|
| `pg_data` | `postgres` | PostgreSQL data — survives container restarts |
| `redis_data` | `redis` | Redis AOF persistence |
| `mongo_data` | `mongodb` | MongoDB data |

---

## Secret Injection

Secrets are passed as Ansible extra vars (`-e`) and injected as Docker environment variables:

```
GitHub Secrets → GitHub Actions -e → Ansible {{ var }} → Docker -e ENV_VAR
```

| Secret | Services that use it |
|--------|----------------------|
| `jwt_secret` | auth-service, jobs-service, profile-service, notification-service |
| `pg_password` | jobs-service, profile-service, notification-service, matching-service |
| `rabbitmq_password` | notification-service, matching-service |
| `postgres_replicator_password` | PostgreSQL replication setup (QA only — see Known gap above) |
| `oauth_client_id/secret` | auth-service |
| `bastion_ip` | auth-service (`FRONTEND_URL`), Nginx routing |
| `ec2_private_ip` | Nginx reverse proxy on bastion |