import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

for (const workflowName of ['ios-v1-1-testflight.yml', 'ios-v1-3-testflight.yml', 'ios-v1-4-testflight.yml', 'ios-v1-5-testflight.yml', 'ios-v1-6-testflight.yml', 'ios-v1-7-testflight.yml']) {
const workflow = readFileSync(new URL('../.github/workflows/' + workflowName, import.meta.url), 'utf8');
const script = workflow.match(/          script: \|\n([\s\S]*?)\n\n  archive:/)[1].split('\n').map(line => line.slice(12)).join('\n');
const execute = new (Object.getPrototypeOf(async function(){}).constructor)('github', 'context', 'core', 'setTimeout', script);
const sha = 'candidate';
const baseRuns = [
 {id:1,name:'Earnly automated tests',head_branch:'main',event:'push',status:'completed',conclusion:'success'},
 {id:2,name:'Earnly iOS native build',head_branch:'main',event:'push',status:'completed',conclusion:'success'},
 {id:3,name:'Publish Earnly Pages after QA',head_branch:'main',event:'workflow_run',status:'completed',conclusion:'success'},
];
async function run({runs=baseRuns,jobs={3:'success'},main=sha}={}) {
 const messages=[];
 const github={rest:{actions:{
  listWorkflowRunsForRepo:async args=>{assert.equal(args.head_sha,sha);return {data:{workflow_runs:runs}};},
  listJobsForWorkflowRun:async ({run_id})=>({data:{jobs:[{name:'publish',status:'completed',conclusion:jobs[run_id]}]}}),
 },repos:{getBranch:async()=>({data:{commit:{sha:main}}})}}};
 await execute(github,{repo:{owner:'owner',repo:'repo'},sha},{info:message=>messages.push(message)},fn=>fn());
 return messages;
}
test('requires successful QA, native build and an actual publication',async()=>{
 assert.match((await run()).at(-1),/All release gates passed/);
});
test('a green wrapper with a skipped publication never unlocks upload',async()=>{
 await assert.rejects(run({jobs:{3:'skipped'}}),/did not finish/);
});
test('ignores skipped wrappers when a real publication succeeded',async()=>{
 assert.match((await run({runs:[{...baseRuns[2],id:4},...baseRuns],jobs:{4:'skipped',3:'success'}})).at(-1),/All release gates passed/);
});
test('failed QA prevents upload',async()=>{
 await assert.rejects(run({runs:baseRuns.map(r=>r.id===1?{...r,conclusion:'failure'}:r)}),/Upload blocked/);
});
test('a failed publication prevents upload',async()=>{
 await assert.rejects(run({jobs:{3:'failure'}}),/Upload blocked/);
});
test('a newer main commit prevents uploading a stale candidate',async()=>{
 await assert.rejects(run({main:'newer'}),/Newer main/);
});
test('an explicitly dispatched native build can satisfy the native gate',async()=>{
 assert.match((await run({runs:baseRuns.map(r=>r.id===2?{...r,event:'workflow_dispatch'}:r)})).at(-1),/All release gates passed/);
});
test('PR-only QA cannot substitute for main push QA',async()=>{
 await assert.rejects(run({runs:baseRuns.map(r=>r.id===1?{...r,event:'pull_request'}:r)}),/did not finish/);
});

}

for(const name of ['ios-v1-1-testflight.yml','ios-v1-3-testflight.yml', 'ios-v1-4-testflight.yml', 'ios-v1-5-testflight.yml', 'ios-v1-6-testflight.yml', 'ios-v1-7-testflight.yml','upload-ios-review.yml']){
 test(name+' requires explicit manual Apple upload confirmation',()=>{
  const source=readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
  const triggers=source.slice(source.indexOf('\non:'),source.indexOf('\npermissions:'));
  assert.doesNotMatch(triggers,/\n  (push|pull_request|workflow_run):/);
  assert.match(triggers,/confirm_apple_upload:[\s\S]*default: false/);
  assert.match(source,/if: \$\{\{ github.event_name == 'workflow_dispatch' && inputs.confirm_apple_upload == true \}\}/);
 });
}
