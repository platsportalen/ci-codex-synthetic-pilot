'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifySyntheticDelivery,acceptSyntheticDelivery}=require('./delivery.cjs');
const order=require('./pilot-order.json');
const H='a'.repeat(40),ID=order.source.repoId,RUN=83012;
function rig(){
  const identity={id:ID,full_name:order.repository};
  const state={taskId:order.taskId,repository:order.repository,
    phase:'REVIEW',stepIndex:1,headSha:H,repairs:0,
    seenEventIds:['ci_'+RUN],seenCiRunIds:[RUN]};
  const run={id:RUN,event:'pull_request',workflow_id:order.source.workflowId,
    name:order.source.workflowName,path:order.source.workflowPath,
    status:'completed',conclusion:'success',run_attempt:1,head_sha:H,
    repository:identity,head_repository:identity};
  const jobs=['validate','Generate SYNTHETIC patch (NOT Codex)','Verify patch on separate runner']
    .map(name=>({name,run_id:RUN,status:'completed',conclusion:'success'}));
  const pr={number:1,state:'open',head:{sha:H,ref:'pilot/synthetic-v1',repo:identity}};
  return {order,state,run,jobs,pr};
}
test('accepts exact completed synthetic CI and required jobs only',()=>{
  const x=rig();const proof=verifySyntheticDelivery(x);
  assert.equal(proof.productionRelease,false);assert.equal(proof.customerAcceptance,false);
  const done=acceptSyntheticDelivery(order,x.state,proof);
  assert.equal(done.phase,'DONE');assert.equal(done.seenEventIds.at(-1),'accept_'+RUN);
});
test('does not treat green status alone as acceptance',()=>{
  for(const name of ['validate','Generate SYNTHETIC patch (NOT Codex)','Verify patch on separate runner']){
    const x=rig();x.jobs=x.jobs.filter(j=>j.name!==name);
    assert.throws(()=>verifySyntheticDelivery(x),/missing mandatory job/);
  }
});
test('reject red/incomplete/stale CI and incorrect work item',()=>{
  for(const mutate of [
    x=>{x.run.conclusion='failure';},
    x=>{x.run.status='in_progress';},
    x=>{x.run.head_sha='b'.repeat(40);},
    x=>{x.state.phase='CODING';},
    x=>{x.state.stepIndex=0;},
    x=>{x.state.seenCiRunIds=[13];},
    x=>{x.pr.head.sha='b'.repeat(40);},
    x=>{x.pr.head.repo.id=123;},
    x=>{x.jobs[0].run_id=7;},
    x=>{x.jobs[1].conclusion='skipped';}
  ]){const x=rig();mutate(x);assert.throws(()=>verifySyntheticDelivery(x));}
});
test('cannot forge acceptance as customer or production release',()=>{
  const x=rig();const proof=verifySyntheticDelivery(x);
  for(const alteration of [
    {productionRelease:true},{customerAcceptance:true},{sourceSha:'b'.repeat(40)},
    {sourceRunId:2},{verification:'CI_GREEN_ONLY'}
  ]) assert.throws(()=>acceptSyntheticDelivery(order,x.state,{...proof,...alteration}));
});
test('terminal event is not accepted twice',()=>{
  const x=rig();const proof=verifySyntheticDelivery(x);
  const done=acceptSyntheticDelivery(order,x.state,proof);
  assert.throws(()=>acceptSyntheticDelivery(order,done,proof),/terminal task/);
});
