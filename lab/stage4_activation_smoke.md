# Stage 4 activation smoke test (synthetic only)

After merging reviewed opt-in controller onto the public synthetic pilot main, this marker triggers one fresh green PR CI completion. Expected: trusted CI-to-Codex receiver automatically validates and creates the deterministic fixture patch, independent tests succeed, and the PAID Codex job stays SKIPPED because opt-in variables are not enabled. Never include private Weazy code or credentials.
