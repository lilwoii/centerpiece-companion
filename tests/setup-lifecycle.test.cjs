const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DisplayTasks } = require('../src/display-tasks.cjs');

// Evaluate only the coordination functions with fake services. Loading the main
// module would open Electron, accounts and HID, which these tests must never do.
const source = fs.readFileSync(require.resolve('../src/main.cjs'), 'utf8');
function section(from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'Main-process coordination entry points must exist.');
  return source.slice(start, end);
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

function fixture({ shortcuts = async () => ({position:26,engineRecovery:true}), sample = async () => {}, appearance = async () => {}, inspect = async () => ({ keyboard: true, display: true }), connect = () => true, start, prepare, commit, restore = async()=>{}, setupRecord = () => ({present:false}) } = {}) {
  const events = [], handlers = {}, state = { device: {}, strip: false }, context = {
    Promise, Error, state,updates:{install(){events.push('install');}},widgetSources:{close(){events.push("widget-sources-close");}},sleepService:null,fs:{existsSync:()=>false},path:require("node:path"),leaveMode(){}, setupBusy: false, setupPlan: null, setupFinished: Promise.resolve(), setupReview: null,
    quitting: false, keyboardOperations:new Set(), automaticSetupSuspended: false, automaticCheckBusy: false, automaticSetupTimer: 1,
    connectionTimer:null,recoveryVerified:false,connectionRecovery:null,profileTimer: null, timer: null, stripTimer: null, lockTimer: null, liveTimer: null, modeTimeout: null,
    hardwareDirectory: 'test-only', widgetShortcutReady: true, appliedAppearance: '',shortcutHealth:new(require('../src/shortcut-health.cjs').ShortcutHealth)(),
    clearInterval() { events.push('clear-timer'); }, clearTimeout() {},
    desk: {config:{},save(config){this.config=config;}, editor: { busy: false }, live: { sample }, close() { assert.equal(state.setupRunning, false); events.push('desk-close'); } },
    strip: { detach(){events.push('detach');},connect() { events.push('connect'); return connect(); }, async close() { events.push('strip-close'); } },
    monitor: {status(){return{connected:events.lastIndexOf('monitor-start')>events.lastIndexOf('monitor-close')};}, start() { events.push('monitor-start'); }, close() { events.push('monitor-close'); } },
    media: { close() { events.push('media-close'); } }, mediaPoll: null, youtubeMusicPoll: null, youtubePoll:null,musicBeePoll:null,musicBee:{close(){}},youtube:{close(){events.push('youtube-close');}}, youtubeMusic: {close(){events.push('youtube-music-close');}}, community: null, twitch: null, widgetCycle: null,
    globalShortcut: { unregisterAll() { events.push('unregister'); } },
    displayTasks: new DisplayTasks({}), syncAppearance: async () => { events.push('appearance'); return appearance(); },
    send() {}, handle(name, fn) { handlers[name] = fn; }, inspectDevice: inspect,
    win: { isVisible: () => true, isMinimized: () => false, webContents: { send() { events.push('review-event'); } } },
    automaticSetup: { canAttempt: () => true, async run({ eligible, setup }) { if (!eligible) return { attempted: false }; events.push('automatic-attempt'); return { attempted: true, result: await setup() }; } },
    require(name) {
      if (name === './setup.cjs') return {restore:async()=>{events.push('restore');return restore();}};
      if (name === './setup-report.cjs') return {setupRecord};
      if (name === './keyboard-errors.cjs') return require('../src/keyboard-errors.cjs');
      if (name === './plugin-shortcuts.cjs') return {configureStartup:async()=>({settings:await shortcuts(),warning:''})};
      if (name === './hid.cjs') return { async shutdown() { events.push('hid-close'); } };
      if (name === './setup-transaction.cjs') return {prepareSetup:prepare,commitSetup:commit, startSetup: start || (async () => ({ needsConfirmation: true, plan: { id: 'review', pending: true, map: { layers: [] }, ownedSlots: [3, 4], preservedSlots: [2] } })) };
      throw Error('Unexpected dependency: ' + name);
    }
  };
  vm.createContext(context);
  const suspension = section('function suspendAutomaticSetup()', '\nconst updateNotes');
  const operations = section('    const setupReview=plan=>', "    handle('change-key'");
  const discovery = section("    handle('update-install'", "    handle('action'");
  const cleanup = section("    quitting=true;clearInterval(connectionTimer);clearInterval(automaticSetupTimer);", "  },()=>app.quit(),error=>");
  vm.runInContext(suspension + '\n' + operations + '\n' + discovery + '\nthis.lifecycle={setupOperation,recoverKeyboardConnection,cleanup:async()=>{' + cleanup + '}};', context);
  return { context, events, handlers, state, ...context.lifecycle };
}

