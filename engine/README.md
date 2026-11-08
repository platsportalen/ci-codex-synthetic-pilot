# Stage 5 — portable event-driven task controller

Repository: existing PUBLIC ci-codex-synthetic-pilot. This is the reusable development engine's non-secret reference/control code, NOT a new repo and NOT part of Weazy or Projektagent.

## What this PR implements

A pure, credential-free, deterministic task state machine in `controller.cjs` with explicit task/repository/SHA/allowed-path/acceptance scope and bounded work steps. Trusted verified events move tasks through:

`QUEUED → CODING → TESTING → REPAIRING (on red CI) or CODING (next step) → REVIEW → DONE`.

Wrong repository, task, SHA, CI run replay and exhausted repair attempts fail closed. There is no network access, GitHub write token, OpenAI secret, model invocation or deployment in this PR. Tests run under `engine-preflight.yml`.

## Next integration, not yet implemented

An adapter must RE-FETCH the real GitHub PR, full SHA and completed CI run before passing a verified event to the state machine. Persist state and task reservations transactionally; this pure state machine's in-memory event list is not a durable multi-run lock. Pair with a *privately executed* runner for any private target project. A GitHub reusable workflow may be hosted in the public controller repo but private source, private patches, logs and secrets MUST remain in the private caller's execution context. Never upload private code/artifacts to this public repository. Railway remains for isolated staging.

GitHub's currently working paid synthetic Codex pilot stays literally disabled (`if: false`) after its completed approved test. Do not reactivate it as a side effect of this work. A final green CI is not customer acceptance or permission to publish.

Detailed migration plan: issue #7.