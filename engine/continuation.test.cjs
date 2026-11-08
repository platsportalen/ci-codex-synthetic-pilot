'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createWorkOrder,verifyWorkOrder}=require('./continuation.cjs');
const order=require('./pilot-order.json');
const CI=42472850043, HEAD='f9059eb49f05e66bc352fcb813c76a1b33db6391';
const CONTROL='c'.repeat(40), STATE='e'.repeat(40);
function state(){return {taskId:order.taskId,repository:order.repository,
  headSha:HEAD,phase:'CODING',stepIndex:1,repairs:0,seenCiRunIds:[CI]};}
function make(s=state()){return createWorkOrder(order,s,{
  sourceRunId:CI,controllerSha:CONTROL,stateSha:STATE});}
function check(receipt){return verifyWorkOrder(order,receipt,{
  sourceRunId:CI,sourceSha:HEAD,controllerSha:CONTROL});}
test('creates exact next-step manifest from approved persisted task phase',()=>{
  const x=make();assert.equal(x.stepId,'final_verification');
  assert.equal(x.sourceRunId,CI);assert.deepEqual(x.allowedPaths,order.steps[1].allowedPaths);
  assert.equal(x.action,'PROPOSE_PATCH_ONLY_NO_AI');assert.equal(check(x),true);
});
test('creates a repair assignment only inside explicitly approved repair boundary',()=>{
  const s={...state(),phase:'REPAIRING',repairs:1,stepIndex:0};
  const x=make(s);assert.equal(x.repairAttempt,1);assert.equal(x.phase,'REPAIRING');
  assert.equal(check(x),true);
});
test('rejects stale, missing and non-existent run bindings',()=>{
  for(const bad of [
    {...state(),seenCiRunIds:[1]},
    {...state(),seenCiRunIds:[]},
    {...state(),seenCiRunIds:null}
  ])assert.throws(()=>make(bad),/source run binding/);
});
test('refuses dispatch for terminal, testing, out-of-bounds tasks',()=>{
  for(const bad of [
    {...state(),phase:'TESTING'},
    {...state(),phase:'DONE'},
    {...state(),phase:'BLOCKED'},
    {...state(),stepIndex:99},
    {...state(),repairs:999}
  ])assert.throws(()=>make(bad));
});
test('independent verifier rejects changed action, paths, step, CI and extra fields',()=>{
  const x=make();
  for(const change of [
    {action:'AUTO_MERGE'},
    {stepId:'first_step'},
    {sourceRunId:1},
    {sourceSha:'f'.repeat(40)},
    {allowedPaths:['secrets.txt']},
    {acceptance:['some different acceptance']},
    {stepIndex:0},
    {controllerSha:'d'.repeat(40)},
    {stateSha:'short'},
    {backdoor:true}
  ])assert.throws(()=>check({...x,...change}));
});
