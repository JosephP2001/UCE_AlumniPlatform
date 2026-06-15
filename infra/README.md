# Infrastructure

Infrastructure-as-Code for the UCE Alumni & Employment Platform.

---

## Tools

| Tool | Purpose |
|------|---------|
| **Terraform** | Provisions AWS cloud resources (EC2, VPC, subnets, ELB, ASG, security groups, EIP, DynamoDB lock) |
| **Ansible** | Configures machines after provisioning — installs Docker, deploys all containers, injects secrets |

---

## Environments

| Environment | AWS Account | Bastion EIP | Domain | Orchestration |
|-------------|-------------|-------------|--------|---------------|
| QA | `782987290346` | `52.20.54.196` | — | Docker via Ansible (self-hosted runner) |
| PROD | `471904521253` | `54.88.140.158` | `josheponcepro1.distribuidauce.org` | Docker via Ansible + ELB |

QA and PROD are in **separate AWS accounts with no VPC peering** — a misconfiguration in QA cannot affect PROD.

Both Bastions have **Elastic IPs** — they do not change between AWS sessions.

---

## Directory Structure

```
infra/
├── terraform/
│   ├── main.tf          # QA — VPC, Bastion, EC2, EIP, DynamoDB lock
│   ├── prod/
│   │   ├── main.tf      # PROD — VPC, ELB, ASG, Bastion, EIP, DynamoDB lock
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
- PROD user traffic: `Internet → ELB → private EC2`
- Secrets injected at deploy time via Ansible — **never hardcoded in code or config files**
- QA and PROD use **separate GitHub OAuth Apps** with separate credentials

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
| `/*` | web-app | 3002 |

---

## Terraform State

State files are stored remotely in S3 with DynamoDB locking:

| Environment | S3 Bucket | Key | DynamoDB Table |
|-------------|-----------|-----|----------------|
| QA | `uce-alumni-tfstate-qa` | `qa/terraform.tfstate` | `uce-tfstate-lock-qa` |
| PROD | `uce-alumni-tfstate` | `prod/terraform.tfstate` | `uce-tfstate-lock-prod` |

---

## Ansible Secrets (injected via CI/CD)

| Variable | Description |
|----------|-------------|
| `jwt_secret` | Shared JWT signing secret (auth + profile + notification) |
| `oauth_client_id` | GitHub OAuth App Client ID |
| `oauth_client_secret` | GitHub OAuth App Client Secret |
| `pg_password` | PostgreSQL password |
| `rabbitmq_password` | RabbitMQ admin password |
| `bastion_ip` | Bastion EIP — used for `FRONTEND_URL` in auth-service |

All variables come from GitHub Secrets — never stored in files.
