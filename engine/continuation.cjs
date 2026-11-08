'use strict';
const fs=require('node:fs');
const {validateOrder}=require('./controller.cjs');

const SHA=/^[a-f0-9]{40}$/;
const KEYS=['version','taskId','repository','sourceRunId','sourceSha',
  'controllerSha','stateSha','phase','stepIndex','stepId','repairAttempt',
  'allowedPaths','acceptance','action'];
function need(ok,why){if(!ok)throw Error('AUTODEV_WORKORDER_DENIED: '+why);}
function createWorkOrder(order,state,{sourceRunId,controllerSha,stateSha}){
  validateOrder(order);
  need(state?.taskId===order.taskId && state?.repository===order.repository,'task scope');
  need(['CODING','REPAIRING'].includes(state.phase),'work phase');
  need(SHA.test(state.headSha||'') && SHA.test(controllerSha||'') && SHA.test(stateSha||''),
    'full SHA bindings');
  need(Number.isSafeInteger(sourceRunId) && sourceRunId>0 &&
    Array.isArray(state.seenCiRunIds) &&
    state.seenCiRunIds.at(-1)===sourceRunId,'source run binding');
  need(Number.isInteger(state.stepIndex) && state.stepIndex>=0 &&
    state.stepIndex<order.steps.length,'step index');
  need(Number.isInteger(state.repairs) && state.repairs>=0 &&
    state.repairs<=order.maxRepairs,'repair count');
  const step=order.steps[state.stepIndex];
  return {
    version:1,taskId:order.taskId,repository:order.repository,
    sourceRunId,sourceSha:state.headSha,controllerSha,stateSha,
    phase:state.phase,stepIndex:state.stepIndex,stepId:step.id,
    repairAttempt:state.repairs,allowedPaths:[...step.allowedPaths],
    acceptance:[...step.acceptance],
    action:'PROPOSE_PATCH_ONLY_NO_AI'
  };
}
function verifyWorkOrder(order,receipt,{sourceRunId,sourceSha,controllerSha}){
  validateOrder(order);
  need(receipt && typeof receipt==='object' && !Array.isArray(receipt) &&
    Object.keys(receipt).sort().join('|')===[...KEYS].sort().join('|'),'exact schema');
  need(receipt.version===1 && receipt.taskId===order.taskId &&
    receipt.repository===order.repository,'trusted task');
  need(receipt.sourceRunId===sourceRunId && receipt.sourceSha===sourceSha &&
    SHA.test(receipt.sourceSha||'') &&
    receipt.controllerSha===controllerSha && SHA.test(receipt.controllerSha||'') &&
    SHA.test(receipt.stateSha||''),'CI / state SHA binding');
  need(['CODING','REPAIRING'].includes(receipt.phase),'phase');
  need(Number.isInteger(receipt.stepIndex) &&
    receipt.stepIndex>=0 && receipt.stepIndex<order.steps.length,'step bounds');
  need(Number.isInteger(receipt.repairAttempt) &&
    receipt.repairAttempt>=0 && receipt.repairAttempt<=order.maxRepairs,
    'repair bounds');
  const expected=order.steps[receipt.stepIndex];
  need(receipt.stepId===expected.id &&
    JSON.stringify(receipt.allowedPaths)===JSON.stringify(expected.allowedPaths) &&
    JSON.stringify(receipt.acceptance)===JSON.stringify(expected.acceptance),
    'step manifest integrity');
  need(receipt.action==='PROPOSE_PATCH_ONLY_NO_AI','no elevated action');
  return true;
}
if(require.main===module){
  need(process.argv[2]==='verify' && process.argv[3],'usage: verify PATH');
  const receipt=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
  verifyWorkOrder(require('./pilot-order.json'),receipt,{
    sourceRunId:Number(process.env.SOURCE_RUN_ID),
    sourceSha:process.env.SOURCE_HEAD_SHA,
    controllerSha:process.env.CONTROLLER_SHA});
  process.stdout.write('Verified bounded, credential-free next work order.\n');
}
module.exports={createWorkOrder,verifyWorkOrder};
