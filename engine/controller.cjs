'use strict';

/* Pure, unprivileged control-plane core. No network, shell, API keys or code execution. */
const SHA = /^[0-9a-f]{40}$/;
const TOKEN = /^[a-z][a-z0-9_-]{2,63}$/;
const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const MAX_EVENTS = 100;
function requireValid(value, why) { if (!value) throw Error('AUTODEV_DENIED: ' + why); }

function validateOrder(order) {
  requireValid(order && typeof order === 'object' && !Array.isArray(order), 'work order');
  requireValid(TOKEN.test(order.taskId || ''), 'task ID');
  requireValid(REPO.test(order.repository || ''), 'repository');
  requireValid(SHA.test(order.baseSha || ''), 'baseline SHA');
  requireValid(Array.isArray(order.steps) && order.steps.length > 0 && order.steps.length <= 20, 'bounded work steps');
  requireValid(Number.isInteger(order.maxRepairs) && order.maxRepairs >= 0 && order.maxRepairs <= 3, 'repair limit');
  const ids = new Set();
  for (const step of order.steps) {
    requireValid(step && TOKEN.test(step.id || '') && !ids.has(step.id), 'unique step ID');
    ids.add(step.id);
    requireValid(Array.isArray(step.allowedPaths) && step.allowedPaths.length > 0 && step.allowedPaths.length <= 20, 'file scope');
    for (const path of step.allowedPaths) {
      requireValid(typeof path === 'string' && path.length <= 160 &&
        !path.startsWith('/') && !path.includes('..') && !path.includes('\\') &&
        !path.split('/').some(p => !p || p.startsWith('.')) &&
        !/(^|\/)(?:env|secrets|credentials)(?:\/|$)/i.test(path), 'unsafe file path');
    }
    requireValid(Array.isArray(step.acceptance) && step.acceptance.length > 0 &&
      step.acceptance.every(x => typeof x === 'string' && x.trim().length > 0 && x.length <= 240), 'acceptance criteria');
  }
  return order;
}

function initialState(order) {
  validateOrder(order);
  return Object.freeze({taskId:order.taskId,repository:order.repository,
    phase:'QUEUED',headSha:order.baseSha,stepIndex:0,repairs:0,
    seenEventIds:[],seenCiRunIds:[]});
}

function advance(order, state, event) {
  validateOrder(order);
  requireValid(state && state.taskId === order.taskId && state.repository === order.repository, 'state scope');
  requireValid(event && event.taskId === order.taskId && event.repository === order.repository, 'event scope');
  requireValid(typeof event.eventId === 'string' && TOKEN.test(event.eventId), 'event ID');
  requireValid(Array.isArray(state.seenEventIds) && Array.isArray(state.seenCiRunIds), 'event ledger');
  if (state.seenEventIds.includes(event.eventId)) return state; // exactly-once effect for same ID
  requireValid(!['DONE','BLOCKED'].includes(state.phase), 'terminal task');
  requireValid(state.seenEventIds.length < MAX_EVENTS, 'ledger full');
  requireValid(state.headSha && SHA.test(state.headSha), 'state SHA');
  requireValid(event.sha === state.headSha, 'stale or foreign SHA');
  let phase = state.phase, stepIndex=state.stepIndex, repairs=state.repairs;
  let blocker=state.blocker||null;
  let headSha=state.headSha;
  const seenCiRunIds=[...state.seenCiRunIds];
  switch(event.type) {
    case 'START':
      requireValid(phase==='QUEUED', 'START phase');
      phase='CODING'; break;
    case 'PATCH_READY':
      requireValid(phase==='CODING' || phase==='REPAIRING', 'PATCH_READY phase');
      requireValid(SHA.test(event.newSha || '') && event.newSha !== headSha, 'new patch SHA');
      headSha=event.newSha; phase='TESTING'; break;
    case 'CI_COMPLETED':
      requireValid(phase==='TESTING', 'CI phase');
      requireValid(Number.isSafeInteger(event.runId) && event.runId > 0, 'CI run ID');
      requireValid(!seenCiRunIds.includes(event.runId), 'duplicate CI run');
      requireValid(event.conclusion==='success'||event.conclusion==='failure', 'CI outcome');
      seenCiRunIds.push(event.runId);
      if (event.conclusion==='failure') {
        if (repairs >= order.maxRepairs) {
          phase='BLOCKED';
          blocker={code:'CI_REPAIR_LIMIT',stepId:order.steps[stepIndex].id,
            sha:state.headSha,sourceRunId:event.runId,attempts:repairs,
            recommendation:'Inspect the failing CI and revise the task or unblock safely.'};
        }else { repairs++; phase='REPAIRING'; }
      } else if (stepIndex + 1 < order.steps.length) {
        stepIndex++; repairs=0; phase='CODING';
      } else phase='REVIEW';
      break;
    case 'ACCEPT':
      requireValid(phase==='REVIEW' && event.accepted===true, 'acceptance');
      phase='DONE'; break;
    case 'HALT':
      phase='BLOCKED';
      blocker={code:'OPERATOR_HALT',stepId:order.steps[stepIndex]?.id||'unknown',
        sha:state.headSha,sourceRunId:null,attempts:repairs,
        recommendation:'Explicit owner review before resuming this task.'};
      break;
    default: throw Error('AUTODEV_DENIED: unknown event');
  }
  return Object.freeze({...state,phase,headSha,stepIndex,repairs,blocker,
    seenEventIds:[...state.seenEventIds,event.eventId],seenCiRunIds});
}

module.exports={validateOrder,initialState,advance};
