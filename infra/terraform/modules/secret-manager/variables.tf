variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "secret_ids" {
  description = "Secret IDs to create. Values are secret containers only; payload versions are managed separately."
  type        = set(string)
}

variable "labels" {
  description = "Labels to attach to each secret."
  type        = map(string)
  default     = {}
}
