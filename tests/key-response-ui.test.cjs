const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

// Small event-capable DOM fixture: exercise editor state transitions without USB.
function fixture(file,{keys,read,save,travel=false,watchResult,unsubscribeResult}={}){
 const nodes=new Map(),handlers=new Map(),events=[],calls=[],feedback=[],sections=[],docEvents=new Map();
 let context,now=1000,travelHandler,keyQueries=0,textWrites=0,domWrites=0;const watchCalls=[],intervals=new Map(),windowEvents=new Map(),subscribers=[];
 function element(){const listeners=new Map(),attrs={},selectors=new Map(),classes=new Set();let content='',hidden=false,disabled=false;return{
  value:'',checked:false,get disabled(){return disabled;},set disabled(value){disabled=value;domWrites++;},get hidden(){return hidden;},set hidden(value){hidden=value;domWrites++;},get textContent(){return content;},set textContent(value){content=value;textWrites++;domWrites++;},placeholder:'',style:new Proxy({},{set(target,key,value){target[key]=value;domWrites++;return true;}}),dataset:{},children:[],parentElement:{},classList:{toggle(name,value){domWrites++;if(value)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
  get validity(){const n=Number(this.value),min=Number(this.min),max=Number(this.max),step=Number(this.step);return{valid:this.value!==''&&Number.isFinite(n)&&n>=min&&n<=max&&Math.abs(n/step-Math.round(n/step))<1e-8};},
  set innerHTML(html){this.html=html;for(const match of html.matchAll(/<(input|select|button|output|p|div)[^>]*\bid="([^"]+)"[^>]*>/g)){const e=el(match[2]);for(const attr of ['value','min','max','step']){const m=match[0].match(new RegExp('\\b'+attr+'="([^"]*)"'));if(m)e[attr]=m[1];}e.disabled=/\bdisabled/.test(match[0]);e.checked=/\bchecked/.test(match[0]);if(match[1]==='select'){const tail=html.slice(match.index+match[0].length),first=tail.match(/<option value="([^"]*)"/);if(first)e.value=first[1];}}},
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},
  dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);return true;},
  async fire(name){for(const fn of listeners.get(name)||[])await fn({type:name,target:this});},
  setAttribute(k,v){attrs[k]=v;domWrites++;},removeAttribute(k){delete attrs[k];domWrites++;},hasAttribute:k=>k in attrs,
  append(child){this.children.push(child);domWrites++;},before(){},after(){},closest(){return{hidden:false};},remove(){domWrites++;},
  querySelector(selector){if(selector==='.key-depth')return this.children.find(e=>e.className==='key-depth');if(!selectors.has(selector))selectors.set(selector,Object.assign(element(),{open:true}));return selectors.get(selector);},
  querySelectorAll(selector){if(selector==='[data-key-group]')return groupButtons;if(selector==='[data-depth]')return presets;if(selector.includes('.response-controls'))return[...nodes.entries()].filter(([id])=>/^(group-(actuation|sensitivity|rapid)|change-)/.test(id)).map(([,e])=>e).concat(presets);if(selector==='.key'){keyQueries++;return keyboard;}return[];}
 };}
 function el(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);}
 const groupButtons=['wasd','arrows','modifiers','all','clear'].map(name=>Object.assign(element(),{dataset:{keyGroup:name}}));
 const presets=['0.5','2','3'].map(depth=>Object.assign(element(),{dataset:{depth}}));
 const keyboard=Array.from({length:68},(_,i)=>Object.assign(element(),{dataset:{position:String(i)}}));
 el('key-layer').value='0';
 const keymap={layers:[{id:0,keys:Array.from({length:68},(_,i)=>({name:'Key '+i,binding:{behaviorId:i===0?29795:50397,param1:0}}))}]};
 const tuning={profile:0,keys:keys||Array.from({length:68},()=>({actuation:2,sensitivity:.2,rapidTrigger:false}))};
 const document={querySelector:()=>null,hidden:false,focused:true,hasFocus(){return this.focused;},createElement(){const node=element();sections.push(node);return node;},addEventListener(type,fn){if(!docEvents.has(type))docEvents.set(type,[]);docEvents.get(type).push(fn);},dispatchEvent(event){events.push(event.type);for(const fn of docEvents.get(event.type)||[])fn(event);}};
 const companion={subscribe:fn=>subscribers.push(fn),readKeyTuning:async()=>read?read():structuredClone(tuning),saveKeyTuning:async patch=>{calls.push(structuredClone(patch));if(save)return save(patch);for(const i of patch.keys)for(const key of ['actuation','sensitivity','rapidTrigger'])if(patch[key]!==undefined)tuning.keys[i][key]=patch[key];return structuredClone(tuning);},changeKey:async patch=>{calls.push(structuredClone(patch));const next=structuredClone(context.keymap);next.layers[0].keys[0].binding={behaviorId:50397,param1:patch.value};return next;},undoKey:async()=>{calls.push('undo');return structuredClone(keymap);}};
 if(travel){companion.onKeyTravel=fn=>{travelHandler=fn;return unsubscribeResult===undefined?()=>travelHandler=null:unsubscribeResult;};companion.setKeyTravelWatching=async enabled=>{watchCalls.push(enabled);return watchResult;};}
 const window={companion,addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,[]);windowEvents.get(type).push(fn);}};
 context=vm.createContext({document,Event,Date:class extends Date{static now(){return now;}},setInterval:fn=>{const id=intervals.size+1;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),location:{hash:'#keyboard'},el,window,keymap:structuredClone(keymap),selectedKey:32,deskBusy:false,draft:{keyAppearance:{}},deskCurrent:{desk:{config:{}}},selectedLayer:()=>context.keymap.layers[0],drawKeyboard(){},announce:message=>feedback.push(message),bind:(id,fn)=>handlers.set(id,fn)});
 vm.runInContext(fs.readFileSync(require.resolve('../src/'+file),'utf8'),context);
 async function action(id){context.deskBusy=true;try{return await handlers.get(id)();}finally{context.deskBusy=false;document.dispatchEvent(new Event('companion-task-finished'));}}
 return{el,context,calls,feedback,events,sections,action,watchCalls,intervals,keyboard,counts:()=>({keyQueries,textWrites,domWrites}),state:()=>subscribers.forEach(fn=>fn({})),travel:sample=>travelHandler?.({position:33,depthMm:1.2,pressed:false,at:now,...sample}),advance(ms){now+=ms;for(const fn of intervals.values())fn();},windowEvent(type){for(const fn of windowEvents.get(type)||[])fn();},group:async name=>groupButtons.find(b=>b.dataset.keyGroup===name).fire('click'),edit:async(id,value)=>{el(id).value=String(value);await el(id).fire('input');},select:async(id,value)=>{el(id).value=value;await el(id).fire('change');}};
}

