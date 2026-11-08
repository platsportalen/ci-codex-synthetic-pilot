const REPO='platsportalen/ci-codex-synthetic-pilot';
function check({pr,sha,attempt=1,duplicate=false}) {
 if(pr?.number!==1 || pr.state!=='open' || pr.base?.ref!=='main' || pr.head?.ref!=='pilot/synthetic-v1' || !/^[0-9a-f]{40}$/.test(sha||'') || pr.head.sha!==sha || ['base','head'].some(k=>pr[k]?.repo?.id!==1449650612 || pr[k]?.repo?.full_name!==REPO) || attempt!==1 || duplicate) throw Error('Pilot scope, SHA, attempt or duplicate rejected');
}
module.exports={check};
