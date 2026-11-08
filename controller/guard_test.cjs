const a=require('node:assert/strict'),{assertScope,assertCI,assertUnused}=require('./guard.cjs');
const sha='5c0d2dc4e9f3c582ad479bb6203a483160627147',repo={id:1449650612,full_name:'platsportalen/ci-codex-synthetic-pilot'};
const pr={number:1,state:'open',base:{ref:'main',repo},head:{ref:'pilot/synthetic-v1',sha,repo}};
assertScope(pr,sha,1);
for(const [path,value] of [[['number'],2],[['state'],'closed'],[['base','ref'],'elsewhere'],[['head','ref'],'evil'],[['head','sha'],'b'.repeat(40)],[['head','repo','id'],8],[['base','repo','full_name'],'evil/repo']]){const p=structuredClone(pr);let x=p;for(const k of path.slice(0,-1))x=x[k];x[path.at(-1)]=value;a.throws(()=>assertScope(p,sha,1));}
a.throws(()=>assertScope(pr,sha,2));
const ci={id:42405295510,head_sha:sha,status:'completed',conclusion:'success',event:'pull_request',path:'.github/workflows/synthetic.yml',pull_requests:[{number:1,head:{repo:{id:1449650612}}}]};assertCI(ci,sha);
for(const change of [{conclusion:'failure'},{status:'in_progress'},{head_sha:'b'.repeat(40)},{id:1},{event:'push'},{pull_requests:[]}])a.throws(()=>assertCI({...ci,...change},sha));
assertUnused([{name:'Codex single paid pass',conclusion:'skipped'}]);
for(const conclusion of ['success','failure','cancelled',null])a.throws(()=>assertUnused([{name:'Codex single paid pass',conclusion}]));
console.log('21 scope/CI/duplicate scenarios passed');