test('mixed actuation is preserved when changing only rapid trigger sensitivity',async()=>{
 const keys=Array.from({length:68},(_,i)=>({actuation:i===18?.5:2,sensitivity:.2,rapidTrigger:i===18})),f=fixture('key-groups-ui.js',{keys});
 await f.action('read-key-tuning');await f.group('wasd');assert.equal(f.el('group-actuation').value,'');assert.equal(f.el('actuation-value').textContent,'Mixed');
 await f.edit('group-sensitivity',.4);assert.equal(f.el('apply-key-tuning').disabled,false);await f.action('apply-key-tuning');
 assert.deepEqual(f.calls,[{keys:[18,33,34,35],sensitivity:.4}]);assert.equal(f.el('group-actuation').value,'');assert.equal(f.el('group-actuation').disabled,false);assert.equal(f.el('apply-key-tuning').disabled,true);
});

test('leaving group selection loads the single key and discards unsaved group edits',async()=>{
 const f=fixture('key-groups-ui.js');await f.action('read-key-tuning');await f.group('wasd');await f.edit('group-actuation',.5);
 f.el('key-multiple').checked=false;await f.el('key-multiple').fire('change');
 assert.equal(Number(f.el('group-actuation').value),2);assert.equal(f.el('change-actuation').checked,false);assert.equal(f.el('apply-key-tuning').disabled,true);
 await f.edit('group-actuation',1.2);await f.action('apply-key-tuning');assert.deepEqual(f.calls,[{keys:[32],actuation:1.2}]);
});

