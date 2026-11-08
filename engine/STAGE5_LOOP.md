# Stage 5.4 — exact-SHA event-driven coding continuation (synthetic only)

## Implementation

This builds on [Stage 5.3](STAGE5_CODEX_RUNNER.md), the already tested protected Codex job and the one-time paid-step reservation. It runs ONLY inside `platsportalen/ci-codex-synthetic-pilot`, never against Weazy, Platsportalen, OutingStore or Projektagenten.

`workflow_run.completed → verify original PR source CI / verified dispatcher CI → update shared task state → issue bound work order → independent artifact verification → (approved protected Codex pass) → verify model patch without API key → fast-forward to the approved synthetic PR branch → update task state to TESTING → explicit workflow_dispatch of next CI → workflow_run.completed → repeat or REVIEW/BLOCKED.`

The synthetic continuation CI is defined in trusted default-branch file `.github/workflows/autodev-continuation-ci.yml` and is dispatched with `task_id` and an **exact SHA**. It verifies the current PR head, read-only task state, and executes trusted, key-free four-case acceptance tests against `lab/sample.py` fetched as data. The event receiver re-fetches this CI's own job results and only categorizes **actual test failure** as repairable; validation/setup failures are not mistaken for source-code defects.

The integration job that fast-forwards the source branch has NO OpenAI API key or Environment. It rechecks the paid-step reservation and the tested source SHA, performs a strict allowlisted `git apply` **without executing any PR code**, creates a new Git tree/commit with exactly the verified source SHA as parent, and updates the PR branch with `force:false`. On conflict it stops; it never overwrites competing code. Afterwards the state is updated via GitHub Contents API's blob SHA (compare-and-swap) and explicit CI dispatch follows. This is required because a `GITHUB_TOKEN`-authored push does not ordinarily retrigger pull-request CI.

## Safety and truth-in-status

- **No new paid AI invocation is enabled by this commit.** Repository variable `AUTODEV_PAID_V1_ENABLED` must be exactly `true` for one-time reservation and the Codex step still requires GitHub Environment `synthetic-pilot-approval` reviewer approval. The earlier Stage 4 Codex job remains literally hard-disabled.
- The current pilot's Codex prompt and commit scope are restricted to a single synthetic step `final_verification` and one source file `lab/sample.py`. It is not yet a generic private-project runner. Only the synthetic task's source content and artifacts may be public.
- Controller state has a structured `blocker` for exhausted CI repair attempts and explicit HALT. Independently unrelated tasks are not blocked by this sample's `BLOCKED` status; no multi-task scheduler exists yet.
- GitHub CI confirmed **unit/integration test coverage**, not live completion of a paid multi-iteration job after this change. Actual paid execution, its protected approval, and a real dispatched CI callback remain to be verified.
- There is a **non-atomic boundary** between Git branch fast-forward, state CAS update, and dispatch of CI. Failure between these operations must be detected and escalated for recovery; this pilot does not yet implement a durable, lossless outbox/reconciler. Do not assert production-grade continuous autonomy until this is fixed.
- Model patch rejection during the key-free verifier is currently a stop, not a fully automatic new prompt/retry. CI failure after a committed patch **does** transition to a bounded `REPAIRING` state, but needs live verification.
- GitHub Environment required-reviewer is a deliberate human control in this public paid pilot. Fully unattended future work requires a trusted private credential controller with pre-approved task, cost and permissions, NOT bypassing the current reviewer protection.

## Verified stages to date

- Stage 5.1: trust and persist real source CI `TESTING→CODING`, GitHub Actions run `42472881987`.
- Stage 5.2: after real source CI, 3 jobs generated and separately verified bounded work-order artifact in run `42473455507`.
- Stage 5.3: PR #11 merged with preflight and one-time reservation; API execution remains disabled pending activation.
- Stage 5.4: this PR builds commit+dispatch and dispatch-CI handling with negative tests. A test-green PR and a merged workflow on pilot main are **not** proof that a paid end-to-end autonomous run has happened.

Tracking: [Issue #7](https://github.com/platsportalen/ci-codex-synthetic-pilot/issues/7).
