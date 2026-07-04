# Production Go-Live Checklist

Production must remain blocked until staging has proven the deployment, data, smoke, restore, monitoring, and rollback path.

## Required gates

- Manual platform bootstrap is complete.
- Staging deployment has passed smoke checks.
- Backup expectations are documented.
- Restore drill has been completed in staging.
- Rollback steps are documented and tested.
- Basic alert checks are documented.
- Real-user onboarding decision is explicit.

## Backup and restore gate

Before real users are invited, record where backups are enabled, how far back recovery is expected to work, who ran the restore drill, and what data set was restored.

## Rollback gate

Record the previous backend revision, the frontend rollback path, the compatible migration state, and the decision owner for rollback.

## Onboarding gate

Do not add real users until all gates above are checked and the remaining persistence/import risks are accepted.
