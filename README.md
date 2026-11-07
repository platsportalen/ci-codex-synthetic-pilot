# Synthetic CI continuation pilot

Only fabricated exercise code is present. No private application source, history, data, logs or credentials are included. There is no OpenAI key reference, no Codex Action and no API call in this repository. Paid execution has not been implemented or authorized.

## Test chain
Pilot PR #1, branch `pilot/synthetic-v1`, base `main`: validate -> automatically generate a deterministic synthetic patch -> upload artifact -> separately download/apply/test patch. This proves CI job sequencing, not AI coding. GitHub standard hosted runners only. No auto commit, push, merge or deployment. Actions are SHA-pinned.

The fabricated task adds zero support to a small integer total function. Baseline tests pass before the patch; acceptance tests pass after it. Test policy rejects wrong PR, repository ID/name, branch, stale SHA, duplicate and rerun. Runtime checks re-fetch PR and compare SHA. Entire workflow has a concurrency lock. Run history is the dry-run duplication ledger; do not delete it to bypass the guard. A failed generator is considered consumed for that SHA. A new reviewed SHA is needed to try changed code.

## Required Environment setup (no key)
Settings -> Environments -> New environment: `synthetic-pilot-approval`.
Enable Required reviewers, select `platsportalen`, save. Leave Prevent self-review OFF if the same account initiates/reviews the experiment. Uncheck Allow administrators to bypass configured protection rules. Restrict branches to the reviewed pilot PR ref where supported. Add NO secrets.
Only after the protection rules are saved, add repository Actions variable `SYNTHETIC_APPROVAL_PROBE_ENABLED=true`, then request a fresh PR event/commit. The probe should stop at Waiting for review. Observe this state, approve the harmless probe manually, and verify successful completion. The probe prints only a fixed sentence and cannot call an API. Without the variable it is skipped. A skipped probe does not prove Required reviewers are configured.

## Future secret boundary — separate approval required
Do not add keys to this PR workflow. A later key-bearing workflow must come from a reviewed trusted default-branch commit, fetch only validated same-repository PR/SHA synthetic files as DATA, never load/execute PR scripts, require Environment approval, and run generated-code tests on a fresh runner WITHOUT credentials. Use a protected API proxy and a dedicated project hard spend limit. Environment approval alone is not a sandbox. Reject forks. Give no private repository access tokens to this public project. No private logs/artifacts/source should be published here.

This repository is a learning demonstrator. Moving an actual private coding workload needs a private trusted controller/worker and explicit exclusive ownership, not copying private code into this public project. Public logs and artifacts must always contain synthetic data only.
