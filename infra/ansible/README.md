# Ansible

Automates software deployment on AWS EC2 instances — installs Docker, deploys all containers, configures PostgreSQL replication, and injects secrets at runtime.

Ansible runs from **GitHub Actions** via SSH through the Bastion Host. Secrets are never hardcoded.

**QA and PROD are not symmetric.** `deploy-qa.yml` now targets three host groups (`qa_ec2`, `qa_bastion`, `qa_replica`) and runs two services (`audit-service`, `analytics-service`) and an MQTT broker (`mosquitto`) that `deploy-prod.yml` does not. See the per-playbook sections below for the exact current state of each.

---

## How It Works (QA)

```
GitHub Actions
  └── ansible-playbook deploy-qa.yml -i inventory
        │
        ├── PLAY 1: qa_ec2 (main services host, via SSH)
        │     ├── Free disk space (Docker prune, apt clean, log truncation)
        │     ├── Install Docker (if not present)
        │     ├── Create Docker network: uce-network
        │     │
        │     ├── Databases (idempotent — only starts if not running)
        │     │     ├── postgres
        │     │     └── redis
        │     │
        │     ├── PostgreSQL replication setup (idempotent, primary side)
        │     │     ├── Create replicator role (REPLICATION privilege)
        │     │     ├── Allow replication from Docker network + VPC in pg_hba.conf
        │     │     └── Reload PostgreSQL config
        │     │
        │     ├── Messaging infrastructure (idempotent)
        │     │     ├── zookeeper
        │     │     ├── kafka
        │     │     ├── rabbitmq
        │     │     ├── mongodb
        │     │     └── mosquitto (MQTT broker)
        │     │
        │     ├── Services (always stopped → pulled → restarted)
        │     │     ├── auth-service
        │     │     ├── jobs-service
        │     │     ├── profile-service
        │     │     ├── notification-service
        │     │     ├── matching-service
        │     │     ├── audit-service
        │     │     ├── analytics-service
        │     │     └── web-app
        │     │
        │     ├── Copy nginx.conf → docker run nginx
        │     └── docker ps (verify all containers running)
        │
        ├── PLAY 2: qa_bastion (reverse proxy host)
        │     ├── Install Nginx
        │     ├── Configure reverse proxy → qa_ec2 private IP
        │     └── Restart Nginx
        │
        └── PLAY 3: qa_replica (separate EC2, streaming replica)
              ├── Install Docker
              └── Start postgres-replica container
                    (pg_basebackup from primary on first run only,
                     then standby/recovery mode on every subsequent run)
```

Secrets flow like this:

```
GitHub Secrets → GitHub Actions → Ansible -e vars → Docker -e ENV_VAR
```

---

## PostgreSQL Replication Setup — current status: **implemented end‑to‑end in QA**

Primary-side setup runs on `qa_ec2`, between the database startup tasks and the messaging infrastructure tasks. All primary-side steps are idempotent — safe to run on every deploy without side effects on an already-configured primary.

```yaml
- name: Ensure replication user exists in PostgreSQL
  shell: |
    docker exec postgres psql -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='replicator'" | grep -q 1 || \
    docker exec postgres psql -U postgres -c "CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD '{{ postgres_replicator_password }}';"

- name: Ensure pg_hba.conf allows replication from Docker network
  shell: |
    docker exec postgres grep -q "host replication replicator 172.18.0.0/16" /var/lib/postgresql/data/pg_hba.conf || \
    docker exec postgres bash -c "echo 'host replication replicator 172.18.0.0/16 md5' >> /var/lib/postgresql/data/pg_hba.conf"

- name: Ensure pg_hba.conf allows replication from whole VPC (replica EC2 in us-east-1b)
  shell: |
    docker exec postgres grep -q "host replication replicator 10.0.0.0/16" /var/lib/postgresql/data/pg_hba.conf || \
    docker exec postgres bash -c "echo 'host replication replicator 10.0.0.0/16 md5' >> /var/lib/postgresql/data/pg_hba.conf"

- name: Reload PostgreSQL config to apply pg_hba.conf changes
  shell: docker exec postgres psql -U postgres -c "SELECT pg_reload_conf();"
```

