'use strict';
/** Trusted, no-model patch landing preflight. Never executes source-PR scripts. */
const {verifyWorkOrder}=require('./continuation.cjs');
const {verifyCompletedCI}=require('./ci-source.cjs');
const ORDER=require('./pilot-order.json');
const SHA=/^[a-f0-9]{40}$/;
function need(ok,why){if(!ok)throw Error('AUTODEV_LANDING_DENIED: '+why);}
function verifyLanding({receipt,pr,run,eventRun,repository,controllerSha,attempt=1,order=ORDER}){
  need(SHA.test(controllerSha||''),'controller SHA');
  need(receipt && receipt.action==='PROPOSE_PATCH' && receipt.phase==='CODING','patch-only phase');
  need(receipt.taskId==='pilot_task_1' && receipt.stepId==='final_verification' && receipt.stepIndex===1,'synthetic task');
  need(receipt.allowedPaths.includes('lab/sample.py') && receipt.allowedPaths.every(p=>p==='lab/sample.py'||p==='lab/test_acceptance.py'),'file scope');
  verifyWorkOrder(order,receipt,{sourceRunId:receipt.sourceRunId,sourceSha:receipt.sourceSha,controllerSha});
  const verified=verifyCompletedCI({repository,pr,run,payloadRun:eventRun,attempt,order});
  need(verified.sha===receipt.sourceSha && verified.runId===receipt.sourceRunId,'CI binding');
  need(pr.head.sha===receipt.sourceSha && pr.head.ref==='pilot/synthetic-v1' &&
    pr.head.repo.id===order.source.repoId && pr.head.repo.full_name===order.repository,'PR head');
  return Object.freeze({repository:order.repository,branch:pr.head.ref,sha:verified.sha,
    sourceRunId:verified.runId,stepId:receipt.stepId,taskId:receipt.taskId});
}
function assertPatchContents(text){
  need(typeof text==='string' && Buffer.byteLength(text)>0 && Buffer.byteLength(text)<=8192,'patch size');
  need(!text.includes('\0') && text.endsWith('\n'),'patch encoding');
  need(!/(?:GIT binary patch|new file mode|old mode|rename from|copy from|diff --cc)/.test(text),'patch type');
  const headers=text.split('\n').filter(x=>x.startsWith('--- ')||x.startsWith('+++ ')||x.startsWith('diff --git '));
  need(headers.length>=2 && headers.length<=3 && headers.filter(x=>x.startsWith('--- ')).length===1 &&
    headers.filter(x=>x.startsWith('+++ ')).length===1,'single-file diff headers');
  need(headers.includes('--- a/sample.py') && headers.includes('+++ b/sample.py'),'target must be sample.py');
  if(headers.length===3)need(headers.includes('diff --git a/sample.py b/sample.py'),'diff path');
  return true;
}
module.exports={verifyLanding,assertPatchContents};
