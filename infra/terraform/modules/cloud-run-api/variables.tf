variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run."
  type        = string
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
}

variable "image" {
  description = "Container image to deploy."
  type        = string
}

variable "runtime_service_account_email" {
  description = "Service account email used by the Cloud Run service."
  type        = string
}

variable "cloud_sql_connection_name" {
  description = "Optional Cloud SQL connection name mounted at /cloudsql."
  type        = string
  default     = null
  nullable    = true
}

variable "environment" {
  description = "Application environment."
  type        = string
}

variable "labels" {
  description = "Labels used for ownership and cost attribution."
  type        = map(string)
  default     = {}
}

variable "repository_mode" {
  description = "Application repository mode."
  type        = string
  default     = "memory"

  validation {
    condition     = contains(["memory", "postgres"], var.repository_mode)
    error_message = "repository_mode must be memory or postgres."
  }
}

variable "environment_variables" {
  description = "Additional non-sensitive environment variables passed to the service."
  type        = map(string)
  default     = {}
}

variable "secret_environment_variables" {
  description = "Environment variables resolved from existing Secret Manager secret versions."
  type = map(object({
    secret  = string
    version = optional(string, "latest")
  }))
  default = {}
}

variable "allow_public_invoker" {
  description = "Whether to make the service publicly invokable."
  type        = bool
  default     = false
}

variable "min_instance_count" {
  description = "Minimum Cloud Run instance count."
  type        = number
  default     = 0
}

variable "max_instance_count" {
  description = "Maximum Cloud Run instance count."
  type        = number
  default     = 2
}
