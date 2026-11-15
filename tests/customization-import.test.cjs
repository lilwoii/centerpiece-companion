const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,{files:[{size:100,type:'image/png'}],value:'',addEventListener(type,fn){this[type]=fn;}});return nodes.get(id);};
 let finish,closed=0;const c=vm.createContext({revision:1,tileRevision:1,selectedPosition:0,selectedPlugin:'musicbee',tileIcon:'old tile',hintIcon:'old hint',el,createImageBitmap:()=>new Promise(resolve=>finish=resolve),document:{createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=> 'converted'})},set(){},syncContentFields(){},announce(){}});
 const source=fs.readFileSync(require.resolve('../src/customization-ui.js'),'utf8');vm.runInContext(source.slice(source.indexOf(' const importRevisions='),source.indexOf(' const mediaPanel=')),c);
 return {c,el,finish(){finish({width:128,height:128,close(){closed++;}});},closed:()=>closed};
}
test('pending bottom hint image import cannot overwrite a newly loaded profile',async()=>{
 const f=fixture(),pending=f.el('hint-file').change();f.c.revision=2;f.c.hintIcon='new profile hint';f.finish();await pending;assert.equal(f.c.hintIcon,'new profile hint');assert.equal(f.closed(),1);
});
test('pending plugin image import cannot follow selection to another slot',async()=>{
 const f=fixture(),pending=f.el('tile-file').change();f.c.selectedPosition=1;f.c.tileIcon='other tile';f.finish();await pending;assert.equal(f.c.tileIcon,'other tile');assert.equal(f.closed(),1);
});
test('current hint and plugin image imports still convert normally',async()=>{
 for(const prefix of ['hint','tile']){const f=fixture(),pending=f.el(prefix+'-file').change();f.finish();await pending;assert.equal(f.c[prefix+'Icon'],'converted');assert.equal(f.closed(),1);}
});
