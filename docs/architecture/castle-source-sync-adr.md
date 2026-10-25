# Castle source archive and conservative projection

Status: proposed with the Castle source sync PR.

Castle and CDL React differ in identities, trade states, ownership semantics and
draw-result cardinality. Replaying source mutations risks executing transfers or
scoring twice. The historical import service's synthetic-only guard must remain.

Use a separate Castle adapter and transactional repository. Store selected-league
and global non-FPL datasets in existing generic import tables with a Castle
namespace, source hashes, prior versions and stable identity mappings. Project
only compatible fixtures, lineups and completed non-loan trades after review.
Never create auth mappings, fetch FPL, reconcile ownership implicitly, replay
trades or overwrite frozen scores.

No schema migration is required and unsupported source fields are retained.
Archive storage is not automatic UI/API integration: multi-award draws,
ownership/loan timelines, chips and global/history records need further modeling
or a dedicated reader. Personal visibility remains the completeness limit.
Reviewed digests, before-images and local-edit detection support repeat runs.
See the [runbook](../runbooks/castle-source-sync.md).
