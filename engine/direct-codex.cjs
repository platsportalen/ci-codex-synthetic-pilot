'use strict';
// Stage 5.7: one bounded model pass in the SAME trusted workflow that reported
// red CI, because workflow_run callbacks from GITHUB_TOKEN dispatch were suppressed.
// Never execute untrusted PR scripts with a write token or API credential.
const {validateOrder}=require('./controller.cjs');
const {verifyWorkOrder}=require('./continuation.cjs');
const {CONTINUATION}=require('./ci-source.cjs');
const SHA=/^[0-9a-f]{40}$/;
const STATE_BRANCH='autodev-state', STATE_PATH='state/pilot_task_1.json';
function need(ok,why){if(!ok)throw Error('AUTODEV_DIRECT_PAID_DENIED: '+why);}
function reservationPath(receipt){
  need(receipt?.taskId==='pilot_task_1'&&
    Number.isSafeInteger(receipt.sourceRunId)&&receipt.sourceRunId>0,'reservation scope');
  return 'state/paid/direct-'+receipt.taskId+'/run-'+receipt.sourceRunId+'.json';
}
function checkManifest(order,receipt,context){
  validateOrder(order);
  need(context?.repo?.owner==='platsportalen'&&
    context.repo.repo==='ci-codex-synthetic-pilot'&&
    context.ref==='refs/heads/main'&&context.eventName==='workflow_dispatch'&&
    SHA.test(context.sha||''),'controller origin');
  need(receipt?.taskId===order.taskId&&receipt.repository===order.repository&&
    receipt.sourceRunId===context.runId&&
    receipt.controllerSha===context.sha&&SHA.test(receipt.sourceSha||'')&&
    receipt.stepIndex===1&&receipt.stepId==='final_verification'&&
    ['CODING','REPAIRING'].includes(receipt.phase)&&
    receipt.action==='PROPOSE_PATCH'&&receipt.repairAttempt<=order.maxRepairs,
    'bounded synthetic step');
  verifyWorkOrder(order,receipt,{
    sourceRunId:context.runId,sourceSha:receipt.sourceSha,
    controllerSha:context.sha});
  need(Number(process.env.GITHUB_RUN_ATTEMPT)===1,'no workflow reruns');
}
async function checkTrustedExecution(github,context,order,receipt){
  checkManifest(order,receipt,context);
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main.object.sha===context.sha,'trusted main moved');
  const {data:self}=await github.rest.actions.getWorkflowRun({
    ...context.repo,run_id:context.runId});
  need(self.id===context.runId&&self.workflow_id===CONTINUATION.workflowId&&
    self.path===CONTINUATION.path&&self.event==='workflow_dispatch'&&
    self.run_attempt===1&&self.head_branch==='main'&&self.head_sha===context.sha&&
    self.name==='autodev-continuation-'+receipt.sourceSha&&
    self.repository?.id===order.source.repoId,
    'exact trusted workflow');
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{
    ...context.repo,run_id:context.runId,filter:'latest',per_page:100});
  const good=n=>jobs.some(j=>j.name===n&&j.conclusion==='success');
  const realTest=jobs.find(j=>j.name===CONTINUATION.testsJob);
  need(good(CONTINUATION.validateJob)&&
    realTest?.conclusion===(receipt.phase==='REPAIRING'?'failure':'success')&&
    good('Persist verified CI result even when source tests fail')&&
    good('Continue repair or next step without a timer (NO AI)')&&
    good('Independently validate new work order (NO API SECRET)'),
    'job-level proof or test provenance missing');
  const {data:pr}=await github.rest.pulls.get({
    ...context.repo,pull_number:order.source.pr});
  need(pr.state==='open'&&pr.base.ref===order.source.baseBranch&&
    pr.head.ref===order.source.headBranch&&pr.head.sha===receipt.sourceSha&&
    pr.head.repo?.id===order.source.repoId,'PR moved');
  const {data:stateFile}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH});
  need(stateFile.type==='file'&&stateFile.encoding==='base64'&&
    stateFile.sha===receipt.stateSha&&stateFile.size<=16384,'state blob or CAS');
  const state=JSON.parse(Buffer.from(stateFile.content,'base64').toString('utf8'));
  need(state.taskId===receipt.taskId&&state.repository===receipt.repository&&
    state.phase===receipt.phase&&state.headSha===receipt.sourceSha&&
    state.stepIndex===receipt.stepIndex&&state.repairs===receipt.repairAttempt&&
    state.seenCiRunIds.at(-1)===receipt.sourceRunId,
    'stale or wrong task state');
  return {pr,stateFile,state,jobs};
}
function reservationPayload(receipt,context){
  return {version:1,taskId:receipt.taskId,repository:receipt.repository,
    stepId:receipt.stepId,sourceRunId:receipt.sourceRunId,
    sourceSha:receipt.sourceSha,stateSha:receipt.stateSha,
    controllerSha:context.sha,workflowRunId:context.runId,
    phase:receipt.phase,repairAttempt:receipt.repairAttempt,
    action:'ONE_CODEX_PATCH_NO_RETRY'};
}
async function reserveDirect({github,context,receipt,order=require('./pilot-order.json')}){
  await checkTrustedExecution(github,context,order,receipt);
  const reserved=reservationPayload(receipt,context);
  // No blob SHA = CREATE ONLY. Existing reservation is permanent; do not retry.
  await github.rest.repos.createOrUpdateFileContents({
    ...context.repo,branch:STATE_BRANCH,path:reservationPath(receipt),
    message:'autodev: reserve direct Codex step '+context.runId,
    content:Buffer.from(JSON.stringify(reserved,null,2)+'\n').toString('base64')
  });
  return reserved;
}
async function verifyDirectReservation({
  github,context,receipt,order=require('./pilot-order.json')
}){
  await checkTrustedExecution(github,context,order,receipt);
  const {data:blob}=await github.rest.repos.getContent({
    ...context.repo,path:reservationPath(receipt),ref:STATE_BRANCH});
  need(blob.type==='file'&&blob.encoding==='base64'&&blob.size<=4096,
    'reservation missing');
  const actual=JSON.parse(Buffer.from(blob.content,'base64').toString('utf8'));
  need(JSON.stringify(actual)===JSON.stringify(reservationPayload(receipt,context)),
    'reservation mismatched');
  return actual;
}
module.exports={reserveDirect,verifyDirectReservation,reservationPath,
  checkTrustedExecution};