test('unsupported actuation and fractional steps disable saving without device writes',async()=>{
 const f=fixture('key-groups-ui.js');await f.action('read-key-tuning');for(const value of ['0.1','0.25','4','']){await f.edit('group-actuation',value);assert.equal(f.el('apply-key-tuning').disabled,true);assert.match(f.el('response-validation').textContent,/0.2–3.9/);}assert.deepEqual(f.calls,[]);
 await f.edit('group-actuation',.2);assert.equal(f.el('apply-key-tuning').disabled,false);await f.action('apply-key-tuning');assert.equal(f.calls[0].actuation,.2);
});

test('a failed settings read disables save and clears stale key depth badges',async()=>{
 let failed=false;const f=fixture('key-groups-ui.js',{read:()=>{if(failed)throw Error('Disconnected');return{profile:0,keys:Array.from({length:68},()=>({actuation:2,sensitivity:.2,rapidTrigger:false}))};}});
 await f.action('read-key-tuning');await f.edit('group-actuation',1);failed=true;await assert.rejects(f.action('read-key-tuning'),/Disconnected/);
 assert.equal(f.el('group-actuation').disabled,true);assert.equal(f.el('apply-key-tuning').disabled,true);assert.equal(f.el('actuation-value').textContent,'Load settings');assert.deepEqual(f.calls,[]);
});

test('Task Manager repair is opt-in, edits only base Esc, and supports guarded undo',async()=>{
 const f=fixture('task-manager-shortcut-ui.js');assert.deepEqual(f.calls,[]);assert.equal(f.el('standard-escape').disabled,false);
 await f.action('standard-escape');assert.deepEqual(f.calls,[{layer:0,position:0,value:0x70029,mods:0,swap:null}]);assert.equal(f.el('standard-escape').disabled,true);assert.equal(f.el('undo-standard-escape').disabled,false);
 await f.action('undo-standard-escape');assert.deepEqual(f.calls[1],'undo');assert.equal(f.el('standard-escape').disabled,false);assert.equal(f.el('undo-standard-escape').disabled,true);
});

test('Task Manager repair cannot undo over a subsequently changed keymap',async()=>{
 const f=fixture('task-manager-shortcut-ui.js');await f.action('standard-escape');f.context.keymap.layers[0].keys[5].binding.param1=123;
 await assert.rejects(f.action('undo-standard-escape'),/Another binding changed/);assert.equal(f.calls.length,1);assert.equal(f.el('undo-standard-escape').disabled,true);
});

test('live meter shows the actual reported key without changing selection or unsaved edits',async()=>{
 const f=fixture('key-groups-ui.js',{travel:true});await f.action('read-key-tuning');await f.edit('group-actuation',.5);f.travel({position:18,depthMm:2.7,pressed:true});
 assert.equal(f.el('live-travel-key').textContent,'Key 18');assert.equal(f.el('live-travel-depth').textContent,'2.7 mm');assert.equal(f.el('live-travel-marker').style.transform,'scaleY(0.675)');assert.equal(f.el('actuation-marker').textContent,'SAVED 2.0 mm');
 assert.equal(f.el('group-actuation').value,'0.5');assert.equal(f.context.selectedKey,32);assert.deepEqual(f.calls,[]);assert.deepEqual(f.watchCalls,[true]);
});

