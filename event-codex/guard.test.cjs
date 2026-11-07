'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {TARGET, assertSource, assertActivation, assertNoPaidAttempt} = require('./guard.cjs');
const sha='a'.repeat(40);
const repo={id:TARGET.repoId,full_name:TARGET.repo};
function valid() {
  return {repository:repo,
    pr:{number:1,state:'open',base:{ref:'main',repo},head:{ref:'pilot/synthetic-v1',sha,repo}},
    sourceRun:{id:101,workflow_id:TARGET.sourceWorkflowId,name:TARGET.sourceWorkflowName,
      path:TARGET.sourcePath,event:'pull_request',status:'completed',conclusion:'success',
      run_attempt:1,repository:repo,head_repository:repo,head_branch:TARGET.head,head_sha:sha,
      pull_requests:[{number:1,head:{repo}}]},
    payloadRun:{id:101,head_sha:sha},attempt:1};
}
test('green CI is accepted only for exact current PR head',()=>{
  assert.deepEqual(assertSource(valid()),{sha,sourceRunId:101,step:'synthetic-ci-codex-v1'});
});
const denied=[
  ['repository.id',42],['repository.full_name','wrong/repo'],
  ['pr.number',2],['pr.state','closed'],['pr.base.ref','wrong'],['pr.head.ref','wrong'],
  ['pr.base.repo.id',42],['pr.head.repo.full_name','fork/thing'],['pr.head.sha','b'.repeat(40)],
  ['sourceRun.id',102],['sourceRun.workflow_id',0],['sourceRun.name','other'],
  ['sourceRun.path','other.yml'],['sourceRun.event','push'],['sourceRun.status','in_progress'],
  ['sourceRun.conclusion','failure'],['sourceRun.conclusion','cancelled'],
  ['sourceRun.run_attempt',2],['sourceRun.repository.id',42],['sourceRun.head_repository.id',42],
  ['sourceRun.head_branch','other'],['sourceRun.head_sha','b'.repeat(40)],
  ['sourceRun.pull_requests',[]],['payloadRun.id',102],['payloadRun.head_sha','b'.repeat(40)],
  ['attempt',2],
];
for(const [path,value] of denied) {
  test('reject '+path,()=>{
    const data=structuredClone(valid());const keys=path.split('.');let obj=data;
    for(const k of keys.slice(0,-1))obj=obj[k];obj[keys.at(-1)]=value;
    assert.throws(()=>assertSource(data), /denied/);
  });
}
test('requires explicit activation, matching source and current trusted controller',()=>{
 const good={sourceSha:sha,approvedSha:sha,enabled:'true',trustedCommit:'b'.repeat(40),currentDefaultCommit:'b'.repeat(40)};
 assert.doesNotThrow(()=>assertActivation(good));
 for(const change of [
   {enabled:'false'},{enabled:undefined},{approvedSha:'c'.repeat(40)},
   {trustedCommit:'c'.repeat(40)},{currentDefaultCommit:'c'.repeat(40)}
 ])assert.throws(()=>assertActivation({...good,...change}),/denied/);
});
test('single paid work step, historical failure also consumes it',()=>{
 const runs=[{id:1},{id:2}];
 assert.doesNotThrow(()=>assertNoPaidAttempt({runs,currentRunId:2,jobsByRun:new Map([[1,[{name:TARGET.paidJobName,conclusion:'skipped'}]]])}));
 for(const status of ['success','failure',null,'cancelled']) {
  assert.throws(()=>assertNoPaidAttempt({runs,currentRunId:2,jobsByRun:new Map([[1,[{name:TARGET.paidJobName,conclusion:status}]])]}),/denied/);
 }
 assert.throws(()=>assertNoPaidAttempt({runs,currentRunId:2,jobsByRun:new Map()}),/denied/);
});
