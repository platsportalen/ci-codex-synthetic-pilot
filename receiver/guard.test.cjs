'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {TARGET, checkSource, checkNoPriorContinuation} = require('./guard.cjs');
const {createProof, verifyProof} = require('./proof.cjs');
const sha = 'a'.repeat(40);
function fixture() {
  const repo = {id:TARGET.id,full_name:TARGET.repo};
  return {
    repository: repo,
    pr: {number:1,state:'open',base:{ref:'main',repo},head:{ref:'pilot/synthetic-v1',sha,repo}},
    run: {id:101,workflow_id:TARGET.workflowId,name:TARGET.workflow,path:TARGET.path,event:'pull_request',status:'completed',conclusion:'success',repository:repo,head_repository:repo,head_branch:TARGET.head,head_sha:sha,run_attempt:1,pull_requests:[{number:1,head:{repo}}]},
    eventRun: {id:101,head_sha:sha},attempt:1,
  };
}
function modified(path, value) {const v = structuredClone(fixture());let p=v;for(const key of path.slice(0,-1))p=p[key];p[path.at(-1)]=value;return v;}
test('accept exactly one green run for the current same-repo PR head',()=>assert.deepEqual(checkSource(fixture()),{sourceRunId:101,sha,prNumber:1}));
const invalid = [
  [['repository','id'],5], [['repository','full_name'],'other/repo'],
  [['pr','number'],2], [['pr','state'],'closed'], [['pr','base','ref'],'release'], [['pr','head','ref'],'other'],
  [['pr','base','repo','id'],5], [['pr','head','repo','full_name'],'fork/repo'], [['pr','head','sha'],'b'.repeat(40)],
  [['run','id'],102], [['run','workflow_id'],1], [['run','name'],'Untrusted CI'], [['run','path'],'evil.yml'],
  [['run','event'],'push'], [['run','status'],'in_progress'], [['run','conclusion'],'failure'],
  [['run','repository','id'],5], [['run','head_repository','id'],5], [['run','head_branch'],'other'],
  [['run','head_sha'],'b'.repeat(40)], [['run','pull_requests'],[]], [['run','run_attempt'],2],
  [['eventRun','id'],102], [['eventRun','head_sha'],'b'.repeat(40)], [['attempt'],2],
];
for(const [path,value] of invalid) test('reject '+path.join('.'),()=>assert.throws(()=>checkSource(modified(path,value))));
test('reject prior continuation (even if it failed)',()=>assert.throws(()=>checkNoPriorContinuation([{id:20,display_title:'receiver-source-101'}],21,'receiver-source-101',new Map([[20,[{name:'Continue synthetic work (NO AI)',conclusion:'failure'}]]]))));
test('allow prior skipped continuation',()=>assert.doesNotThrow(()=>checkNoPriorContinuation([{id:20,display_title:'receiver-source-101'}],21,'receiver-source-101',new Map([[20,[{name:'Continue synthetic work (NO AI)',conclusion:'skipped'}]]]))));
test('proof is bounded to matching run id and SHA',()=>{const proof=createProof(101,sha);assert.equal(verifyProof(proof,101,sha),true);assert.throws(()=>verifyProof({...proof,sourceRunId:102},101,sha));assert.throws(()=>verifyProof({...proof,extra:'bad'},101,sha));assert.throws(()=>createProof('oops',sha));});
