'use strict';
/* Final receipt for the trusted in-workflow dispatch path.
   No API key, private code, external publication or customer acceptance. */
const fs=require('node:fs');
const {CONTINUATION}=require('./ci-source.cjs');
const {validateOrder,advance}=require('./controller.cjs');
const SHA=/^[0-9a-f]{40}$/;
function need(ok,reason){if(!ok)throw Error('AUTODEV_DIRECT_DELIVERY_DENIED: '+reason);}
async function finishDirectSynthetic({github,context,core,expectedSha,taskId,
  order=require('./pilot-order.json')}){
  validateOrder(order);
  need(order.repository==='platsportalen/ci-codex-synthetic-pilot'&&
    order.taskId==='pilot_task_1'&&taskId===order.taskId&&SHA.test(expectedSha||''),
    'synthetic scope');
  need(context?.repo?.owner==='platsportalen'&&
    context.repo.repo==='ci-codex-synthetic-pilot'&&
    context.eventName==='workflow_dispatch'&&
    context.ref==='refs/heads/main'&&SHA.test(context.sha||'')&&
    Number(process.env.GITHUB_RUN_ATTEMPT)===1,'trusted controller identity');
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main.object?.sha===context.sha,'main moved');
  const {data:self}=await github.rest.actions.getWorkflowRun({
    ...context.repo,run_id:context.runId
  });
  need(self.id===context.runId && self.workflow_id===CONTINUATION.workflowId &&
    self.path===CONTINUATION.path && self.event==='workflow_dispatch' &&
    self.run_attempt===1 && self.head_branch==='main' &&
    self.head_sha===context.sha && self.repository?.id===order.source.repoId &&
    self.display_title==='autodev-continuation-'+expectedSha,
    'trusted continuation CI identity');
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{
    ...context.repo,run_id:context.runId,filter:'latest',per_page:100});
  const required=[CONTINUATION.validateJob,CONTINUATION.testsJob,
    'Persist verified CI result even when source tests fail'];
  need(Array.isArray(jobs) && required.every(name=>
    jobs.some(j=>j.name===name && j.conclusion==='success' &&
      j.status==='completed')),'mandatory direct CI jobs not successful');
  const {data:pr}=await github.rest.pulls.get({
    ...context.repo,pull_number:order.source.pr
  });
  need(pr.state==='open' && pr.head.ref===order.source.headBranch &&
    pr.base.ref===order.source.baseBranch && pr.head.sha===expectedSha &&
    pr.head.repo?.id===order.source.repoId,
    'source PR changed');
  const path='state/pilot_task_1.json';
  const {data:file}=await github.rest.repos.getContent({
    ...context.repo,path,ref:'autodev-state'
  });
  need(file.type==='file'&&file.encoding==='base64'&&SHA.test(file.sha||'')&&
    file.size<=16384,'state file');
  const state=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  need(state.phase==='REVIEW'&&state.taskId===order.taskId&&
    state.repository===order.repository && state.headSha===expectedSha &&
    state.stepIndex===order.steps.length-1 &&
    state.seenCiRunIds.at(-1)===context.runId &&
    state.seenEventIds.includes('ci_'+context.runId),'unverified review state');
  const proof={
    version:1,taskId:order.taskId,repository:order.repository,
    sourceSha:expectedSha,sourceRunId:context.runId,
    stepId:order.steps.at(-1).id,controllerSha:context.sha,
    verification:'DIRECT_CI_SUCCESS_ALL_TRUSTED_JOBS',
    requiredJobs:required,productionRelease:false,customerAcceptance:false
  };
  const done=advance(order,state,{
    type:'ACCEPT',taskId:order.taskId,repository:order.repository,
    eventId:'accept_'+context.runId,sha:expectedSha,accepted:true
  });
  need(done.phase==='DONE','task not completed');
  const saved={...done,delivery:proof};
  const contents=Buffer.from(JSON.stringify(saved,null,2)+'\n','utf8');
  need(contents.length<=16384,'bounded state record');
  await github.rest.repos.createOrUpdateFileContents({
    ...context.repo,path,branch:'autodev-state',sha:file.sha,
    message:'autodev: complete verified direct synthetic task '+context.runId,
    content:contents.toString('base64')
  });
  fs.mkdirSync('delivery',{recursive:true});
  fs.writeFileSync('delivery/direct-receipt.json',JSON.stringify(proof,null,2)+'\n');
  core.info('DIRECT synthetic task DONE at verified CI '+context.runId);
  return proof;
}
module.exports={finishDirectSynthetic};
