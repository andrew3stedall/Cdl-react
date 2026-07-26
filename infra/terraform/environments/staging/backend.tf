terraform {
  backend "gcs" {
    bucket = "cdl-react-staging-ast-terraform-state"
    prefix = "environments/staging"
  }
}
