'use strict';
const {advance,validateOrder}=require('./controller.cjs');

const SHA=/^[a-f0-9]{40}$/;
const CONTINUATION=Object.freeze({
  name:'Autodev synthetic continuation CI',
  path:'.github/workflows/autodev-continuation-ci.yml',
  validateJob:'Validate exact continuation target',
  testsJob:'Run trusted acceptance cases without credentials',
});
function need(value,why){if(!value)throw Error('AUTODEV_SOURCE_DENIED: '+why);}

/* Accept only verified, fresh PR CI evidence. The main-branch workflow_dispatch
   path must have a completed, successful target-validation job; only test failure
   can be interpreted as a repairable coding failure. */
function verifyCompletedCI({repository,pr,run,payloadRun,attempt,order,jobs}){
  validateOrder(order);
  const s=order.source;
  need(s&&Number.isSafeInteger(s.repoId)&&Number.isInteger(s.pr)&&
    Number.isSafeInteger(s.workflowId),'trusted source config');
  need(repository?.id===s.repoId&&repository?.full_name===order.repository,'repository');
  need(pr?.number===s.pr&&pr?.state==='open','source PR');
  need(pr?.base?.ref===s.baseBranch&&pr?.head?.ref===s.headBranch,'branches');
  for(const side of ['base','head'])
    need(pr[side]?.repo?.id===s.repoId&&
      pr[side]?.repo?.full_name===order.repository,'PR repository identity');
  need(SHA.test(pr.head?.sha||''),'head SHA');
  need(run?.id===payloadRun?.id&&Number.isSafeInteger(run?.id)&&run.id>0,'source run ID');
  need(run.status==='completed'&&['success','failure'].includes(run.conclusion),
    'completed CI');
  need(payloadRun.status==='completed'&&payloadRun.conclusion===run.conclusion,
    'immutable event outcome');
  need(run.run_attempt===1&&attempt===1,'no rerun');
  need(run.repository?.id===s.repoId&&run.head_repository?.id===s.repoId,
    'CI repository');
  if(run.event==='pull_request'){
    need(run.workflow_id===s.workflowId&&run.name===s.workflowName &&
      run.path===s.workflowPath,'PR workflow identity');
    need(run.head_branch===s.headBranch&&run.head_sha===pr.head.sha &&
      payloadRun.head_sha===run.head_sha,'current PR source SHA');
    need(Array.isArray(run.pull_requests)&&run.pull_requests.some(p=>
      p.number===s.pr&&p.head?.repo?.id===s.repoId),'CI-PR association');
  }else if(run.event==='workflow_dispatch'){
    // The trusted workflow definition lives on main and tests PR source as data.
    // GitHub run.head_sha is MAIN SHA, not the PR SHA in this event type.
    need(run.name===CONTINUATION.name&&run.path===CONTINUATION.path &&
      Number.isSafeInteger(run.workflow_id)&&run.workflow_id>0,
      'trusted continuation CI');
    need(run.head_branch==='main'&&SHA.test(run.head_sha||'') &&
      payloadRun.head_sha===run.head_sha,'trusted main source');
    need(run.display_title==='autodev-continuation-'+pr.head.sha,
      'dispatch expected source SHA');
    need(Array.isArray(jobs)&&
      jobs.some(j=>j.name===CONTINUATION.validateJob&&j.conclusion==='success') &&
      jobs.some(j=>j.name===CONTINUATION.testsJob &&
        j.conclusion===run.conclusion),
      'source validation or test provenance');
  }else throw Error('AUTODEV_SOURCE_DENIED: unsupported CI event');
  return Object.freeze({runId:run.id,sha:pr.head.sha,conclusion:run.conclusion,
    repository:order.repository,taskId:order.taskId});
}
function applyVerifiedCI(order,state,verified){
  need(verified?.repository===order.repository&&verified?.taskId===order.taskId,
    'verified identity');
  need(Number.isSafeInteger(verified.runId)&&verified.runId>0,'run ID');
  need(SHA.test(verified.sha||'')&&
    ['success','failure'].includes(verified.conclusion),'CI decision');
  return advance(order,state,{
    type:'CI_COMPLETED',taskId:order.taskId,repository:order.repository,
    eventId:'ci_'+verified.runId,runId:verified.runId,
    sha:verified.sha,conclusion:verified.conclusion
  });
}
module.exports={verifyCompletedCI,applyVerifiedCI,CONTINUATION};
