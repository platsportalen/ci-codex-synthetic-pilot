# Real Codex candidate — NOT AUTHORIZED TO RUN

## Trust boundary
Controller branch: `control/codex-v1`, separate from source PR #1 branch `pilot/synthetic-v1`. No default-branch change is needed to prepare this candidate. The controller workflow triggers on pushes only to the exact control branch; it does not run from a PR event or pull_request_target. Only a fully reviewed controller commit may become trusted. Before any future paid activation, restrict Environment deployment branches to this controller branch, pin its full SHA in repository variable `SYNTHETIC_CONTROL_APPROVED_SHA`, verify reviewers/bypass settings, and explicitly approve the run. Same-account review is allowed intentionally; it is not two-person review.

Current source input is PR #1, repo ID 1449650612, head SHA 5c0d2dc4e9f3c582ad479bb6203a483160627147, base main, head pilot/synthetic-v1. Source CI run 42405295510 must be completed/success, match the SHA/path/PR/repository, and the PR must still be open on that exact SHA. Fail closed on API errors, reruns, wrong identity, stale head or previous paid-job reservation.

## Paid job remains hard-disabled
`codex.if` is literally `${{ false }}`. Tests enforce this. Existing OPENAI_API_KEY is referenced ONLY by the disabled pinned Codex Action, never in env, shell, scripts, test jobs or logs. Do not remove the literal stop or change its audit until separately authorized. No key validity/model request has been made.

## Key-bearing runner
No checkout, PR package installation, PR test runner, PR action, PR prompt or PR script is executed. Reviewed inline controller code fetches exactly lab/sample.py at the pinned public synthetic SHA as bytes; it is saved in a fresh temporary Git workspace with no repo history or hooks/config. Codex receives a fixed prompt and returns JSON patch data. `drop-sudo` and sandbox protections plus the Action's credential proxy protect the raw key; prompt instructions alone are not isolation. Only fixed standard-library serialization and pinned artifact upload follow the Action, not PR/model executable code. Dependency compromise and sandbox/proxy defects remain supply-chain risks. No self-hosted runner, private repo token, or external callback is used.

Codex Action pinned to bdf19a4a223ec2549a3e2274a0cf61556bc07675; CLI pinned to 0.167.0 (upstream rust-v0.167.0 release); model gpt-5.3-codex, low effort. Runtime availability remains untested until authorized. Other Actions use reviewed Node24-generation immutable SHAs. Disposable Ubuntu 24.04 runner, 10-minute timeout. Timeout and patch/output-size checks do NOT impose an API monetary cap or single underlying model request; Codex may make several model calls in one coding pass.

## Independent verification
Fresh job has no Environment and no secret expressions. It checks out the reviewed controller SHA only. Trusted controller baseline and acceptance tests are used, not PR-provided scripts. Patch permits one bounded regular text change to sample.py; binary/mode/path changes are rejected. Tests exercise positive/zero/empty/invalid input. Output is artifact only: no remote commit/push/merge or deployment. Disposable local baseline commit is only for diff context.

## Duplicate/race model
One concurrency group serializes this work step; run_attempt must equal 1. Before accessing the OpenAI key, previous runs of this workflow are scanned, including all job attempts. Any non-skipped Codex single paid pass reserves the work step, even if it failed before API access. This is conservative and prevents automatic retry. Run history must be retained; deleting it or changing the controller workflow identity invalidates this guarantee and requires new review. This is not a durable external transactional ledger across administrator history deletion. No A/B/C work is started or changed.

## Current API budget/key evidence — BLOCKER
User reports key named Codex Synthetic Pilot_1 stored as Environment secret OPENAI_API_KEY. Naming alone does not prove dedicated project, permissions or spending controls. OpenAI connector rejected metadata lookup; Platform browser is not signed in. Therefore project ID, exact monthly hard spend cap, model permission, key role/endpoint restrictions and key-to-project mapping are NOT independently verified. No raw secret is requested or read. Need non-secret metadata (project name/ID, hard limit/enforcement, permitted model, key permission scope) before first paid approval. Recommended dedicated project cap: USD 1 for this pilot, owner to approve; enforceable spend cap must be distinguished from alerts and may slightly overshoot during propagation. Do not alter organization-wide limits that could affect other applications.

## Activation sequence after a separate decision
1. Complete project/key and Environment branch-rule verification; never paste secret values.
2. Owner approves one named work step, model, budget and source SHA.
3. Make a separately reviewed controller-only activation commit removing literal false and updating its preparation-only audit. Compute final controller SHA before publishing, set its exact approval variable, then push that reviewed commit. This is a new push event, not a rerun. Environment still holds the paid job for explicit review.
4. Observe validate SUCCESS -> Environment waiting -> approved Codex -> artifact -> fresh verifier. Never automatically approve a paid Environment gate.

This candidate uses a controlled push to bootstrap the exact one-pass experiment; it does NOT yet subscribe directly to future completion events of source PR CI. A general workflow_run receiver requires a workflow on the default branch and is outside the current no-main-change mandate. That next event-routing step needs a separate decision. Do not present this as migration of existing Work A/B/C sessions or full event-driven private development.
