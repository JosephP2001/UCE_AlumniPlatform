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
    bucket       = "uce-alumni-tfstate"
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
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
# SUBNETS — 2 AZs para ELB y ASG
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

resource "aws_subnet" "private_1b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.4.0/24"
  availability_zone = "us-east-1b"
  tags = { Name = "uce-prod-private-1b" }
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
  domain     = "vpc"
  tags       = { Name = "uce-prod-nat-eip" }
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

resource "aws_route_table_association" "private_1b" {
  subnet_id      = aws_subnet.private_1b.id
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

resource "aws_security_group" "sg_elb" {
  name        = "elb-prod"
  description = "ELB inbound HTTP/HTTPS"
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
  tags = { Name = "elb-prod" }
}

resource "aws_security_group" "sg_private" {
  name        = "private-prod"
  description = "Private EC2 instances — only from ELB and bastion"
  vpc_id      = aws_vpc.main.id

  # All internal VPC traffic
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"]
  }

  # SSH from bastion only
  ingress {
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_bastion.id]
  }

  # All microservice ports from ELB (3000-3005)
  # FIX: was 3000-3003, now includes notification(3004) + matching(3005)
  ingress {
    from_port       = 3000
    to_port         = 3005
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_elb.id]
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
# AMI — Ubuntu 24.04
# ─────────────────────────────────────────
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*ubuntu*24.04*amd64*"]
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

  lifecycle {
    ignore_changes = [ami]
  }

  tags = { Name = "uce-prod-bastion" }
}

resource "aws_eip" "bastion_eip" {
  instance   = aws_instance.bastion.id
  domain     = "vpc"
  depends_on = [aws_internet_gateway.igw]
  tags       = { Name = "uce-prod-bastion-eip" }
}

# ─────────────────────────────────────────
# LAUNCH TEMPLATE — for ASG
# ─────────────────────────────────────────
resource "aws_launch_template" "prod_lt" {
  name_prefix   = "uce-prod-lt-"
  image_id      = data.aws_ami.ubuntu.id
  instance_type = "t3.large"
  key_name      = aws_key_pair.prod_key.key_name

  vpc_security_group_ids = [aws_security_group.sg_private.id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e
    exec > /var/log/uce-ec2-init.log 2>&1

    apt-get update -y
    apt-get install -y ca-certificates curl gnupg git apt-transport-https

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    usermod -aG docker ubuntu

    echo "EC2 PROD init complete"
  EOF
  )

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = 30
      volume_type           = "gp3"
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = { Name = "uce-prod-asg-instance" }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────
# AUTO SCALING GROUP
# ─────────────────────────────────────────
resource "aws_autoscaling_group" "prod_asg" {
  name                = "uce-prod-asg"
  desired_capacity    = 1
  min_size            = 1
  max_size            = 3
  vpc_zone_identifier = [aws_subnet.private_1a.id, aws_subnet.private_1b.id]

  launch_template {
    id      = aws_launch_template.prod_lt.id
    version = "$Latest"
  }

  target_group_arns = [
    aws_lb_target_group.auth_tg.arn,
    aws_lb_target_group.jobs_tg.arn,
    aws_lb_target_group.web_tg.arn,
  ]

  health_check_type         = "ELB"
  health_check_grace_period = 300

  tag {
    key                 = "Name"
    value               = "uce-prod-asg-instance"
    propagate_at_launch = true
  }

  lifecycle {
    ignore_changes = [desired_capacity]
  }
}

# ─────────────────────────────────────────
# AUTO SCALING POLICIES — CPU based
# ─────────────────────────────────────────
resource "aws_autoscaling_policy" "scale_up" {
  name                   = "uce-prod-scale-up"
  autoscaling_group_name = aws_autoscaling_group.prod_asg.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = 1
  cooldown               = 120
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "uce-prod-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 70
  alarm_description   = "Scale up when CPU > 70% for 2 minutes"
  alarm_actions       = [aws_autoscaling_policy.scale_up.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.prod_asg.name
  }
}

resource "aws_autoscaling_policy" "scale_down" {
  name                   = "uce-prod-scale-down"
  autoscaling_group_name = aws_autoscaling_group.prod_asg.name
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = -1
  cooldown               = 300
}

resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  alarm_name          = "uce-prod-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 20
  alarm_description   = "Scale down when CPU < 20% for 3 minutes"
  alarm_actions       = [aws_autoscaling_policy.scale_down.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.prod_asg.name
  }
}

# ─────────────────────────────────────────
# ELB
# ─────────────────────────────────────────
resource "aws_lb" "prod_elb" {
  name               = "uce-prod-elb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.sg_elb.id]
  subnets            = [aws_subnet.public_1a.id, aws_subnet.public_1b.id]
  tags               = { Name = "uce-prod-elb" }
}

# ─────────────────────────────────────────
# TARGET GROUPS
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

resource "aws_lb_target_group" "web_tg" {
  name     = "uce-prod-web-tg"
  port     = 3002
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  tags = { Name = "uce-prod-web-tg" }
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
    target_group_arn = aws_lb_target_group.web_tg.arn
  }
}

resource "aws_lb_listener_rule" "auth_rule" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth_tg.arn
  }

  condition {
    path_pattern {
      values = ["/api/auth*", "/health"]
    }
  }
}

resource "aws_lb_listener_rule" "jobs_rule" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.jobs_tg.arn
  }

  condition {
    path_pattern {
      values = ["/api/jobs*"]
    }
  }
}

# ─────────────────────────────────────────
# OUTPUTS
# ─────────────────────────────────────────
output "bastion_eip" {
  description = "Fixed Elastic IP — update PROD_BASTION_IP in GitHub Secrets"
  value       = aws_eip.bastion_eip.public_ip
}

output "elb_dns_name" {
  description = "Map this to josheponcepro1.distribuidauce.org in Cloudflare"
  value       = aws_lb.prod_elb.dns_name
}

output "asg_name" {
  value = aws_autoscaling_group.prod_asg.name
}
