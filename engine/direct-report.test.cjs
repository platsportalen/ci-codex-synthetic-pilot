'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {recordTrustedResult}=require('./direct-report.cjs');
const {CONTINUATION}=require('./ci-source.cjs');
const order=require('./pilot-order.json');
const SHA='a'.repeat(40),MAIN='b'.repeat(40),BLOB='c'.repeat(40),ID=411223;
const previous=process.env.GITHUB_RUN_ATTEMPT;
process.env.GITHUB_RUN_ATTEMPT='1';
process.on('exit',()=>{if(previous===undefined)delete process.env.GITHUB_RUN_ATTEMPT;else process.env.GITHUB_RUN_ATTEMPT=previous;});
function fixture(outcome='failure'){
 const identity={id:order.source.repoId,full_name:order.repository};
 const context={repo:{owner:'platsportalen',repo:'ci-codex-synthetic-pilot'},
   ref:'refs/heads/main',sha:MAIN,eventName:'workflow_dispatch',runId:ID};
 const pr={state:'open',base:{ref:order.source.baseBranch},head:{
    ref:order.source.headBranch,sha:SHA,repo:identity}};
 const self={id:ID,workflow_id:CONTINUATION.workflowId,path:CONTINUATION.path,
   event:'workflow_dispatch',run_attempt:1,head_branch:'main',head_sha:MAIN,
   display_title:'autodev-continuation-'+SHA,repository:identity};
 const jobs=[{name:CONTINUATION.validateJob,conclusion:'success'},
   {name:CONTINUATION.testsJob,conclusion:outcome}];
 const state={taskId:order.taskId,repository:order.repository,headSha:SHA,
   phase:'TESTING',stepIndex:1,repairs:0,seenEventIds:[],seenCiRunIds:[]};
 const writes=[],outputs={};
 const github={rest:{
   git:{getRef:async()=>({data:{object:{sha:MAIN}}})},
   actions:{getWorkflowRun:async()=>({data:self}),listJobsForWorkflowRun:async()=>{}},
   pulls:{get:async()=>({data:pr})},
   repos:{getContent:async()=>{const b=Buffer.from(JSON.stringify(state));
       return {data:{type:'file',encoding:'base64',sha:BLOB,size:b.length,content:b.toString('base64')}};},
     createOrUpdateFileContents:async x=>{writes.push(x);return {data:{}};}}
 },paginate:async()=>jobs};
 const core={setOutput:(k,v)=>{outputs[k]=v;},info:()=>{}};
 return {github,context,core,taskId:order.taskId,expectedSha:SHA,testOutcome:outcome,
   order,pr,self,jobs,state,writes,outputs};
}
test('red trusted functional CI is persisted as REPAIRING with exact run ID',async()=>{
 const a=fixture();const d=await recordTrustedResult(a);
 assert.equal(d.after,'REPAIRING');assert.equal(a.writes.length,1);
 const state=JSON.parse(Buffer.from(a.writes[0].content,'base64').toString('utf8'));
 assert.equal(state.repairs,1);assert.deepEqual(state.seenCiRunIds,[ID]);
 assert.equal(a.outputs.phase,'REPAIRING');assert.equal(a.outputs.source_sha,SHA);
});
test('final green trusted functional CI reaches REVIEW, not unapproved DONE',async()=>{
 const a=fixture('success');const d=await recordTrustedResult(a);
 assert.equal(d.after,'REVIEW');
});
test('rejects wrong CI workflow, changed PR, failed validation and missing test provenance',async()=>{
 for(const modify of [
   a=>{a.self.workflow_id=9999;},a=>{a.self.display_title='wrong';},
   a=>{a.pr.head.sha='d'.repeat(40);},
   a=>{a.jobs[0].conclusion='failure';},
   a=>{a.jobs[1].conclusion='skipped';},
   a=>{a.context.ref='refs/heads/evil';},
   a=>{a.state.phase='CODING';},
   a=>{a.taskId='other';}
 ]){
   const a=fixture();modify(a);
   await assert.rejects(()=>recordTrustedResult(a));
   assert.equal(a.writes.length,0);
 }
});
test('a repeated CI result cannot write state twice',async()=>{
 const a=fixture();a.state.seenEventIds=['ci_'+ID];a.state.seenCiRunIds=[ID];
 const d=await recordTrustedResult(a);
 assert.equal(d.duplicate,true);assert.equal(a.writes.length,0);
});
test('CAS write failure does not claim successful persistence',async()=>{
 const a=fixture();
 a.github.rest.repos.createOrUpdateFileContents=async()=>{throw Error('409 CAS');};
 await assert.rejects(()=>recordTrustedResult(a),/409 CAS/);
});
