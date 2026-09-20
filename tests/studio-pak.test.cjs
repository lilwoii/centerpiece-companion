const {test}=require('node:test'),assert=require('node:assert/strict'),{contentPaths}=require('../src/studio-pak.cjs');
test('native content validation combines the Unreal mount point and relative index paths',()=>{
 const base={version:11,encryptedIndex:false,unsafePaths:[],mountPoint:'../../../spark/Content/',paths:['map/M_EntryPoint.umap','Companion/Material.uexp']};
 assert.deepEqual(contentPaths(base),base.paths);
 assert.deepEqual(contentPaths({...base,mountPoint:'../../../',paths:base.paths.map(p=>'spark/Content/'+p)}),base.paths);
 for(const mountPoint of ['../../../Engine/','../../../../spark/Content/','C:/','../../../other/Content/'])assert.equal(contentPaths({...base,mountPoint}),null);
 for(const extra of ['../Engine/a.uasset','Config/a.ini','Companion/a.dll','/map/test.umap','Companion/../../x.uasset'])assert.equal(contentPaths({...base,paths:[...base.paths,extra]}),null);
 assert.equal(contentPaths({...base,paths:['Companion/a.uasset']}),null);
});
