'use strict';
const {advance,validateOrder}=require('./controller.cjs');

const SHA=/^[a-f0-9]{40}$/;
function need(value,why){if(!value)throw Error('AUTODEV_SOURCE_DENIED: '+why);}

/** Accept only fresh, exact PR CI evidence. Both green and red are intentional. */
function verifyCompletedCI({repository,pr,run,payloadRun,attempt,order}) {
  validateOrder(order);
  const s=order.source;
  need(s && Number.isSafeInteger(s.repoId) && Number.isInteger(s.pr) &&
    Number.isSafeInteger(s.workflowId),'trusted source config');
  need(repository?.id===s.repoId && repository?.full_name===order.repository,'repository');
  need(pr?.number===s.pr && pr?.state==='open','source PR');
  need(pr?.base?.ref===s.baseBranch && pr?.head?.ref===s.headBranch,'branches');
  for(const side of ['base','head']){
    need(pr[side]?.repo?.id===s.repoId &&
      pr[side]?.repo?.full_name===order.repository,'PR repository identity');
  }
  need(SHA.test(pr.head?.sha||''),'head SHA');
  need(run?.id===payloadRun?.id && Number.isSafeInteger(run?.id) && run.id>0,'source run ID');
  need(run.workflow_id===s.workflowId && run.name===s.workflowName &&
    run.path===s.workflowPath,'workflow identity');
  need(run.event==='pull_request' && run.status==='completed' &&
    ['success','failure'].includes(run.conclusion),'completed CI');
  need(payloadRun.status==='completed' && payloadRun.conclusion===run.conclusion,
    'immutable event outcome');
  need(run.run_attempt===1 && attempt===1,'no rerun');
  need(run.head_branch===s.headBranch && run.head_sha===pr.head.sha &&
    payloadRun.head_sha===run.head_sha,'current source SHA');
  need(run.repository?.id===s.repoId && run.head_repository?.id===s.repoId,
    'CI repository');
  need(Array.isArray(run.pull_requests) && run.pull_requests.some(p =>
    p.number===s.pr && p.head?.repo?.id===s.repoId),'CI-PR association');
  return Object.freeze({runId:run.id,sha:run.head_sha,conclusion:run.conclusion,
    repository:order.repository,taskId:order.taskId});
}
function applyVerifiedCI(order,state,verified){
  need(verified?.repository===order.repository && verified?.taskId===order.taskId,
    'verified identity');
  need(Number.isSafeInteger(verified.runId) && verified.runId>0,'run ID');
  need(SHA.test(verified.sha||'') &&
    ['success','failure'].includes(verified.conclusion),'CI decision');
  return advance(order,state,{
    type:'CI_COMPLETED',taskId:order.taskId,repository:order.repository,
    eventId:'ci_'+verified.runId,runId:verified.runId,
    sha:verified.sha,conclusion:verified.conclusion
  });
}
module.exports={verifyCompletedCI,applyVerifiedCI};