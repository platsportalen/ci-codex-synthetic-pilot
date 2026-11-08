'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {finishDirectSynthetic}=require('./direct-delivery.cjs');
const {CONTINUATION}=require('./ci-source.cjs');
const order=require('./pilot-order.json');
const MAIN='b'.repeat(40),HEAD='a'.repeat(40),ID=981111,FILE_SHA='c'.repeat(40);
const previous=process.env.GITHUB_RUN_ATTEMPT;
process.env.GITHUB_RUN_ATTEMPT='1';
process.on('exit',()=>{if(previous===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=previous;});
function fixture(){
 const identity={id:order.source.repoId,full_name:order.repository};
 const context={repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},
   eventName:'workflow_dispatch',ref:'refs/heads/main',sha:MAIN,runId:ID};
 const pr={state:'open',head:{ref:order.source.headBranch,sha:HEAD,repo:identity},
   base:{ref:order.source.baseBranch,repo:identity}};
 const self={id:ID,event:'workflow_dispatch',workflow_id:CONTINUATION.workflowId,
   path:CONTINUATION.path,run_attempt:1,head_branch:'main',head_sha:MAIN,
   repository:identity,display_title:'autodev-continuation-'+HEAD};
 const jobs=[CONTINUATION.validateJob,CONTINUATION.testsJob,
   'Persist verified CI result even when source tests fail']
   .map(name=>({name,status:'completed',conclusion:'success'}));
 const state={taskId:order.taskId,repository:order.repository,phase:'REVIEW',
   stepIndex:1,headSha:HEAD,repairs:1,seenCiRunIds:[ID],
   seenEventIds:['bootstrap_start','ci_'+ID]};
 const writes=[];
 const github={rest:{
   git:{getRef:async()=>({data:{object:{sha:MAIN}}})},
   actions:{getWorkflowRun:async()=>({data:self}),listJobsForWorkflowRun:async()=>({})},
   pulls:{get:async()=>({data:pr})},
   repos:{
     getContent:async()=>{const b=Buffer.from(JSON.stringify(state));return {
       data:{type:'file',sha:FILE_SHA,encoding:'base64',size:b.length,content:b.toString('base64')}};},
     createOrUpdateFileContents:async x=>{writes.push(x);return {data:{}};}
   }
 },paginate:async()=>jobs};
 return {github,context,core:{info(){}},expectedSha:HEAD,taskId:order.taskId,
    order,pr,self,jobs,state,writes};
}
test('successful validated direct CI closes synthetic task and writes proof atomically',async()=>{
 const a=fixture();const receipt=await finishDirectSynthetic(a);
 assert.equal(receipt.verification,'DIRECT_CI_SUCCESS_ALL_TRUSTED_JOBS');
 assert.equal(receipt.productionRelease,false);assert.equal(receipt.customerAcceptance,false);
 assert.equal(a.writes.length,1);assert.equal(a.writes[0].sha,FILE_SHA);
 const state=JSON.parse(Buffer.from(a.writes[0].content,'base64').toString());
 assert.equal(state.phase,'DONE');assert.equal(state.delivery.sourceRunId,ID);
});
test('direct finalizer cannot accept failed jobs, state not REVIEW, stale SHA',async()=>{
 for(const mutate of [
  a=>a.jobs[1].conclusion='failure',
  a=>a.jobs[0].status='in_progress',
  a=>a.jobs[2].conclusion='failure',
  a=>a.pr.head.sha='d'.repeat(40),
  a=>a.state.phase='REPAIRING',
  a=>a.state.seenCiRunIds=[11],
  a=>a.self.workflow_id=1,
  a=>a.self.display_title='forged',
  a=>a.context.sha='f'.repeat(40),
  a=>a.taskId='wrong'
 ]){
  const a=fixture();mutate(a);
  await assert.rejects(()=>finishDirectSynthetic(a));assert.equal(a.writes.length,0);
 }
});
test('CAS failure never reports completed delivery',async()=>{
 const a=fixture();a.github.rest.repos.createOrUpdateFileContents=async()=>{throw Error('409 conflict');};
 await assert.rejects(()=>finishDirectSynthetic(a),/409 conflict/);
});
