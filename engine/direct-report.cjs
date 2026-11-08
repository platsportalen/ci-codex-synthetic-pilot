'use strict';
/** Trusted same-workflow result handoff, avoiding suppressed workflow_run events from GITHUB_TOKEN dispatches. */
const {advance,validateOrder}=require('./controller.cjs');
const {CONTINUATION}=require('./ci-source.cjs');
const SHA=/^[a-f0-9]{40}$/;
function need(ok,why){if(!ok)throw Error('AUTODEV_DIRECT_REPORT_DENIED: '+why);}
async function recordTrustedResult({github,context,core,taskId,expectedSha,testOutcome,order=require('./pilot-order.json')}){
  validateOrder(order);
  need(context.repo.owner==='platsportalen'&&context.repo.repo==='ci-codex-synthetic-pilot'&&
    context.ref==='refs/heads/main'&&context.eventName==='workflow_dispatch','trusted workflow origin');
  need(Number(process.env.GITHUB_RUN_ATTEMPT)===1&&
    taskId===order.taskId&&SHA.test(expectedSha||'')&&
    ['success','failure'].includes(testOutcome),'scope and outcome');
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main.object.sha===context.sha,'controller moved');
  const {data:self}=await github.rest.actions.getWorkflowRun({...context.repo,run_id:context.runId});
  need(self.id===context.runId&&self.workflow_id===CONTINUATION.workflowId&&
    self.path===CONTINUATION.path&&self.event==='workflow_dispatch'&&self.run_attempt===1&&
    self.head_branch==='main'&&self.head_sha===context.sha&&
    self.display_title==='autodev-continuation-'+expectedSha&&
    self.repository?.id===order.source.repoId,'trusted dispatch identity');
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{
    ...context.repo,run_id:context.runId,filter:'latest',per_page:100});
  need(Array.isArray(jobs)&&
    jobs.some(j=>j.name===CONTINUATION.validateJob&&j.conclusion==='success')&&
    jobs.some(j=>j.name===CONTINUATION.testsJob&&j.conclusion===testOutcome),
    'verified completed jobs');
  const {data:pr}=await github.rest.pulls.get({...context.repo,pull_number:order.source.pr});
  need(pr.state==='open'&&pr.base.ref===order.source.baseBranch&&
    pr.head.ref===order.source.headBranch&&pr.head.sha===expectedSha&&
    pr.head.repo.id===order.source.repoId,'source PR changed');
  const {data:file}=await github.rest.repos.getContent({
    ...context.repo,path:'state/pilot_task_1.json',ref:'autodev-state'});
  need(file.type==='file'&&file.encoding==='base64'&&SHA.test(file.sha||'')&&file.size<=16384,
    'state blob');
  const before=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  need(before.taskId===order.taskId&&before.repository===order.repository&&
    before.headSha===expectedSha,'state not at source SHA');
  const after=advance(order,before,{
    type:'CI_COMPLETED',taskId:order.taskId,repository:order.repository,
    eventId:'ci_'+context.runId,runId:context.runId,
    sha:expectedSha,conclusion:testOutcome
  });
  if(after!==before){
    const buf=Buffer.from(JSON.stringify(after,null,2)+'\n','utf8');
    need(buf.length<=16384,'state size');
    await github.rest.repos.createOrUpdateFileContents({
      ...context.repo,path:'state/pilot_task_1.json',branch:'autodev-state',
      sha:file.sha,message:'autodev: direct verified CI '+context.runId+' ('+testOutcome+')',
      content:buf.toString('base64')
    });
  }
  core.setOutput('phase',after.phase);
  core.setOutput('source_run_id',String(context.runId));
  core.setOutput('source_sha',expectedSha);
  core.info('Direct trusted CI report '+JSON.stringify({
    taskId,sourceRunId:context.runId,sourceSha:expectedSha,
    outcome:testOutcome,before:before.phase,after:after.phase,duplicate:after===before}));
  return {before:before.phase,after:after.phase,duplicate:after===before};
}
module.exports={recordTrustedResult};
