const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {catalog}=require('../src/catalog.cjs');
function fixture({target='desktop',api,slotApi}={}){
 const nodes=new Map(),writes=[],slotWrites=[],feedback=[];
 const element=()=>({hidden:false,value:'',textContent:'',disabled:false,attributes:{},listeners:{},dataset:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},addEventListener(k,fn){this.listeners[k]=fn;},replaceChildren(...items){this.items=items;this.value=items[0]?.value||'';}});
 const el=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 el('widget-type').value='youtubemusic';el('slot-action').value='toggle';
 const buttons=['plugin','widget'].flatMap(scope=>['desktop','web'].map(value=>{const b=element();b.dataset.youtubeMusicTarget=value;b.dataset.youtubeMusicScope=scope;return b;})),notes=['plugin','widget'].map(scope=>{const n=element();n.dataset.youtubeMusicScope=scope;return n;});
 const config={youtubeMusicTarget:target,youtubeMusicSource:'',slots:[{plugin:'youtubemusic',action:'toggle',mediaTarget:'desktop'},{plugin:'youtubemusic',action:'next',mediaTarget:'web'},null,null],widget:{text:'saved text'}};
 const current={desk:{config:structuredClone(config),catalog},youtubeMusic:{available:false}},draft={...structuredClone(config),widget:{text:'unfinished draft'}};
 const companion={
  youtubeMusicTarget:async value=>{writes.push(value);return api?api(value):{desk:{config:{...structuredClone(config),youtubeMusicTarget:value,youtubeMusicSource:''}},youtubeMusic:{available:true},feedback:'Saved widget player'};},
  setSlot:async input=>{slotWrites.push(structuredClone(input));if(slotApi)return slotApi(input);config.slots[input.index]=structuredClone(input.slot);return{desk:{config:structuredClone(config)},feedback:'Saved position'};}
 };
 const context=vm.createContext({structuredClone,window:{companion,SlotAutosave:require('../src/slot-autosave.js'),readTileCustomization:()=>({})},document:{querySelectorAll:selector=>selector==='[data-youtube-music-target]'?buttons:notes},el,draft,deskCurrent:current,selectedPlugin:'youtubemusic',selectedPosition:0,selectedMusicTarget:'desktop',announce:(...args)=>feedback.push(args),youtubeSourceDirty:false,youtubeSourcesKey:'',drawSlots(){},drawLibrary(){},actionHelp(){},task:(_b,fn)=>fn(),option:(value,text)=>({value,text}),renderYoutubeMusic(){vm.runInContext('renderYoutubeMusicTarget(deskCurrent)',context);},drawMusicActions(){vm.runInContext('renderYoutubeMusicTarget(deskCurrent)',context);}});
 const desk=fs.readFileSync(require.resolve('../src/desk.js'),'utf8');
 vm.runInContext(desk.slice(desk.indexOf('const slotSaves='),desk.indexOf("el('run-slot').addEventListener")),context);
 vm.runInContext(desk.slice(desk.indexOf('function drawDetail('),desk.indexOf('function drawMusicActions(')),context);
 const source=fs.readFileSync(require.resolve('../src/release-ui.js'),'utf8');
 vm.runInContext(source.slice(source.indexOf('// Plugin positions own'),source.indexOf('// Keep the optional advanced source')),context);
 context.window.renderYoutubeMusicTarget=()=>vm.runInContext('renderYoutubeMusicTarget(deskCurrent)',context);
 const render=()=>vm.runInContext('renderYoutubeMusicTarget(deskCurrent)',context);render();
 return{context,buttons,notes,el,writes,slotWrites,feedback,render,choose:(value,scope='widget')=>buttons.find(b=>b.dataset.youtubeMusicScope===scope&&b.dataset.youtubeMusicTarget===value).listeners.click(),detail:saved=>{context.input=saved;vm.runInContext('drawDetail(input)',context);}};
}
const pressed=f=>f.buttons.filter(b=>b.attributes['aria-pressed']==='true').map(b=>[b.dataset.youtubeMusicScope,b.dataset.youtubeMusicTarget]);

