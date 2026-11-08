'use strict';
const os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {advance}=require('./controller.cjs');
const {verifyReservedStep}=require('./paid-runner.cjs');
const SHA=/^[0-9a-f]{40}$/;
const STATE_BRANCH='autodev-state',STATE_PATH='state/pilot_task_1.json';
function need(ok,reason){if(!ok)throw Error('AUTODEV_INTEGRATE_DENIED: '+reason);}

/* Executed only on a fresh write-token runner, after independent, key-free
   verification of this immutable model artifact. This function NEVER executes
   the PR's Python source: git apply treats it solely as data. */
function applyDataOnlyPatch(sourceBytes,patchBytes){
  need(Buffer.isBuffer(sourceBytes)&&sourceBytes.length>0&&sourceBytes.length<=4096,
    'baseline bytes');
  need(Buffer.isBuffer(patchBytes)&&patchBytes.length>0&&patchBytes.length<=8192 &&
    !patchBytes.includes(0),'patch bytes');
  const patchText=patchBytes.toString('utf8');
  need(Buffer.from(patchText,'utf8').equals(patchBytes),'UTF8 patch encoding');
  need(!['GIT binary patch','new file mode','old mode','rename from','rename to',
    'copy from','copy to','diff --cc'].some(v=>patchText.includes(v)),'unsupported diff');
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'autodev-patch-'));
  try{
    fs.writeFileSync(path.join(cwd,'sample.py'),sourceBytes,{flag:'wx'});
    fs.writeFileSync(path.join(cwd,'codex.patch'),patchBytes,{flag:'wx'});
    execFileSync('git',['init','-q'],{cwd,stdio:'pipe'});
    const numstat=execFileSync('git',['apply','--numstat','codex.patch'],
      {cwd,encoding:'utf8',stdio:'pipe'}).trim().split('\n');
    need(numstat.length===1&&/^\d+\t\d+\tsample\.py$/.test(numstat[0]),
      'exactly one allowlisted file');
    execFileSync('git',['apply','--check','codex.patch'],{cwd,stdio:'pipe'});
    execFileSync('git',['apply','codex.patch'],{cwd,stdio:'pipe'});
    const file=path.join(cwd,'sample.py');
    need(!fs.lstatSync(file).isSymbolicLink(),'symlink rejected');
    const result=fs.readFileSync(file);
    need(result.length>0&&result.length<=4096&&!result.includes(0),
      'patched source size');
    return result;
  }finally{
    fs.rmSync(cwd,{recursive:true,force:true});
  }
}

async function publishVerifiedPatch({github,context,receipt,patchBytes,core,
  order=require('./pilot-order.json'),runId}){
  await verifyReservedStep({github,context,receipt,order,runId});
  need(Number.isSafeInteger(runId)&&runId>0&&
    Number(process.env.GITHUB_RUN_ATTEMPT)===1,'workflow run attempt');
  const {data:currentPR}=await github.rest.pulls.get({
    ...context.repo,pull_number:order.source.pr});
  need(currentPR.state==='open'&&currentPR.head.sha===receipt.sourceSha &&
    currentPR.head.ref===order.source.headBranch &&
    currentPR.head.repo.id===order.source.repoId,'source PR moved');
  const {data:stateBlob}=await github.rest.repos.getContent({
    ...context.repo,path:STATE_PATH,ref:STATE_BRANCH});
  need(stateBlob.type==='file'&&stateBlob.encoding==='base64'&&
    stateBlob.sha===receipt.stateSha&&stateBlob.size<=16384,
    'task state changed');
  const oldState=JSON.parse(Buffer.from(stateBlob.content,'base64').toString('utf8'));
  need(oldState.headSha===receipt.sourceSha&&
    oldState.phase===receipt.phase&&oldState.stepIndex===receipt.stepIndex&&
    oldState.seenCiRunIds.at(-1)===receipt.sourceRunId,'task phase changed');
  const {data:base}=await github.rest.repos.getContent({
    ...context.repo,path:'lab/sample.py',ref:receipt.sourceSha});
  need(base.type==='file'&&base.encoding==='base64'&&base.size<=4096,
    'original file data');
  const sourceBytes=Buffer.from(base.content,'base64');
  const patchedBytes=applyDataOnlyPatch(sourceBytes,patchBytes);
  const {data:priorCommit}=await github.rest.git.getCommit({
    ...context.repo,commit_sha:receipt.sourceSha});
  need(SHA.test(priorCommit.tree?.sha||''),'baseline commit');
  const {data:blob}=await github.rest.git.createBlob({
    ...context.repo,content:patchedBytes.toString('base64'),encoding:'base64'});
  const {data:tree}=await github.rest.git.createTree({
    ...context.repo,base_tree:priorCommit.tree.sha,
    tree:[{path:'lab/sample.py',mode:'100644',type:'blob',sha:blob.sha}]});
  const {data:commit}=await github.rest.git.createCommit({
    ...context.repo,tree:tree.sha,parents:[receipt.sourceSha],
    message:'autodev: verified Codex patch for '+receipt.stepId+
      ' (source CI '+receipt.sourceRunId+')'});
  need(SHA.test(commit.sha||''),'new commit SHA');
  // force:false enforces a genuine fast-forward: no blind overwrite.
  await github.rest.git.updateRef({
    ...context.repo,ref:'heads/'+order.source.headBranch,sha:commit.sha,force:false});
  const updated=advance(order,oldState,{
    type:'PATCH_READY',taskId:receipt.taskId,repository:receipt.repository,
    eventId:'codex_patch_'+runId,sha:receipt.sourceSha,newSha:commit.sha});
  await github.rest.repos.createOrUpdateFileContents({
    ...context.repo,path:STATE_PATH,branch:STATE_BRANCH,sha:stateBlob.sha,
    message:'autodev: code patch ready; await CI on '+commit.sha.slice(0,12),
    content:Buffer.from(JSON.stringify(updated,null,2)+'\n').toString('base64')
  });
  // GITHUB_TOKEN commits do not normally trigger pull_request CI.
  // Workflow_dispatch is an explicitly allowed exception, and the dispatched
  // source-check workflow revalidates task ID, current PR head and state SHA.
  await github.rest.actions.createWorkflowDispatch({
    ...context.repo,workflow_id:'autodev-continuation-ci.yml',ref:'main',
    inputs:{task_id:receipt.taskId,expected_sha:commit.sha}});
  core.info('Autodev: fast-forward committed '+commit.sha+
    '; state TESTING; dispatched continuation CI for exact SHA.');
  return {commitSha:commit.sha,phase:updated.phase,dispatched:true};
}
module.exports={applyDataOnlyPatch,publishVerifiedPatch};
