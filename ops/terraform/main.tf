# ops/terraform/main.tf
terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
  
  backend "s3" {
    bucket = "skypay-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.this.token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.this.token
  }
}

# VPC
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 3.0"

  name = "skypay-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  tags = {
    Environment = "production"
    Project     = "skypay"
  }
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "skypay-cluster"
  cluster_version = "1.27"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    general = {
      desired_size = 3
      min_size     = 3
      max_size     = 10

      instance_types = ["t3.medium"]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "general"
      }

      taints = []

      tags = {
        Environment = "production"
        Project     = "skypay"
      }
    }
    
    monitoring = {
      desired_size = 2
      min_size     = 2
      max_size     = 4

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"

      labels = {
        role = "monitoring"
      }

      taints = [{
        key    = "role"
        value  = "monitoring"
        effect = "NO_SCHEDULE"
      }]

      tags = {
        Environment = "production"
        Project     = "skypay"
      }
    }
  }
}

# RDS PostgreSQL
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 5.0"

  identifier = "skypay-db"

  engine               = "postgres"
  engine_version       = "15"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = "db.t3.medium"

  allocated_storage     = 100
  max_allocated_storage = 500

  db_name  = "skypay"
  username = var.db_username
  password = var.db_password
  port     = 5432

  manage_master_user_password = false

  vpc_security_group_ids = [module.vpc.default_security_group_id]
  subnet_ids             = module.vpc.database_subnets

  maintenance_window = "Mon:00:00-Mon:03:00"
  backup_window      = "03:00-06:00"

  backup_retention_period = 7
  skip_final_snapshot     = false
  deletion_protection     = true

  parameters = [
    {
      name  = "autovacuum"
      value = 1
    },
    {
      name  = "client_encoding"
      value = "utf8"
    }
  ]

  tags = {
    Environment = "production"
    Project     = "skypay"
  }
}

# Elasticache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "skypay-redis"
  engine              = "redis"
  node_type           = "cache.t3.micro"
  num_cache_nodes     = 1
  parameter_group_name = "default.redis7"
  port                = 6379
  security_group_ids  = [module.vpc.default_security_group_id]
  subnet_group_name   = aws_elasticache_subnet_group.redis.name

  tags = {
    Environment = "production"
    Project     = "skypay"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "skypay-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

# S3 Buckets
resource "aws_s3_bucket" "assets" {
  bucket = "skypay-assets-${var.environment}"

  tags = {
    Environment = var.environment
    Project     = "skypay"
  }
}

resource "aws_s3_bucket" "backups" {
  bucket = "skypay-backups-${var.environment}"

  tags = {
    Environment = var.environment
    Project     = "skypay"
  }
}

# IAM Roles
module "iam_assumable_role_admin" {
  source = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"
  
  create_role = true
  
  role_name = "skypay-eks-admin"
  
  provider_url = module.eks.cluster_oidc_issuer_url
  role_policy_arns = [
    "arn:aws:iam::aws:policy/AmazonS3FullAccess",
    "arn:aws:iam::aws:policy/AmazonRDSFullAccess",
  ]
  
  oidc_fully_qualified_subjects = ["system:serviceaccount:default:skypay-backend"]
}

# Outputs
output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "db_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}