test('position and widget player choices are independent, and hide outside YouTube Music',()=>{
 const f=fixture({target:'web'});assert.deepEqual(pressed(f),[['plugin','desktop'],['widget','web']]);
 assert.equal(f.el('youtube-music-plugin-target').hidden,false);assert.equal(f.el('youtube-music-widget-target').hidden,false);
 f.context.selectedPlugin='spotify';f.el('widget-type').value='clock';f.render();
 assert.equal(f.el('youtube-music-plugin-target').hidden,true);assert.equal(f.el('youtube-music-widget-target').hidden,true);
});

test('widget Web saves only the widget choice, preserving positions and unfinished fields',async()=>{
 let complete;const gate=new Promise(resolve=>complete=resolve),f=fixture({api:async value=>{await gate;return{desk:{config:{youtubeMusicTarget:value,youtubeMusicSource:'',slots:[],widget:{text:'stale response'}}},youtubeMusic:{available:true},feedback:'Saved widget player'};}});
 const first=f.choose('web');await f.choose('desktop');assert.deepEqual(f.writes,['web']);
 assert.equal(f.buttons.filter(b=>b.dataset.youtubeMusicScope==='widget').every(b=>b.disabled&&b.attributes['aria-busy']==='true'),true);
 assert.equal(f.buttons.filter(b=>b.dataset.youtubeMusicScope==='plugin').every(b=>!b.disabled),true);
 f.context.draft.slots[0].action='next';f.context.draft.widget.text='new unsaved text';complete();await first;
 assert.equal(f.context.draft.youtubeMusicTarget,'web');assert.equal(f.context.draft.slots[0].action,'next');assert.equal(f.context.draft.widget.text,'new unsaved text');
 assert.equal(f.buttons.every(b=>!b.disabled&&!('aria-busy' in b.attributes)),true);
 assert.deepEqual(pressed(f),[['plugin','desktop'],['widget','web']]);assert.match(f.notes[1].textContent,/browser chooses the active media tab/);
 assert.equal(f.feedback.at(-1)[0],'Saved widget player');assert.deepEqual(f.slotWrites,[]);
});

test('changing a position player saves that position immediately without changing the widget or executing playback',async()=>{
 const f=fixture();await f.choose('web','plugin');
 assert.deepEqual(f.slotWrites,[{index:0,slot:{plugin:'youtubemusic',action:'toggle',value:'',mediaTarget:'web'}}]);
 assert.deepEqual(f.writes,[]);assert.equal(f.context.draft.youtubeMusicTarget,'desktop');assert.equal(f.context.draft.slots[1].mediaTarget,'web');
 assert.deepEqual(pressed(f),[['plugin','web'],['widget','desktop']]);assert.match(f.notes[0].textContent,/this position only/);
});

test('saved positions restore their player; a new Music choice takes the widget default',()=>{
 const f=fixture({target:'web'});f.detail({plugin:'youtubemusic',action:'next',mediaTarget:'desktop'});assert.equal(f.context.selectedMusicTarget,'desktop');assert.equal(f.el('slot-action').value,'next');
 f.detail({plugin:'youtubemusic',action:'next',mediaTarget:'web'});assert.equal(f.context.selectedMusicTarget,'web');
 f.detail();assert.equal(f.context.selectedMusicTarget,'web');assert.equal(f.el('slot-action').value,'toggle');
});

test('live polling does not erase an unsaved player choice after a failed position save',async()=>{
 const f=fixture({slotApi:async()=>{throw Error('Disconnected');}});await f.choose('web','plugin');f.render();
 assert.equal(f.context.selectedMusicTarget,'web');assert.equal(f.context.draft.slots[0].mediaTarget,'desktop');assert.equal(f.feedback.at(-1)[1],true);assert.match(f.feedback.at(-1)[0],/not saved/);
});

