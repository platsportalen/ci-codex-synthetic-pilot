# Stage 3 — synthetic CI-completion receiver (PREPARED, UNMERGED)

This is an **unpaid** event-routing acceptance test, not another Codex invocation. No API keys, Environment reference, private code or customer data are present. No auto-commit, push, merge or deployment occurs.

Once separately approved and merged **only into this public pilot repository's main**, .github/workflows/ci-completion-receiver.yml listens for workflow_run.completed from Synthetic CI pipeline. GitHub requires the receiving workflow to exist on the default branch; creating this Draft PR alone cannot test the live event trigger.

For the current same-repository synthetic PR #1, the gate obtains the completed source run and current PR via GitHub API; demands success, known source workflow ID/path/name, PR #1, pilot/synthetic-v1 -> main, matching full head SHA, original (non-rerun) attempt and same repository ID. A red, stale, fork or unrelated run cannot continue. A global concurrency group and retained receiver run history reject duplicate continuation of the same CI run ID; this is not a permanent transactional ledger if an administrator deletes run history. GitHub may replace pending concurrency runs: this pilot does not promise processing every event in a burst.

Trusted receiver code is checked out from the default-branch github.sha, **never the source PR's head**. It produces a tiny synthetic evidence artifact (sourceRunId, sourceHeadSha, validated decision), which a fresh runner validates. The receiver has only explicit read token permissions, no Environment, secrets, API model calls, PR scripts or executable PR artifacts. PR preflight tests run 29 local accept/reject cases without secrets.

**Post-merge acceptance (needs separate approval):** trigger a fresh source PR #1 CI run by an approved harmless synthetic commit; wait for the *whole* Synthetic CI pipeline to complete. Its existing approval_probe may require manual review before completion. Verify that receiver-source-<sourceRunId> runs immediately afterward, validation, continuation and separate verifier all succeed. For a failed or stale source run, continuation must be skipped. Neither this PR nor a green PR preflight demonstrates that workflow_run has fired in production.

Direct automatic dispatch to a new **paid** Codex pass, continuous development and migration of Weazy A/B/C are explicitly OUT OF SCOPE. The completed synthetic-zero-v1 paid step remains consumed, and no new paid pass is authorized. No changes are needed in Weazy, its PR #92, its default branch, Railway or the Work agents.
