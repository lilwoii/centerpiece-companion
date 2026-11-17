const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
function fixture(quitting){let requests=0;const ctx={quitting,connectionRecovery:null,musicCapture:true,musicCaptureAt:0,musicSlot:()=>({plugin:'spotify'}),crashLog:{observe(){}},crashSnapshot(){},state:{},monitor:{status:()=>({})},strip:{setData(){}},desk:{system:{request(){requests++;return Promise.resolve();}},countdown:{view(){}},live:{state:{}},chat:{state:{}}},updateNotes:{view(){}},deskState(){},twitch:null,xpanelSkins:null,community:null,updates:null,navigation:{action:0},win:null};return{ctx,count:()=>requests};}
test('late state updates cannot restart Windows music capture during shutdown',()=>{for(const quitting of [true,false]){const f=fixture(quitting),start=source.indexOf('function send() {'),end=source.indexOf('\nfunction configPath()',start);vm.runInNewContext(source.slice(start,end)+';send();',f.ctx);assert.equal(f.count(),quitting?0:1);}});
test('late music shortcut events cannot restart playback transport during shutdown',async()=>{let requests=0;const ctx={quitting:true,executing:false,musicSlot:()=>({plugin:'spotify'}),media:{request(){requests++;return Promise.resolve();}},armModeTimeout(){},state:{},send(){}};const start=source.indexOf('async function musicNavigation('),end=source.indexOf('\nfunction armModeTimeout',start);vm.runInNewContext(source.slice(start,end),ctx);await ctx.musicNavigation('next');assert.equal(requests,0);assert.equal(ctx.executing,false);ctx.quitting=false;await ctx.musicNavigation('next');assert.equal(requests,1);});

test('live sensor polling cannot restart Windows helper after shutdown begins',async()=>{
 let callback,release,requests=0,obs=0;const sample=new Promise(resolve=>release=resolve);
 const ctx={process:{argv:[]},setInterval(fn){callback=fn;},liveBusy:false,quitting:false,desk:{live:{sample:()=>sample,state:{}},config:{widget:{type:'performance'},extraWidgets:[],slots:[]},system:{request(){requests++;return Promise.resolve('game.exe');}},sampleObs:async()=>{obs++;}},widgetSources:{sample(){},state:{}},state:{},send(){}};
 const start=source.indexOf("    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))liveTimer="),end=source.indexOf("    if(!process.argv.includes('--verify'))lockTimer=",start);assert.ok(start>=0&&end>start);vm.runInNewContext(source.slice(start,end),ctx);
 const pending=callback();ctx.quitting=true;release();await pending;assert.equal(requests,0);assert.equal(obs,0);assert.equal(ctx.liveBusy,false);ctx.quitting=false;await callback();assert.equal(requests,1);assert.equal(obs,1);
});


test('configuration import cannot save or restart sleep after shutdown during either dialog',async()=>{
 for(const pause of ['file','confirm','none']){
  let handler,release;const events=[];const gate=new Promise(r=>release=r);
  const ctx={handle:(_name,fn)=>handler=fn,require:()=>({read:()=>{events.push('read');return{sleepMinutes:10};}}),desk:{validate:x=>x,save:()=>events.push('save')},dialog:{showOpenDialog:async()=>{if(pause==='file')await gate;return{filePaths:['mock.json']};},showMessageBox:async()=>{if(pause==='confirm')await gate;return{response:1};}},win:{},profiles:{data:{enabled:false}},cancelSleepStartup(){},leaveMode(){},updateNavigation(){},send(){},youtubeMusic:{},sleepService:{configure:async()=>events.push('configure')},syncAppearance:async()=>{},quitting:false};
  const start=source.indexOf("    handle('config-backup'"),end=source.indexOf("    handle('test-display-sleep'",start);vm.runInNewContext(source.slice(start,end),ctx);
  const importing=handler('import');await new Promise(r=>setImmediate(r));
  if(pause!=='none'){ctx.quitting=true;release();await assert.rejects(importing,/closing/);assert.equal(events.includes('save'),false);assert.equal(events.includes('configure'),false);if(pause==='file')assert.deepEqual(events,[]);}
  else{await importing;assert.deepEqual(events,['read','save','configure']);}
 }
});


