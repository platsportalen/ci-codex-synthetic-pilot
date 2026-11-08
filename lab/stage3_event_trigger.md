# Stage 3 synthetic CI completion probe

This synthetic-only file intentionally triggers a fresh pull-request CI run after the trusted receiver was merged to the public pilot repository's default branch. No source code, customer data, credentials, model calls, deployments or generated commits are introduced.

The CI completion event should start the read-only receiver. Its continuation output is a tiny JSON proof artifact tested by a separate secret-free runner. The existing paid `synthetic-zero-v1` Codex work step remains consumed and disabled from this source PR.
