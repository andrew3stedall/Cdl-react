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

variable "enable_database_jobs" {
  description = "Create controlled migration and deterministic synthetic seed jobs."
  type        = bool
  default     = false
}

variable "enable_cloud_run" {
  description = "Create the single-service Cloud Run application after database jobs are proven."
  type        = bool
  default     = false
}

variable "backend_image" {
  description = "Fully qualified immutable frontend-and-API container image used by jobs and Cloud Run."
  type        = string
  default     = ""

  validation {
    condition = (
      var.backend_image == "" ||
      can(regex("@sha256:[0-9a-f]{64}$", var.backend_image))
    )
    error_message = "backend_image must be empty or an immutable @sha256 digest URI."
  }
}

variable "runtime_repository_mode" {
  description = "Repository mode for the staging Cloud Run service."
  type        = string
  default     = "postgres"

  validation {
    condition     = contains(["memory", "postgres"], var.runtime_repository_mode)
    error_message = "runtime_repository_mode must be memory or postgres."
  }
}

variable "allow_public_invoker" {
  description = "Grant allUsers roles/run.invoker on staging. Keep false until the access model is approved."
  type        = bool
  default     = false
}

variable "database_version" {
  description = "Cloud SQL PostgreSQL engine version."
  type        = string
  default     = "POSTGRES_16"
}

variable "database_edition" {
  description = "Cloud SQL edition compatible with the selected staging tier."
  type        = string
  default     = "ENTERPRISE"

  validation {
    condition     = contains(["ENTERPRISE", "ENTERPRISE_PLUS"], var.database_edition)
    error_message = "database_edition must be ENTERPRISE or ENTERPRISE_PLUS."
  }
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

variable "monitoring_notification_channels" {
  description = "Existing Cloud Monitoring notification-channel resource names. Keep empty until channel ownership and recipients are approved."
  type        = set(string)
  default     = []
}
