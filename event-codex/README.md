# Stage 4 — trusted event-to-Codex candidate

CURRENT STATUS: prepared, unpaid. This pilot stays entirely in the PUBLIC SYNTHETIC REPOSITORY. No private Weazy code, customer data, tokens, Railway or production changes. Existing Work A/B/C and Weazy PR #92 are untouched.

## What runs automatically

When Synthetic CI pipeline finishes on synthetic PR #1, the workflow ci-event-codex.yml receives workflow_run.completed from trusted default branch, refreshes the exact PR and source run via GitHub API, validates identity/branch/head SHA/CI outcome, and—only for green results—generates a deterministic no-AI patch. A separate fresh runner applies only the allowed sample.py modification and verifies all four acceptance tests.

Red CI, wrong PR/repository/workflow, stale head, forks and reruns fail closed or skip. No untrusted PR scripts are executed by the receiver. The default branch workflow receives a read-only token; no write permission or external deployment is required. A source-PR check on this Draft PR alone is NOT proof of actual workflow_run delivery: prove that after the new receiver is reviewed and merged into the public pilot main.

## Future real Codex path — deliberately OFF

The Codex job uses a LITERAL FALSE job condition, enforced by event-codex/audit.py. The key-bearing job requires protected GitHub Environment synthetic-pilot-approval and has no checkout of PR code or history. Only pinned Actions, a trusted inline scope/duplication guard, and a fixed prompt operate before model invocation. It fetches exactly lab/sample.py as data from an explicitly approved source SHA, then executes pinned openai/codex-action using the proxied API key. A fresh runner WITHOUT Environment secrets applies the returned bounded JSON patch and runs trusted tests. No push, merge, or deployment can occur.

Before any future paid activation:

1. Obtain an explicit authorization for a NEW work step synthetic-ci-codex-v1 (the old synthetic-zero-v1 is ALREADY CONSUMED). Verify the dedicated OpenAI project limit and selected model.
2. Audit a controller-only activation commit that removes literal false and updates the test audit. Pin the final default-branch/controller SHA and the approved source PR SHA in repository or Environment variables SYNTHETIC_EVENT_CONTROLLER_SHA / SYNTHETIC_EVENT_APPROVED_SHA; require SYNTHETIC_EVENT_AI_ENABLED=true. Approval variables are NOT a substitute for GitHub Environment review.
3. GitHub Environment synthetic-pilot-approval currently permits only control/codex-v1. An authorized administrator must review any adjustment to permit trusted public pilot main WITHOUT allowing untrusted PR heads. Required reviewer and disabled administrative bypass must remain.
4. A fresh green synthetic CI completion will then queue the job for Environment approval. After owner review, re-fetch PR/run/default-branch SHA and scan retained workflow history for any prior non-skipped Codex event paid pass. One attempt, no automatic retries; successful OR failed paid attempt consumes the step. Concurrency serializes the workflow but is NOT a durable transactional lock if GitHub run history is deleted or workflows change.
5. After a paid run verify that the model produced one allowlisted patch, tested on separate runner without any secret. Public logs/artifacts must contain synthetic data only. The hard spend cap is not a guarantee of exact billed cost.

GitHub workflow_run requires trusted workflow code on default branch, which is why this candidate must be merged only after its own PR tests, diff and security audit are green.

## Out of scope

No automatic continuation of ChatGPT Work sessions A/B/C; no general-purpose autonomous Weazy agent. A later private Weazy integration needs its own trusted PRIVATE worker/controller, PR ownership locks, secret separation and private artifact storage. Never send Weazy source or logs through this public repository.
