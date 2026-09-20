'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createRestorationProvider,catalog}=require('../src/studio-restoration.cjs');
function fixture(t,fetchImpl){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-restoration-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return{dir,provider:createRestorationProvider(dir,{fetchImpl})};}
const flames=()=>{const {fileID,fileName,fileExtension,fileSize}=catalog[0];return{slot:5,fileID,fileName,fileExtension,fileSize};};
test('unknown or mismatched skins never trigger restoration downloads',async t=>{let calls=0;const f=fixture(t,async()=>{calls++;throw Error('unexpected');});assert.deepEqual(await f.provider([{...flames(),fileID:'different'},{...flames(),fileSize:1}]),[]);assert.equal(calls,0);});
test('download failure and invalid bytes never authorize replacement',async t=>{const f=fixture(t,async(url,options)=>{assert.equal(url,catalog[0].sourceUrl);assert.equal(options.redirect,'error');return{ok:true,body:(async function*(){yield Buffer.from('invalid');})()};});assert.deepEqual(await f.provider([flames()]),[]);assert.equal(fs.existsSync(path.join(f.dir,'catalog-restoration')),false);});
test('oversized streamed response stops without saving a restoration file',async t=>{let resumed=false;const f=fixture(t,async()=>({ok:true,body:(async function*(){yield Buffer.alloc(catalog[0].fileSize+1);resumed=true;})()}));assert.deepEqual(await f.provider([flames()]),[]);assert.equal(resumed,false);});