**Replica side (`qa_replica` host group, separate EC2 in `us-east-1b`):** a `postgres-replica` container runs `pg_basebackup` against the primary on first run only (empty volume check), writing `postgresql.auto.conf` via the `-R` flag so it comes up directly in standby/recovery mode. On every later run the volume already has data, so the task just restarts the existing container — this is what makes the play idempotent.

**Verified state (QA primary):**

```bash
docker exec postgres psql -U postgres -c "SELECT usename, userepl FROM pg_user;"
#   usename   | userepl
# ------------+---------
#  postgres   | t
#  replicator | t

docker exec postgres cat /var/lib/postgresql/data/pg_hba.conf | grep replicator
# host replication replicator 172.18.0.0/16 md5
# host replication replicator 10.0.0.0/16 md5
```

> **⚠️ Open issue — intermittent hang on `qa_replica`:** the "Add Docker GPG key" task on the `qa_replica` host currently uses `async: 30` / `poll: 5` as a workaround for a hang believed to come from the interaction between Ansible's `-tt` flag, `become`'s use of a pty, and SSH `ControlMaster` multiplexing over a `ProxyJump`/bastion connection. The CI workflow also currently runs the whole `ansible-playbook` call with `-vvv` to capture more detail on this. Both should be considered temporary until the root cause is confirmed and can likely be removed/reverted once it is.

> **PROD has no equivalent.** There is no `prod_replica` host group, no replica container, and the `postgres_replicator_password` variable is not used anywhere in `deploy-prod.yml` — PROD currently runs a single PostgreSQL primary with no read replica or replication setup at all.

---

## Playbooks

### deploy-qa.yml — QA Environment

**Targets:** `qa_ec2` (main services, self-hosted runner), `qa_bastion` (reverse proxy), `qa_replica` (Postgres standby — separate EC2)
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
| `mosquitto` | `eclipse-mosquitto:2.0` | **1883 (public)** — QA only |
| `postgres-replica` | `postgres:15-alpine` | 5432 (internal, on `qa_replica` host) |

#### Services

| Container | Image | Port |
|-----------|-------|------|
| `auth-service` | `josephp2001/uce-auth-service:qa` | 3000 (internal) |
| `jobs-service` | `josephp2001/uce-jobs-service:qa` | 3001 (internal) |
| `web-app` | `josephp2001/uce-web-app:qa` | 3002 (internal) |
| `profile-service` | `josephp2001/uce-profile-service:qa` | 3003 (internal) |
| `notification-service` | `josephp2001/uce-notification-service:qa` | 3004 (internal) |
| `matching-service` | `josephp2001/uce-matching-service:qa` | 3005 (internal) |
| `audit-service` | `josephp2001/uce-audit-service:qa` | 3006 (internal) — QA only |
| `analytics-service` | `josephp2001/uce-analytics-service:qa` | 3007 (internal) — QA only |
| `nginx` | `nginx:alpine` | **80 (public)** |

**Run manually** (main services host only — `qa_bastion` and `qa_replica` need their own inventory entries to also run):
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

> No `mosquitto` container in PROD — it's QA-only at this point.

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

> No `audit-service` or `analytics-service` container in PROD — see Known gaps below.

> **Known gap:** the `postgres_replicator_password` task block — and the replica itself — have not yet been ported to `deploy-prod.yml`. Currently only QA has PostgreSQL streaming replication (primary configured + a live `postgres-replica` on a second EC2). PROD runs a single, unreplicated PostgreSQL primary.

> **Known gap — service parity:** `deploy-prod.yml` has no tasks for `audit-service` or `analytics-service` — they are not stopped, pulled, or run on PROD. There's also no `:latest` image for either in Docker Hub yet (see the CI/CD README).

> **⚠️ Risk to verify:** the `nginx.conf` copied into the PROD `nginx` container is the same file used in QA (`infra/nginx/nginx.conf`), which already routes `/api/audit/` and `/api/analytics/` to `audit-service:3006` / `analytics-service:3007`. Since those containers don't exist on PROD, confirm this doesn't break PROD's nginx container on the next deploy (either at startup, via hostname resolution, or as a silent 502 on those two routes).

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

Three cleanup tasks run **before** any `apt` or `docker pull` to prevent `no space left on device` failures, on both QA and PROD:

