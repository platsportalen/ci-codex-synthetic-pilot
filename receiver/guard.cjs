'use strict';
const TARGET = Object.freeze({
  repo: 'platsportalen/ci-codex-synthetic-pilot',
  id: 1449650612,
  pr: 1,
  base: 'main',
  head: 'pilot/synthetic-v1',
  workflowId: 410595623,
  workflow: 'Synthetic CI pipeline',
  path: '.github/workflows/synthetic.yml',
});
function requireValid(ok, reason) { if (!ok) throw Error('Rejected source CI: '+reason); }
function checkSource({repository, pr, run, eventRun, attempt = 1}) {
  requireValid(repository?.id === TARGET.id && repository?.full_name === TARGET.repo, 'repository');
  requireValid(pr?.number === TARGET.pr && pr?.state === 'open', 'PR');
  requireValid(pr.base?.ref === TARGET.base && pr.head?.ref === TARGET.head, 'PR branches');
  for (const side of ['base', 'head']) {
    requireValid(pr[side]?.repo?.id === TARGET.id && pr[side]?.repo?.full_name === TARGET.repo, 'PR '+side+' repository');
  }
  requireValid(/^[a-f0-9]{40}$/.test(pr.head?.sha || ''), 'head SHA format');
  requireValid(Number.isSafeInteger(run?.id) && run.id > 0 && run.id === eventRun?.id, 'run ID');
  requireValid(run.workflow_id === TARGET.workflowId && run.name === TARGET.workflow && run.path === TARGET.path, 'workflow identity');
  requireValid(run.event === 'pull_request' && run.status === 'completed' && run.conclusion === 'success', 'workflow result');
  requireValid(run.repository?.id === TARGET.id && run.head_repository?.id === TARGET.id, 'run repository');
  requireValid(run.head_branch === TARGET.head && run.head_sha === pr.head.sha && eventRun.head_sha === run.head_sha, 'run head SHA');
  requireValid(Array.isArray(run.pull_requests) && run.pull_requests.some(p => p.number === TARGET.pr && p.head?.repo?.id === TARGET.id), 'run PR association');
  requireValid(attempt === 1 && run.run_attempt === 1, 'retry disallowed');
  return Object.freeze({sourceRunId: run.id, sha: run.head_sha, prNumber: TARGET.pr});
}
function checkNoPriorContinuation(runs, currentRunId, marker, jobsByRun) {
  for (const run of runs) {
    if (run.id === currentRunId || run.display_title !== marker) continue;
    const jobs = jobsByRun.get(run.id);
    requireValid(Array.isArray(jobs), 'missing historical jobs');
    requireValid(!jobs.some(job => job.name === 'Continue synthetic work (NO AI)' && job.conclusion !== 'skipped'), 'duplicate work step');
  }
}
module.exports = {TARGET, checkSource, checkNoPriorContinuation};
