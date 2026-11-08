'use strict';
const {verifyCompletedCI,applyVerifiedCI}=require('./ci-source.cjs');
const {validateOrder}=require('./controller.cjs');

const STATE_BRANCH='autodev-state';
const STATE_PATH='state/pilot_task_1.json';
const SHA=/^[a-f0-9]{40}$/;
function need(value,why){if(!value)throw Error('AUTODEV_PERSIST_DENIED: '+why);}

/**
 * Runs ONLY from the trusted default-branch workflow, with no PR checkout,
 * AI credentials, customer files, merge, deployment or subprocess execution.
 * GitHub Contents API's blob SHA is used as the write precondition.
 */
async function processCI({github,context,core,order=require('./pilot-order.json')}){
  validateOrder(order);
  need(context?.repo?.owner==='platsportalen' &&
       context.repo.repo==='ci-codex-synthetic-pilot' &&
       context.ref==='refs/heads/main' && SHA.test(context.sha||''),
    'trusted controller origin');
  need(context?.payload?.repository?.full_name===order.repository,
    'event repository');
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main?.object?.sha===context.sha,'controller default branch moved');

  const trigger=context.payload.workflow_run;
  need(Number.isSafeInteger(trigger?.id) && trigger.id>0,'event source run ID');
  const {data:pr}=await github.rest.pulls.get({
    ...context.repo,pull_number:order.source.pr});
  const {data:run}=await github.rest.actions.getWorkflowRun({
    ...context.repo,run_id:trigger.id});
  const jobs=run.event==='workflow_dispatch'
    ?await github.paginate(github.rest.actions.listJobsForWorkflowRun,{
      ...context.repo,run_id:run.id,per_page:100,filter:'latest'})
    :undefined;
  const verified=verifyCompletedCI({
    repository:context.payload.repository,pr,run,payloadRun:trigger,
    attempt:Number(process.env.GITHUB_RUN_ATTEMPT),order,jobs
  });
  const {data:file}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH});
  need(file?.type==='file' && file.encoding==='base64' &&
    SHA.test(file.sha||'') && file.size<=16384,'state blob');
  const before=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  need(before?.taskId===order.taskId &&
    before?.repository===order.repository,'state identity');
  const after=applyVerifiedCI(order,before,verified);
  const duplicate=after===before;
  if(!duplicate){
    const stateText=JSON.stringify(after,null,2)+'\n';
    need(Buffer.byteLength(stateText,'utf8')<=16384,'state size');
    await github.rest.repos.createOrUpdateFileContents({
      ...context.repo,path:STATE_PATH,branch:STATE_BRANCH,
      message:'autodev: record verified CI '+verified.runId+' ('+verified.conclusion+')',
      sha:file.sha,content:Buffer.from(stateText,'utf8').toString('base64')
    });
  }
  const result={taskId:order.taskId,sourceRunId:verified.runId,
    sourceSha:verified.sha,conclusion:verified.conclusion,
    before:before.phase,after:after.phase,stepIndex:after.stepIndex,
    repairs:after.repairs,duplicate};
  core.setOutput('phase',after.phase);
  core.setOutput('source_run_id',String(verified.runId));
  core.setOutput('source_sha',verified.sha);
  core.info('Trusted autonomous task decision: '+JSON.stringify(result));
  return result;
}
module.exports={processCI,STATE_BRANCH,STATE_PATH};