test('quit waits for the setup transaction and never starts display initialization afterward', async () => {
  const transaction = deferred(), f = fixture();
  const setup = f.setupOperation(() => transaction.promise, true);
  const quit = f.cleanup();
  assert.equal(f.events.includes('desk-close'), false);
  transaction.resolve({ verified: true });
  await Promise.all([setup, quit]);
  assert.equal(f.events.includes('connect'), false);
  assert.equal(f.events.includes('monitor-start'), false);
  assert.ok(f.events.indexOf('desk-close') < f.events.indexOf('hid-close'));
  await assert.rejects(f.setupOperation(async () => assert.fail('No setup after Quit.'), true), /companion is closing/);
});

test('quit during recovery-shortcut installation waits without reopening the display',async()=>{
 const reached=deferred(),done=deferred(),f=fixture({shortcuts:()=>{reached.resolve();return done.promise;}});
 const setup=f.setupOperation(async()=>({verified:true}),true);await reached.promise;const quit=f.cleanup();
 done.resolve({position:26,engineRecovery:true});await Promise.all([setup,quit]);assert.equal(f.events.includes('connect'),false);
});

test('quit during the live sample waits and does not queue display initialization', async () => {
  const reached = deferred(), sample = deferred(), f = fixture({ sample: () => { reached.resolve(); return sample.promise; } });
  const setup = f.setupOperation(async () => ({ verified: true }), true);
  await reached.promise;
  const quit = f.cleanup();
  assert.equal(f.events.includes('desk-close'), false);
  sample.resolve();
  await Promise.all([setup, quit]);
  assert.equal(f.events.includes('appearance'), false);
  assert.equal(f.events.includes('monitor-start'), false);
});

test('quit during display initialization waits for completion without restarting monitoring', async () => {
  const reached = deferred(), appearance = deferred(), f = fixture({ appearance: () => { reached.resolve(); return appearance.promise; } });
  const setup = f.setupOperation(async () => ({ verified: true }), true);
  await reached.promise;
  const quit = f.cleanup();
  assert.equal(f.events.includes('desk-close'), false);
  appearance.resolve();
  await Promise.all([setup, quit]);
  assert.equal(f.events.includes('monitor-start'), false);
  assert.ok(f.events.includes('strip-close'));
});

test('failed setup also releases the shutdown completion barrier', async () => {
  const transaction = deferred(), f = fixture(), failure = Error('Save failed');
  const setup = f.setupOperation(async () => { await transaction.promise; throw failure; }, true);
  const rejected = assert.rejects(setup, error => error === failure), quit = f.cleanup();
  transaction.resolve();
  await Promise.all([rejected, quit]);
  assert.ok(f.events.includes('hid-close'));
});

test('automatic reconnect does not run during an existing settings review', async()=>{const f=fixture({inspect:async()=>assert.fail('must not inspect')});f.state.setupRecovery={token:'existing'};await f.recoverKeyboardConnection();assert.equal(f.state.setupRecovery.token,'existing');assert.equal(f.events.includes('hid-close'),false);});
test('automatic reconnect clears stale USB helper before discovery and preserves pending settings for review',async()=>{const f=fixture();await f.recoverKeyboardConnection();assert.ok(f.events.indexOf('detach')<f.events.indexOf('hid-close'));assert.equal(f.state.setupRecovery.token,'review');assert.equal(f.events.includes('connect'),false);assert.equal(f.events.includes('review-event'),true);assert.equal(f.state.connectionRecovering,false);});
test('quit during reconnect discovery never starts setup writes',async()=>{const d=deferred(),f=fixture({inspect:()=>d.promise,start:async()=>assert.fail('No writes after quit')});const work=f.recoverKeyboardConnection();await new Promise(r=>setImmediate(r));const quit=f.cleanup();d.resolve({keyboard:true,display:true});await assert.rejects(work,/closing/);await quit;assert.equal(f.events.includes('connect'),false);});
test('reconnect reloads display and monitor after verified setup',async()=>{const f=fixture({start:async()=>({backup:{verified:true}})});await f.recoverKeyboardConnection();assert.equal(f.state.strip,true);assert.equal(f.context.recoveryVerified,true);assert.ok(f.events.includes('appearance'));assert.ok(f.events.includes('monitor-start'));assert.deepEqual(f.context.shortcutHealth.view().map(e=>e.kind),['recovery-start','recovery-complete']);});

