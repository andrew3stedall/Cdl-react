variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique Cloud Storage bucket name for built frontend assets."
  type        = string
}

variable "location" {
  description = "Cloud Storage bucket location."
  type        = string
}

variable "labels" {
  description = "Labels used for billing attribution and resource inventory."
  type        = map(string)
  default     = {}
}
