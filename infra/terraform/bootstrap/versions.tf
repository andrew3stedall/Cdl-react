terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.0, < 8.0"
    }
  }
}

provider "google" {
  alias   = "staging"
  project = var.staging_project_id
  region  = var.region
}

provider "google" {
  alias   = "production"
  project = var.production_project_id
  region  = var.region
}