for(const returnsFalse of [false,true])test('verified setup retries a display-open '+(returnsFalse?'refusal':'failure')+' without claiming readiness',async()=>{
 const f=fixture({connect:()=>{if(returnsFalse)return false;throw Error('Display disappeared while opening');}});
 await assert.rejects(f.setupOperation(async()=>({verified:true}),true),error=>{
  assert.equal(error.code,'KEYBOARD_DISPLAY_INITIALIZATION_FAILED');assert.equal(error.configurationVerified,true);assert.equal(error.writesAttempted,true);
  assert.equal(require('../src/connection-recovery.cjs').retryable(error),true);return true;
 });
 assert.equal(f.state.strip,false);assert.equal(f.context.appliedAppearance,'');assert.equal(f.events.includes('monitor-start'),false);assert.equal(f.context.recoveryVerified,false);
});


test('manual recovery uses automatic slot selection while retaining settings confirmation',async()=>{
 for(const approval of [false,true,'true']){
  let prepareOptions,commitOptions;const f=fixture({prepare:async(_dir,options)=>{prepareOptions=options;return{id:'slots',pending:true,map:{layers:[]},ownedSlots:[9,10],preservedSlots:[2,3,4,5,6,7,8],replacementSlots:[10,9]};},commit:async(_dir,_plan,options)=>{commitOptions=options;if(!options.acceptOverlayReplacement)throw Error('Overlay approval required');return{verified:true};}});
  const review=await f.handlers['prepare-setup-recovery']();assert.equal(prepareOptions.reviewOccupied,true);assert.deepEqual(Array.from(review.replacementSlots),[10,9]);assert.equal(f.events.includes('connect'),false);
  await f.handlers['confirm-setup-recovery']('slots',approval);
  assert.equal(commitOptions.acceptOverlayReplacement,true);assert.equal(commitOptions.acceptPending,true);
 }
});


test('canceling a prepared recovery retains a fresh-review action without reusing the old token',async()=>{
 let prepared=0;const f=fixture({prepare:async()=>({id:'review-'+(++prepared),pending:true,map:{layers:[]},ownedSlots:[9,10],preservedSlots:[],replacementSlots:[9,10]})});
 f.state.setupFailure={code:'KEYBOARD_OVERLAY_SPACE_REQUIRED',canRecover:true};
 const first=await f.handlers['prepare-setup-recovery']();assert.equal(f.state.setupFailure,null);assert.equal(f.state.setupReviewAvailable,true);
 await f.handlers['cancel-setup-recovery']();assert.equal(f.state.setupRecovery,null);assert.equal(f.context.setupPlan,null);assert.equal(f.state.setupReviewAvailable,true);assert.equal(f.context.automaticSetupSuspended,true);
 const next=await f.handlers['prepare-setup-recovery']();assert.notEqual(next.token,first.token);assert.equal(f.events.includes('connect'),false);
});

test('fresh review stays available only for safe pre-write review failures',async()=>{
 for(const [code,writesAttempted,expected]of [['KEYBOARD_CONFIGURATION_CHANGED',false,true],['SETUP_REVIEW_EXPIRED',false,true],['KEYBOARD_CONFIGURATION_CHANGED',true,false],['KEYBOARD_SAVE_FAILED',true,false],['SETUP_BACKUP_UNREADABLE',false,false]]){
  const f=fixture();f.state.setupReviewAvailable=true;
  await assert.rejects(f.setupOperation(async()=>{throw Object.assign(Error('test failure'),{code,writesAttempted});}));assert.equal(f.state.setupReviewAvailable,expected,code+' / '+writesAttempted);
  await f.handlers['cancel-setup-recovery']();assert.equal(f.state.setupReviewAvailable,expected);
 }
});

