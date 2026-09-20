const test=require('node:test'),assert=require('node:assert/strict');
const {Coordinator}=require('../studio/project-loader.js');
function pending(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test('An older create result cannot replace the newer project selection',async()=>{
 const loader=new Coordinator(),a=pending(),commits=[];
 const first=loader.load(()=>a.promise,()=>{},value=>commits.push(value));
 assert.deepEqual(await loader.load(()=>Promise.resolve('B'),()=>{},value=>commits.push(value)),{status:'loaded'});
 a.resolve('A');
 assert.deepEqual(await first,{status:'superseded'});
 assert.deepEqual(commits,['B']);
});
test('A newer selection also supersedes an older pending image preparation',async()=>{
 const loader=new Coordinator(),prepared=pending(),started=pending(),commits=[];
 const first=loader.load(()=>'A',()=>{started.resolve();return prepared.promise;},value=>commits.push(value));
 await started.promise;
 await loader.load(()=>'B',()=>{},value=>commits.push(value));
 prepared.resolve();
 assert.deepEqual(await first,{status:'superseded'});
 assert.deepEqual(commits,['B']);
});
test('Edits, undo or drag changes made during loading keep the current draft',async()=>{
 let revision=1;const loader=new Coordinator(()=>revision),asset=pending(),commits=[];
 const result=loader.load(()=>asset.promise,()=>{},value=>commits.push(value));
 revision++;
 asset.resolve('Incoming project');
 assert.deepEqual(await result,{status:'edited'});
 assert.deepEqual(commits,[]);
});
test('Current errors stay actionable; late errors from replaced loads are ignored',async()=>{
 const loader=new Coordinator(),late=pending();
 await assert.rejects(()=>loader.load(()=>{throw Error('Missing project file');},()=>{},()=>{}),/Missing project file/);
 const result=loader.load(()=>late.promise,()=>{},()=>{});
 await loader.load(()=>'New choice',()=>{},()=>{});
 late.reject(Error('Old request failed'));
 assert.deepEqual(await result,{status:'superseded'});
 await assert.rejects(()=>loader.load(()=>'Project',()=>{throw Error('Image decode failed');},()=>{}),/Image decode failed/);
});
test('An explicit cancellation prevents commit and commit errors are not swallowed',async()=>{
 let revision=1;const loader=new Coordinator(()=>revision),asset=pending();let commits=0;
 const result=loader.load(()=>asset.promise,()=>{},()=>commits++);
 loader.cancel();asset.resolve('Project');
 assert.deepEqual(await result,{status:'superseded'});
 assert.equal(commits,0);
 await assert.rejects(()=>loader.load(()=>'Project',()=>{},()=>{revision++;throw Error('Could not save draft');}),/Could not save draft/);
});
test('Tokens belong to one coordinator and snapshots must still match at commit',async()=>{
 let snapshot='Before';const a=new Coordinator(()=>snapshot),b=new Coordinator(()=>snapshot),token=a.begin();
 assert.equal(a.current(token),true);
 assert.equal(b.current(token),false);
 assert.equal(a.current({...token}),false);
 snapshot='After';assert.equal(a.status(token),'edited');
 a.begin();assert.equal(a.status(token),'superseded');
 assert.throws(()=>new Coordinator(null),/snapshot reader/);
 await assert.rejects(()=>a.load(null,()=>{},()=>{}),/create, prepare and commit/);
});
