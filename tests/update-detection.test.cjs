const {test}=require('node:test'),assert=require('node:assert/strict'),{Updates}=require('../src/updates.cjs'),fs=require('node:fs');
test('background checks deduplicate and throttle, manual retry remains available',async()=>{const u=new Updates({});let calls=0,finish;u.updater={checkForUpdates(){calls++;return new Promise(r=>finish=r)}};const a=u.check({background:true}),b=u.check({background:true});await Promise.resolve();assert.equal(calls,1);finish();await Promise.all([a,b]);await u.check({background:true});assert.equal(calls,1);const c=u.check();await Promise.resolve();assert.equal(calls,2);finish();await c;});
test('availability and downloaded update survive background events and skip checks',async()=>{for(const status of ['available','ready']){const u=new Updates({});u.set(status,'New release');u.updater={checkForUpdates(){throw Error('must not check')}};for(const event of ['checking','error','current']){u.set(event,'stale');assert.equal(u.state.status,status);}await u.check();assert.equal(u.state.status,status);}});
test('network failure can retry and does not leave checking stuck',async()=>{const u=new Updates({});u.updater={checkForUpdates(){throw Error('offline')}};await u.check();assert.equal(u.state.status,'error');assert.equal(u.checkPromise,null);u.updater.checkForUpdates=async()=>u.set('available','Update 25 available');await u.check();assert.equal(u.state.status,'available');});
test('downloads cannot be interrupted by automatic checks',async()=>{const u=new Updates({});u.set('downloading','50%');u.updater={checkForUpdates(){throw Error('must not check')}};await u.check();assert.equal(u.state.status,'downloading');});
test('new release preserves every previous announcement including Working fix',()=>{const notes=require('../src/update-notes-data.cjs');for(const item of notes['0.3.0-preview.24'])assert.ok(notes['0.3.0-preview.25'].includes(item));});
test('automatic checks run every five minutes and on focus',()=>{const main=fs.readFileSync('src/main.cjs','utf8');assert.ok(main.includes('setInterval(()=>updates.check({background:true}),5*60000)'));assert.match(main,/win.on\('focus',[^\n]+updates.check\(\{background:true\}\)/);});

function installedUpdater({prepareUpdateTemp=()=> 'D:\\Updates\\temporary',chooseWritableStorage=async()=> 'C:\\UserData\\.centerpiece-companion-updates',env={TEMP:'C:\\OriginalTemp'}}={}){
 const {EventEmitter}=require('node:events'),vm=require('node:vm'),updater=new EventEmitter();updater.app={};
 const processMock={resourcesPath:'D:\\App\\resources',env:{...env}},storage={updateStorage:()=> 'D:\\Updates',prepareUpdateTemp,chooseWritableStorage};
 const box={module:{exports:{}},process:processMock,require:n=>n==='electron-updater'?{NsisUpdater:class{constructor(){return updater;}}}:n==='./update-storage.cjs'?storage:n==='electron'?{dialog:{}}:n==='fs'?{existsSync:()=>true}:n==='./distribution.json'?{githubOwner:'owner',githubRepo:'repo'}:require(n)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/updates.cjs'),'utf8'),box);
 const updates=new box.module.exports.Updates({isPackaged:true,getVersion:()=> '0.3.0-preview.35'});updates.start();
 return{updates,updater,env:processMock.env};
}
test('cache fallback replaces the updater helper before starting the download',async()=>{
 const {updates,updater}=installedUpdater();updates.set('available','Update available');updater.downloadedUpdateHelper={cacheDir:'D:\\Protected'};
 updater.downloadUpdate=async()=>{assert.equal(updater.app.baseCachePath,'C:\\UserData\\.centerpiece-companion-updates');assert.equal(updater.downloadedUpdateHelper,null);updater.emit('update-downloaded');};
 await updates.download();assert.equal(updates.state.status,'ready');
});
test('synchronous installer failure restores temporary paths and allows another attempt',()=>{
 const {updates,updater,env}=installedUpdater();updates.set('ready','Update ready');let calls=0;
 updater.quitAndInstall=()=>{calls++;assert.equal(env.TEMP,'D:\\Updates\\temporary');assert.equal(env.TMP,'D:\\Updates\\temporary');throw Error('Installer missing');};
 updates.install();assert.deepEqual(env,{TEMP:'C:\\OriginalTemp'});assert.equal(updates.state.status,'ready');assert.match(updates.state.message,/installer could not start/);assert.equal(updates.installAttempt,null);
 updates.install();assert.equal(calls,2);
});
test('installer error events stay visible in ready state and reset the retry latch',()=>{
 const {updates,updater,env}=installedUpdater({env:{TEMP:'C:\\Temp',TMP:'D:\\OldTemp'}});updates.set('ready','Update ready');let calls=0;
 updater.quitAndInstall=()=>{calls++;updater.quitAndInstallCalled=true;};
 updates.install();updates.install();assert.equal(calls,1);
 updater.emit('error',Object.assign(Error('Access denied'),{code:'EACCES'}));
 assert.deepEqual(env,{TEMP:'C:\\Temp',TMP:'D:\\OldTemp'});assert.equal(updates.state.status,'ready');assert.match(updates.state.message,/Windows denied access/);assert.equal(updater.quitAndInstallCalled,false);
 updates.install();assert.equal(calls,2);
});
test('a temporary directory failure leaves the downloaded update available without launching',()=>{
 const {updates,updater,env}=installedUpdater({prepareUpdateTemp:()=>{throw Object.assign(Error('Disk full'),{code:'ENOSPC'});}});updates.set('ready','Update ready');
 updater.quitAndInstall=()=>assert.fail('Installer must not launch');updates.install();
 assert.deepEqual(env,{TEMP:'C:\\OriginalTemp'});assert.equal(updates.state.status,'ready');assert.match(updates.state.message,/drive is full/);
});
test('late update-check errors still preserve a downloaded release before installation',()=>{
 const {updates,updater}=installedUpdater();updates.set('ready','Update ready');updater.emit('error',Error('Old check failed'));
 assert.equal(updates.state.status,'ready');assert.equal(updates.state.message,'Update ready');
});