test('successful recovery clears the retained manual review action',async()=>{
 const f=fixture();f.state.setupReviewAvailable=true;await f.setupOperation(async()=>({verified:true}),true);assert.equal(f.state.setupReviewAvailable,false);assert.equal(f.state.strip,true);
});


test('a stale review token offers a fresh review instead of stranding setup',async()=>{
 const f=fixture();await assert.rejects(f.handlers['confirm-setup-recovery']('expired'),error=>error.code==='SETUP_REVIEW_EXPIRED');assert.equal(f.state.setupReviewAvailable,true);assert.equal(f.state.setupRunning,false);
});


test('failed save retains a read-only fresh review without automatically retrying mutations',async()=>{
 let prepared=0,commits=0,incomplete=false;
 const f=fixture({setupRecord:()=>({present:true,readable:true,setupInProgress:incomplete}),
  prepare:async()=>({id:'review-'+(++prepared),pending:false,prior:incomplete?{setupInProgress:true}:null,map:{layers:[]},ownedSlots:[9,10],preservedSlots:[2,3,4,5,6,7,8]}),
  commit:async()=>{commits++;incomplete=true;throw Object.assign(Error('Save rejected'),{code:'KEYBOARD_SAVE_FAILED',writesAttempted:true});}});
 const first=await f.handlers['prepare-setup-recovery']();
 await assert.rejects(f.handlers['confirm-setup-recovery'](first.token),error=>error.code==='KEYBOARD_SAVE_FAILED');
 assert.equal(f.state.setupRecovery,null);assert.equal(f.context.setupPlan,null);assert.equal(f.state.setupFailure.canRecover,false);assert.equal(f.state.setupReviewAvailable,true);
 await f.handlers['cancel-setup-recovery']();assert.equal(f.state.setupReviewAvailable,true);
 const next=await f.handlers['prepare-setup-recovery']();assert.notEqual(next.token,first.token);assert.equal(next.retryIncomplete,true);
 assert.equal(commits,1);assert.equal(f.context.automaticSetupSuspended,true);assert.equal(f.events.includes('connect'),false);
});


test('only explicit Save shortcut authorizes interrupted optional shortcut recovery',async()=>{
 const calls=[],handlers={},state={},config={pluginShortcuts:{position:26}};
 const context={state,hardwareDirectory:'test-only',desk:{config,save(value){this.config=value;}},monitor:{},appliedAppearance:'before',leaveMode(){},send(){},syncAppearance:async()=>{},setupOperation:async action=>action(),handle(name,handler){handlers[name]=handler;},require(name){assert.equal(name,'./plugin-shortcuts.cjs');return{configure:async(...args)=>{calls.push(args);return{position:33};},label:()=> 'L1 + A'};}};
 vm.runInNewContext(section("    handle('set-plugin-shortcuts'","    handle('copy-setup-report'"),context);
 await handlers['set-plugin-shortcuts']({custom:true,position:33});
 assert.equal(calls.length,1);assert.equal(calls[0][2].recoverInterrupted,true);assert.equal(context.monitor.pluginPosition,33);assert.equal(state.shortcutWarning,'');
});


test('Restore waits for queued display work and a status read before closing the transport',async()=>{
 const f=fixture(),gate=deferred();f.state.strip=true;f.context.displayTasks.cache=f.context.strip;
 const preceding=f.context.displayTasks.run(()=>gate.promise);
 await Promise.resolve();f.context.strip.watching=true;
 const restoring=f.handlers['restore-keyboard']();
 assert.equal(f.state.setupRunning,true);assert.equal(f.events.includes('strip-close'),false);
 gate.resolve();await preceding;await new Promise(r=>setTimeout(r,25));
 assert.equal(f.events.includes('strip-close'),false);assert.equal(f.events.includes('restore'),false);
 f.context.strip.watching=false;await restoring;
 assert.ok(f.events.indexOf('strip-close')<f.events.indexOf('restore'));assert.equal(f.state.strip,false);assert.equal(f.state.setupRunning,false);assert.equal(f.context.displayTasks.pending,0);
});