test('startup continuations cannot restart shortcuts or collectors after quitting',async()=>{
 for(const pause of ['page','device','media','none']){
  let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r),events=[];
  const wait=async name=>{events.push(name);if(name===pause){entered();await gate;}};
  const ctx={quitting:false,keyboardOperation:fn=>fn(),win:{loadFile:()=>wait('page')},path:{join:()=>''},__dirname:'',globalShortcut:{register:()=>{events.push('shortcut');return true;}},widgetCycle:{},desk:{},state:{},enterMode(){},inspectDevice:async()=>{await wait('device');return{};},refresh:()=>wait('media'),process:{argv:[]},community:{refresh:async()=>{}},xpanelSkins:{refresh:async()=>{}},twitch:{restore:async()=>{}},send(){},setTimeout:()=>({unref(){}}),setInterval:()=>({unref(){}}),MediaPoll:class{start(){events.push('poll');}},refreshMusicBee(){},refreshYoutube(){},youtubeMusic:{start(){events.push('youtube');}}};
  const start=source.indexOf('    await win.loadFile('),end=source.indexOf('    if(desk.config.sleepMinutes!==null',start);const starting=vm.runInNewContext('(async()=>{'+source.slice(start,end)+'})()',ctx);
  if(pause!=='none'){await ready;ctx.quitting=true;events.push('quit');release();await starting;assert.deepEqual(events.slice(events.indexOf('quit')+1),[]);}
  else{await starting;assert.equal(events.filter(e=>e==='poll').length,3);assert.equal(events.filter(e=>e==='youtube').length,1);assert.equal(events.filter(e=>e==='shortcut').length,3);}
 }
});

test('widget weather setup does not save or upload after shutdown across awaited sources',async()=>{
 for(const phase of ['location','weather']){
  let handler,release,saves=0,uploads=0;const wait=new Promise(r=>release=r),ctx={quitting:false,handle(n,fn){handler=fn;},leaveMode(){},desk:{config:{widget:{type:'clock'},extraWidgets:[],weather:{location:phase==='weather'?{name:'Test'}:null}},save(c){saves++;this.config=c;},system:{request:()=>wait},live:{weather:()=>wait}},require:()=>({includeWidget:()=>[]}),widgetSources:{sample(){}},state:{strip:true},displayTasks:{run:fn=>fn()},strip:{config:{},setWidget(){},async refreshLive(){uploads++;}},send(){}};
  const start=source.indexOf("    handle('save-widget',"),end=source.indexOf("    handle('save-desk',",start);vm.runInNewContext(source.slice(start,end),ctx);const pending=handler({type:'weather'});ctx.quitting=true;release({name:'Test'});await pending;assert.equal(uploads,0);assert.equal(saves,phase==='weather'?1:0);
 }
});

test('a superseded sleep native failure cannot roll back the newest requested timer',async()=>{
 const {SleepService}=require('../src/sleep-service.cjs');let native=10,tail=Promise.resolve(),rejectOld,enteredOld;const entered=new Promise(r=>enteredOld=r),writes=[];
 const service=new SleepService({run(fn){const task=tail.then(fn);tail=task.catch(()=>{});return task;},onError(){},createSom:()=>({identity:'mock',async screenTimeout(value){if(value===undefined)return native;writes.push(value);if(value===15){enteredOld();await new Promise((_,reject)=>rejectOld=reject);}native=value;},close(){}}),setEnabled:async()=>{},every:()=>({unref(){}}),cancel(){}});await service.configure(10);
 let handler;const ctx={quitting:false,sleepRequestRevision:0,desk:{config:{sleepMinutes:10},save(c){this.config=c;}},sleepService:service,cancelSleepStartup(){},handle(_n,fn){handler=fn;},send(){},state:{}};
 const start=source.indexOf("    handle('set-display-sleep',"),end=source.indexOf('\n',start);vm.runInNewContext(source.slice(start,end),ctx);
 const first=handler(15).catch(e=>e);await entered;const second=handler(30);rejectOld(Error('native transfer failure'));const [error]=await Promise.all([first,second]);
 assert.equal(error.code,'SLEEP_CONFIGURATION_CANCELLED');assert.deepEqual(writes,[10,15,30]);assert.equal(native,30);assert.equal(ctx.desk.config.sleepMinutes,30);assert.equal(service.status().minutes,30);await service.close();
});