test('stale live samples become waiting instead of a fabricated released depth',()=>{
 const f=fixture('key-groups-ui.js',{travel:true});f.travel();assert.equal(f.el('live-travel-marker').hidden,false);f.advance(1600);
 assert.equal(f.el('live-travel-marker').hidden,true);assert.equal(f.el('live-travel-depth').textContent,'— mm');assert.match(f.el('live-travel-status').textContent,/Waiting for a fresh/);
 f.travel({depthMm:6});assert.equal(f.el('live-travel-depth').textContent,'— mm');
});

test('live travel stops off the editor or when unfocused, without retaining background polling',()=>{
 const f=fixture('key-groups-ui.js',{travel:true});assert.equal(f.intervals.size,1);f.context.document.focused=false;f.windowEvent('blur');assert.equal(f.intervals.size,0);assert.deepEqual(f.watchCalls,[true,false]);f.travel();assert.equal(f.el('live-travel-marker').hidden,true);
 f.context.document.focused=true;f.windowEvent('focus');assert.equal(f.intervals.size,1);f.context.location.hash='#community';f.windowEvent('hashchange');assert.equal(f.intervals.size,0);assert.deepEqual(f.watchCalls,[true,false,true,false]);
});

test('disconnection clears the physical meter until a new real sample arrives',()=>{
 const f=fixture('key-groups-ui.js',{travel:true});f.travel({depthMm:3.4});f.travel({unavailable:true});f.advance(500);
 assert.equal(f.el('live-travel-marker').hidden,true);assert.match(f.el('live-travel-status').textContent,/unavailable/);assert.equal(f.el('live-travel-depth').textContent,'— mm');
 f.travel({position:35,depthMm:.6,pressed:false});assert.equal(f.el('live-travel-depth').textContent,'0.6 mm');assert.equal(f.el('live-travel-key').textContent,'Key 35');assert.deepEqual(f.watchCalls,[true]);
});

test('UI-only preview reports unavailable without fabricating motion or leaving a timer running',async()=>{
 const f=fixture('key-groups-ui.js',{travel:true,watchResult:{enabled:false,connected:false},unsubscribeResult:{}});await Promise.resolve();
 assert.equal(f.intervals.size,0);assert.match(f.el('live-travel-status').textContent,/unavailable/);assert.equal(f.el('live-travel-depth').textContent,'— mm');f.travel({depthMm:2});assert.equal(f.el('live-travel-depth').textContent,'— mm');assert.doesNotThrow(()=>f.windowEvent('beforeunload'));
});

test('an armed disconnected desktop meter can resume without another watch request',async()=>{
 const f=fixture('key-groups-ui.js',{travel:true,watchResult:{enabled:true,connected:false}});await Promise.resolve();
 assert.match(f.el('live-travel-status').textContent,/unavailable/);assert.equal(f.intervals.size,1);f.travel({depthMm:.9});assert.equal(f.el('live-travel-depth').textContent,'0.9 mm');assert.deepEqual(f.watchCalls,[true]);
});

test('rapid trigger meter shows firmware reset while pressed and trigger while released',async()=>{
 const keys=Array.from({length:68},()=>({actuation:2,sensitivity:.2,rapidTrigger:true})),f=fixture('key-groups-ui.js',{travel:true,keys});await f.action('read-key-tuning');
 f.travel({pressed:true,depthMm:2.4,rtPressMm:2.8,rtReleaseMm:2.2});assert.equal(f.el('actuation-marker').textContent,'RESET 2.2 mm');assert.ok(Math.abs(parseFloat(f.el('actuation-marker').style.top)-55)<.001);
 f.travel({pressed:false,depthMm:2,rtPressMm:2.3,rtReleaseMm:1.8});assert.equal(f.el('actuation-marker').textContent,'TRIGGER 2.3 mm');
 f.travel({rtPressMm:NaN,rtReleaseMm:8});assert.equal(f.el('actuation-marker').textContent,'SAVED 2.0 mm');assert.match(f.el('live-travel-settings').textContent,/Live RT threshold unavailable/);assert.deepEqual(f.calls,[]);
});

