# Stage 5.4 — gated, fast-forward landing of a verified Codex patch

This is a change to the EXISTING public synthetic engine, not a separate repository or a production task.

**What it adds:** after the previously verified trusted work-order→Codex→independent key-free patch test, an **additional default-OFF job** may apply the exact verified `sample.py` diff on `pilot/synthetic-v1` using ordinary Git. The job rechecks the original CI event, branch/PR SHA, controller SHA, paid reservation and patch allowlist; uses `git apply --check --directory=lab`; checks that the only changed file is `lab/sample.py`; commits and does an ordinary **fast-forward** `git push`. No `--force`, no repo-main writes and no execution of source PR tests/scripts in the Git-token job.

**Guards:** `needs.verify_codex_paid.result == 'success'` **and** `AUTODEV_LANDING_V1_ENABLED == 'true'`. This variable is not configured or activated by this PR. The existing `AUTODEV_PAID_V1_ENABLED` remains separately gated and the older consumed Stage 4 Codex pass remains `if: false`.

**Not full autonomous continuation:** A push using the built-in GitHub Actions `GITHUB_TOKEN` normally does NOT trigger a new `pull_request` or `push` workflow. A separate trusted `workflow_dispatch` CI and downstream source verification with exact SHA/PR association will be required before this can autonomously continue after the landing. Until that mechanism is tested, do **not** enable `AUTODEV_LANDING_V1_ENABLED`; otherwise a patch could land with no follow-up verification event. This stage adds only the safe integration code behind a second activation gate.

**No AI or Github secrets used by PR CI.** No user project code, data, Work agents, Railway or Projektagent integration.

Next: construct and test trusted post-patch CI dispatch and completion/repair reconciliation, then run one bounded full paid synthetic loop with explicit GitHub Environment approval and the existing OpenAI hard limit.

Tracks #7.