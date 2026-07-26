data "google_project" "staging" {
  provider   = google.staging
  project_id = var.staging_project_id
}

data "google_project" "production" {
  provider   = google.production
  project_id = var.production_project_id
}

module "staging" {
  source = "../modules/project-bootstrap"

  providers = {
    google = google.staging
  }

  project_id           = var.staging_project_id
  environment          = "staging"
  github_repository    = var.github_repository
  github_branch        = var.github_branch
  deploy_project_roles = toset([
    "roles/artifactregistry.writer",
    "roles/run.admin",
    "roles/viewer",
  ])
}

module "production" {
  source = "../modules/project-bootstrap"

  providers = {
    google = google.production
  }

  project_id        = var.production_project_id
  environment       = "production"
  github_repository = var.github_repository
  github_branch     = var.github_branch
}

resource "google_storage_bucket" "terraform_state" {
  provider = google.staging

  project                     = var.staging_project_id
  name                        = var.terraform_state_bucket_name
  location                    = var.region
  storage_class               = "STANDARD"
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age        = 90
      with_state = "ARCHIVED"
    }

    action {
      type = "Delete"
    }
  }

  labels = {
    app         = "cdl-react"
    environment = "bootstrap"
    managed_by  = "terraform"
  }

  lifecycle {
    prevent_destroy = true
  }

  depends_on = [module.staging]
}

resource "google_storage_bucket_iam_member" "staging_deploy_state_access" {
  provider = google.staging

  bucket = google_storage_bucket.terraform_state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${module.staging.deploy_service_account_email}"
}

resource "google_billing_budget" "staging" {
  provider = google.staging

  billing_account = "billingAccounts/${var.billing_account_id}"
  display_name    = "CDL React Staging Budget"

  budget_filter {
    projects = ["projects/${data.google_project.staging.number}"]
  }

  amount {
    specified_amount {
      currency_code = "AUD"
      units         = tostring(var.staging_monthly_budget_aud)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    disable_default_iam_recipients = false
  }

  depends_on = [module.staging]
}

resource "google_billing_budget" "production" {
  provider = google.production

  billing_account = "billingAccounts/${var.billing_account_id}"
  display_name    = "CDL React Production Budget"

  budget_filter {
    projects = ["projects/${data.google_project.production.number}"]
  }

  amount {
    specified_amount {
      currency_code = "AUD"
      units         = tostring(var.production_monthly_budget_aud)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.9
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    disable_default_iam_recipients = false
  }

  depends_on = [module.production]
}
