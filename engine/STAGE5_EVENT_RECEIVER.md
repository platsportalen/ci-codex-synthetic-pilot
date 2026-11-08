# Stage 5.1 — event-driven pilot task state (unpaid)

This is an **increment to the existing ci-codex-synthetic-pilot**, not a new repository or a Projektagent integration.

## Scope

A GitHub `workflow_run.completed` event from the known `Synthetic CI pipeline` can update one isolated synthetic task in `autodev-state:state/pilot_task_1.json`. The trusted receiver validates exact repository ID/name, PR #1, branch names, full SHA, source workflow ID/name/path, original run attempt and completed green **or red** outcome. It reads fresh GitHub API objects rather than trusting event text alone.

- **Success**: `TESTING → CODING` for the next approved step, or `REVIEW` when all steps are exhausted.
- **Failure**: `TESTING → REPAIRING` within the configured `maxRepairs`, otherwise `BLOCKED`.
- **Duplicate**: same CI run ID is idempotent, no second state write.
- **Unsafe / stale**: fail closed. GitHub Contents API's current blob SHA acts as a write precondition; a write conflict fails without claiming success.

The trusted receiver checks out only `github.sha` from the default branch, does not check out source PR code, runs test files from default branch only, and has no OpenAI key, Codex call, deployment, PR merge or access to private repositories. Its only persisted write is the synthetic task state file on the dedicated `autodev-state` branch. Existing paid Codex job remains `if: false`.

## Before live acceptance

1. Merge the tested trusted receiver PR to **this public pilot repo's main only**.
2. Create the dedicated `autodev-state` branch and an initial synthetic state matching PR #1 HEAD (phase `TESTING`, event ledger containing bootstrap IDs).
3. Trigger a single new source CI run by closing/reopening the synthetic PR #1; the current source CI itself has separate deterministic tests and no AI key.
4. Check **new** GitHub Actions run `Autodev pilot trusted CI-to-state receiver (NO AI)` and the state file at the exact new branch commit. Verify success and independent proof, not merely workflow creation.
5. Run negative CI in a separate controlled test task only when the state is appropriately reset to `TESTING`; never toggle production/customer data to force a failure.

## Known limits that must be solved before replacing the hourly ChatGPT developers

- This is a trusted CI event **decision and persistence** receiver, not Codex continuation. `CODING` / `REPAIRING` are dispatch requests that still need a **safe job worker**.
- The source config is pinned to public synthetic PR #1. Multi-repository support needs a private caller workflow running in the private repo with private artifacts and private secrets.
- GitHub Actions concurrency is not an unconditional durable queue: pending `workflow_run` events can be coalesced/replaced. The eventual production motor needs durable event reconciliation, transactional reservations and replay recovery.
- GitHub state branch is suitable for this PUBLIC synthetic test only. The private production solution must store protected task state in trusted private infrastructure.
- `REVIEW` is **not** automatic product acceptance and does not permit production deployment. The owner must approve sensitive or production actions.

Tracking: Issue #7.
