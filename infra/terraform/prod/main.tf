# ─────────────────────────────────────────
# TERRAFORM BACKEND — S3 remote state PROD
# ─────────────────────────────────────────
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "uce-alumni-tfstate"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

# ─────────────────────────────────────────
# VPC
# ─────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "uce-prod-vpc" }
}

# ─────────────────────────────────────────
# SUBNETS — 2 AZs para ELB
# ─────────────────────────────────────────
resource "aws_subnet" "public_1a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = true
  tags = { Name = "uce-prod-public-1a" }
}

resource "aws_subnet" "public_1b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b"
  map_public_ip_on_launch = true
  tags = { Name = "uce-prod-public-1b" }
}

resource "aws_subnet" "private_1a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "us-east-1a"
  tags = { Name = "uce-prod-private-1a" }
}

# ─────────────────────────────────────────
# INTERNET GATEWAY
# ─────────────────────────────────────────
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = { Name = "uce-prod-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "uce-prod-public-rt" }
}

resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_1b" {
  subnet_id      = aws_subnet.public_1b.id
  route_table_id = aws_route_table.public.id
}

# ─────────────────────────────────────────
# NAT GATEWAY — private subnet outbound
# ─────────────────────────────────────────
resource "aws_eip" "nat_eip" {
  domain = "vpc"
  tags   = { Name = "uce-prod-nat-eip" }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat_eip.id
  subnet_id     = aws_subnet.public_1a.id
  tags          = { Name = "uce-prod-nat" }
  depends_on    = [aws_internet_gateway.igw]
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
  tags = { Name = "uce-prod-private-rt" }
}

resource "aws_route_table_association" "private_1a" {
  subnet_id      = aws_subnet.private_1a.id
  route_table_id = aws_route_table.private.id
}

# ─────────────────────────────────────────
# SECURITY GROUPS
# ─────────────────────────────────────────
resource "aws_security_group" "sg_bastion" {
  name        = "bastion-prod"
  description = "SSH access to bastion host"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "bastion-prod" }
}

resource "aws_security_group" "sg_nginx" {
  name        = "nginx-prod"
  description = "ELB and Nginx"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "nginx-prod" }
}

resource "aws_security_group" "sg_private" {
  name        = "private-prod"
  description = "Private EC2 instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"]
  }
  ingress {
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_bastion.id]
  }
  ingress {
    from_port       = 3000
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_nginx.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = "private-prod" }
}

# ─────────────────────────────────────────
# KEY PAIR
# ─────────────────────────────────────────
resource "aws_key_pair" "prod_key" {
  key_name   = "PROD"
  public_key = file("${path.module}/PROD.pub")
}

# ─────────────────────────────────────────
# AMI — Ubuntu 26.04
# ─────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*ubuntu*26.04*amd64*"]
  }
}

# ─────────────────────────────────────────
# BASTION HOST
# ─────────────────────────────────────────
resource "aws_instance" "bastion" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public_1a.id
  key_name               = aws_key_pair.prod_key.key_name
  vpc_security_group_ids = [aws_security_group.sg_bastion.id]
  tags                   = { Name = "uce-prod-bastion" }
}

# ─────────────────────────────────────────
# ELASTIC IP — Bastion (fixed public IP)
# ─────────────────────────────────────────
resource "aws_eip" "bastion_eip" {
  instance   = aws_instance.bastion.id
  domain     = "vpc"
  depends_on = [aws_internet_gateway.igw]
  tags       = { Name = "uce-prod-bastion-eip" }
}

# ─────────────────────────────────────────
# ELB
# ─────────────────────────────────────────
resource "aws_lb" "prod_elb" {
  name               = "uce-prod-elb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.sg_nginx.id]
  subnets            = [aws_subnet.public_1a.id, aws_subnet.public_1b.id]
  tags               = { Name = "uce-prod-elb" }
}

# ─────────────────────────────────────────
# TARGET GROUPS — auth-service + jobs-service
# ─────────────────────────────────────────
resource "aws_lb_target_group" "auth_tg" {
  name     = "uce-prod-auth-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  tags = { Name = "uce-prod-auth-tg" }
}

resource "aws_lb_target_group" "jobs_tg" {
  name     = "uce-prod-jobs-tg"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  tags = { Name = "uce-prod-jobs-tg" }
}

# ─────────────────────────────────────────
# ELB LISTENERS
# ─────────────────────────────────────────
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.prod_elb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_tg.arn
  }
}

resource "aws_lb_listener_rule" "jobs_rule" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.jobs_tg.arn
  }

  condition {
    path_pattern {
      values = ["/jobs*"]
    }
  }
}

# ─────────────────────────────────────────
# EC2 — PROD Auth + Jobs service
# ─────────────────────────────────────────
resource "aws_instance" "prod_auth_jobs" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = "t3.small"
  subnet_id              = aws_subnet.private_1a.id
  key_name               = aws_key_pair.prod_key.key_name
  vpc_security_group_ids = [aws_security_group.sg_private.id]

  user_data = <<-EOF
    #!/bin/bash
    apt update -y
    apt install -y ca-certificates curl gnupg git apt-transport-https
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update -y
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ubuntu
  EOF

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = { Name = "uce-prod-ec2-auth-jobs" }
  lifecycle {
    ignore_changes = [user_data, ami]
  }
}

# ─────────────────────────────────────────
# TARGET GROUP ATTACHMENT
# ─────────────────────────────────────────
resource "aws_lb_target_group_attachment" "auth_attachment" {
  target_group_arn = aws_lb_target_group.auth_tg.arn
  target_id        = aws_instance.prod_auth_jobs.id
  port             = 3000
}

resource "aws_lb_target_group_attachment" "jobs_attachment" {
  target_group_arn = aws_lb_target_group.jobs_tg.arn
  target_id        = aws_instance.prod_auth_jobs.id
  port             = 3001
}

# ─────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────
output "bastion_eip" {
  value = aws_eip.bastion_eip.public_ip
}

output "bastion_public_ip" {
  value = aws_instance.bastion.public_ip
}

output "elb_dns_name" {
  value = aws_lb.prod_elb.dns_name
}

output "prod_auth_jobs_private_ip" {
  value = aws_instance.prod_auth_jobs.private_ip
}
