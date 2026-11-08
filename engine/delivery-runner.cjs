'use strict';
const fs=require('node:fs');
const {verifySyntheticDelivery,acceptSyntheticDelivery}=require('./delivery.cjs');
const {validateOrder}=require('./controller.cjs');
const {STATE_BRANCH,STATE_PATH}=require('./ci-receiver.cjs');
const SHA=/^[a-f0-9]{40}$/;
function need(ok,why){if(!ok)throw Error('AUTODEV_FINALIZE_DENIED: '+why);}
async function finalizeSynthetic({github,context,core,order=require('./pilot-order.json')}){
  validateOrder(order);
  need(context?.repo?.owner==='platsportalen'&&
    context.repo.repo==='ci-codex-synthetic-pilot' &&
    context.ref==='refs/heads/main'&&SHA.test(context.sha||''),'trusted origin');
  need(context.payload?.repository?.id===order.source.repoId &&
    context.payload.repository.full_name===order.repository,'repository');
  const {data:main}=await github.rest.git.getRef({...context.repo,ref:'heads/main'});
  need(main.object?.sha===context.sha,'default branch moved');
  const event=context.payload.workflow_run;
  need(event?.event==='pull_request' && event.status==='completed' &&
    event.conclusion==='success' && Number.isSafeInteger(event.id),'successful PR CI event');
  const {data:file}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH
  });
  need(file.type==='file'&&file.encoding==='base64'&&SHA.test(file.sha||'')&&file.size<=16384,'task state blob');
  const state=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  need(state.phase==='REVIEW','task is not ready for final acceptance');
  const {data:run}=await github.rest.actions.getWorkflowRun({...context.repo,run_id:event.id});
  const {data:pr}=await github.rest.pulls.get({...context.repo,pull_number:order.source.pr});
  need(run.id===event.id&&run.conclusion===event.conclusion &&
    run.head_sha===event.head_sha,'re-fetched source CI mismatch');
  const jobs=await github.paginate(github.rest.actions.listJobsForWorkflowRun,{
    ...context.repo,run_id:event.id,filter:'latest',per_page:100
  });
  const proof=verifySyntheticDelivery({order,state,run,jobs,pr});
  const accepted=acceptSyntheticDelivery(order,state,proof);
  const saved={...accepted,delivery:{...proof,reviewedAtSourceSha:state.headSha}};
  const serialized=JSON.stringify(saved,null,2)+'\n';
  need(Buffer.byteLength(serialized,'utf8')<=16384,'bounded final record');
  await github.rest.repos.createOrUpdateFileContents({
    ...context.repo,path:STATE_PATH,branch:STATE_BRANCH,sha:file.sha,
    message:'autodev: record completed synthetic task '+order.taskId+' at CI '+run.id,
    content:Buffer.from(serialized,'utf8').toString('base64')
  });
  fs.mkdirSync('delivery',{recursive:true});
  fs.writeFileSync('delivery/receipt.json',JSON.stringify(saved.delivery,null,2)+'\n');
  core.info('Completed synthetic task '+order.taskId+' on CI '+run.id+'; no production acceptance.');
  return saved.delivery;
}
module.exports={finalizeSynthetic};