test('actuation badges can be hidden instantly without clearing response settings',async()=>{
 const f=fixture('key-groups-ui.js');await f.action('read-key-tuning');assert.equal(f.el('show-key-depth').checked,true);assert.equal(f.el('keyboard-map').classList.contains('show-key-depths'),true);assert.equal(f.keyboard[32].querySelector('.key-depth').textContent,'2.0 mm');
 const before=f.counts().keyQueries;f.el('show-key-depth').checked=false;await f.el('show-key-depth').fire('change');assert.equal(f.el('keyboard-map').classList.contains('show-key-depths'),false);assert.equal(f.counts().keyQueries,before);assert.equal(Number(f.el('group-actuation').value),2);
 await f.edit('group-actuation',1.1);await f.action('apply-key-tuning');assert.equal(f.keyboard[32].querySelector('.key-depth').textContent,'1.1 mm');assert.equal(f.el('keyboard-map').classList.contains('show-key-depths'),false);
 f.el('show-key-depth').checked=true;await f.el('show-key-depth').fire('change');assert.equal(f.el('keyboard-map').classList.contains('show-key-depths'),true);
});

test('unrelated app state and slider drags do not traverse or repaint keyboard keys',async()=>{
 const f=fixture('key-groups-ui.js');await f.action('read-key-tuning');const before=f.counts();for(let i=0;i<100;i++)f.state();assert.deepEqual(f.counts(),before);
 for(let i=2;i<=30;i++)await f.edit('group-actuation',(i/10).toFixed(1));assert.equal(f.counts().keyQueries,before.keyQueries);assert.deepEqual(f.calls,[]);
});

test('green meter fills directly from real depth and does not repaint duplicate samples',()=>{
 const f=fixture('key-groups-ui.js',{travel:true});f.travel({depthMm:4,pressed:true});assert.equal(f.el('live-travel-marker').style.transform,'scaleY(1)');const before=f.counts();
 for(let i=0;i<100;i++){f.advance(100);f.travel({depthMm:4,pressed:true});}assert.deepEqual(f.counts(),before);
 f.travel({depthMm:0,pressed:false});assert.equal(f.el('live-travel-marker').style.transform,'scaleY(0)');assert.equal(f.el('live-travel-depth').textContent,'0.0 mm');assert.equal(f.el('live-travel-state').textContent,'Released');
});

test('lightweight key selection updates selected response values and preserves existing badge nodes',async()=>{
 const keys=Array.from({length:68},(_,i)=>({actuation:i===18?.6:2,sensitivity:.2,rapidTrigger:false})),f=fixture('key-groups-ui.js',{keys});await f.action('read-key-tuning');const badges=f.keyboard.map(key=>key.querySelector('.key-depth')),before=f.counts();
 f.context.selectedKey=18;const event=new Event('companion-key-selected',{cancelable:true});f.context.document.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(Number(f.el('group-actuation').value),.6);assert.match(f.el('key-group-count').textContent,/Key 18/);
 assert.deepEqual(f.keyboard.map(key=>key.querySelector('.key-depth')),badges);assert.ok(f.counts().domWrites-before.domWrites<60,'Selection should update only the changed highlights and controls');assert.deepEqual(f.calls,[]);
});

test('live meter processes changing samples synchronously without traversing keys',t=>{
 const {performance}=require('node:perf_hooks'),f=fixture('key-groups-ui.js',{travel:true}),before=f.counts().keyQueries,count=10000,start=performance.now();
 for(let i=0;i<count;i++)f.travel({depthMm:(i%41)/10,pressed:(i%41)>=20});const elapsed=performance.now()-start;
 assert.equal(f.el('live-travel-depth').textContent,(((count-1)%41)/10).toFixed(1)+' mm');assert.equal(f.counts().keyQueries,before);assert.deepEqual(f.calls,[]);t.diagnostic('Synthetic DOM fixture: '+count+' changing samples in '+elapsed.toFixed(1)+' ms ('+(elapsed/count).toFixed(4)+' ms/sample). Not a hardware latency measurement.');
});
