'use strict';
const fs = require('node:fs');
const path = require('node:path');
function createProof(id, sha) {
  if (!/^[1-9][0-9]*$/.test(String(id)) || !Number.isSafeInteger(Number(id))) throw Error('Invalid CI run ID');
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('Invalid CI SHA');
  return {version: 1, step: 'synthetic-ci-followup-v1', sourceRunId: Number(id), sourceHeadSha: sha, decision: 'CONTINUE_AFTER_GREEN_CI'};
}
function verifyProof(value, id, sha) {
  const expected = createProof(id, sha);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== Object.keys(expected).sort().join(',')) throw Error('Unexpected proof schema');
  for (const key of Object.keys(expected)) if (value[key] !== expected[key]) throw Error('Invalid proof '+key);
  return true;
}
if (require.main === module) {
  const mode = process.argv[2];
  const id = process.env.SOURCE_RUN_ID, sha = process.env.SOURCE_HEAD_SHA;
  if (mode === 'create') {
    fs.mkdirSync('proof', {recursive: true});
    fs.writeFileSync(path.join('proof', 'ci-completion.json'), JSON.stringify(createProof(id, sha)) + '\n');
  } else if (mode === 'verify') {
    const obj = JSON.parse(fs.readFileSync(path.join('incoming', 'ci-completion.json'), 'utf8'));
    verifyProof(obj, id, sha);
    process.stdout.write('Verified trusted follow-up after exact green PR CI.\n');
  } else {throw Error('Expected create or verify');}
}
module.exports = {createProof, verifyProof};
