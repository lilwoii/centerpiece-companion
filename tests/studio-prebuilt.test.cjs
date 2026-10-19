const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {StudioPrebuilt}=require('../src/studio-prebuilt.cjs');
function setup(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-bundled-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bytes=Buffer.alloc(300,7),entry={id:crypto.randomUUID(),projectName:'Test',sceneSha256:'a'.repeat(64),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length,validationRevision:5,createdAt:1};
 fs.writeFileSync(path.join(root,entry.id+'.pak'),bytes);fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({format:1,entries:[entry]}));
 const inspect=()=>({version:11,mountPoint:'../../../spark/Content/',paths:['map/M_EntryPoint.umap'],unsafePaths:[],encryptedIndex:false});
 return{root,entry,library:new StudioPrebuilt(root,{inspect})};
}
test('bundled skins match only their exact scene without engine tools or device access',t=>{
 const {library,entry}=setup(t);assert.equal(library.latest(entry.sceneSha256).bundled,true);assert.equal(library.latest('b'.repeat(64)),null);assert.equal(library.latest(),null);
 const artifact=library.artifact(entry.id,entry.sceneSha256);assert.equal(artifact.cooked,true);assert.equal(artifact.deviceVerified,false);
 assert.throws(()=>library.artifact(entry.id,'b'.repeat(64)),/does not match/);assert.throws(()=>library.artifact('../other',entry.sceneSha256));
});
test('changed package bytes are rejected even when their size is unchanged',t=>{
 const {library,entry,root}=setup(t);fs.writeFileSync(path.join(root,entry.id+'.pak'),Buffer.alloc(300,8));assert.throws(()=>library.latest(entry.sceneSha256),/integrity/);
});
test('bundled package content must pass the same native entry-map check',t=>{
 const {root,entry}=setup(t);const library=new StudioPrebuilt(root,{inspect:()=>({version:11,paths:['other.umap']})});assert.throws(()=>library.artifact(entry.id,entry.sceneSha256),/integrity/);
});
test('all shipped bundles match their normalized editable sources and actual package checksums',()=>{
 const library=new StudioPrebuilt(),M=require('../studio/model.js');const expected=[...require('../studio/collection-presets.js').list,...require('../studio/presets.js').list,...require('../studio/pond-presets.js').list,...require('../studio/photo-presets.js').list].map(p=>p.id);assert.deepEqual([...library.entries.values()].map(e=>e.collectionId).sort(),[...new Set(expected)].sort());
 for(const entry of library.entries.values()){
  const project=M.validate(JSON.parse(fs.readFileSync(path.join(__dirname,'../studio/examples/community-collection',entry.collectionId+'.cpskin'),'utf8')));
  const hash=crypto.createHash('sha256').update(JSON.stringify(project,null,2)+'\n').digest('hex');assert.equal(hash,entry.sceneSha256);assert.equal(library.latest(hash).state,'ready');
 }
});
test('service resolves included builds without invoking the native toolchain',async()=>{
 const library=new StudioPrebuilt(),entry=[...library.entries.values()][0];
 const builder={latest:()=>null,start:()=>{throw Error('Must not compile');}};
 const request=require('../src/studio-service.cjs').createStudioService('unused',{builder,prebuilt:library});
 const found=await request('build-latest',{sceneSha256:entry.sceneSha256});assert.equal(found.id,entry.id);
 assert.equal((await request('build-status',{id:found.id})).bundled,true);
 assert.equal((await request('build-download',{id:found.id,sceneSha256:entry.sceneSha256})).length,entry.size);
 assert.equal(await request('build-latest',{sceneSha256:'f'.repeat(64)}),null);
});

test('corrected bundled packages supersede older local copies of the same scene',async()=>{
 const library=new StudioPrebuilt(),entry=[...library.entries.values()][0];
 let local={id:'local',state:'ready',createdAt:entry.createdAt-1};
 const request=require('../src/studio-service.cjs').createStudioService('unused',{prebuilt:library,builder:{latest:()=>local}});
 assert.equal((await request('build-latest',{sceneSha256:entry.sceneSha256})).id,entry.id);
 local={...local,createdAt:entry.createdAt+1};assert.equal((await request('build-latest',{sceneSha256:entry.sceneSha256})).id,'local');
 local={...local,state:'building',createdAt:0};assert.equal((await request('build-latest',{sceneSha256:entry.sceneSha256})).id,'local');
});
test('gallery retains the entire collection and newly-created basic presets contain native triggers',()=>{
 const presets=require('../studio/presets.js'),collection=require('../studio/collection-presets.js'),gallery=require('../src/studio-gallery-ui.js');
 assert.equal(gallery.collectionEntries(collection,presets).length,26);
 for(const preset of presets.list)assert.equal(preset.create().rules.some(r=>r.trigger==='beat'),false,preset.id);
});