test('widget target failures retain saved settings, preserve drafts, and allow retry',async()=>{
 let tries=0;const f=fixture({api:async value=>{if(++tries===1)throw Error('Connection unavailable');return{desk:{config:{youtubeMusicTarget:value,youtubeMusicSource:''}},feedback:'Saved widget player'};}});
 await f.choose('web');assert.equal(f.context.draft.youtubeMusicTarget,'desktop');assert.equal(f.context.draft.widget.text,'unfinished draft');assert.deepEqual(f.feedback.at(-1),['Connection unavailable',true]);assert.equal(f.buttons.every(b=>!b.disabled),true);
 await f.choose('web');assert.equal(f.context.draft.youtubeMusicTarget,'web');
});

test('a saved widget choice with a detection error shows its returned error without reverting',async()=>{
 const f=fixture({api:async value=>({desk:{config:{youtubeMusicTarget:value,youtubeMusicSource:''}},error:'Saved; browser playback is unavailable.'})});
 await f.choose('web');assert.equal(f.context.draft.youtubeMusicTarget,'web');assert.deepEqual(f.feedback.at(-1),['Saved; browser playback is unavailable.',true]);
});

test('older Auto config falls back to Desktop in UI and unavailable APIs disable the respective groups',()=>{
 const f=fixture({target:'auto'});delete f.context.window.companion.youtubeMusicTarget;f.render();
 assert.equal(f.context.draft.youtubeMusicTarget,'desktop');assert.equal(f.buttons.filter(b=>b.dataset.youtubeMusicScope==='widget').every(b=>b.disabled),true);assert.equal(f.buttons.filter(b=>b.dataset.youtubeMusicScope==='plugin').every(b=>!b.disabled),true);
 delete f.context.window.companion.setSlot;f.render();assert.equal(f.buttons.every(b=>b.disabled),true);
 const markup=fs.readFileSync(require.resolve('../src/index.html'),'utf8');assert.doesNotMatch(markup,/data-youtube-music-target="auto"/);assert.match(markup,/<p id="youtube-music-plugin-help"[^>]*data-youtube-music-scope="plugin"/);assert.match(markup,/<p id="youtube-music-widget-help"[^>]*data-youtube-music-scope="widget"/);
});


test('playback setup notice appears only for Music above all customization controls',()=>{
 const f=fixture();f.detail();assert.equal(f.el('youtube-music-playback-note').hidden,false);
 f.context.selectedPlugin='spotify';f.detail();assert.equal(f.el('youtube-music-playback-note').hidden,true);
 const markup=fs.readFileSync(require.resolve('../src/index.html'),'utf8');
 const notice=markup.indexOf('id="youtube-music-playback-note"');
 assert.ok(notice>markup.indexOf('id="plugin-detail"'));
 assert.ok(notice<markup.indexOf('id="slot-action"'));assert.ok(notice<markup.indexOf('id="music-actions"'));assert.ok(notice<markup.indexOf('id="youtube-music-plugin-target"'));
 const text=markup.replace(/<[^>]*>/g,'');assert.match(text,/In YouTube Music Desktop · Settings → Playback/);assert.match(text,/In web app · Play a song once/);assert.match(text,/Continue where you left off → On/);assert.match(text,/Pause on application launch → Off/);assert.match(text,/Fully quit → Reopen Desktop/);assert.match(text,/Music may start automatically/);assert.match(text,/Optional settings · Settings → General → Start on boot → On/);assert.match(text,/while playing or paused/);assert.match(text,/Repeat after a browser restart if needed/);assert.doesNotMatch(markup,/youtube-music-desktop-connect|Enable companion authorization|Companion server/);
 assert.deepEqual(f.writes,[]);assert.deepEqual(f.slotWrites,[]);
});
