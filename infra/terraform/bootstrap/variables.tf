variable "billing_account_id" {
  description = "Cloud Billing account ID without the billingAccounts/ prefix."
  type        = string
  sensitive   = true

  validation {
    condition     = can(regex("^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$", var.billing_account_id))
    error_message = "billing_account_id must use the XXXXXX-XXXXXX-XXXXXX format."
  }
}

variable "staging_project_id" {
  description = "Existing staging GCP project ID."
  type        = string
  default     = "cdl-react-staging-ast"
}

variable "production_project_id" {
  description = "Existing production GCP project ID."
  type        = string
  default     = "cdl-react-prod-ast"
}

variable "region" {
  description = "Default Australian region for CDL React resources."
  type        = string
  default     = "australia-southeast1"
}

variable "github_repository" {
  description = "GitHub repository allowed to exchange OIDC tokens."
  type        = string
  default     = "andrew3stedall/Cdl-react"
}

variable "github_branch" {
  description = "GitHub branch allowed to impersonate deploy service accounts."
  type        = string
  default     = "main"
}

variable "staging_monthly_budget_aud" {
  description = "Monthly staging budget alert amount in AUD. This does not cap spend."
  type        = number
  default     = 25
}

variable "production_monthly_budget_aud" {
  description = "Monthly production budget alert amount in AUD. This does not cap spend."
  type        = number
  default     = 50
}

variable "terraform_state_bucket_name" {
  description = "Globally unique GCS bucket used for Terraform state."
  type        = string
  default     = "cdl-react-staging-ast-terraform-state"
}
