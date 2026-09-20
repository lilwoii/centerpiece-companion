const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../src/studio-gallery-ui.js'),M=require('../studio/model.js'),P=require('../studio/presets.js');

test('Studio gallery preserves original Ignition and places new interactive projects first',()=>{
 const value=G.collectionEntries({list:[{id:'reef',name:'Coral reef',style:'Realistic style',create:()=>M.createProject('Reef')}]},P);
 assert.deepEqual(value.map(v=>v.id),['reef','ignition']);
 assert.equal(value[1].original,true);
 assert.equal(value[1].style,'Animated');
 assert.equal(value[0].preview,'../studio/examples/community-collection/previews/reef.png');
});
test('Gallery filters title, description and interactions while preserving collection order',()=>{
 const entries=[{name:'Rocket',description:'Launch',interaction:'Space to ignite',style:'Realistic rocket'}, {name:'Reef',description:'Coral',interaction:'Tap for bubbles',style:'Animated'}];
 assert.equal(G.filterEntries(entries,'space','realistic')[0].name,'Rocket');
 assert.equal(G.filterEntries(entries,'bubbles','all')[0].name,'Reef');
 assert.equal(G.filterEntries(entries,'space','animated').length,0);
 assert.equal(G.filterEntries(entries,'missing').length,0);
 assert.deepEqual(G.filterEntries(entries,'','all'),entries);
});
test('Editable download is validated JSON with a .cpskin extension, never a .pak',async()=>{
 const entry=G.collectionEntries(null,P)[0],file=await G.projectDownload(entry,M);
 assert.equal(file.name,'ignition.cpskin');
 const p=M.validate(JSON.parse(file.text));
 assert.equal(p.canvas.width,1920);
 assert.ok(p.rules.length>0);
 await assert.rejects(()=>G.projectDownload({...entry,create:()=>({})},M));
});
test('Gallery rejects invalid IDs and duplicate entries before constructing local asset paths',async()=>{
 const make=id=>({id,name:'Item',create:()=>M.createProject('Item')});
 assert.deepEqual(G.collectionEntries({list:[make('../outside'),make('valid'),make('valid'),make('http://invalid'),make('other')]},null).map(v=>v.id),['valid','other']);
 await assert.rejects(()=>G.projectDownload(make('../outside'),M));
});
test('Download awaits the full async project and includes artwork instead of the preview fallback',async()=>{
 const image='data:image/png;base64,'+(await require('sharp')({create:{width:10,height:10,channels:4,background:'#9bb9ff'}}).png().toBuffer()).toString('base64');
 let fallbackUsed=false,loaded=false;
 const raw={id:'full-scene',name:'Full scene',create(){fallbackUsed=true;return M.createProject('Preview only');},async createAsync(){await Promise.resolve();loaded=true;const p=M.createProject('Full scene');p.layers.push(M.createLayer('image',{image}));return p;}};
 const entry=G.collectionEntries({list:[raw]},null)[0],file=await G.projectDownload(entry,M),p=M.validate(JSON.parse(file.text));
 assert.equal(loaded,true);
 assert.equal(fallbackUsed,false);
 assert.equal(p.name,'Full scene');
 assert.equal(p.layers.at(-1).image,image);
 assert.equal(file.name,'full-scene.cpskin');
});
test('A failed or invalid full-project load fails clearly without downloading the fallback',async()=>{
 let fallbackUsed=false;
 const entry={id:'failed',create(){fallbackUsed=true;return M.createProject('Preview');},async createAsync(){throw Error('Collection file could not load.');}};
 await assert.rejects(()=>G.projectDownload(entry,M),/could not load/);
 await assert.rejects(()=>G.projectDownload({...entry,createAsync:async()=>({})},M));
 assert.equal(fallbackUsed,false);
});
