'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {finalizeSynthetic}=require('./delivery-runner.cjs');
const order=require('./pilot-order.json');
const H='a'.repeat(40),MAIN='b'.repeat(40),BLOB='c'.repeat(40),RUN=88421;
function rig(){
  const id={id:order.source.repoId,full_name:order.repository};
  const state={taskId:order.taskId,repository:order.repository,phase:'REVIEW',stepIndex:1,
    headSha:H,repairs:0,seenEventIds:['ci_'+RUN],seenCiRunIds:[RUN]};
  const pr={number:1,state:'open',head:{ref:'pilot/synthetic-v1',sha:H,repo:id}};
  const run={id:RUN,event:'pull_request',workflow_id:order.source.workflowId,
    name:order.source.workflowName,path:order.source.workflowPath,
    status:'completed',conclusion:'success',run_attempt:1,head_sha:H,
    repository:id,head_repository:id};
  const jobs=['validate','Generate SYNTHETIC patch (NOT Codex)','Verify patch on separate runner']
    .map(name=>({name,run_id:RUN,status:'completed',conclusion:'success'}));
  const context={repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},ref:'refs/heads/main',sha:MAIN,
    payload:{repository:id,workflow_run:{id:RUN,event:'pull_request',status:'completed',conclusion:'success',head_sha:H}}};
  const writes=[];
  const github={
    paginate:async()=>jobs,
    rest:{
      git:{getRef:async()=>({data:{object:{sha:MAIN}}})},
      pulls:{get:async()=>({data:pr})},
      actions:{getWorkflowRun:async()=>({data:run}),
        listJobsForWorkflowRun:async()=>({data:{jobs}})},
      repos:{getContent:async()=>{const t=JSON.stringify(state);return {data:{
        type:'file',encoding:'base64',sha:BLOB,size:t.length,
        content:Buffer.from(t).toString('base64')}};},
        createOrUpdateFileContents:async p=>{writes.push(p);return {data:{commit:{sha:'d'.repeat(40)}}};}}
    }
  };
  return {github,context,writes,run,jobs,pr,state};
}
test('records DONE only after authentic source CI and mandatory jobs',async()=>{
  const x=rig();const old=process.env.GITHUB_RUN_ATTEMPT;process.env.GITHUB_RUN_ATTEMPT='1';
  try{
    const proof=await finalizeSynthetic({...x,core:{info(){}}});
    assert.equal(proof.sourceRunId,RUN);
    assert.equal(x.writes.length,1);assert.equal(x.writes[0].branch,'autodev-state');
    assert.equal(x.writes[0].sha,BLOB);
    const saved=JSON.parse(Buffer.from(x.writes[0].content,'base64').toString('utf8'));
    assert.equal(saved.phase,'DONE');assert.equal(saved.delivery.productionRelease,false);
    assert.equal(saved.delivery.customerAcceptance,false);
  }finally{if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=old;}
});
test('refuses finalization after red CI, without reviewer or wrong SHA',async()=>{
  for(const mutate of [
    x=>{x.context.payload.workflow_run.conclusion='failure';},
    x=>{x.run.conclusion='failure';x.context.payload.workflow_run.conclusion='failure';},
    x=>{x.state.phase='REPAIRING';},
    x=>{x.pr.head.sha='d'.repeat(40);},
    x=>{x.context.sha='f'.repeat(40);},
    x=>{x.jobs[2].conclusion='failure';}
  ]){
    const x=rig();mutate(x);await assert.rejects(()=>finalizeSynthetic({...x,core:{info(){}}}));
    assert.equal(x.writes.length,0);
  }
});
test('failed CAS state write cannot claim delivered',async()=>{
  const x=rig();
  x.github.rest.repos.createOrUpdateFileContents=async()=>{throw Error('409 conflict');};
  await assert.rejects(()=>finalizeSynthetic({...x,core:{info(){}}}),/409 conflict/);
});
