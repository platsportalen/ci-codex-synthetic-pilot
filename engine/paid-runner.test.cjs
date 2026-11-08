'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reserveStep,verifyReservedStep,pathFor}=require('./paid-runner.cjs');
const {createWorkOrder}=require('./continuation.cjs');
const order=require('./pilot-order.json');
const HEAD='a'.repeat(40),MAIN='b'.repeat(40),BLOB='c'.repeat(40);
const RUN=71122,WORKFLOW=81133,ID=order.source.repoId;
const prev=process.env.GITHUB_RUN_ATTEMPT;
process.env.GITHUB_RUN_ATTEMPT='1';
process.on('exit',()=>{if(prev===undefined)delete process.env.GITHUB_RUN_ATTEMPT;
else process.env.GITHUB_RUN_ATTEMPT=prev;});
function rig(){
  const identity={id:ID,full_name:order.repository};
  const state={taskId:order.taskId,repository:order.repository,phase:'CODING',
    headSha:HEAD,stepIndex:1,repairs:0,seenCiRunIds:[RUN]};
  const receipt=createWorkOrder(order,state,{
    sourceRunId:RUN,controllerSha:MAIN,stateSha:BLOB});
  const pr={number:1,state:'open',
    head:{sha:HEAD,ref:'pilot/synthetic-v1',repo:identity},
    base:{ref:'main',repo:identity}};
  const sourceRun={id:RUN,workflow_id:order.source.workflowId,
    name:order.source.workflowName,path:order.source.workflowPath,
    event:'pull_request',status:'completed',conclusion:'success',
    run_attempt:1,head_branch:order.source.headBranch,
    head_sha:HEAD,repository:identity,head_repository:identity,
    pull_requests:[{number:1,head:{repo:identity}}]};
  const context={repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},
    ref:'refs/heads/main',sha:MAIN,payload:{
      repository:identity,
      workflow_run:{id:RUN,head_sha:HEAD,status:'completed',conclusion:'success'}
    }};
  const writes=[];let stored=null;
  const gh={rest:{
    git:{getRef:async()=>({data:{object:{sha:MAIN}}})},
    pulls:{get:async()=>({data:pr})},
    actions:{getWorkflowRun:async()=>({data:sourceRun})},
    repos:{
      getContent:async ({path})=>{
        if(path==='state/pilot_task_1.json'){
          const text=JSON.stringify(state);
          return {data:{type:'file',encoding:'base64',sha:BLOB,size:text.length,
            content:Buffer.from(text).toString('base64')}};
        }
        if(path===pathFor(receipt) && stored!==null){
          const text=JSON.stringify(stored);
          return {data:{type:'file',encoding:'base64',sha:'d'.repeat(40),
            size:text.length,content:Buffer.from(text).toString('base64')}};
        }
        throw Error('404');
      },
      createOrUpdateFileContents:async payload=>{
        if(stored!==null)throw Error('409 existing paid reservation');
        if(payload.sha)throw Error('must never overwrite');
        const parsed=JSON.parse(Buffer.from(payload.content,'base64').toString());
        stored=parsed;writes.push(payload);
        return {data:{content:{sha:'e'.repeat(40)}}};
      }
    }
  }};
  return {receipt,context,gh,writes,state,pr,sourceRun,get reservation(){return stored;},
    changeReservation(r){stored=r;}};
}
test('one strict synthetic step, exact commit/SHA and stage ownership',()=>{
  const a=rig();
  assert.equal(pathFor(a.receipt),'state/paid/pilot_task_1/source-'+RUN+'.json');
  assert.equal(a.receipt.stepId,'final_verification');
  for(const mutate of [
    {stepId:'zero_support'}, {stepIndex:0},{phase:'REPAIRING'},
    {sourceRunId:1}, {action:'AUTO_MERGE'}, {sourceSha:'f'.repeat(40)},
    {allowedPaths:['.github/workflows/malicious.yml']}
  ]) assert.rejects(async()=>reserveStep({github:a.gh,context:a.context,
    receipt:{...a.receipt,...mutate},runId:WORKFLOW}));
});
test('reserve atomically creates a single append-only reservation',async()=>{
  const a=rig();
  const reservation=await reserveStep({github:a.gh,context:a.context,
    receipt:a.receipt,runId:WORKFLOW});
  assert.equal(a.writes.length,1);
  assert.equal(a.writes[0].branch,'autodev-state');
  assert.equal(a.writes[0].path,pathFor(a.receipt));
  assert.equal(reservation.action,'ONE_BOUNDED_CODEX_PASS_NO_RETRY');
  await assert.rejects(()=>reserveStep({github:a.gh,context:a.context,
    receipt:a.receipt,runId:WORKFLOW}),/409 existing/);
});
test('after Environment approval, identical immutable reservation validates',async()=>{
  const a=rig();
  await reserveStep({github:a.gh,context:a.context,receipt:a.receipt,runId:WORKFLOW});
  const x=await verifyReservedStep({github:a.gh,context:a.context,
    receipt:a.receipt,runId:WORKFLOW});
  assert.equal(x.workflowRunId,WORKFLOW);
});
test('stale controller, source PR and state fail before reservation',async()=>{
  for(const which of ['main','pr','state']){
    const a=rig();
    if(which==='main') a.context.sha='d'.repeat(40);
    if(which==='pr') a.pr.head.sha='d'.repeat(40);
    if(which==='state') a.state.headSha='d'.repeat(40);
    await assert.rejects(()=>reserveStep({github:a.gh,context:a.context,
      receipt:a.receipt,runId:WORKFLOW}));
    assert.equal(a.writes.length,0);
  }
});
test('tampered paid reservation blocks key-consuming job',async()=>{
  const a=rig();
  await reserveStep({github:a.gh,context:a.context,receipt:a.receipt,runId:WORKFLOW});
  a.changeReservation({...a.reservation,workflowRunId:55});
  await assert.rejects(()=>verifyReservedStep({github:a.gh,context:a.context,
    receipt:a.receipt,runId:WORKFLOW}),/reservation identity/);
});
test('wrong GitHub workflow run cannot consume another reservation',async()=>{
  const a=rig();
  await reserveStep({github:a.gh,context:a.context,receipt:a.receipt,runId:WORKFLOW});
  await assert.rejects(()=>verifyReservedStep({github:a.gh,context:a.context,
    receipt:a.receipt,runId:99999}),/reservation identity/);
});
