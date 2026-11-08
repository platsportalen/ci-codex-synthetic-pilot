'use strict';
const {advance,validateOrder}=require('./controller.cjs');
const SHA=/^[a-f0-9]{40}$/;
function need(ok,reason){if(!ok)throw Error('AUTODEV_DELIVERY_DENIED: '+reason);}
function verifySyntheticDelivery({order,state,run,jobs,pr}){
  validateOrder(order);
  need(order.repository==='platsportalen/ci-codex-synthetic-pilot' &&
    order.taskId==='pilot_task_1','synthetic only');
  need(state?.taskId===order.taskId && state.repository===order.repository &&
    state.phase==='REVIEW' &&
    state.stepIndex===order.steps.length-1,'final review state');
  need(SHA.test(state.headSha||'') && pr?.state==='open' &&
    pr.number===order.source.pr && pr.head?.sha===state.headSha &&
    pr.head?.ref===order.source.headBranch &&
    pr.head?.repo?.id===order.source.repoId,'current PR identity');
  need(run?.event==='pull_request' && run.workflow_id===order.source.workflowId &&
    run.name===order.source.workflowName &&
    run.path===order.source.workflowPath &&
    run.status==='completed' && run.conclusion==='success' &&
    run.run_attempt===1 && run.head_sha===state.headSha &&
    run.repository?.id===order.source.repoId &&
    run.head_repository?.id===order.source.repoId,'successful exact CI');
  need(Array.isArray(state.seenCiRunIds) &&
    state.seenCiRunIds.at(-1)===run.id &&
    state.seenEventIds.includes('ci_'+run.id),'CI recorded in state');
  need(Array.isArray(jobs),'GitHub job evidence');
  const required=['validate','Generate SYNTHETIC patch (NOT Codex)','Verify patch on separate runner'];
  for(const name of required){
    need(jobs.some(j=>j.name===name && j.status==='completed' &&
      j.conclusion==='success' && j.run_id===run.id),'missing mandatory job '+name);
  }
  return Object.freeze({
    version:1,taskId:order.taskId,repository:order.repository,
    sourceSha:run.head_sha,sourceRunId:run.id,stepId:order.steps.at(-1).id,
    verification:'CI_SUCCESS_ALL_REQUIRED_SYNTHETIC_JOBS',
    requiredJobs:required,productionRelease:false,
    customerAcceptance:false
  });
}
function acceptSyntheticDelivery(order,state,proof){
  need(proof?.taskId===order.taskId && proof.repository===order.repository &&
    proof.sourceSha===state.headSha &&
    proof.sourceRunId===state.seenCiRunIds.at(-1) &&
    proof.verification==='CI_SUCCESS_ALL_REQUIRED_SYNTHETIC_JOBS' &&
    proof.productionRelease===false && proof.customerAcceptance===false,
    'unbound delivery proof');
  return advance(order,state,{
    type:'ACCEPT',taskId:order.taskId,repository:order.repository,
    eventId:'accept_'+proof.sourceRunId,sha:state.headSha,accepted:true
  });
}
module.exports={verifySyntheticDelivery,acceptSyntheticDelivery};
