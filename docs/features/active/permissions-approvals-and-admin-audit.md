# Permissions, Approvals, and Admin Audit

## Purpose

Define league roles, approval routing, commissioner/vice commissioner responsibilities, and auditable correction workflows.

## Status

Checkpoint 1 complete.

## Business Rules

- Roles: commissioner, vice commissioner, manager, spectator.
- Transfers and loans require commissioner approval after both parties agree.
- Commissioner-involved transfers require vice commissioner approval.
- Commissioner cannot approve their own trade or loan.
- Admin corrections require a reason.
- Historical/competitive records are corrected by appending correction records, not silent overwrite.

## Target Architecture

```text
league_memberships
approval_requests
admin_actions
admin_action_changes
audit_events
```

Approval routing:

```text
if commissioner involved -> vice_commissioner
else -> commissioner
```

## API Requirements

- List pending approvals.
- Approve/reject request.
- Create correction request.
- Record admin action with before/after values.
- Fetch audit trail for target entity.

## React Requirements

- Approval queue.
- Conflict-of-interest indicator.
- Correction forms with mandatory reason.
- Audit timeline on relevant detail screens.

## Data Access Requirements

- Store required approver role and actual approver.
- Store approval basis, such as commissioner involvement.
- Enforce permission checks server-side.

## Acceptance Criteria

- Commissioner cannot approve own transfer.
- Vice commissioner can approve commissioner-involved transfer.
- All corrections create admin action and audit records.
