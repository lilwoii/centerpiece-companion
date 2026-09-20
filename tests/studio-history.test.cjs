const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Model=require('../studio/model.js'),{History,MAX_BYTES}=require('../studio/history.js'),Storage=require('../studio/storage.js');
const project=name=>Model.createProject(name);
const named=(original,name)=>({...Model.clone(original),name});
const bytes=value=>new TextEncoder().encode(JSON.stringify(Model.validate(value))).length;
function memoryStorage(){const values=new Map();let failure=null,writes=0;return{values,get writes(){return writes;},fail(error){failure=error;},getItem:key=>values.has(key)?values.get(key):null,setItem(key,value){writes++;if(failure)throw failure;values.set(key,value);}};}

test('undo history keeps caller input and returned snapshots independent',()=>{
 const original=project('Original'),history=new History(original);
 original.name='Mutated input';assert.equal(history.current.name,'Original');
 const current=history.current;current.name='Mutated output';current.layers.push({bad:true});assert.equal(history.current.name,'Original');assert.equal(history.current.layers.length,0);
 const saved=history.commit(named(history.current,'Second'));saved.name='Changed return';assert.equal(history.current.name,'Second');
 assert.equal(history.canUndo,true);assert.equal(history.canRedo,false);
 assert.equal(history.undo().name,'Original');assert.equal(history.canRedo,true);
 assert.equal(history.redo().name,'Second');assert.equal(history.redo().name,'Second');
});

test('duplicate commits retain redo while real edits start a new branch',()=>{
 const a=project('A'),history=new History(a);history.commit(named(a,'B'));history.commit(named(a,'C'));history.undo();
 history.commit(history.current);assert.equal(history.canRedo,true);assert.equal(history.redo().name,'C');history.undo();
 history.commit(named(a,'D'));assert.equal(history.canRedo,false);assert.equal(history.undo().name,'B');assert.equal(history.undo().name,'A');assert.equal(history.canUndo,false);
});

test('history bounds entry count and serialized bytes independently',()=>{
 const original=project('A'),countLimited=new History(original,{maxEntries:3});
 for(const name of ['B','C','D'])countLimited.commit(named(original,name));
 assert.equal(countLimited.undo().name,'C');assert.equal(countLimited.undo().name,'B');assert.equal(countLimited.canUndo,false);
 const byteLimited=new History(original,{maxBytes:bytes(original)*2});
 byteLimited.commit(named(original,'B'));byteLimited.commit(named(original,'C'));
 assert.equal(byteLimited.undo().name,'B');assert.equal(byteLimited.canUndo,false);
});

test('invalid and oversized edits are atomic and do not destroy redo',()=>{
 const original=project('A'),history=new History(original,{maxBytes:bytes(original)*3});history.commit(named(original,'B'));history.undo();
 assert.throws(()=>history.commit({...original,format:'untrusted'}));assert.equal(history.current.name,'A');assert.equal(history.canRedo,true);
 assert.throws(()=>history.reset({...original,version:-1}));assert.equal(history.canRedo,true);
 assert.throws(()=>history.commit({...original,description:'x'.repeat(2000)}),/too large for undo history/);assert.equal(history.current.name,'A');assert.equal(history.redo().name,'B');
 history.reset(named(original,'Reset'));assert.equal(history.current.name,'Reset');assert.equal(history.canUndo,false);assert.equal(history.canRedo,false);
});

test('history counts UTF-8 text toward its byte budget and validates limits',()=>{
 const original=project('A'),longName=named(original,'雪'.repeat(120)),limit=bytes(original)+200;
 assert.ok(bytes(longName)>limit);const history=new History(original,{maxBytes:limit});assert.throws(()=>history.commit(longName),/too large/);assert.equal(history.current.name,'A');
 for(const options of [{maxEntries:1},{maxEntries:Infinity},{maxBytes:0},{maxBytes:MAX_BYTES+1}])assert.throws(()=>new History(original,options),/Invalid Skin Studio history/);
});

