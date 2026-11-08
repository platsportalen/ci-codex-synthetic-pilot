'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {advance,initialState}=require('./controller.cjs');
const {verifyCompletedCI,applyVerifiedCI}=require('./ci-source.cjs');
const {processCI,STATE_BRANCH,STATE_PATH}=require('./ci-receiver.cjs');
const order=require('./pilot-order.json');
const ID=order.source.repoId, R=order.repository;
const HEAD='f9059eb49f05e66bc352fcb813c76a1b33db6391';
const MAIN='e'.repeat(40);
function evidence(conclusion='success',runId=65001){
  const identity={id:ID,full_name:R};
  const pr={number:1,state:'open',
    base:{ref:'main',repo:identity},
    head:{ref:'pilot/synthetic-v1',sha:HEAD,repo:identity}};
  const run={id:runId,workflow_id:order.source.workflowId,
    name:order.source.workflowName,path:order.source.workflowPath,
    event:'pull_request',status:'completed',conclusion,run_attempt:1,
    head_branch:'pilot/synthetic-v1',head_sha:HEAD,
    repository:identity,head_repository:identity,
    pull_requests:[{number:1,head:{repo:identity}}]};
  const payloadRun={id:runId,status:'completed',conclusion,head_sha:HEAD};
  return {repository:identity,pr,run,payloadRun,attempt:1,order};
}
function testingState(){
  let state=advance(order,initialState(order),{
    type:'START',taskId:order.taskId,repository:R,eventId:'bootstrap_start',sha:order.baseSha
  });
  state=advance(order,state,{
    type:'PATCH_READY',taskId:order.taskId,repository:R,eventId:'bootstrap_patch',
    sha:order.baseSha,newSha:HEAD
  });
  return state;
}
function fakeGitHub(e,initial,opts={}){
  let writes=[],reads=[];
  const blob=JSON.stringify(initial,null,2)+'\n';
  const github={rest:{
    git:{getRef:async args=>({data:{object:{sha:opts.mainSha||MAIN}}})},
    pulls:{get:async args=>({data:e.pr})},
    actions:{getWorkflowRun:async args=>({data:e.run})},
    repos:{
      getContent:async args=>{reads.push(args);return {data:{
        type:'file',sha:'b'.repeat(40),encoding:'base64',
        size:Buffer.byteLength(blob),content:Buffer.from(blob).toString('base64')}};},
      createOrUpdateFileContents:async args=>{writes.push(args);return {data:{commit:{sha:'c'.repeat(40)}}};}
    }
  }};
  return {github,writes,reads};
}
const contextFor=e=>({repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},
  sha:MAIN,ref:'refs/heads/main',
  payload:{repository:e.repository,workflow_run:e.payloadRun}});

