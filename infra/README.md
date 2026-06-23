# Infrastructure

Infrastructure-as-Code for the UCE Alumni & Employment Platform.

---

## Tools

| Tool | Purpose |
|------|---------|
| **Terraform** | Provisions AWS cloud resources (EC2, VPC, subnets, ELB, ASG, security groups, EIP, DynamoDB lock) |
| **Ansible** | Configures machines after provisioning — installs Docker, deploys all containers, configures PostgreSQL replication, injects secrets |

---

## Environments

| Environment | AWS Account | Bastion EIP | Domain | Orchestration |
|-------------|-------------|-------------|--------|---------------|
| QA | `782987290346` | `98.86.126.222` | — | Docker via Ansible (self-hosted runner) |
| PROD | `471904521253` | `54.88.140.158` | `josheponcepro1.distribuidauce.org` | Docker via Ansible (direct SSH) |

QA and PROD are in **separate AWS accounts with no VPC peering** — a misconfiguration in QA cannot affect PROD.

Both Bastions have **Elastic IPs** — they do not change between AWS sessions, but the private EC2/instance IPs can change if a session/lab is restarted without an attached Elastic IP, requiring a GitHub Secrets update (see `Guia_Nueva_Sesion_AWS.docx`).

---

## Directory Structure

```
infra/
├── terraform/
│   ├── main.tf          # QA — VPC (1 AZ), Bastion, EC2, EIP, DynamoDB lock
│   ├── prod/
│   │   ├── main.tf      # PROD — VPC (2 AZs), Bastion, Launch Template, ASG, ELB, target groups
│   │   └── PROD.pub     # Public key for PROD key pair
│   └── README.md
├── ansible/
│   ├── deploy-qa.yml    # QA deployment playbook
│   ├── deploy-prod.yml  # PROD deployment playbook
│   └── README.md
└── nginx/
    └── nginx.conf       # Reverse proxy config
```

---

## Security Design

- All service EC2 instances run in **private subnets** — no public IP
- Only the Bastion Host has a public IP (Elastic IP)
- Developer SSH: `Developer → Bastion → private EC2`
- PROD user traffic (current pipeline): `Internet → Bastion (reverse proxy) → private EC2`
- Secrets injected at deploy time via Ansible — **never hardcoded in code or config files**
- QA and PROD use **separate GitHub OAuth Apps** with separate credentials

---

## PROD Terraform — ASG/ELB Status

`infra/terraform/prod/main.tf` defines an Auto Scaling Group (min 1, max 3), an Application Load Balancer, a Launch Template (Ubuntu AMI + Docker-install `user_data` — no custom AMI, compatible with AWS Academy student account restrictions), and target groups for `auth-service`, `jobs-service`, and `web-app`.

**This infrastructure exists in Terraform but is not yet used by the deployment pipeline.** `deploy-prod.yml` still deploys via direct SSH + `docker stop/rm/run` against a single fixed private EC2 (`PROD_AUTH_JOBS_IP`), the same pattern used in QA. This means:

- The ASG/ELB resources may or may not currently be applied in AWS — state should be verified with `terraform plan` before further work.
- The Launch Template's `user_data` only installs Docker — it does not yet pull or run any service containers, so a fresh ASG-launched instance would fail its health check.
- There is no `profile-service` target group yet, despite `profile-service` being one of the three services selected for ASG coverage (alongside `auth-service` and `jobs-service` — chosen because they receive direct, synchronous user traffic, unlike async/internal services such as `matching-service` or `audit-service`).
- Achieving true zero-downtime PROD deploys (a now-mandatory requirement) requires rewriting the `deploy` job in `deploy-prod.yml` to trigger an ASG instance refresh (`aws autoscaling start-instance-refresh`) instead of direct SSH.

This is tracked as pending infrastructure work, not yet started.

---

## Deployed Containers

Every environment runs the following containers on `uce-network`:

| Container | Image | Port |
|-----------|-------|------|
| `postgres` | `postgres:15-alpine` | 5432 (internal) |
| `redis` | `redis:7-alpine` | 6379 (internal) |
| `zookeeper` | `confluentinc/cp-zookeeper:7.4.0` | 2181 (internal) |
| `kafka` | `confluentinc/cp-kafka:7.4.0` | 9092 (internal) |
| `rabbitmq` | `rabbitmq:3.12-management-alpine` | 5672 / 15672 (internal) |
| `mongodb` | `mongo:7-jammy` | 27017 (internal) |
| `mosquitto` | `eclipse-mosquitto:2.0` | 1883 (public, QA) |
| `auth-service` | `josephp2001/uce-auth-service` | 3000 (internal) |
| `jobs-service` | `josephp2001/uce-jobs-service` | 3001 (internal) |
| `web-app` | `josephp2001/uce-web-app` | 3002 (internal) |
| `profile-service` | `josephp2001/uce-profile-service` | 3003 (internal) |
| `notification-service` | `josephp2001/uce-notification-service` | 3004 (internal) |
| `matching-service` | `josephp2001/uce-matching-service` | 3005 (internal) |
| `nginx` | `nginx:alpine` | **80 (public)** |

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
| `/rabbitmq/*` | RabbitMQ Management UI | 15672 |
| `/*` | web-app | 3002 |

---

## Terraform State

State files are stored remotely in S3 with locking:

| Environment | S3 Bucket | Key |
|-------------|-----------|-----|
| QA | `uce-alumni-tfstate-qa-026658` | `qa/terraform.tfstate` |
| PROD | `uce-alumni-tfstate` | `prod/terraform.tfstate` |

---

## Ansible Secrets (injected via CI/CD)

| Variable | Description |
|----------|--------------|
| `jwt_secret` | Shared JWT signing secret (auth + profile + notification) |
| `oauth_client_id` | GitHub OAuth App Client ID |
| `oauth_client_secret` | GitHub OAuth App Client Secret |
| `pg_password` | PostgreSQL password |
| `rabbitmq_password` | RabbitMQ admin password |
| `postgres_replicator_password` | Password for PostgreSQL `replicator` role (streaming replication, QA only so far) |
| `bastion_ip` | Bastion EIP — used for `FRONTEND_URL` in auth-service and Nginx reverse proxy |
| `ec2_private_ip` | Private EC2 IP — used for Nginx reverse proxy on bastion (QA) |

All variables come from GitHub Secrets — never stored in files.