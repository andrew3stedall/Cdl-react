locals {
  artifact_repository_id = "cdl-react-backend"
  database_name          = "cdl_react"
  database_instance_name = "${var.name_prefix}-postgres"
  api_service_name       = "${var.name_prefix}-api"
  runtime_service_id     = "cdl-api-runtime"
  migration_service_id   = "cdl-db-migration"

  common_labels = {
    application = "cdl-react"
    environment = var.environment
    managed_by  = "terraform"
  }

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
  ])

  secret_ids = toset([
    "cdl-database-url",
    "cdl-development-login-secret",
    "cdl-session-cookie-secret",
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project = var.project_id
  service = each.value

  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_service_account" "runtime" {
  account_id   = local.runtime_service_id
  display_name = "CDL API runtime"
  description  = "Runtime identity for the staging FastAPI service."

  depends_on = [google_project_service.required]
}

resource "google_service_account" "migration" {
  account_id   = local.migration_service_id
  display_name = "CDL database migration"
  description  = "Identity reserved for Alembic migration jobs."

  depends_on = [google_project_service.required]
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id                  = var.project_id
  region                      = var.region
  repository_id               = local.artifact_repository_id
  description                 = "Backend container images for CDL React staging."
  labels                      = merge(local.common_labels, { component = "artifact-registry" })
  immutable_tags              = true
  cleanup_policy_dry_run      = true
  cleanup_untagged_older_than = "1209600s"

  depends_on = [google_project_service.required]
}

module "cloud_sql" {
  source = "../../modules/cloud-sql-postgres"

  project_id                     = var.project_id
  region                         = var.region
  instance_name                  = local.database_instance_name
  database_name                  = local.database_name
  database_version               = var.database_version
  database_tier                  = var.database_tier
  disk_size_gb                   = var.database_disk_size_gb
  disk_autoresize_limit_gb       = var.database_disk_autoresize_limit_gb
  deletion_protection            = var.deletion_protection
  labels                         = merge(local.common_labels, { component = "database" })
  availability_type              = "ZONAL"
  backup_enabled                 = true
  backup_location                = var.region
  backup_start_time              = var.database_backup_start_time
  point_in_time_recovery         = true
  transaction_log_retention_days = var.database_transaction_log_retention_days
  retained_backups               = var.database_retained_backups

  depends_on = [google_project_service.required]
}

module "runtime_secrets" {
  source = "../../modules/secret-manager"

  project_id = var.project_id
  secret_ids = local.secret_ids
  labels     = merge(local.common_labels, { component = "secrets" })

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "runtime_secret_access" {
  for_each = module.runtime_secrets.secret_names

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "migration_secret_access" {
  project   = var.project_id
  secret_id = module.runtime_secrets.secret_names["cdl-database-url"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.migration.email}"
}

resource "google_project_iam_member" "cloud_sql_client" {
  for_each = {
    runtime   = google_service_account.runtime.email
    migration = google_service_account.migration.email
  }

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${each.value}"
}

module "cloud_run_api" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud-run-api"

  project_id                    = var.project_id
  region                        = var.region
  service_name                  = local.api_service_name
  image                         = var.backend_image
  runtime_service_account_email = google_service_account.runtime.email
  cloud_sql_connection_name     = module.cloud_sql.connection_name
  environment                   = var.environment
  labels                        = merge(local.common_labels, { component = "api" })
  repository_mode               = "memory"
  allow_public_invoker          = var.allow_public_invoker
  min_instance_count            = 0
  max_instance_count            = 2

  depends_on = [
    google_project_service.required,
    module.artifact_registry,
    module.cloud_sql,
    google_project_iam_member.cloud_sql_client,
  ]
}
