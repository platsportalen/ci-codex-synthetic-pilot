function assertScope(pr, sha, attempt) {
 const repo='platsportalen/ci-codex-synthetic-pilot';
 if(pr.number!==1 || pr.state!=='open' || pr.base.ref!=='main' || pr.head.ref!=='pilot/synthetic-v1' || pr.head.sha!==sha || !/^[a-f0-9]{40}$/.test(sha) || ['base','head'].some(k=>pr[k].repo?.id!==1449650612 || pr[k].repo?.full_name!==repo) || attempt!==1) throw Error('Scope/SHA/attempt rejected');
}
function assertCI(run, sha) {
 if(run.id!==42405295510 || run.head_sha!==sha || run.status!=='completed' || run.conclusion!=='success' || run.event!=='pull_request' || run.path!=='.github/workflows/synthetic.yml' || !run.pull_requests?.some(p=>p.number===1 && p.head.repo.id===1449650612)) throw Error('Exact source CI not green');
}
function assertUnused(jobs) {
 if(jobs.some(j=>j.name==='Codex single paid pass' && j.conclusion!=='skipped')) throw Error('Work step already consumed/reserved');
}
module.exports={assertScope,assertCI,assertUnused};
