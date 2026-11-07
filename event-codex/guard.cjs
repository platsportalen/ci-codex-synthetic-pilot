'use strict';
const TARGET = Object.freeze({
  repo: 'platsportalen/ci-codex-synthetic-pilot',
  repoId: 1449650612,
  pr: 1, base: 'main', head: 'pilot/synthetic-v1',
  sourceWorkflowId: 410595623,
  sourceWorkflowName: 'Synthetic CI pipeline',
  sourcePath: '.github/workflows/synthetic.yml',
  workStep: 'synthetic-ci-codex-v1',
  paidJobName: 'Codex event paid pass',
});
function ensure(valid, msg) { if (!valid) throw Error('event-codex denied: ' + msg); }
function assertSource({repository, pr, sourceRun, payloadRun, attempt = 1}) {
  ensure(repository?.id === TARGET.repoId && repository?.full_name === TARGET.repo, 'repository');
  ensure(pr?.number === TARGET.pr && pr?.state === 'open', 'source PR');
  ensure(pr?.base?.ref === TARGET.base && pr?.head?.ref === TARGET.head, 'PR branches');
  for (const side of ['base', 'head']) {
    ensure(pr[side]?.repo?.id === TARGET.repoId && pr[side]?.repo?.full_name === TARGET.repo, 'PR '+side+' identity');
  }
  const sha = pr.head?.sha;
  ensure(/^[0-9a-f]{40}$/.test(sha || ''), 'source SHA');
  ensure(Number.isSafeInteger(sourceRun?.id) && sourceRun.id > 0 && sourceRun.id === payloadRun?.id, 'source run ID');
  ensure(sourceRun.workflow_id === TARGET.sourceWorkflowId &&
    sourceRun.name === TARGET.sourceWorkflowName && sourceRun.path === TARGET.sourcePath, 'source workflow');
  ensure(sourceRun.event === 'pull_request' && sourceRun.status === 'completed' && sourceRun.conclusion === 'success', 'CI outcome');
  ensure(sourceRun.run_attempt === 1 && attempt === 1, 'rerun');
  ensure(sourceRun.repository?.id === TARGET.repoId && sourceRun.head_repository?.id === TARGET.repoId, 'source repo');
  ensure(sourceRun.head_branch === TARGET.head && sourceRun.head_sha === sha && payloadRun.head_sha === sha, 'stale source');
  ensure(Array.isArray(sourceRun.pull_requests) && sourceRun.pull_requests.some(p =>
    p.number === TARGET.pr && p.head?.repo?.id === TARGET.repoId), 'source association');
  return Object.freeze({sha, sourceRunId: sourceRun.id, step: TARGET.workStep});
}
function assertActivation({sourceSha, approvedSha, enabled, trustedCommit, currentDefaultCommit}) {
  ensure(enabled === 'true', 'activation disabled');
  ensure(approvedSha === sourceSha, 'unapproved source SHA');
  ensure(/^[0-9a-f]{40}$/.test(trustedCommit || '') && trustedCommit === currentDefaultCommit, 'stale controller');
}
function assertNoPaidAttempt({runs, currentRunId, jobsByRun}) {
  ensure(Array.isArray(runs), 'missing workflow history');
  for (const run of runs) {
    if (run.id === currentRunId) continue;
    const jobs = jobsByRun.get(run.id);
    ensure(Array.isArray(jobs), 'missing jobs for historical run');
    ensure(!jobs.some(j => j.name === TARGET.paidJobName && j.conclusion !== 'skipped'), 'work step already reserved');
  }
}
module.exports = {TARGET, assertSource, assertActivation, assertNoPaidAttempt};
