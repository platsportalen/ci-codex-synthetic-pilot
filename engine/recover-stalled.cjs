'use strict';
// Resume exactly one already verified, stalled REPAIRING state after a source
// workflow finished before the guarded paid flag was enabled.
// NO source-PR code execution; all inputs are untrusted until re-fetched.
const {validateOrder}=require('./controller.cjs');
const {createWorkOrder,verifyWorkOrder}=require('./continuation.cjs');
const {CONTINUATION}=require('./ci-source.cjs');
const SHA=/^[a-f0-9]{40}$/;
const STATE_BRANCH='autodev-state';
const STATE_PATH='state/pilot_task_1.json';
const RESUME_PATH='.github/workflows/autodev-repair-resume.yml';
const RESUME_NAME='Autodev resume one stalled synthetic repair';
function need(x,msg){if(!x)throw Error('AUTODEV_RECOVERY_DENIED: '+msg);}
function reservationPath(receipt){
  need(receipt.taskId==='pilot_task_1' &&
    Number.isSafeInteger(receipt.sourceRunId) && receipt.sourceRunId>0,
    'reservation identity');
  return 'state/paid/resume-'+receipt.taskId+'/source-'+receipt.sourceRunId+'.json';
}
function checkContext(context){
  need(context?.repo?.owner==='platsportalen' &&
    context.repo.repo==='ci-codex-synthetic-pilot' &&
    context.ref==='refs/heads/main' &&
    context.eventName==='workflow_dispatch' &&
    SHA.test(context.sha||'') &&
    Number.isSafeInteger(context.runId) && context.runId>0 &&
    Number(process.env.GITHUB_RUN_ATTEMPT)===1,'trusted workflow dispatch');
}
async function verifyRecovery({github,context,order=require('./pilot-order.json'),
  sourceRunId,sourceSha,taskId}){
  validateOrder(order);
  checkContext(context);
  need(taskId===order.taskId && SHA.test(sourceSha||'') &&
    Number.isSafeInteger(sourceRunId) && sourceRunId>0,'input work scope');
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main.object.sha===context.sha,'trusted main advanced');
  const {data:self}=await github.rest.actions.getWorkflowRun({
    ...context.repo,run_id:context.runId});
  need(self.id===context.runId&&self.event==='workflow_dispatch' &&
    self.path===RESUME_PATH && self.name===RESUME_NAME &&
    self.head_sha===context.sha && self.head_branch==='main' &&
    self.run_attempt===1 && self.repository?.id===order.source.repoId,
    'recovery workflow identity');
  const {data:pr}=await github.rest.pulls.get({
    ...context.repo,pull_number:order.source.pr});
  need(pr.state==='open' && pr.base.ref===order.source.baseBranch &&
    pr.head.ref===order.source.headBranch && pr.head.sha===sourceSha &&
    pr.head.repo?.id===order.source.repoId,'source PR moved');
  const {data:failed}=await github.rest.actions.getWorkflowRun({
    ...context.repo,run_id:sourceRunId});
  need(failed.id===sourceRunId &&
    failed.workflow_id===CONTINUATION.workflowId &&
    failed.path===CONTINUATION.path &&
    failed.event==='workflow_dispatch' &&
    failed.run_attempt===1 &&
    failed.status==='completed' && failed.conclusion==='failure' &&
    failed.head_branch==='main' &&
    failed.display_title==='autodev-continuation-'+sourceSha &&
    failed.repository?.id===order.source.repoId,'not the exact failed source CI');
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{
    ...context.repo,run_id:sourceRunId,filter:'latest',per_page:100});
  const passed=n=>jobs.some(j=>j.name===n && j.conclusion==='success');
  need(passed(CONTINUATION.validateJob)&&
    jobs.some(j=>j.name===CONTINUATION.testsJob&&j.conclusion==='failure')&&
    passed('Persist verified CI result even when source tests fail') &&
    passed('Continue repair or next step without a timer (NO AI)') &&
    passed('Independently validate new work order (NO API SECRET)'),
    'original red CI and recovery receipt not verified');
  const {data:file}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH});
  need(file.type==='file' && file.encoding==='base64' &&
    SHA.test(file.sha||'') && file.size<=16384,'persisted state blob');
  const state=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  need(state.taskId===taskId&&state.repository===order.repository &&
    state.phase==='REPAIRING'&&state.stepIndex===1 &&
    state.headSha===sourceSha &&
    state.seenCiRunIds.at(-1)===sourceRunId &&
    Number.isInteger(state.repairs) && state.repairs>0 &&
    state.repairs<=order.maxRepairs &&
    !state.blocker,'not an active bounded repair');
  const receipt=createWorkOrder(order,state,{
    sourceRunId,controllerSha:context.sha,stateSha:file.sha});
  verifyWorkOrder(order,receipt,{
    sourceRunId,sourceSha,controllerSha:context.sha});
  need(receipt.phase==='REPAIRING'&&
    receipt.stepId==='final_verification'&&
    receipt.action==='PROPOSE_PATCH'&&
    receipt.allowedPaths.includes('lab/sample.py'),'exact synthetic repair only');
  return {receipt,state,sourceRun:failed};
}
async function createRecoveryReceipt({github,context,taskId,sourceRunId,sourceSha,
  order=require('./pilot-order.json')}){
  const {receipt}=await verifyRecovery({
    github,context,order,taskId,sourceRunId,sourceSha});
  return receipt;
}
function reservationFor(receipt,context){
  return {version:1,taskId:receipt.taskId,repository:receipt.repository,
    sourceRunId:receipt.sourceRunId,sourceSha:receipt.sourceSha,
    stateSha:receipt.stateSha,controllerSha:context.sha,
    stepId:receipt.stepId,workflowRunId:context.runId,
    phase:'REPAIRING',repairAttempt:receipt.repairAttempt,
    action:'ONE_RECOVERED_CODEX_PATCH_NO_RETRY'};
}
async function reserveRecovery({github,context,receipt,
  order=require('./pilot-order.json'),runId=context.runId}){
  need(runId===context.runId,'reservation caller run');
  await verifyRecovery({github,context,order,
    taskId:receipt.taskId,sourceRunId:receipt.sourceRunId,sourceSha:receipt.sourceSha});
  const {data:file}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH});
  need(receipt.stateSha===file.sha &&
    receipt.controllerSha===context.sha,'state or controller moved');
  const reservation=reservationFor(receipt,context);
  // Create-only write: GitHub rejects if this run was already consumed.
  await github.rest.repos.createOrUpdateFileContents({
    ...context.repo,branch:STATE_BRANCH,path:reservationPath(receipt),
    message:'autodev: reserve recovered repair from CI '+receipt.sourceRunId,
    content:Buffer.from(JSON.stringify(reservation,null,2)+'\n').toString('base64')
  });
  return reservation;
}
async function verifyRecoveryReservation({github,context,receipt,
  order=require('./pilot-order.json'),runId=context.runId}){
  need(runId===context.runId,'reservation run');
  const {receipt:live}=await verifyRecovery({
    github,context,order,taskId:receipt.taskId,
    sourceRunId:receipt.sourceRunId,sourceSha:receipt.sourceSha});
  need(JSON.stringify(live)===JSON.stringify(receipt),'work order became stale');
  const {data:blob}=await github.rest.repos.getContent({
    ...context.repo,path:reservationPath(receipt),ref:STATE_BRANCH});
  need(blob.type==='file'&&blob.encoding==='base64'&&blob.size<=4096,
    'missing bounded reservation');
  need(JSON.stringify(JSON.parse(Buffer.from(blob.content,'base64').toString('utf8')))===
    JSON.stringify(reservationFor(receipt,context)),'reservation identity mismatch');
  return true;
}
module.exports={createRecoveryReceipt,verifyRecovery,reserveRecovery,
  verifyRecoveryReservation,reservationPath,RESUME_PATH,RESUME_NAME};
