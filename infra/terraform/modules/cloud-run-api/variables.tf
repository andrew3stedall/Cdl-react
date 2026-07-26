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

variable "environment" {
  description = "Application environment."
  type        = string
}

variable "repository_mode" {
  description = "Application repository mode. Use memory until PostgreSQL repositories and migrations are fully wired."
  type        = string
  default     = "memory"
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
