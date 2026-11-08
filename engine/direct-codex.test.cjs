'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createWorkOrder}=require('./continuation.cjs');
const {reserveDirect,verifyDirectReservation,reservationPath}=require('./direct-codex.cjs');
const {CONTINUATION}=require('./ci-source.cjs');
const order=require('./pilot-order.json');
const HEAD='a'.repeat(40),MAIN='b'.repeat(40),STATE='c'.repeat(40);
const RUN=91011,ID=order.source.repoId;
const old=process.env.GITHUB_RUN_ATTEMPT;
process.env.GITHUB_RUN_ATTEMPT='1';
process.on('exit',()=>{if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=old;});
function rig(phase='REPAIRING'){
  const repo={id:ID,full_name:order.repository};
  const state={taskId:order.taskId,repository:order.repository,phase,
    stepIndex:1,headSha:HEAD,repairs:phase==='REPAIRING'?1:0,
    seenEventIds:['start'],seenCiRunIds:[RUN]};
  const receipt=createWorkOrder(order,state,{
    sourceRunId:RUN,controllerSha:MAIN,stateSha:STATE});
  const context={repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},
    ref:'refs/heads/main',eventName:'workflow_dispatch',sha:MAIN,runId:RUN};
  const jobs=[
    {name:CONTINUATION.validateJob,conclusion:'success'},
    {name:CONTINUATION.testsJob,conclusion:phase==='REPAIRING'?'failure':'success'},
    {name:'Persist verified CI result even when source tests fail',conclusion:'success'},
    {name:'Continue repair or next step without a timer (NO AI)',conclusion:'success'},
    {name:'Independently validate new work order (NO API SECRET)',conclusion:'success'}
  ];
  let reservation=null;const writes=[];
  const self={id:RUN,workflow_id:CONTINUATION.workflowId,
    path:CONTINUATION.path,event:'workflow_dispatch',run_attempt:1,
    head_branch:'main',head_sha:MAIN,name:'autodev-continuation-'+HEAD,
    repository:repo};
  const pr={state:'open',base:{ref:order.source.baseBranch},
    head:{ref:order.source.headBranch,sha:HEAD,repo}};
  const gh={
    paginate:async()=>jobs,
    rest:{
      git:{getRef:async()=>({data:{object:{sha:MAIN}}})},
      actions:{
        getWorkflowRun:async()=>({data:self}),
        listJobsForWorkflowRun:async()=>({data:{jobs}})
      },
      pulls:{get:async()=>({data:pr})},
      repos:{
        getContent:async({path})=>{
          const src=path==='state/pilot_task_1.json'
            ?JSON.stringify(state):path===reservationPath(receipt)
              ?(reservation?JSON.stringify(reservation):null):null;
          if(!src)throw Error('404');
          return {data:{type:'file',encoding:'base64',sha:path==='state/pilot_task_1.json'?STATE:'d'.repeat(40),
            size:src.length,content:Buffer.from(src).toString('base64')}};
        },
        createOrUpdateFileContents:async x=>{
          if(reservation)throw Error('409 existing reservation');
          reservation=JSON.parse(Buffer.from(x.content,'base64').toString('utf8'));
          writes.push(x);return {data:{commit:{sha:'e'.repeat(40)}}};
        }
      }
    }
  };
  return {gh,context,receipt,jobs,writes,state,self,pr,get reserved(){return reservation;},
    changeReservation(v){reservation=v;}};
}
test('repair has a unique append-only reservation and protected verification',async()=>{
  const x=rig();
  const receipt=await reserveDirect({github:x.gh,context:x.context,receipt:x.receipt});
  assert.equal(receipt.phase,'REPAIRING');assert.equal(x.writes.length,1);
  assert.equal(x.writes[0].branch,'autodev-state');
  assert.equal(x.writes[0].sha,undefined);
  assert.equal((await verifyDirectReservation({github:x.gh,context:x.context,
    receipt:x.receipt})).sourceRunId,RUN);
  await assert.rejects(()=>reserveDirect({github:x.gh,context:x.context,receipt:x.receipt}),
    /409 existing reservation/);
});
test('green CI next step also supports bounded direct reservation',async()=>{
  const x=rig('CODING');
  const z=await reserveDirect({github:x.gh,context:x.context,receipt:x.receipt});
  assert.equal(z.phase,'CODING');assert.equal(z.repairAttempt,0);
});
test('untrusted job result and incorrect source SHA prevent any reservation',async()=>{
  for(const mutate of [
    x=>x.jobs[0].conclusion='failure',
    x=>x.jobs[1].conclusion='success',
    x=>x.jobs[3].conclusion='skipped',
    x=>x.pr.head.sha='0'.repeat(40),
    x=>x.self.name='another-workflow'
  ]){
    const x=rig();mutate(x);
    await assert.rejects(()=>reserveDirect({github:x.gh,context:x.context,receipt:x.receipt}));
    assert.equal(x.writes.length,0);
  }
});
test('stale task state and forged paid-work artifact are rejected',async()=>{
  const x=rig();
  x.state.headSha='0'.repeat(40);
  await assert.rejects(()=>reserveDirect({github:x.gh,context:x.context,receipt:x.receipt}),
    /stale or wrong task state/);
  x.state.headSha=HEAD;
  await reserveDirect({github:x.gh,context:x.context,receipt:x.receipt});
  x.changeReservation({...x.reserved,workflowRunId:RUN+1});
  await assert.rejects(()=>verifyDirectReservation({github:x.gh,context:x.context,receipt:x.receipt}),
    /reservation mismatched/);
});
test('wrong workflow, reruns, or wrong trusted main cannot start paid work',async()=>{
  for(const mutate of [
    x=>x.self.workflow_id=1,
    x=>x.self.run_attempt=2,
    x=>x.context.sha='f'.repeat(40),
    x=>x.context.eventName='pull_request',
    x=>x.context.runId=999
  ]){
    const x=rig();mutate(x);
    await assert.rejects(()=>reserveDirect({github:x.gh,context:x.context,receipt:x.receipt}));
    assert.equal(x.writes.length,0);
  }
});
