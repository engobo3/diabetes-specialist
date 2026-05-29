variable "region" {
  description = "AWS region. Cape Town for low latency to Kinshasa."
  type        = string
  default     = "af-south-1"
}

variable "environment" {
  description = "Deployment environment (staging | production)."
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "vpc_id" {
  description = "Existing VPC ID to place the RDS instance in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs (>= 2 AZs) for the DB subnet group."
  type        = list(string)
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "RDS requires subnets in at least two availability zones."
  }
}

variable "app_security_group_id" {
  description = "Security group of the application tier allowed to reach Postgres on 5432."
  type        = string
}

variable "admin_cidr_blocks" {
  description = "Optional admin/bastion CIDRs allowed to reach 5432 for running migrations. Keep tight; empty in production if migrations run from inside the VPC."
  type        = list(string)
  default     = []
}

variable "engine_version" {
  description = "Postgres engine version."
  type        = string
  default     = "16.4"
}

variable "instance_class" {
  description = "RDS instance class. t4g.small (ARM, burstable) is fine for launch traffic."
  type        = string
  default     = "db.t4g.small"
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "glucosoin"
}

variable "master_username" {
  description = "Master DB username (admin). The app uses app_rw, NOT this account."
  type        = string
  default     = "glucocare_admin"
}

variable "allocated_storage" {
  description = "Initial storage (GB)."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Storage autoscaling ceiling (GB)."
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "Multi-AZ failover. false at launch (cost); set true before scaling up."
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Automated backup retention (days)."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Block accidental instance deletion. Keep true in production."
  type        = bool
  default     = true
}

variable "kms_key_arn" {
  description = "KMS key ARN for storage + (future) column encryption. null → AWS-managed key."
  type        = string
  default     = null
}
