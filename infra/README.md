# Infrastructure

Infrastructure-as-Code for the UCE Alumni & Employment Platform.

## Tools

| Tool | Purpose |
|------|---------|
| **Terraform** | Provisions AWS cloud resources (EC2, VPC, subnets, ELB, security groups) |
| **Ansible** | Configures machines after provisioning (installs Docker, deploys containers, injects secrets) |

## Environments

| Environment | AWS Account | Orchestration | Details |
|-------------|-------------|---------------|---------|
| QA | Account #2 (782987290346) | Docker via Ansible | Push to `QA` branch triggers deploy |
| PROD | Account #1 (471904521253) | Docker via Ansible | Merge to `master` triggers deploy |

QA and PROD are in **separate AWS accounts with no VPC peering** — a misconfiguration in QA cannot affect PROD.

## Directory Structure

```
infra/
├── terraform/
│   ├── main.tf          # QA environment
│   ├── prod/
│   │   ├── main.tf      # PROD environment
│   │   └── PROD.pub     # Public key for PROD key pair
│   └── README.md
└── ansible/
    ├── deploy-qa.yml    # QA deployment playbook
    ├── deploy-prod.yml  # PROD deployment playbook
    └── README.md
```

## Security Design

- All service EC2 instances run in **private subnets** — no public IP
- Only the Bastion Host has a public IP
- Developer SSH: `Developer → Bastion → private EC2`
- User traffic (PROD): `Internet → ELB → private EC2`
- Secrets injected at deploy time via Ansible — **never hardcoded in code or config files**
