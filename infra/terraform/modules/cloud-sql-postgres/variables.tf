variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for the instance."
  type        = string
}

variable "instance_name" {
  description = "Cloud SQL instance name."
  type        = string
}

variable "database_name" {
  description = "Initial application database name."
  type        = string
}

variable "database_version" {
  description = "PostgreSQL database engine version."
  type        = string
}

variable "database_tier" {
  description = "Cloud SQL machine tier."
  type        = string
}

variable "disk_size_gb" {
  description = "Disk size in GiB."
  type        = number
}

variable "deletion_protection" {
  description = "Enable Terraform and GCP API deletion protection for the instance."
  type        = bool
}

variable "labels" {
  description = "Labels used for ownership and cost attribution."
  type        = map(string)
  default     = {}
}

variable "availability_type" {
  description = "Cloud SQL availability type. Use ZONAL for cost-conscious staging."
  type        = string
  default     = "ZONAL"
}

variable "backup_enabled" {
  description = "Whether automated backups are enabled."
  type        = bool
  default     = true
}

variable "point_in_time_recovery" {
  description = "Whether point-in-time recovery is enabled."
  type        = bool
  default     = true
}

variable "disk_autoresize_limit_gb" {
  description = "Maximum storage size in GiB after automatic growth."
  type        = number
  default     = 20
}

variable "backup_location" {
  description = "Location used for automated Cloud SQL backups."
  type        = string
}

variable "backup_start_time" {
  description = "UTC start time for the daily backup window in HH:MM format."
  type        = string
  default     = "17:00"
}

variable "transaction_log_retention_days" {
  description = "Number of transaction-log days retained for point-in-time recovery."
  type        = number
  default     = 7
}

variable "retained_backups" {
  description = "Number of automated backups retained."
  type        = number
  default     = 8
}
