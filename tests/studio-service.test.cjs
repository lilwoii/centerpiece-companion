const {test}=require('node:test'),assert=require('node:assert/strict');
const {createStudioService}=require('../src/studio-service.cjs');
const Model=require('../studio/model.js');
test('build service forwards only fixed operations and resolves artifacts inside main process',async()=>{
 const calls=[],builder={start:input=>{calls.push(['start',input]);return{id:'known'};},status:id=>{calls.push(['status',id]);return{state:'building'};},cancel:id=>{calls.push(['cancel',id]);return{state:'cancelled'};},artifact:(id,sha)=>{calls.push(['artifact',id,sha]);throw Error('Package mismatch');}};
 const request=createStudioService('unused',{builder}),project=Model.createProject();
 assert.deepEqual(await request('build-start',project),{id:'known'});
 assert.deepEqual(await request('build-status',{id:'known',path:'C:/not-trusted',command:'unsafe'}),{state:'building'});
 assert.deepEqual(await request('build-cancel',{id:'known'}),{state:'cancelled'});
 await assert.rejects(request('build-download',{id:'known',sceneSha256:'expected',path:'C:/not-trusted'}),/Package mismatch/);
 assert.deepEqual(calls.at(-1),['artifact','known','expected']);
 await assert.rejects(request('build-run',{command:'unsafe'}),/not supported/);
});