test('local draft saves one validated snapshot under its own key',()=>{
 const storage=memoryStorage();storage.values.set('unrelated-setting','keep');assert.equal(Storage.load(storage),null);
 const original=project('Autosaved'),saved=Storage.save(storage,original);original.name='Changed after save';saved.name='Changed normalized return';
 assert.equal(storage.writes,1);assert.equal(Storage.load(storage).name,'Autosaved');assert.equal(storage.values.get('unrelated-setting'),'keep');
 Storage.save(storage,project('Other'),'skin-studio-test');assert.equal(Storage.load(storage,'skin-studio-test').name,'Other');assert.equal(Storage.load(storage).name,'Autosaved');
});

test('quota and unavailable-storage errors preserve the previous draft without cleanup writes',()=>{
 const storage=memoryStorage();Storage.save(storage,project('Preserved'));const previous=storage.values.get(Storage.DEFAULT_KEY);
 storage.fail(Object.assign(new Error('full'),{name:'QuotaExceededError'}));assert.throws(()=>Storage.save(storage,project('Rejected')),error=>error.code==='STUDIO_DRAFT_QUOTA'&&/Save project/.test(error.message));assert.equal(storage.values.get(Storage.DEFAULT_KEY),previous);assert.equal(storage.writes,2);
 storage.fail(Object.assign(new Error('blocked'),{name:'SecurityError'}));assert.throws(()=>Storage.save(storage,project('Rejected again')),error=>error.code==='STUDIO_DRAFT_UNAVAILABLE');assert.equal(storage.values.get(Storage.DEFAULT_KEY),previous);assert.equal(Storage.load(storage).name,'Preserved');
 assert.throws(()=>Storage.load({getItem(){throw Error('blocked');}}),error=>error.code==='STUDIO_DRAFT_UNAVAILABLE'&&/No saved draft was removed/.test(error.message));
});

test('invalid saved or imported projects are retained for manual recovery',()=>{
 const storage=memoryStorage();Storage.save(storage,project('Preserved'));const previous=storage.values.get(Storage.DEFAULT_KEY);
 assert.throws(()=>Storage.save(storage,{format:'other'}),error=>error.code==='STUDIO_DRAFT_INVALID_PROJECT');assert.equal(storage.writes,1);assert.equal(storage.values.get(Storage.DEFAULT_KEY),previous);
 for(const text of ['{bad json',JSON.stringify({...project('Wrong version'),version:999})]){
  storage.values.set(Storage.DEFAULT_KEY,text);assert.throws(()=>Storage.load(storage),error=>error.code==='STUDIO_DRAFT_INVALID');assert.equal(storage.values.get(Storage.DEFAULT_KEY),text);
 }
});

test('local draft load refuses oversized text before parsing and rejects remote/SVG assets',()=>{
 const storage=memoryStorage(),oversized=' '.repeat(Storage.MAX_BYTES+1);storage.values.set(Storage.DEFAULT_KEY,oversized);
 assert.throws(()=>Storage.load(storage),error=>error.code==='STUDIO_DRAFT_TOO_LARGE');assert.equal(storage.values.get(Storage.DEFAULT_KEY),oversized);
 for(const image of ['https://example.com/image.png','data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=']){
  const p=project('Invalid image');p.layers=[Model.createLayer('image')];p.layers[0].image=image;const text=JSON.stringify(p);storage.values.set(Storage.DEFAULT_KEY,text);
  assert.throws(()=>Storage.load(storage),error=>error.code==='STUDIO_DRAFT_INVALID');assert.equal(storage.values.get(Storage.DEFAULT_KEY),text);
 }
});

test('UMD modules expose the same isolated browser API with no Node integration',()=>{
 const browser={StudioModel:Model,TextEncoder};vm.createContext(browser);
 for(const file of ['history.js','storage.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../studio',file),'utf8'),browser,{filename:file});
 const original=project('Browser'),history=new browser.StudioHistory.History(original),storage=memoryStorage();
 history.commit(named(original,'Browser edit'));assert.equal(history.undo().name,'Browser');browser.StudioStorage.save(storage,history.current);assert.equal(browser.StudioStorage.load(storage).name,'Browser');
 assert.equal(browser.require,undefined);assert.equal(browser.module,undefined);
});
