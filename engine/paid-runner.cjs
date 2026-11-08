'use strict';
const {verifyWorkOrder}=require('./continuation.cjs');
const {verifyCompletedCI}=require('./ci-source.cjs');
const SHA=/^[0-9a-f]{40}$/;
const STATE_BRANCH='autodev-state';
const STATE_PATH='state/pilot_task_1.json';
function need(ok,why){if(!ok)throw Error('AUTODEV_PAID_DENIED: '+why);}
function pathFor(receipt){
  need(receipt?.taskId==='pilot_task_1' &&
    Number.isSafeInteger(receipt.sourceRunId) && receipt.sourceRunId>0,'bounded reservation path');
  return 'state/paid/'+receipt.taskId+'/source-'+receipt.sourceRunId+'.json';
}
function assertSyntheticScope(order,receipt,context){
  need(context?.repo?.owner==='platsportalen' &&
    context.repo.repo==='ci-codex-synthetic-pilot' &&
    context.ref==='refs/heads/main' && SHA.test(context.sha||''),'trusted controller');
  need(receipt?.stepId==='final_verification' && receipt.stepIndex===1 &&
    receipt.phase==='CODING' && receipt.action==='PROPOSE_PATCH_ONLY_NO_AI',
    'pilot single approved work step');
  need(receipt.allowedPaths.includes('lab/sample.py') &&
    receipt.allowedPaths.length<=2 &&
    receipt.allowedPaths.every(p=>p==='lab/sample.py'||p==='lab/test_acceptance.py'),
    'synthetic source scope');
  need(receipt.taskId===order.taskId && receipt.repository===order.repository,
    'work order identity');
  need(receipt.sourceRunId===context.payload?.workflow_run?.id &&
    receipt.sourceSha===context.payload?.workflow_run?.head_sha &&
    receipt.controllerSha===context.sha,'source/controller binding');
  verifyWorkOrder(order,receipt,{
    sourceRunId:receipt.sourceRunId,sourceSha:receipt.sourceSha,
    controllerSha:context.sha});
}
/* This is the ONLY credential-free job allowed to write a paid-step reservation.
   Any existing path aborts; never overwrite a reserved step. */
async function reserveStep({github,context,receipt,order=require('./pilot-order.json'),runId}){
  assertSyntheticScope(order,receipt,context);
  need(Number.isSafeInteger(runId)&&runId>0,'current workflow ID');
  need(Number(process.env.GITHUB_RUN_ATTEMPT)===1,'workflow rerun disallowed');
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main.object.sha===context.sha,'controller moved');
  const {data:pr}=await github.rest.pulls.get({...context.repo,pull_number:order.source.pr});
  const {data:run}=await github.rest.actions.getWorkflowRun({
    ...context.repo,run_id:receipt.sourceRunId});
  verifyCompletedCI({repository:context.payload.repository,pr,run,
    payloadRun:context.payload.workflow_run,attempt:1,order});
  const {data:blob}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH});
  need(blob.type==='file'&&blob.encoding==='base64' &&
    blob.sha===receipt.stateSha && blob.size<=16384,'state SHA/size');
  const state=JSON.parse(Buffer.from(blob.content,'base64').toString('utf8'));
  need(state.taskId===receipt.taskId && state.repository===receipt.repository &&
    state.phase===receipt.phase && state.stepIndex===receipt.stepIndex &&
    state.headSha===receipt.sourceSha &&
    state.seenCiRunIds.at(-1)===receipt.sourceRunId,'current state mismatch');
  const reservation={
    version:1,taskId:receipt.taskId,repository:receipt.repository,
    sourceRunId:receipt.sourceRunId,sourceSha:receipt.sourceSha,
    controllerSha:receipt.controllerSha,stateSha:receipt.stateSha,
    stepId:receipt.stepId,workflowRunId:runId,
    action:'ONE_BOUNDED_CODEX_PASS_NO_RETRY'
  };
  await github.rest.repos.createOrUpdateFileContents({
    ...context.repo,branch:STATE_BRANCH,path:pathFor(receipt),
    message:'autodev: reserve single Codex pass for CI '+receipt.sourceRunId,
    content:Buffer.from(JSON.stringify(reservation,null,2)+'\n').toString('base64')
  }); // NO sha => GitHub refuses if already exists; never retry on collision
  return reservation;
}
/* Run as the FIRST step inside the protected-Environment job, before API key use.
   Rechecks exact reservation, controller SHA, PR head, state and source CI. */
async function verifyReservedStep({github,context,receipt,order=require('./pilot-order.json'),runId}){
  assertSyntheticScope(order,receipt,context);
  need(Number.isSafeInteger(runId)&&runId>0,'current run');
  need(Number(process.env.GITHUB_RUN_ATTEMPT)===1,'workflow rerun disallowed');
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main.object.sha===context.sha,'stale controller');
  const {data:blob}=await github.rest.repos.getContent({
    ...context.repo,path:pathFor(receipt),ref:STATE_BRANCH});
  need(blob.type==='file'&&blob.encoding==='base64'&&blob.size<=4096,'reservation blob');
  const reservation=JSON.parse(Buffer.from(blob.content,'base64').toString('utf8'));
  const expected={
    version:1,taskId:receipt.taskId,repository:receipt.repository,
    sourceRunId:receipt.sourceRunId,sourceSha:receipt.sourceSha,
    controllerSha:receipt.controllerSha,stateSha:receipt.stateSha,
    stepId:receipt.stepId,workflowRunId:runId,
    action:'ONE_BOUNDED_CODEX_PASS_NO_RETRY'
  };
  need(JSON.stringify(reservation)===JSON.stringify(expected),'reservation identity');
  const {data:stateFile}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH});
  need(stateFile.sha===receipt.stateSha,'task state changed');
  const {data:pr}=await github.rest.pulls.get({
    ...context.repo,pull_number:order.source.pr});
  const {data:sourceRun}=await github.rest.actions.getWorkflowRun({
    ...context.repo,run_id:receipt.sourceRunId});
  verifyCompletedCI({repository:context.payload.repository,pr,run:sourceRun,
    payloadRun:context.payload.workflow_run,attempt:1,order});
  need(pr.head.sha===receipt.sourceSha,'PR moved');
  return expected;
}
module.exports={reserveStep,verifyReservedStep,pathFor,assertSyntheticScope};
