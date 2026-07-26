variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region for the repository."
  type        = string
}

variable "repository_id" {
  description = "Artifact Registry repository ID."
  type        = string
}

variable "description" {
  description = "Artifact Registry repository description."
  type        = string
  default     = "Container images."
}

variable "labels" {
  description = "Labels used for ownership and cost attribution."
  type        = map(string)
  default     = {}
}

variable "immutable_tags" {
  description = "Prevent Docker tags from being moved, overwritten, or deleted."
  type        = bool
  default     = true
}

variable "cleanup_policy_dry_run" {
  description = "Evaluate cleanup policies without deleting artifacts."
  type        = bool
  default     = true
}

variable "cleanup_untagged_older_than" {
  description = "Age after which untagged artifacts match the cleanup policy."
  type        = string
  default     = "1209600s"
}
