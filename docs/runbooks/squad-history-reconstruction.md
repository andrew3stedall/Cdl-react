# Squad history reconstruction

The staging roster operation can reconstruct historical checkpoints from the current 160 ownership rows, the commissioner’s dated movement screenshots, and the archived Castle records. It does not reapply an old current-squad snapshot while reconstructing history.

Confirmed, non-forfeited draw results identify acquisitions, including players subsequently removed from the current squad. Confirmation timestamps are preferred when they fall on the screenshot’s Melbourne calendar date. Screenshot-only releases are represented by the exclusive end of that local day; this is day precision, not a claimed execution timestamp.

The reviewed 10 October trade bulletin records Yalcouyé and Solanke moving from Wilde Boars to Dribbling Dicks, with Martinez and David moving in the other direction. The operation restores the eight associated ownership periods, including closed periods, while verifying the current allocations and roster slots remain identical.

The existing squad_audit_events table stores a squad_history_reconstructed event containing the movement ledger, backwards checkpoints, ownership before-images, and gaps. No schema changes are needed. Checkpoints reverse each Melbourne day’s events together and reject duplicate player allocation across teams. Current squads must contain exactly twenty players per team.

A successful execution is not proof of complete source history. An acquisition missing from later squads without a recorded exit produces an explicit uncertainty interval. Such departures are not assigned invented dates or native ownership periods. The snapshot completeness field remains partial until every missing transition has dated evidence. Historical checkpoints describe known continuity and must be read together with these gaps.

Staging changes are transactional. Workflow failures roll back ownership changes. The operation uses the existing repository, season, league, project and database guards.
