'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {verifyRecovery,createRecoveryReceipt,reserveRecovery,
  verifyRecoveryReservation,reservationPath}=require('./recover-stalled.cjs');
const order=require('./pilot-order.json');
const SOURCE='5968c5ce6e686b92f1d1f96c97a057a5a62c0abf';
const MAIN='2'.repeat(40), RUN=42479733175, CONTROL=777777;
const REPO=order.repository, ID=order.source.repoId;
const names=[
  'Validate exact continuation target',
  'Run trusted acceptance cases without credentials',
  'Persist verified CI result even when source tests fail',
  'Continue repair or next step without a timer (NO AI)',
  'Independently validate new work order (NO API SECRET)'
];
function fixture(){
  const identity={id:ID,full_name:REPO};
  const state={taskId:order.taskId,repository:REPO,phase:'REPAIRING',
    headSha:SOURCE,stepIndex:1,repairs:2,blocker:null,seenCiRunIds:[RUN]};
  const context={repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},
    ref:'refs/heads/main',sha:MAIN,eventName:'workflow_dispatch',runId:CONTROL};
  const self={id:CONTROL,event:'workflow_dispatch',
    path:'.github/workflows/autodev-repair-resume.yml',
    name:'Autodev resume one stalled synthetic repair',
    head_sha:MAIN,head_branch:'main',run_attempt:1,repository:identity};
  const source={id:RUN,workflow_id:411104907,
    path:'.github/workflows/autodev-continuation-ci.yml',
    event:'workflow_dispatch',status:'completed',conclusion:'failure',run_attempt:1,
    head_branch:'main',display_title:'autodev-continuation-'+SOURCE,
    repository:identity};
  const pr={state:'open',base:{ref:'main'},head:{
    ref:'pilot/synthetic-v1',sha:SOURCE,repo:identity}};
  const jobs=names.map((name,i)=>({name,conclusion:i===1?'failure':'success'}));
  const file=JSON.stringify(state,null,2);
  const stateBlob={type:'file',encoding:'base64',sha:'e'.repeat(40),
    size:Buffer.byteLength(file),content:Buffer.from(file).toString('base64')};
  const written=[];
  const github={rest:{
    git:{getRef:async()=>({data:{object:{sha:MAIN}}})},
    actions:{getWorkflowRun:async x=>({data:x.run_id===CONTROL?self:source}),
      listJobsForWorkflowRun:()=>{}},
    pulls:{get:async()=>({data:pr})},
    repos:{getContent:async x=>({data:
      x.path==='state/pilot_task_1.json'?stateBlob:
      {type:'file',encoding:'base64',size:1024,
        content:Buffer.from(JSON.stringify(written[0]?.parsed||{})).toString('base64')}}),
      createOrUpdateFileContents:async x=>{written.push({
        ...x,parsed:JSON.parse(Buffer.from(x.content,'base64').toString('utf8'))});
        return {data:{commit:{sha:'f'.repeat(40)}}};}}
  },paginate:async()=>jobs};
  return {github,context,state,source,self,pr,jobs,written,stateBlob};
}
async function execute(f,fn){
  const old=process.env.GITHUB_RUN_ATTEMPT;
  process.env.GITHUB_RUN_ATTEMPT='1';
  try{return await fn();}finally{
    if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;
    else process.env.GITHUB_RUN_ATTEMPT=old;
  }
}
test('recovers ONLY an existing verified bounded repair, without changing state',async()=>{
  const f=fixture();
  await execute(f,async()=>{
    const {receipt}=await verifyRecovery({github:f.github,context:f.context,
      taskId:order.taskId,sourceRunId:RUN,sourceSha:SOURCE});
    assert.equal(receipt.phase,'REPAIRING');
    assert.equal(receipt.stepId,'final_verification');
    assert.equal(receipt.sourceRunId,RUN);
    assert.equal(receipt.stateSha,'e'.repeat(40));
    assert.equal(receipt.action,'PROPOSE_PATCH');
    assert.equal(f.written.length,0);
  });
});
test('rejects mismatched source, stale PR, wrong CI job, lost state and main drift',async()=>{
  const cases=[
    f=>{f.context.sha='a'.repeat(40)},
    f=>{f.source.conclusion='success'},
    f=>{f.source.path='bad.yml'},
    f=>{f.pr.head.sha='a'.repeat(40)},
    f=>{f.jobs[1].conclusion='success'},
    f=>{f.stateBlob.content=Buffer.from(JSON.stringify({...f.state,phase:'TESTING'})).toString('base64')},
    f=>{f.stateBlob.content=Buffer.from(JSON.stringify({...f.state,seenCiRunIds:[1]})).toString('base64')},
    f=>{f.self.event='push'}
  ];
  for(const mutate of cases){const f=fixture();mutate(f);
    await execute(f,async()=>assert.rejects(()=>verifyRecovery({
      github:f.github,context:f.context,taskId:order.taskId,
      sourceRunId:RUN,sourceSha:SOURCE})));
    assert.equal(f.written.length,0);
  }
});
test('one-time reservation binds task, PR SHA, source CI and controller',async()=>{
  const f=fixture();
  await execute(f,async()=>{
    const receipt=await createRecoveryReceipt({github:f.github,context:f.context,
      taskId:order.taskId,sourceRunId:RUN,sourceSha:SOURCE});
    const reservation=await reserveRecovery({github:f.github,context:f.context,receipt});
    assert.equal(f.written.length,1);
    assert.equal(f.written[0].path,reservationPath(receipt));
    assert.equal(Object.hasOwn(f.written[0],'sha'),false);
    assert.equal(reservation.sourceRunId,RUN);
    assert.equal(reservation.workflowRunId,CONTROL);
    assert.equal(await verifyRecoveryReservation({
      github:f.github,context:f.context,receipt}),true);
  });
});
test('cannot re-use reservation if GitHub create-only CAS rejects duplicate',async()=>{
  const f=fixture();
  await execute(f,async()=>{
    const receipt=await createRecoveryReceipt({github:f.github,context:f.context,
      taskId:order.taskId,sourceRunId:RUN,sourceSha:SOURCE});
    f.github.rest.repos.createOrUpdateFileContents=async()=>{throw Error('422 already exists')};
    await assert.rejects(()=>reserveRecovery({github:f.github,context:f.context,receipt}),
      /already exists/);
  });
});
test('rejects workflow retry before receiving or reserving any key',async()=>{
  const f=fixture(),old=process.env.GITHUB_RUN_ATTEMPT;
  process.env.GITHUB_RUN_ATTEMPT='2';
  try{await assert.rejects(()=>verifyRecovery({github:f.github,context:f.context,
    taskId:order.taskId,sourceRunId:RUN,sourceSha:SOURCE}),/trusted workflow dispatch/);}
  finally{if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;
  else process.env.GITHUB_RUN_ATTEMPT=old;}
});
