'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {applyDataOnlyPatch,publishVerifiedPatch}=require('./integrate-patch.cjs');
const {createWorkOrder}=require('./continuation.cjs');
const order=require('./pilot-order.json');
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40),D='d'.repeat(40);
const ID=order.source.repoId,R=order.repository,CI=71122,WORK=81133;
const SOURCE=Buffer.from('x=1\n');
const PATCH=Buffer.from('--- a/sample.py\n+++ b/sample.py\n@@ -1 +1 @@\n-x=1\n+x=2\n');
function make(){
  const identity={id:ID,full_name:R};
  const state={taskId:order.taskId,repository:R,phase:'CODING',
    headSha:A,stepIndex:1,repairs:0,seenCiRunIds:[CI],seenEventIds:['bootstrap_start']};
  const receipt=createWorkOrder(order,state,{
    sourceRunId:CI,controllerSha:B,stateSha:C});
  const reservation={version:1,taskId:receipt.taskId,repository:receipt.repository,
    sourceRunId:CI,sourceSha:A,controllerSha:B,stateSha:C,
    stepId:receipt.stepId,workflowRunId:WORK,
    action:'ONE_BOUNDED_CODEX_PASS_NO_RETRY'};
  const pr={number:1,state:'open',base:{ref:'main',repo:identity},
    head:{ref:'pilot/synthetic-v1',repo:identity,sha:A}};
  const sourceRun={id:CI,workflow_id:order.source.workflowId,
    name:order.source.workflowName,path:order.source.workflowPath,
    event:'pull_request',status:'completed',conclusion:'success',run_attempt:1,
    head_branch:'pilot/synthetic-v1',head_sha:A,repository:identity,
    head_repository:identity,pull_requests:[{number:1,head:{repo:identity}}]};
  const ctx={repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},
    ref:'refs/heads/main',sha:B,
    payload:{repository:identity,workflow_run:{id:CI,head_sha:A,
      status:'completed',conclusion:'success'}}};
  const ops=[];
  const gh={rest:{
    git:{
      getRef:async()=>({data:{object:{sha:B}}}),
      getCommit:async()=>({data:{tree:{sha:'f'.repeat(40)}}}),
      createBlob:async q=>{ops.push(['blob',q]);return {data:{sha:'1'.repeat(40)}};},
      createTree:async q=>{ops.push(['tree',q]);return {data:{sha:'2'.repeat(40)}};},
      createCommit:async q=>{ops.push(['commit',q]);return {data:{sha:D}};},
      updateRef:async q=>{ops.push(['ref',q]);return {data:{object:{sha:D}}};}
    },
    pulls:{get:async()=>({data:pr})},
    actions:{
      getWorkflowRun:async()=>({data:sourceRun}),
      createWorkflowDispatch:async q=>{ops.push(['dispatch',q]);return {status:204};}
    },
    repos:{
      getContent:async q=>{
        let buf,sha='3'.repeat(40);
        if(q.path==='state/paid/pilot_task_1/source-'+CI+'.json')buf=Buffer.from(JSON.stringify(reservation));
        else if(q.path==='state/pilot_task_1.json'){buf=Buffer.from(JSON.stringify(state));sha=C;}
        else if(q.path==='lab/sample.py'){buf=SOURCE;}
        else throw Error('unexpected path: '+q.path);
        return {data:{type:'file',encoding:'base64',sha,size:buf.length,
          content:buf.toString('base64')}};
      },
      createOrUpdateFileContents:async q=>{ops.push(['state',q]);return {data:{commit:{sha:'4'.repeat(40)}}};}
    }
  }};
  return {gh,ctx,receipt,state,pr,ops};
}
const old=process.env.GITHUB_RUN_ATTEMPT;
process.env.GITHUB_RUN_ATTEMPT='1';
process.on('exit',()=>{if(old===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=old;});
test('applies a single verified data-only diff without executing source',()=>{
  assert.equal(applyDataOnlyPatch(SOURCE,PATCH).toString(),'x=2\n');
});
test('denies path traversal, another file, binary and malformed diff',()=>{
  const bad=[
    Buffer.from('--- a/secrets.txt\n+++ b/secrets.txt\n@@ -1 +1 @@\n-x=1\n+x=2\n'),
    Buffer.from('--- a/sample.py\n+++ b/sample.py\n@@ -1 +1 @@\n-x=1\n+x=2\nGIT binary patch'),
    Buffer.from('wrong patch'),
    Buffer.alloc(8200,65),
    Buffer.from('--- a/sample.py\n+++ b/sample.py\n@@ -1 +1 @@\n-x=1\n+x=2\n\x00')
  ];
  for(const b of bad)assert.throws(()=>applyDataOnlyPatch(SOURCE,b));
});
test('publishes verified source using Git tree, fast-forward only and explicit dispatch',async()=>{
  const a=make();
  const res=await publishVerifiedPatch({github:a.gh,context:a.ctx,
    receipt:a.receipt,patchBytes:PATCH,runId:WORK,core:{info(){}}});
  assert.equal(res.commitSha,D);assert.equal(res.phase,'TESTING');
  const opnames=a.ops.map(x=>x[0]);
  assert.deepEqual(opnames,['blob','tree','commit','ref','state','dispatch']);
  assert.deepEqual(a.ops[2][1].parents,[A]);
  assert.equal(a.ops[1][1].tree[0].path,'lab/sample.py');
  assert.equal(a.ops[3][1].force,false);
  const saved=JSON.parse(Buffer.from(a.ops[4][1].content,'base64').toString());
  assert.equal(saved.headSha,D);assert.equal(saved.phase,'TESTING');
  assert.equal(a.ops[5][1].workflow_id,'autodev-continuation-ci.yml');
  assert.equal(a.ops[5][1].inputs.expected_sha,D);
});
test('stale source SHA refuses all code writes',async()=>{
  const a=make();a.pr.head.sha='9'.repeat(40);
  await assert.rejects(()=>publishVerifiedPatch({github:a.gh,context:a.ctx,
    receipt:a.receipt,patchBytes:PATCH,runId:WORK,core:{info(){}}}));
  assert.deepEqual(a.ops,[]);
});
test('fast-forward conflict prevents state and next CI dispatch',async()=>{
  const a=make();
  a.gh.rest.git.updateRef=async()=>{throw Error('git not a fast forward');};
  await assert.rejects(()=>publishVerifiedPatch({github:a.gh,context:a.ctx,
    receipt:a.receipt,patchBytes:PATCH,runId:WORK,core:{info(){}}}),
    /not a fast forward/);
  assert.equal(a.ops.filter(x=>x[0]==='state'||x[0]==='dispatch').length,0);
});
