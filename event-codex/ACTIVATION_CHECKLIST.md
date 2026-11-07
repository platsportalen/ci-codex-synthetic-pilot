# Stage 4 event-driven Codex: operator checklist

STATUS: Draft activation candidate only. The previous `synthetic-zero-v1` paid pass was completed and consumed. The new work step `synthetic-ci-codex-v1` has never used a key. Do NOT infer payment from a successful CI/dry run.

## Already verified
- Public synthetic CI completion triggers the candidate workflow immediately (no hourly Work delay).
- Its exact PR/SHA/green CI validation, deterministic patch and separate 4-case verification passed.
- Failed CI creates a skipped receiver with no continuation.
- A protected-environment real Codex run worked ONCE previously in the old isolated control-branch pilot. The NEW event-triggered paid path has not yet been tested.
- No private Weazy files or logs are part of this public repo.

## Preconditions before enabling a new paid event
1. Confirm the specific dedicated OpenAI project, hard spending cap, and model; do not share the key.
2. GitHub repository Settings → Environments → `synthetic-pilot-approval`:
   * Required reviewer `platsportalen` remains active.
   * Administration bypass remains disabled.
   * Deployment branch policy currently permits only `control/codex-v1`. Review adding **only trusted `main`**. Never permit feature/fork/source PR heads.
   * Secret `OPENAI_API_KEY` stays environment-scoped. Do NOT move it to repository secrets.
3. Review Draft activation PR and merge only the audited activation to the public synthetic pilot's `main`. Do not touch Weazy.
4. In Settings → Secrets and variables → Actions → Variables:
   * Set `SYNTHETIC_EVENT_AI_ENABLED` to `false` initially (or leave absent).
   * Set `SYNTHETIC_EVENT_APPROVED_SHA` to the EXACT current full head SHA of source PR #1.
   * Set `SYNTHETIC_EVENT_CONTROLLER_SHA` to the EXACT trusted `main` SHA of the merged activation. If either SHA moves, refuse the paid run.
   * Once approved, change `SYNTHETIC_EVENT_AI_ENABLED=true`; merely changing variables will not trigger the workflow.
5. Produce ONE fresh, approved synthetic source PR CI run. On success, the candidate should automatically start and the paid job should WAIT for Environment approval. Before clicking Approve and deploy, verify the source/receiver SHA and job/PR scope. Never approve a different run.
6. Verify bounded Codex patch artifact and secret-free 4-case testing, record real token usage and measured API charge. No automatic retries, push, merge or deployment. Disable `SYNTHETIC_EVENT_AI_ENABLED` after a single attempted paid run.

## Boundaries
- The paid job does not check out PR code or execute PR tests; it only treats a small fixed synthetic file as input data.
- A failed paid job reserves the single work step. Historical GitHub runs must remain available for duplicate protection. This is not a durable transactional lock against admin run-history deletion.
- Concurrency serializes this workflow only, not ChatGPT Work A/B/C.
- Environment approval is a manual security boundary. No tool here can configure/review GitHub Environments on your behalf.
- Do not transfer this public synthetic workflow or secret to private Weazy. Real Weazy coding needs private storage, trusted CI controller/worker and exclusive assignment.

## Success criteria
Green source CI → receiver created automatically → identity/SHA/CI validated → protected Environment review → one genuine Codex model pass → bounded patch artifact → independent secret-free acceptance tests all green. Until these all happen on the SAME new run, Stage 4 PAID END-TO-END is not proven.