test('Restore refuses concurrent editor/setup work and retains shutdown barrier on failure',async()=>{
 for(const busy of ['setup','editor']){
  const f=fixture();if(busy==='setup')f.context.setupBusy=true;else f.context.desk.editor.busy=true;
  await assert.rejects(f.handlers['restore-keyboard'](),/current keyboard operation/);assert.equal(f.events.includes('strip-close'),false);assert.equal(f.events.includes('restore'),false);
 }
 const gate=deferred(),f=fixture({restore:async()=>{await gate.promise;throw Error('restore failed');}});
 const restoring=f.handlers['restore-keyboard'](),rejected=assert.rejects(restoring,/restore failed/);await new Promise(r=>setImmediate(r));
 const quitting=f.cleanup();assert.equal(f.events.includes('desk-close'),false);
 gate.resolve();await Promise.all([rejected,quitting]);assert.equal(f.state.setupRunning,false);assert.equal(f.events.includes('desk-close'),true);assert.equal(f.context.displayTasks.pending,0);
});


test('update installation waits for queued native skin work before closing the display',async()=>{
 const f=fixture(),transfer=deferred();f.state.strip=true;
 const native=f.context.displayTasks.run(async()=>{f.events.push('native-start');await transfer.promise;f.events.push('native-end');});
 await Promise.resolve();const install=f.handlers['update-install']();await Promise.resolve();assert.equal(f.events.includes('strip-close'),false);assert.equal(f.events.includes('install'),false);
 transfer.resolve();await Promise.all([native,install]);assert.ok(f.events.indexOf('native-end')<f.events.indexOf('strip-close'));assert.ok(f.events.indexOf('strip-close')<f.events.indexOf('install'));assert.equal(f.state.strip,false);
});

test('quitting before or during update cleanup prevents launching the installer',async()=>{
 const before=fixture();before.context.quitting=true;await assert.rejects(before.handlers['update-install'](),/closing/);assert.equal(before.events.includes('install'),false);
 const f=fixture(),closed=deferred();f.context.strip.close=async()=>{f.events.push('strip-close');await closed.promise;};
 const install=f.handlers['update-install']();await new Promise(setImmediate);f.context.quitting=true;closed.resolve();await install;assert.equal(f.events.includes('install'),false);
});

test('failed update cleanup cannot launch the installer, and installer-triggered quit drains normally',async()=>{
 const failed=fixture();failed.context.strip.close=async()=>{throw Error('restore failed');};await assert.rejects(failed.handlers['update-install'](),/restore failed/);assert.equal(failed.events.includes('install'),false);
 const f=fixture();let quit;f.context.updates.install=()=>{f.events.push('install');quit=f.cleanup();};await f.handlers['update-install']();await quit;assert.ok(f.events.includes('hid-close'));assert.equal(f.state.setupRunning,false);
});


test('widget-only rendering never marks newer unrendered appearance settings as applied',async()=>{
 for(const kind of ['cycle','save'])for(const phase of ['before','during']){
  const wait=deferred(),handlers={},original={widget:{type:'spotify'},extraWidgets:[],appearance:{accent:'green'},widgetOrder:[],weather:{location:''}};
  const context={quitting:false,state:{strip:true},desk:{config:structuredClone(original),save(value){this.config=value;}},strip:{config:structuredClone(original),setWidget(widget,extraWidgets){this.config={...this.config,widget:structuredClone(widget),extraWidgets:structuredClone(extraWidgets)};},refreshLive:()=>wait.promise},displayTasks:{run:fn=>fn()},appliedAppearance:'old',leaveMode(){},send(){},widgetSources:null,handle(name,fn){handlers[name]=fn;},require(name){assert.equal(name,'./widget-cycle.cjs');return{WidgetCycle:class{constructor(_desk,apply){this.apply=apply;}},includeWidget:(_order,type)=>[type]};}};
  vm.createContext(context);
  if(kind==='cycle')vm.runInContext(section('widgetCycle=new(', ';desk.language=null'),context);
  else vm.runInContext(section("    handle('save-widget'", "    handle('save-desk'"),context);
  if(phase==='before')context.desk.config={...context.desk.config,appearance:{accent:'orange'}};
  const applying=kind==='cycle'?context.widgetCycle.apply():handlers['save-widget']({type:'clock'});
  await Promise.resolve();const rendered=JSON.stringify(context.strip.config);
  if(phase==='during')context.desk.config={...context.desk.config,appearance:{accent:'orange'}};
  wait.resolve();await applying;assert.equal(context.appliedAppearance,rendered,kind+'/'+phase);assert.notEqual(context.appliedAppearance,JSON.stringify(context.desk.config),kind+'/'+phase+' must still need full appearance apply');
 }
});