test('sleep setting persistence failure still restores previous timer, but stale failures never do',async()=>{
 for(const newer of [false,true]){
  let handler,rejectOld;const calls=[];const ctx={quitting:false,sleepRequestRevision:0,desk:{config:{sleepMinutes:10},save(c){if(!newer&&c.sleepMinutes===15)throw Error('disk full');this.config=c;}},sleepService:{configure(value){calls.push(value);return newer&&value===15?new Promise((_,reject)=>rejectOld=reject):Promise.resolve();}},cancelSleepStartup(){},handle(_n,fn){handler=fn;},send(){},state:{}};
  const start=source.indexOf("    handle('set-display-sleep',"),end=source.indexOf('\n',start);vm.runInNewContext(source.slice(start,end),ctx);
  if(newer){const old=handler(15).catch(e=>e);rejectOld(Error('late native error'));const latest=handler(30);await Promise.all([old,latest]);assert.deepEqual(calls,[15,30]);assert.equal(ctx.desk.config.sleepMinutes,30);}
  else{await assert.rejects(handler(15),/disk full/);assert.deepEqual(calls,[15,10]);assert.equal(ctx.desk.config.sleepMinutes,10);}
 }
});

test('a newer sleep request arriving before an older success continuation owns persistence',async()=>{
 let handler,resolveOld;const saved=[];const ctx={quitting:false,sleepRequestRevision:0,desk:{config:{sleepMinutes:10},save(c){saved.push(c.sleepMinutes);this.config=c;}},sleepService:{configure(value){return value===15?new Promise(resolve=>resolveOld=resolve):Promise.resolve();}},cancelSleepStartup(){},handle(_n,fn){handler=fn;},send(){},state:{}};
 const start=source.indexOf("    handle('set-display-sleep',"),end=source.indexOf('\n',start);vm.runInNewContext(source.slice(start,end),ctx);const old=handler(15);resolveOld();const latest=handler(30);await Promise.all([old,latest]);assert.deepEqual(saved,[30]);
});

