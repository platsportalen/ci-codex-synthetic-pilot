const assert=require('node:assert/strict');const {check}=require('./policy.cjs');
const sha='a'.repeat(40), repo={id:1449650612,full_name:'platsportalen/ci-codex-synthetic-pilot'};
const pr={number:1,state:'open',base:{ref:'main',repo},head:{ref:'pilot/synthetic-v1',sha,repo}};
check({pr,sha});let count=1;
for(const [path,value] of [[['number'],2],[['state'],'closed'],[['base','ref'],'other'],[['head','ref'],'fork'],[['head','sha'],'b'.repeat(40)],[['head','repo','id'],3],[['base','repo','full_name'],'other/repo']]){let p=structuredClone(pr),o=p;for(const k of path.slice(0,-1))o=o[k];o[path.at(-1)]=value;assert.throws(()=>check({pr:p,sha}));count++;}
for(const args of [{attempt:2},{duplicate:true},{sha:'bad'}]){assert.throws(()=>check({pr,sha,...args}));count++;}
console.log(count+' policy scenarios passed');