test('Quit waits for accepted key edits and tuning success or failure before releasing USB',async()=>{
 for(const name of ['change-key','undo-key','read-keymap','read-key-tuning','save-key-tuning','read-telemetry','inspect-device'])for(const failed of [false,true]){
  const f=fixture(),calls={},gate=deferred(),frame={url:'file:///companion/index.html'},ipc={};f.state.setupRunning=false;
  Object.assign(f.context,{ipcMain:{handle(channel,fn){ipc[channel]=fn;}},win:{webContents:{mainFrame:frame}},pageURL:frame.url,keyboardOperationNames:new Set(['change-key','undo-key','read-keymap','read-key-tuning','save-key-tuning','read-telemetry','inspect-device'])});
  vm.runInContext(section('function keyboardOperation(task)', '\nif (!app.requestSingleInstanceLock())'),f.context);
  f.context.handle(name,async()=>{calls.started=(calls.started||0)+1;await gate.promise;if(failed)throw Error('save verification failed');f.events.push('edit-finished');return true;});
  const accepted=ipc[name]({senderFrame:frame}),result=failed?assert.rejects(accepted,/save verification failed/):accepted;
  assert.equal(f.context.keyboardOperations.size,1);const quit=f.cleanup();await Promise.resolve();
  assert.equal(f.events.includes('desk-close'),false);assert.equal(f.events.includes('hid-close'),false);
  await assert.rejects(ipc[name]({senderFrame:frame}),/closing/);assert.equal(calls.started,1);
  gate.resolve();await Promise.all([result,quit]);assert.equal(f.context.keyboardOperations.size,0);assert.equal(f.events.includes('hid-close'),true);
  if(!failed)assert.ok(f.events.indexOf('edit-finished')<f.events.indexOf('hid-close'));
 }
});

test('read-only background key checks share the shutdown barrier, unrelated IPC does not',async()=>{
 const f=fixture(),gate=deferred(),frame={url:'file:///companion/index.html'},ipc={};f.state.setupRunning=false;
 Object.assign(f.context,{ipcMain:{handle(channel,fn){ipc[channel]=fn;}},win:{webContents:{mainFrame:frame}},pageURL:frame.url,keyboardOperationNames:new Set(['change-key'])});
 vm.runInContext(section('function keyboardOperation(task)', '\nif (!app.requestSingleInstanceLock())'),f.context);
 const background=f.context.keyboardOperation(()=>gate.promise);f.context.handle('community-status',()=>new Promise(()=>{}));void ipc['community-status']({senderFrame:frame});
 assert.equal(f.context.keyboardOperations.size,1);const quit=f.cleanup();await Promise.resolve();assert.equal(f.events.includes('hid-close'),false);
 gate.resolve();await Promise.all([background,quit]);assert.equal(f.events.includes('hid-close'),true);
});


test('Quit waits for language capture and rollback before closing display transport',async()=>{
 const f=fixture(),capturing=deferred(),release=deferred(),frame={url:'file:///companion/index.html'},ipc={};f.state.setupRunning=false;f.state.strip=true;
 const dependency=f.context.require;f.context.require=name=>name==='./languages.cjs'?{map:async id=>({id})}:dependency(name);
 f.context.desk.config={languageId:'qwerty',physicalLanguage:false};f.context.desk.validate=value=>value;
 f.context.strip.som={async language(value){if(value!==undefined)f.events.push('native-restore');return 0;}};
 f.context.strip.legends={model:null};f.context.strip.languageDefault={capture:async()=>{f.events.push('capture-start');capturing.resolve();await release.promise;f.events.push('capture-end');}};
 f.context.syncAppearance=async()=>{if(f.context.quitting)return;f.context.appliedAppearance=JSON.stringify(f.context.desk.config);};
 Object.assign(f.context,{ipcMain:{handle(channel,fn){ipc[channel]=fn;}},win:{webContents:{mainFrame:frame}},pageURL:frame.url});
 vm.runInContext(section('const keyboardOperationNames=', '\nif (!app.requestSingleInstanceLock())')+section("    handle('set-language'", "    handle('language-settings'"),f.context);
 const changing=ipc['set-language']({senderFrame:frame},'00000809'),result=assert.rejects(changing,/closing|disconnected/);await capturing.promise;
 const quit=f.cleanup();await new Promise(setImmediate);const closedWhileCapturing=f.events.includes('desk-close');
 release.resolve();await Promise.all([result,quit]);assert.equal(closedWhileCapturing,false);assert.ok(f.events.indexOf('capture-end')<f.events.indexOf('hid-close'));
});


