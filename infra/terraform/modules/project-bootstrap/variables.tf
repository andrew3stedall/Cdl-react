variable "project_id" {
  description = "Existing GCP project ID to bootstrap."
  type        = string
}

variable "environment" {
  description = "Environment label used in resource descriptions."
  type        = string
}

variable "github_repository" {
  description = "GitHub owner/repository allowed by the OIDC provider."
  type        = string
}

variable "github_branch" {
  description = "GitHub branch allowed by the OIDC provider."
  type        = string
}

variable "deploy_project_roles" {
  description = "Project roles granted to the GitHub deploy service account."
  type        = set(string)
  default     = []
}