```bash
docker system prune -af --volumes   # removes unused images, containers, volumes, build cache
apt-get clean                        # clears apt package cache
journalctl --vacuum-size=50M         # truncates system logs to 50MB
```

These run on every deploy and are safe — only unused resources are removed. Active containers and persistent volumes (`pg_data`, `redis_data`, `mongo_data`) are preserved.

---

## Startup Order (qa_ec2 / prod_ec2)

Databases, replication setup, and messaging infrastructure use idempotent checks (`docker ps | grep -q name || docker run`, or `SELECT ... | grep -q 1 || CREATE`) — they only run if not already in the desired state. Services always stop, pull, and restart on every deploy.

```
1. postgres, redis              (databases)
2. Wait for PostgreSQL ready
3. PostgreSQL replication setup (replicator role + pg_hba.conf + reload)  — QA only
4. zookeeper
5. Wait 10s
6. kafka, rabbitmq, mongodb, mosquitto (messaging)                       — mosquitto: QA only
7. Wait 15s for Kafka
8. auth, jobs, profile, notification, matching, audit*, analytics*, web-app, nginx
```
`*` audit-service and analytics-service: QA only.

---

## Docker Network

All containers share `uce-network` (subnet `172.18.0.0/16` in QA; PROD creates its own `uce-network` the same way, on its own host). They communicate by container name:

| From | To | Hostname |
|------|----|----------|
| `auth-service` | Redis | `redis` |
| `jobs-service` | PostgreSQL, Redis, Kafka | `postgres`, `redis`, `kafka` |
| `profile-service` | PostgreSQL | `postgres` |
| `notification-service` | PostgreSQL, RabbitMQ, Mosquitto (QA only) | `postgres`, `rabbitmq`, `mosquitto` |
| `matching-service` | PostgreSQL, Kafka, RabbitMQ | `postgres`, `kafka`, `rabbitmq` |
| `audit-service` (QA only) | PostgreSQL, Kafka | `postgres`, `kafka` |
| `analytics-service` (QA only) | PostgreSQL, MongoDB | `postgres`, `mongodb` |
| `nginx` | All services | `auth-service`, `jobs-service`, etc. |

No database or messaging ports are exposed to the host, except Mosquitto (`1883`, QA only — required for external MQTT clients). In QA, ports `80` (nginx) and `1883` (mosquitto) are public. In PROD, only port `80` (nginx) is public.

---

## Persistent Volumes

| Volume | Used by | Host | Data |
|--------|---------|------|------|
| `pg_data` | `postgres` | `qa_ec2` / `prod_ec2` | PostgreSQL data — survives container restarts |
| `redis_data` | `redis` | `qa_ec2` / `prod_ec2` | Redis AOF persistence |
| `mongo_data` | `mongodb` | `qa_ec2` / `prod_ec2` | MongoDB data |
| `pg_replica_data` | `postgres-replica` | `qa_replica` only | Streaming replica data directory (cloned via `pg_basebackup`) |

---

## Secret Injection

Secrets are passed as Ansible extra vars (`-e`) and injected as Docker environment variables:

```
GitHub Secrets → GitHub Actions -e → Ansible {{ var }} → Docker -e ENV_VAR
```

| Secret | Services that use it | QA | PROD |
|--------|----------------------|----|------|
| `jwt_secret` | auth-service, jobs-service, profile-service, notification-service | ✅ | ✅ |
| `pg_password` | jobs-service, profile-service, notification-service, matching-service, audit-service, analytics-service | ✅ | ✅ (services that exist there) |
| `rabbitmq_password` | notification-service, matching-service | ✅ | ✅ |
| `postgres_replicator_password` | PostgreSQL replication setup (primary + replica) | ✅ | ❌ not ported yet |
| `oauth_client_id` / `oauth_client_secret` | auth-service | ✅ | ✅ |
| `bastion_ip` | auth-service (`FRONTEND_URL`), Nginx routing on the bastion | ✅ | ✅ (used in SSH ProxyCommand, not passed to a container env var) |
| `ec2_private_ip` | Nginx reverse proxy on the QA bastion | ✅ | ❌ not used — PROD's bastion doesn't run a reverse-proxy play |