test('setup cannot interleave its mutation inside an accepted language transaction',async()=>{
 const f=fixture(),capturing=deferred(),release=deferred(),frame={url:'file:///companion/index.html'},ipc={};f.state.setupRunning=false;f.state.strip=true;
 const dependency=f.context.require;f.context.require=name=>name==='./languages.cjs'?{map:async id=>({id})}:dependency(name);
 f.context.desk.config={languageId:'qwerty',physicalLanguage:false};f.context.desk.validate=value=>value;
 f.context.strip.som={async language(){return 0;}};f.context.strip.legends={model:null};f.context.strip.languageDefault={capture:async()=>{capturing.resolve();await release.promise;}};
 f.context.syncAppearance=async()=>{f.context.appliedAppearance=JSON.stringify(f.context.desk.config);};
 Object.assign(f.context,{ipcMain:{handle(channel,fn){ipc[channel]=fn;}},win:{webContents:{mainFrame:frame}},pageURL:frame.url});
 vm.runInContext(section('const keyboardOperationNames=', '\nif (!app.requestSingleInstanceLock())')+section("    handle('set-language'", "    handle('language-settings'"),f.context);
 const changing=ipc['set-language']({senderFrame:frame},'00000809');await capturing.promise;
 const settingUp=f.setupOperation(async()=>{f.events.push('setup-mutation');});const rejected=assert.rejects(settingUp,/current keyboard operation/);
 release.resolve();await changing;await rejected;assert.equal(f.events.includes('setup-mutation'),false);
});


test('Quit waits for startup multi-interface inspection before releasing the USB helper',async()=>{
 const reached=deferred(),release=deferred(),f=fixture({inspect:async()=>{reached.resolve();await release.promise;f.events.push('inspect-second-interface');return{};}});f.state.setupRunning=false;
 f.context.refresh=async()=>f.events.push('refresh');vm.runInContext(section('function keyboardOperation(task)', '\nfunction handle('),f.context);
 const start=source.indexOf('    try { state.device = await keyboardOperation(()=>inspectDevice(true)); } catch'),end=source.indexOf("    if(!process.argv.includes('--verify'))",start);assert.ok(start>=0&&end>start);
 const starting=vm.runInContext('(async()=>{'+source.slice(start,end)+'})()',f.context);await reached.promise;
 const quit=f.cleanup();await new Promise(setImmediate);const prematurelyClosed=f.events.includes('hid-close');release.resolve();await Promise.all([starting,quit]);
 assert.equal(prematurelyClosed,false);assert.ok(f.events.indexOf('inspect-second-interface')<f.events.indexOf('hid-close'));assert.equal(f.events.includes('refresh'),false);
});

test('automatic inactive-slot selection still waits for pending-settings confirmation',async()=>{
 let commits=0;const f=fixture({start:async()=>({needsConfirmation:true,plan:{id:'auto-slots',pending:true,automaticReplacement:true,map:{layers:[]},ownedSlots:[9,10],preservedSlots:[2,3,4,5,6,7,8],replacementSlots:[10,9]}}),commit:async(_dir,plan,options)=>{commits++;assert.equal(plan.id,'auto-slots');assert.equal(options.acceptPending,true);assert.equal(options.acceptOverlayReplacement,true);return{verified:true};}});
 f.state.deviceError='Old setup blocker';await f.recoverKeyboardConnection();assert.equal(commits,0);assert.equal(f.state.setupRecovery.automaticReplacement,true);assert.equal(f.state.deviceError,'');assert.match(f.state.feedback,/selected inactive display slots automatically/);await f.handlers['confirm-setup-recovery']('auto-slots',false);assert.equal(commits,1);assert.equal(f.state.strip,true);
});
