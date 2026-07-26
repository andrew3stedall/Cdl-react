variable "project_id" {
  description = "GCP project ID for the staging environment."
  type        = string
}

variable "region" {
  description = "Default GCP region for staging resources."
  type        = string
  default     = "australia-southeast1"
}

variable "name_prefix" {
  description = "Short resource-name prefix for staging resources."
  type        = string
  default     = "cdl-react-staging"
}

variable "environment" {
  description = "Application environment label passed to runtime services."
  type        = string
  default     = "staging"
}

variable "enable_cloud_run" {
  description = "Create the Cloud Run API service. Keep false until Artifact Registry has a pushed backend image."
  type        = bool
  default     = false
}

variable "backend_image" {
  description = "Fully qualified backend container image to deploy when enable_cloud_run is true."
  type        = string
  default     = ""
}

variable "allow_public_invoker" {
  description = "Grant allUsers roles/run.invoker on the staging API. Keep false until the auth and ingress model is confirmed."
  type        = bool
  default     = false
}

variable "database_version" {
  description = "Cloud SQL PostgreSQL engine version."
  type        = string
  default     = "POSTGRES_16"
}

variable "database_tier" {
  description = "Cloud SQL staging instance tier."
  type        = string
  default     = "db-f1-micro"
}

variable "database_disk_size_gb" {
  description = "Cloud SQL disk size in GiB."
  type        = number
  default     = 10
}

variable "deletion_protection" {
  description = "Enable Terraform and GCP API deletion protection for the staging Cloud SQL instance."
  type        = bool
  default     = true
}

variable "database_disk_autoresize_limit_gb" {
  description = "Maximum Cloud SQL storage size in GiB after automatic growth."
  type        = number
  default     = 20
}

variable "database_backup_start_time" {
  description = "UTC start time for the daily Cloud SQL backup window."
  type        = string
  default     = "17:00"
}

variable "database_transaction_log_retention_days" {
  description = "Days of PostgreSQL transaction logs retained for point-in-time recovery."
  type        = number
  default     = 7
}

variable "database_retained_backups" {
  description = "Number of automated Cloud SQL backups retained."
  type        = number
  default     = 8
}
