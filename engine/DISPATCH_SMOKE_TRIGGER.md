# Synthetic dispatch smoke trigger

One-time trusted integration test: run exactly one workflow_dispatch CI for synthetic pilot_task_1 at its current PR #1 SHA. The intentionally failing zero-support code must produce a red CI, then the controller must move TESTING to REPAIRING. No paid model and no private code.

Second bounded smoke after PR #15: verify dispatched red CI reaches REPAIRING. No AI or private data.