test('accepts exact success and failure after verifying real PR/run evidence',()=>{
  for(const conclusion of ['success','failure']){
    const v=verifyCompletedCI(evidence(conclusion));
    assert.equal(v.conclusion,conclusion);assert.equal(v.sha,HEAD);
  }
});
test('green CI advances to next work step, red CI requests repair',()=>{
  for(const [conclusion,phase] of [['success','CODING'],['failure','REPAIRING']]){
    const v=verifyCompletedCI(evidence(conclusion));
    const next=applyVerifiedCI(order,testingState(),v);
    assert.equal(next.phase,phase);assert.equal(next.seenCiRunIds.length,1);
  }
});
test('rejects unrelated PR, fork, old SHA and spoofed workflow',()=>{
  const variations=[
    e=>{e.pr.number=2;},
    e=>{e.pr.head.repo.id=123;},
    e=>{e.run.head_sha='f'.repeat(40);},
    e=>{e.run.workflow_id=1;},
    e=>{e.run.name='Fake workflow';},
    e=>{e.run.pull_requests=[];},
    e=>{e.payloadRun.conclusion='failure';},
    e=>{e.run.run_attempt=2;},
    e=>{e.attempt=2;},
    e=>{e.pr.base.ref='other';}
  ];
  for(const mutate of variations){const e=evidence();mutate(e);assert.throws(()=>verifyCompletedCI(e));}
});
test('rejects cancelled/in-progress/not-completed and unknown CI conclusions',()=>{
  for(const bad of ['cancelled','timed_out','neutral','skipped',null]){
    const e=evidence();e.run.conclusion=bad;e.payloadRun.conclusion=bad;
    assert.throws(()=>verifyCompletedCI(e),/completed CI/);
  }
  const e=evidence();e.run.status='in_progress';
  assert.throws(()=>verifyCompletedCI(e),/completed CI/);
});
test('replay same CI run ID is idempotent, new event cannot double-consume run',()=>{
  const v=verifyCompletedCI(evidence());
  const first=applyVerifiedCI(order,testingState(),v);
  assert.equal(applyVerifiedCI(order,first,v),first);
  assert.equal(first.seenCiRunIds[0],v.runId);
});
test('trusted receiver persists success by conditional blob SHA to isolated branch',async()=>{
  const e=evidence(), {github,writes,reads}=fakeGitHub(e,testingState());
  const outputs={};const core={setOutput:(n,v)=>outputs[n]=v,info:()=>{}};
  const prior=process.env.GITHUB_RUN_ATTEMPT; process.env.GITHUB_RUN_ATTEMPT='1';
  try {
    const d=await processCI({github,context:contextFor(e),core});
    assert.equal(d.before,'TESTING');assert.equal(d.after,'CODING');
    assert.equal(writes.length,1);assert.equal(writes[0].branch,STATE_BRANCH);
    assert.equal(writes[0].path,STATE_PATH);assert.equal(writes[0].sha,'b'.repeat(40));
    const saved=JSON.parse(Buffer.from(writes[0].content,'base64').toString('utf8'));
    assert.equal(saved.seenCiRunIds[0],e.run.id);
    assert.equal(reads[0].ref,STATE_BRANCH);assert.equal(outputs.phase,'CODING');
  } finally {if(prior===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=prior;}
});
test('trusted receiver rejects stale main and never writes state',async()=>{
  const e=evidence(),{github,writes}=fakeGitHub(e,testingState(),{mainSha:'f'.repeat(40)});
  const core={setOutput(){},info(){}};
  await assert.rejects(()=>processCI({github,context:contextFor(e),core}),/controller default branch moved/);
  assert.equal(writes.length,0);
});
test('trusted receiver rejects invalid CI before any persistent mutation',async()=>{
  const e=evidence();e.run.head_sha='d'.repeat(40);
  const {github,writes}=fakeGitHub(e,testingState());
  const prior=process.env.GITHUB_RUN_ATTEMPT; process.env.GITHUB_RUN_ATTEMPT='1';
  try{
    await assert.rejects(()=>processCI({github,context:contextFor(e),core:{setOutput(){},info(){}}}),/current source SHA/);
  }finally{if(prior===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=prior;}
  assert.equal(writes.length,0);
});

test('red CI is durably recorded as REPAIRING without an AI call',async()=>{
  const e=evidence('failure',66001),{github,writes}=fakeGitHub(e,testingState());
  const old=process.env.GITHUB_RUN_ATTEMPT;process.env.GITHUB_RUN_ATTEMPT='1';
  try {
    const d=await processCI({github,context:contextFor(e),core:{setOutput(){},info(){}}});
    assert.equal(d.after,'REPAIRING');assert.equal(d.repairs,1);
    const saved=JSON.parse(Buffer.from(writes[0].content,'base64').toString('utf8'));
    assert.equal(saved.phase,'REPAIRING');assert.equal(saved.seenCiRunIds[0],66001);
  }finally{if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=old;}
});
test('receiver does not issue a second state write for same completed CI',async()=>{
  const e=evidence('success',67001);
  const already=applyVerifiedCI(order,testingState(),verifyCompletedCI(e));
  const {github,writes}=fakeGitHub(e,already);
  const old=process.env.GITHUB_RUN_ATTEMPT;process.env.GITHUB_RUN_ATTEMPT='1';
  try{
    const d=await processCI({github,context:contextFor(e),core:{setOutput(){},info(){}}});
    assert.equal(d.duplicate,true);assert.equal(writes.length,0);
  }finally{if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=old;}
});
test('state CAS write conflicts fail closed without pretending success',async()=>{
  const e=evidence(),{github}=fakeGitHub(e,testingState());
  github.rest.repos.createOrUpdateFileContents=async()=>{throw Error('409 conflict');};
  const old=process.env.GITHUB_RUN_ATTEMPT;process.env.GITHUB_RUN_ATTEMPT='1';
  try {
    await assert.rejects(()=>processCI({github,context:contextFor(e),core:{setOutput(){},info(){}}}),/409 conflict/);
  }finally{if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=old;}
});
