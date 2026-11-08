# Stage 5.3 — gated live Codex worker consumes the accepted next-step work order

## Purpose

Connect the existing `workflow_run.completed → trusted CI check → persisted task state → signed-by-context work-order artifact → separate verifier` chain to **one actual model coding attempt**, without creating a new repository or depending on Weazy or Projektagent.

Implementation is scoped to **public synthetic fixture** `pilot_task_1`, **step** `final_verification`, and a single allowlisted source file `lab/sample.py`. No private source or logs may enter this public pilot.

## Activation is deliberately OFF

`reserve_paid` runs only if repository variable `AUTODEV_PAID_V1_ENABLED` is **exactly `true`** and all previous no-secret validation succeeds. This variable has *not* been created or modified by this PR. This is a separate flag from the previous synthetic pilot `SYNTHETIC_EVENT_AI_ENABLED`.

When enabled, GitHub creates the one-time reservation file `autodev-state:state/paid/pilot_task_1/source-<ci-run-id>.json` **before** offering the paid job. The GitHub Contents API creates it without a prior blob SHA: an existing file results in failure rather than overwrite. An old PR SHA, stale controller, duplicate workflow attempt or stale task state blocks the reservation.

The API-secret consumer is isolated in job `codex_paid`, protected by **GitHub Environment `synthetic-pilot-approval`** with Required reviewers. Before any API call, it re-fetches and verifies the immutable reservation, PR head, source CI and current task state. It reads just the synthetic `lab/sample.py` as **data**, never checks out PR scripts. The action is pinned to the previously tested `openai/codex-action` commit and Codex CLI version, model `gpt-5.3-codex`, sandbox workspace-write. It makes only ONE attempt (no workflow rerun). Token/API cost remains controlled by the dedicated OpenAI project's existing limit.

The model returns a bounded unified-diff **artifact only**, not a commit, merge or deployment. Another runner WITHOUT the Environment or API key downloads it and applies only `sample.py` modifications, running trusted four-case tests. No automatic pushes, merges or production actions are available.

## What this DOES and does not prove

The last verified Stage 5.2 event `42473455507` showed a successful artifact of a real CI-created synthetic task. This PR adds the real AI handoff and checks, but does **not** by itself prove actual Codex execution; the paid flag and subsequent GitHub Environment approval are necessary. The old paid test `42423040999` was a different, already-consumed work step and remains disabled.

This is **NOT YET** a complete autonomous multi-step developer. After a successful model patch the trusted integration layer must safely commit it to a branch and explicitly trigger/associate the next CI run; a `GITHUB_TOKEN` push normally does not trigger arbitrary push/PR workflows. We also need bounded automatic repair after a failed verifier, durable recovery for lost CI events, and a project-private caller runtime with secret/artifact isolation. Only then may it replace a scheduled ChatGPT developer.

## Next exact pilot verification

1. Review source, protection of `synthetic-pilot-approval`, OpenAI 1 USD hard project limit, and latest pilot `main` SHA.
2. Once reviewed, set `AUTODEV_PAID_V1_ENABLED=true` under **this repository's GitHub Actions Variables**. Do not replace/print the existing Environment secret.
3. Trigger one new synthetic source PR #1 CI while task state is in matching `TESTING` phase and has not previously reserved the given CI run. The receiver will generate a `CODING` work order, reserve exactly one paid step, and queue `codex_paid` for explicit Environment approval.
4. On approved job completion check the real patch artifact and independent `verify_codex_paid` success.
5. Set the activation variable to false. A reservation is **consumed even if Codex/model verification fails**; restarting it is not a safe retry.
6. Extend from this known working chain to the actual automatic patch→branch→fresh CI loop (new PR).

No unrelated repository, Railway service or existing schedules are modified in this PR. Progress is tracked by [Issue #7](https://github.com/platsportalen/ci-codex-synthetic-pilot/issues/7).
