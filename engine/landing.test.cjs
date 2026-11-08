'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyLanding,assertPatchContents}=require('./landing.cjs');
const {createWorkOrder}=require('./continuation.cjs');
const order=require('./pilot-order.json');
const SHA='a'.repeat(40),CONTROL='b'.repeat(40),STATE='c'.repeat(40),RUN=730003;
function fixture(){
  const repo={id:order.source.repoId,full_name:order.repository};
  const receipt=createWorkOrder(order,{taskId:order.taskId,repository:order.repository,
    phase:'CODING',headSha:SHA,stepIndex:1,repairs:0,seenCiRunIds:[RUN]},
    {sourceRunId:RUN,controllerSha:CONTROL,stateSha:STATE});
  const pr={number:1,state:'open',head:{ref:'pilot/synthetic-v1',sha:SHA,repo},base:{ref:'main',repo}};
  const run={id:RUN,workflow_id:order.source.workflowId,name:order.source.workflowName,
    path:order.source.workflowPath,event:'pull_request',status:'completed',conclusion:'success',
    run_attempt:1,head_branch:order.source.headBranch,head_sha:SHA,repository:repo,
    head_repository:repo,pull_requests:[{number:1,head:{repo}}]};
  return {receipt,pr,run,eventRun:{id:RUN,head_sha:SHA,status:'completed',conclusion:'success'},
    repository:repo,controllerSha:CONTROL,attempt:1,order};
}
test('exact completed CI and task permit synthetic landing',()=>{
  const v=verifyLanding(fixture());assert.equal(v.sha,SHA);assert.equal(v.branch,'pilot/synthetic-v1');
});
test('rejects changed SHA, PR, workflow, repo, scope and controller',()=>{
  const changes=[
    x=>{x.pr.head.sha='d'.repeat(40);},
    x=>{x.pr.head.ref='wrong';},
    x=>{x.run.workflow_id=123;},
    x=>{x.run.id=123;},
    x=>{x.repository.id=1;},
    x=>{x.controllerSha='d'.repeat(40);},
    x=>{x.receipt.stepId='zero_support';},
    x=>{x.receipt.allowedPaths.push('private.txt');},
    x=>{x.receipt.action='AUTO_MERGE';}
  ];
  for(const change of changes){const e=fixture();change(e);assert.throws(()=>verifyLanding(e));}
});
test('accepts only one bounded sample.py diff',()=>{
  const diff='--- a/sample.py\n+++ b/sample.py\n@@ -1 +1 @@\n-old\n+new\n';
  assert.equal(assertPatchContents(diff),true);
  for(const bad of [
    diff+'--- a/secret.txt\n+++ b/secret.txt\n',diff.slice(0,-1),
    diff.replace('a/sample.py','a/bad.py'),diff+'GIT binary patch\n',
    diff+'x'.repeat(9000),diff+'\0'
  ]) assert.throws(()=>assertPatchContents(bad));
});
