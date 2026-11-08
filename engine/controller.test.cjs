'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateOrder,initialState,advance}=require('./controller.cjs');
const A='a'.repeat(40), B='b'.repeat(40), C='c'.repeat(40), D='d'.repeat(40);
const order=Object.freeze({taskId:'pilot_task_1',repository:'platsportalen/ci-codex-synthetic-pilot',
  baseSha:A,maxRepairs:2,steps:[
    {id:'first_step',allowedPaths:['lab/sample.py'],acceptance:['accept zero']},
    {id:'second_step',allowedPaths:['lab/test_sample.py'],acceptance:['run tests']}
  ]});
let id=0;
function ev(type,sha,extra={}) { return {taskId:order.taskId,repository:order.repository,eventId:'event_'+(++id),type,sha,...extra}; }
function start(){return advance(order,initialState(order),ev('START',A));}
function patch(state,newSha){return advance(order,state,ev('PATCH_READY',state.headSha,{newSha}));}
function ci(state,runId,conclusion){return advance(order,state,ev('CI_COMPLETED',state.headSha,{runId,conclusion}));}

test('work order validation requires bounded task and explicit acceptance',()=>{
  assert.equal(validateOrder(order),order);
  assert.throws(()=>validateOrder({...order,maxRepairs:9}),/repair limit/);
  assert.throws(()=>validateOrder({...order,steps:[]}),/bounded work steps/);
  assert.throws(()=>validateOrder({...order,steps:[{id:'first_step',allowedPaths:['../.env'],acceptance:['ok']}]}),/unsafe file path/);
  assert.throws(()=>validateOrder({...order,steps:[{id:'first_step',allowedPaths:['.github/workflows/x.yml'],acceptance:['ok']}]}),/unsafe file path/);
  assert.throws(()=>validateOrder({...order,steps:[order.steps[0],order.steps[0]]}),/unique step ID/);
});

test('green CI moves automatically to next step and final REVIEW',()=>{
  let state=start(); assert.equal(state.phase,'CODING');
  state=ci(patch(state,B),1001,'success');
  assert.equal(state.phase,'CODING'); assert.equal(state.stepIndex,1);
  state=ci(patch(state,C),1002,'success'); assert.equal(state.phase,'REVIEW');
  state=advance(order,state,ev('ACCEPT',C,{accepted:true}));
  assert.equal(state.phase,'DONE');
  assert.throws(()=>advance(order,state,ev('START',C)),/terminal task/);
});

test('red CI automatically requests bounded correction; no infinite retries',()=>{
  let state=patch(start(),B);
  state=ci(state,2001,'failure'); assert.equal(state.phase,'REPAIRING');assert.equal(state.repairs,1);
  state=patch(state,C);state=ci(state,2002,'failure');
  assert.equal(state.phase,'REPAIRING');assert.equal(state.repairs,2);
  state=patch(state,D);state=ci(state,2003,'failure');
  assert.equal(state.phase,'BLOCKED');
});

test('green CI after failed test clears repairs when next step starts',()=>{
  let state=ci(patch(start(),B),3001,'failure');
  state=ci(patch(state,C),3002,'success');
  assert.equal(state.phase,'CODING');assert.equal(state.repairs,0);
});

test('duplicate event IDs are idempotent; stale SHA and fake task are rejected',()=>{
  let state=start();const e=ev('PATCH_READY',A,{newSha:B});
  state=advance(order,state,e);assert.equal(advance(order,state,e),state);
  assert.throws(()=>advance(order,state,ev('CI_COMPLETED',A,{runId:4001,conclusion:'success'})),/stale or foreign SHA/);
  assert.throws(()=>advance(order,state,{...ev('CI_COMPLETED',B,{runId:4001,conclusion:'success'}),repository:'other/repo'}),/event scope/);
  assert.throws(()=>advance(order,state,ev('ACCEPT',B,{accepted:true})),/acceptance/);
});

test('CI run cannot be replayed under a new event ID',()=>{
  let state=ci(patch(start(),B),5001,'success');
  state=patch(state,C);
  assert.throws(()=>ci(state,5001,'success'),/duplicate CI run/);
});

test('unknown and malformed events fail closed',()=>{
  const state=start();
  assert.throws(()=>advance(order,state,ev('PUBLISH',A)),/unknown event/);
  assert.throws(()=>advance(order,state,ev('PATCH_READY',A,{newSha:'xyz'})),/new patch SHA/);
  assert.throws(()=>advance(order,state,ev('CI_COMPLETED',A,{runId:1,conclusion:'success'})),/CI phase/);
});

test('operator can halt any active task without publishing',()=>{
  const state=advance(order,start(),ev('HALT',A));assert.equal(state.phase,'BLOCKED');
});