test('malformed shortcut backups keep startup usable and preserve original files',()=>{
 const os=require('node:os'),shortcut=require('../src/plugin-shortcuts.cjs');
 for(const content of ['{broken',JSON.stringify({settings:null}),JSON.stringify({settings:{custom:true,position:55}})]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shortcut-startup-'));try{const file=path.join(dir,'plugin-shortcuts.json');fs.writeFileSync(file,content);let paused=0;const original={custom:false,position:26,engineRecovery:true,hideLegendsShortcut:true};const ctx={hardwareDirectory:dir,desk:{config:{pluginShortcuts:{...original}}},state:{},suspendAutomaticSetup(){paused++;},require:n=>n==='./plugin-shortcuts.cjs'?shortcut:require('../src/'+n.slice(2))};
  const marker='state.youtubeMusic=youtubeMusic.view();',start=source.indexOf(marker,source.indexOf('desk=new Workspace'))+marker.length,end=source.indexOf('monitor.pluginPosition=',start);vm.runInNewContext(source.slice(start,end),ctx);
  assert.equal(paused,1);assert.match(ctx.state.deviceError,/preserved|untouched/i);assert.match(ctx.state.deviceError,/crash report/i);assert.deepEqual(ctx.desk.config.pluginShortcuts,original);assert.equal(fs.readFileSync(file,'utf8'),content);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
});

test('healthy or absent shortcut backups retain normal startup behavior',()=>{
 const os=require('node:os'),shortcut=require('../src/plugin-shortcuts.cjs');
 for(const record of [null,{settings:{custom:true,position:27,engineRecovery:true,hideLegendsShortcut:true}}]){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shortcut-startup-ok-'));try{if(record)fs.writeFileSync(path.join(dir,'plugin-shortcuts.json'),JSON.stringify(record));let paused=0;const ctx={hardwareDirectory:dir,desk:{config:{pluginShortcuts:{position:26}}},state:{},suspendAutomaticSetup(){paused++;},require:n=>n==='./plugin-shortcuts.cjs'?shortcut:require('../src/'+n.slice(2))};const marker='state.youtubeMusic=youtubeMusic.view();',start=source.indexOf(marker,source.indexOf('desk=new Workspace'))+marker.length,end=source.indexOf('monitor.pluginPosition=',start);vm.runInNewContext(source.slice(start,end),ctx);assert.equal(paused,0);assert.equal(ctx.state.setupFailure,undefined);assert.equal(ctx.desk.config.pluginShortcuts.position,record?27:26);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
});


test('late weather location during full settings save cannot restart work after Quit',async()=>{
 let handler,release;const events=[],wait=new Promise(r=>release=r),ctx={quitting:false,handle(_name,fn){handler=fn;},leaveMode(){},desk:{config:{weather:{location:null}},save(){events.push('save');},system:{request:()=>wait},live:{weather:async()=>events.push('weather')}},updateNavigation(){events.push('navigate');},syncAppearance:async()=>events.push('apply'),state:{},send(){}};
 const start=source.indexOf("    handle('save-desk',"),end=source.indexOf("    handle('set-slot',",start);vm.runInNewContext(source.slice(start,end),ctx);const pending=handler({widget:{type:'weather'},weather:{location:null}});ctx.quitting=true;release({name:'Test'});await pending;assert.deepEqual(events,[]);
});
test('queued key appearance cannot save or upload after Quit begins',async()=>{
 let handler,release;const events=[],wait=new Promise(r=>release=r),ctx={quitting:false,handle(_name,fn){handler=fn;},require:n=>n==='./key-tuning.cjs'?{selection:x=>x}:{normalize:x=>x},desk:{config:{keyAppearance:{}},save(){events.push('save');}},displayTasks:{run:fn=>wait.then(fn)},strip:{apply:async()=>events.push('apply')},state:{strip:true},send(){}};
 const start=source.indexOf("    handle('save-key-appearance',"),end=source.indexOf('    let telemetryBusy=',start);vm.runInNewContext(source.slice(start,end),ctx);const pending=handler({keys:[33],layer:0,style:{color:'#00ff00'}});ctx.quitting=true;release();await pending;assert.deepEqual(events,[]);
});


test('language apply and rollback preserve unrelated settings saved during capture',async()=>{
 for(const fail of [false,true]){
  let handler,release,entered,attempt=0;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
  const ctx={quitting:false,handle(_name,fn){handler=fn;},require:()=>({map:async id=>({id})}),state:{strip:true},desk:{config:{languageId:'qwerty',physicalLanguage:false,widget:{type:'clock'}},validate:c=>c,save(c){this.config=c;}},strip:{legends:{model:null},languageDefault:{capture:async()=>{entered();await gate;}},som:{language:async()=>0}},displayTasks:{run:fn=>fn()},send(){},syncAppearance:async()=>{if(fail&&!attempt++)throw Error('apply failed');ctx.appliedAppearance=JSON.stringify(ctx.desk.config);}};
  const start=source.indexOf("    handle('set-language',"),end=source.indexOf("    handle('language-settings',",start);vm.runInNewContext(source.slice(start,end),ctx);
  const applying=handler('00000809'),result=fail?assert.rejects(applying,/apply failed/):applying;await ready;ctx.desk.config={...ctx.desk.config,widget:{type:'spotify'}};release();await result;
  assert.equal(ctx.desk.config.widget.type,'spotify');assert.equal(ctx.desk.config.languageId,fail?'qwerty':'00000809');
 }
});


test('late screenshot-folder and widget-source dialogs cannot restart helpers or save after Quit',async()=>{
 for(const name of ['choose-screenshot-folder','pick-widget-source'])for(const canceled of [false,true])for(const quitting of [false,true]){
  const handlers={},calls=[];let release;const ctx={quitting:false,handle:(n,fn)=>handlers[n]=fn,path,dialog:{showOpenDialog:()=>new Promise(r=>release=r)},desk:{system:{request:async(...args)=>calls.push(args)}},widgetSources:{config:{},view:()=>({}),save:()=>calls.push(['save'])}};
  const start=source.indexOf("    handle('pick-widget-source',"),end=source.indexOf("    handle('set-language',",start);vm.runInNewContext(source.slice(start,end),ctx);
  const pending=handlers[name]('game');ctx.quitting=quitting;release({canceled,filePaths:['game.exe']});
  if(quitting){await assert.rejects(pending,/closing/);assert.deepEqual(calls,[]);assert.equal(ctx.widgetSources.game,undefined);}
  else{await pending;assert.equal(calls.length,name==='choose-screenshot-folder'||!canceled?1:0);}
 }
});
