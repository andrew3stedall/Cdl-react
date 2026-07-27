# GCP Staging Observability Runbook

## Purpose

This runbook defines the first cost-conscious Cloud Logging and Cloud Monitoring baseline for CDL React staging.

It covers the declarative configuration in:

- `infra/terraform/environments/staging/monitoring.tf`
- `infra/terraform/environments/staging/variables.tf`

This baseline does not apply Terraform, create a notification destination, deploy Cloud Run, connect the application to Cloud SQL, or make any service public.

## Logging sources

Cloud SQL and Cloud Run emit platform logs to Cloud Logging when those services exist. The staging configuration does not add a duplicate log sink, export logs to another project, change the `_Default` bucket, or increase retention.

The first alert policies query those native platform logs directly. This avoids a custom logs-based metric and its additional ingestion and operational surface.

## Alert policies

### Cloud SQL sustained CPU

The Cloud SQL CPU policy opens an incident when the staging instance reports average CPU utilization above 80% for five minutes.

Before changing the instance tier, inspect:

1. active and slow queries;
2. connection pressure and pool settings;
3. locks and long-running transactions;
4. recent migrations or seed operations;
5. whether the condition is sustained or a short staging test spike.

Missing metric data is treated as inactive. Availability and readiness require separate health checks after the instance is deployed.

### Cloud SQL error logs

The Cloud SQL log policy matches `ERROR`-or-higher entries for the exact staging database resource.

Notifications are rate-limited to one per 15 minutes and incidents auto-close after 30 minutes without another match. Inspect the matching log before changing infrastructure.

### Cloud Run error logs

The Cloud Run log policy is created only when `enable_cloud_run=true`. It matches `ERROR`-or-higher entries for the exact staging service, region and project.

Keeping the policy conditional prevents Terraform from creating Cloud Run monitoring for a service that remains deliberately disabled. Enabling the policy does not make the service public and does not change repository mode.

## Notification-channel boundary

`monitoring_notification_channels` accepts existing Cloud Monitoring notification-channel resource names and defaults to an empty set.

An empty set still allows incidents to appear in Cloud Monitoring, but no external recipient is notified. Channel creation, recipient addresses and ownership are intentionally outside this Terraform state until they are explicitly approved.

Expected channel value shape:

```text
projects/<project-id-or-number>/notificationChannels/<channel-id>
```

Do not place email addresses, webhook credentials, paging tokens or other recipient secrets in Terraform variables or repository files.

## Cost attribution labels

The staging design applies a shared label set to Artifact Registry, Cloud SQL, Secret Manager and the optional Cloud Run API:

```text
application=cdl-react
environment=staging
managed_by=terraform
component=<artifact-registry|database|secrets|api>
```

These labels support filtering and grouping in GCP Billing reports after an approved apply. They do not create a billing export, budget, dashboard or chargeable resource. The existing bootstrap-managed staging budget remains the spending guardrail.

Before approving a saved plan, confirm every chargeable staging resource carries the shared labels and the expected component label. Do not invent a cost centre, client or owner label until its authoritative value and maintenance owner are known.

## Validation before apply

Pull requests must pass the `GCP Terraform Staging` workflow, which runs:

```text
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
```

After keyless GitHub authentication is proven, a manual authenticated plan must show only the expected monitoring resources and label updates alongside the already reviewed staging design.

Before any apply, confirm:

- Cloud SQL and Cloud Run names in each filter match the planned resources;
- no notification channel was created implicitly;
- Cloud Run remains disabled unless a reviewed image and deployment decision exist;
- public invocation remains disabled;
- the plan contains no production resources;
- chargeable resources carry the expected cost-attribution labels;
- expected Monitoring and Logging costs are recorded.

## Post-apply verification

After an explicitly approved apply:

1. list the alert policies in Cloud Monitoring;
2. confirm the Cloud SQL CPU policy selects the intended `cloudsql_database` resource;
3. confirm log filters contain the exact project, region and service or database identifiers;
4. generate only a controlled staging test event where safe;
5. verify incident creation and auto-close behaviour;
6. verify external notifications only after an approved channel is attached;
7. confirm Billing reports can group the staging resources by `application`, `environment` and `component` labels;
8. record the evidence in issues #70 and #78.

Do not generate a destructive database failure or expose the Cloud Run service merely to test alerting.

## Known limitations

- No uptime, readiness, migration-state or database-connectivity alert exists yet.
- No notification destination is provisioned.
- No dashboard or billing export is provisioned.
- Cloud Run logging is inactive while the service is disabled.
- A live resource and controlled event are required to prove filter matching; `terraform validate` proves schema only.
