# Stage 4 paid CI-driven Codex attempt — result and offline recovery

- Event-triggered run: https://github.com/platsportalen/ci-codex-synthetic-pilot/actions/runs/42423040999
- Source CI run: https://github.com/platsportalen/ci-codex-synthetic-pilot/actions/runs/42423004643
- Source PR #1 SHA: `f9059eb49f05e66bc352fcb813c76a1b33db6391`
- Trusted controller `main` SHA: `8abb544e000fdb5071dcf8481527004941fae886`
- Model: `gpt-5.3-codex`; job `Codex event paid pass` SUCCESS, one attempt; CLI reports **11,529 tokens** (actual USD cost not proven here).
- The generated `event-codex-patch-42423040999` artifact was uploaded (ID `13594890418`). The credential-free `Verify AI patch` job FAILED **before running acceptance tests**, because `git apply --numstat` rejected a malformed diff (`corrupt patch at line 10`).
- The exact extracted artifact `codex.patch` is 410 bytes and has SHA256 `1b83b52f8d47d64497908fdedff242ae1eae63c51d530a6b0b34c443ec75668c`. It is a semantically correct single-file modification, but its last diff context line lacks a terminal LF.
- Local diagnostic: the ORIGINAL bytes fail `git apply --numstat` with the same error; appending exactly one byte `\n` makes `git apply --numstat`, `git apply --check`, `git apply`, and all 4 acceptance cases pass.
- A new secret-free GitHub PR test downloads the **same original immutable run artifact**, verifies SHA256, adds only the missing final LF and executes the original trusted acceptance tests on a separate runner. No new AI inference or retry is involved.
- The consumed paid job is set back to literal `if: false`, regardless of the repository's `SYNTHETIC_EVENT_AI_ENABLED` setting. Re-activation for an entirely new work step requires another explicit review. Keep historical Actions runs and Environment protections.
- Only the PUBLIC synthetic pilot repository is modified; Weazy's private repo, A/B/C/PL, staging and production remain untouched.

**Interpretation:** The event-triggering and paid Codex execution worked, but the first combined workflow was FAILED because its AI patch artifact was not valid unified-diff format. Offline normalization and re-verification are an evidence-preserving repair, not a retroactive rewrite of the failed workflow or a second model pass.
