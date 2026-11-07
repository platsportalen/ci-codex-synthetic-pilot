"""Static fail-closed PR audit for the still-disabled API-bearing job."""
from pathlib import Path

workflow = Path(".github/workflows/ci-event-codex.yml").read_text()
start = workflow.index("\n  codex:\n")
end = workflow.index("\n  verify_codex:\n")
codex = workflow[start:end]
assert "if: ${{ false }}" in codex, "PAID JOB MUST REMAIN LITERALLY DISABLED"
assert "environment: synthetic-pilot-approval" in codex
assert "needs: validate" in codex
assert "openai/codex-action@bdf19a4a223ec2549a3e2274a0cf61556bc07675" in codex
assert "secrets.OPENAI_API_KEY" in codex
assert "actions/checkout@" not in codex, "No checkout in key-bearing job"
assert "npm install" not in codex and "pip install" not in codex
assert "pull_request_target" not in workflow
assert "workflow_run:" in workflow and "types: [completed]" in workflow
assert workflow.count("secrets.OPENAI_API_KEY") == 1
assert "ref: ${{ github.sha }}" in workflow
assert "contents: write" not in workflow
print("Stage4 audit: paid job hard-disabled, isolated and secret-free verification")
