const { app, BrowserWindow, ipcMain, globalShortcut, session, shell, dialog, safeStorage, Tray, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
app.setPath('userData',path.join(app.getPath('appData'),'centerpiece-companion'));

const { pathToFileURL } = require('node:url');
const {XpanelSkins}=require('./xpanel-skins.cjs');let xpanelSkins;
const languages=require('./languages.cjs');const {Community}=require('./community.cjs');const {Updates}=require('./updates.cjs');let community,updates,twitch,widgetCycle,widgetShortcutReady=false;
const { MediaBridge } = require('./media.cjs');
const { inspectDevice } = require('./device.cjs');
const plugins = require('./plugins/index.cjs');
const { PluginNavigation } = require('./navigation.cjs');
const { StripController } = require('./strip.cjs');
const { Workspace } = require('./workspace.cjs');
const{KeyboardMonitor}=require('./keyboard-monitor.cjs');const monitor=new KeyboardMonitor();const hardwareDirectory=path.join(app.getPath('userData'),'hardware');let liveTimer,liveBusy=false;
let desk, lockTimer, lockBusy=false, appliedAppearance='';
function deskState(){if(desk)state.desk=desk.view();}
function updateNavigation(){
 navigation.plugins=[{id:'strip',name:'Keyboard strip',actions:desk.config.slots.map((s,i)=>({id:['previous','toggle','next','fourth'][i],label:s?`${desk.view().catalog.find(p=>p.id===s.plugin).name} · ${desk.view().catalog.find(p=>p.id===s.plugin).actions.find(a=>a.id===s.action).label}`:'Empty position'}))}];
 navigation.category=0;state.navigation=navigation.selection();
}
async function syncAppearance(){return displayTasks.run(async()=>{if(!state.strip)return;const key=JSON.stringify(desk.config);if(key===appliedAppearance)return;await strip.apply(desk.config,desk.locks);appliedAppearance=key;});}
async function runSlot(index){if(executing){state.error='A plugin action is already running.';send();return state;}executing=true;leaveMode();try{await desk.run(index);state.error='';state.feedback='Plugin action sent.';}catch(e){state.error=e.message;}finally{executing=false;}deskState();send();return state;}

const media = new MediaBridge();
let win, tray, timer, stripTimer, displayBusy=false, polling = false, executing = false, quitting = false;
const state = { media: { available: false, message: 'Connecting to Spotify…' }, device: {}, plugins: plugins.list(), shortcuts: false, feedback: '', error: '', deviceError: '' };
const navigation = new PluginNavigation(state.plugins);
state.navigation = navigation.selection();
const strip = new StripController(hardwareDirectory);
const displayTasks=new(require('./display-tasks.cjs').DisplayTasks)(strip);
state.strip = false;
let modeTimeout;
const modeKeys = ['Left', 'Right', 'Up', 'Down', 'Return', 'Escape'];
function leaveMode() {
  clearTimeout(modeTimeout);
  for (const key of modeKeys) globalShortcut.unregister(key);
  navigation.active = false; state.navigation = navigation.selection(); send();
}
function armModeTimeout() { clearTimeout(modeTimeout); modeTimeout = setTimeout(leaveMode, 45000); }
function enterMode() {
  // DisplayCache keeps the desired state and selects its cached frame after an upload.
  if (navigation.active) { leaveMode(); return; }
  for (const key of modeKeys) {
    if (!globalShortcut.register(key, () => {
      armModeTimeout();
      if (key === 'Escape') { leaveMode(); return; }
      if (key === 'Return') { runSlot(navigation.action); return; }
      state.navigation = navigation.move(key); send();
    })) { leaveMode(); state.error = `Cannot capture ${key}. Plugin mode is off.`; send(); return; }
  }
  navigation.active = true; state.navigation = navigation.selection(); armModeTimeout(); send();
}
const pageURL = pathToFileURL(path.join(__dirname, 'index.html')).href;

function send() {
  deskState();
  if(twitch&&desk)desk.chat.state.auth=twitch.state;if(xpanelSkins)state.xpanelSkins=xpanelSkins.state;if(community)state.community=community.state;if(updates)state.updates=updates.state;
  if(desk)strip.setData({live:desk.live.state,media:state.media,chat:desk.chat.state,selected:navigation.action,baseLabels:desk.baseLabels,language:desk.language});
  if(state.strip)try{strip.show(state.navigation);}catch(error){state.error=`Keyboard strip: ${error.message}`;state.strip=false;}
  if (win && !win.isDestroyed()) win.webContents.send('state', state);
}
function configPath() { return path.join(app.getPath('userData'), 'settings.json'); }
function setShortcuts(enabled, persist = true) {
  for (const plugin of state.plugins) for (const action of plugin.actions) globalShortcut.unregister(action.shortcut);
  state.shortcuts = false;
  if (enabled) {
    for (const plugin of state.plugins) {
      for (const action of plugin.actions) {
        if (!globalShortcut.register(action.shortcut, () => perform(plugin.id, action.id))) {
          for (const item of state.plugins) for (const binding of item.actions) globalShortcut.unregister(binding.shortcut);
          throw new Error(`${action.shortcut} is already in use. Shortcuts remain off.`);
        }
      }
    }
    state.shortcuts = true;
  }
  if (persist) {
    try { fs.writeFileSync(configPath(), JSON.stringify({ shortcuts: state.shortcuts }, null, 2)); }
    catch { state.error = 'Shortcuts changed for this session, but settings could not be saved.'; }
  }
  return state.shortcuts;
}
async function refresh() {
  if (polling || executing || quitting) return;
  polling = true;
  try { state.media = await media.request('status');state.media.receivedAt=Date.now(); }
  catch (error) { state.media = { available: false, message: error.message }; }
  finally { polling = false; send(); }
}
async function perform(plugin, action) {
  if (executing) return { ok: false, error: 'A control is already in progress.' };
  executing = true; state.error = ''; send();
  try {
    await plugins.execute(plugin, action, { media });
    state.feedback = `${state.plugins.find(p => p.id === plugin)?.actions.find(a => a.id === action)?.label || 'Control'} sent to Spotify.`;
    return { ok: true };
  } catch (error) {
    state.error = error.message;
    return { ok: false, error: error.message };
  } finally { executing = false; await refresh(); }
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.senderFrame !== win?.webContents.mainFrame || event.senderFrame.url.split('#')[0] !== pageURL) throw new Error('Untrusted sender');
    return fn(...args);
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else if(process.argv.includes('--quit')) app.quit();
else {
  function diagnostics(){
    const directory=path.join(__dirname,'../diagnostics');fs.mkdirSync(directory,{recursive:true});
      fs.writeFileSync(path.join(directory,'state.json'),JSON.stringify({strip:state.strip,navigation:state.navigation,error:state.error,deviceError:state.deviceError,expectedSlot:strip.lastSlot,layer:state.layer,monitor:monitor.status(),updating:strip.updating,cacheKeys:[...strip.cache.keys()],observedSlot:strip.lastObservedSlot,desired:strip.desired,media:{available:state.media.available,status:state.media.status,position:state.media.position,duration:state.media.duration,receivedAt:state.media.receivedAt},pluginBinding:desk?.editor.snapshot?.layers.find(l=>l.id===1)?.bindings[26]},null,2));
  }
  app.on('second-instance', (_event,args) => { if(args.includes('--diagnostics')){diagnostics();return;} if(args.includes('--quit')){app.quit();return;} if (win) { win.show(); win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    xpanelSkins=new XpanelSkins(shell);community=new Community(app.getPath('userData'),shell,safeStorage);updates=new Updates(app);updates.start();updates.on('change',send);
    desk=new Workspace(app.getPath('userData'),shell,dialog,media);twitch=new(require('./twitch-auth.cjs').TwitchConnection)(app.getPath('userData'),shell,safeStorage,desk.chat,require('./distribution.json').twitchClientId);twitch.on('change',send);widgetCycle=new(require('./widget-cycle.cjs').WidgetCycle)(desk,async()=>{try{await displayTasks.run(async()=>{if(!state.strip)return;strip.setWidget(desk.config.widget);await strip.refreshLive();appliedAppearance=JSON.stringify(desk.config);});state.error='';}catch(e){state.error=e.message;}send();},()=>{leaveMode();state.widgetRevision=(state.widgetRevision||0)+1;state.feedback='Screen widget: '+desk.config.widget.type;send();});try{desk.language=await languages.map(desk.config.languageId);}catch{desk.language=await languages.map('qwerty');}deskState();updateNavigation();
    desk.system.on('locks',locks=>{if(navigation.active&&desk.locks.caps!==locks.caps)leaveMode();desk.locks=locks;if(state.strip)strip.setLocks(locks);send();});
    monitor.on('disconnected',()=>{state.device.keyboard=false;state.deviceError='Keyboard connection interrupted. Use Reconnect keyboard.';send();});
    monitor.on('layer',active=>{state.layer=active;if(state.strip)strip.setLayer(active);send();});
    monitor.on('selected',position=>{if(win?.isFocused())win.webContents.send('selected-key',position);});
    win = new BrowserWindow({ icon:path.join(__dirname,'assets/community.png'), width: 1320, height: 920, minWidth: 560, minHeight: 600, show: !process.argv.includes('--background') && !process.argv.includes('--verify') && !process.argv.includes('--smoke'), backgroundColor: '#11151d', title: 'Centerpiece Companion', autoHideMenuBar: true,
      frame:false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke')){
        tray=new Tray(path.join(__dirname,'assets/community.ico'));
        tray.setToolTip('Centerpiece Companion — keyboard controls running');
        const open=()=>{win.show();win.restore();win.focus();};
        const refreshMenu=()=>tray.setContextMenu(Menu.buildFromTemplate([
          {label:'Open companion',click:open},
          {label:'Start with Windows',type:'checkbox',checked:app.getLoginItemSettings({path:process.execPath,args:['--background']}).openAtLogin,enabled:app.isPackaged,click:item=>{app.setLoginItemSettings({openAtLogin:item.checked,path:process.execPath,args:['--background']});refreshMenu();}},
          {type:'separator'},
          {label:'Quit companion (stops live controls)',click:()=>app.quit()}
        ]));refreshMenu();tray.on('double-click',open);
        win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();monitor.capture(false);}});
      }
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.on('blur',()=>monitor.capture(false));
    handle('get-state', () => state);
    handle('window-control',action=>{if(action==='minimize')win.minimize();else if(action==='maximize'){win.isMaximized()?win.unmaximize():win.maximize();}else if(action==='close')win.close();else throw Error('Unknown window control');return{maximized:win.isMaximized()};});
    const windowState=()=>win.webContents.send('window-state',{maximized:win.isMaximized()});win.on('maximize',windowState);win.on('unmaximize',windowState);
    handle('xpanel-refresh',async()=>{await xpanelSkins.refresh();send();return xpanelSkins.state;});
    handle('xpanel-download',id=>xpanelSkins.download(id));
    handle('community-refresh',async()=>{await community.refresh();send();return state;});
    handle('community-login',async()=>{if(community.state.signingIn)return state;community.state.signingIn=true;community.state.error='';send();community.login().catch(e=>{community.state.error=e.message;}).finally(()=>{community.state.signingIn=false;send();});return state;});
    handle('community-cancel-login',()=>{community.close();send();return state;});
    handle('community-logout',async()=>{await community.logout();send();return state;});
    handle('community-submit',async input=>{await community.submit(input);send();return state;});
    handle('community-review',async(id,status)=>{await community.review(id,status);send();return state;});
    handle('community-color',async color=>{await community.color(color);send();return state;});
    handle('community-skin',id=>community.openSkin(id));
    handle('update-check',async()=>{await updates.check();send();return state;});
    handle('update-download',async()=>{await updates.download();send();return state;});
    handle('update-install',async()=>{leaveMode();if(strip.updating)throw Error('Wait for the keyboard display update to finish.');await strip.close();state.strip=false;updates.install();});
    handle('action', (plugin, action) => perform(plugin, action));
    handle('plugin-mode', () => { enterMode(); return state; });
    handle('save-desk', async config=>{leaveMode();try{if(!config.weather?.location&&(config.slots?.some(s=>s?.plugin==='weather')||config.widget?.type==='weather'))try{config.weather={location:await desk.system.request('windows-location'),unit:config.weather?.unit||'fahrenheit'};}catch{}desk.save(config);if(config.weather?.location)await desk.live.weather(true);updateNavigation();appliedAppearance='';await syncAppearance();state.error='';state.feedback=state.strip?'Saved to the companion and keyboard strip.':'Saved to the companion. Reconnect the keyboard to apply the strip.';}catch(e){state.error=`${e.message} Settings may be saved locally; retry Apply to refresh the keyboard.`;}send();return state;});
    handle('run-slot', index=>runSlot(index));
    handle('media-key',async action=>{const codes={previous:177,next:176,toggle:179,volumeup:175,volumedown:174,volumemute:173};if(!Object.hasOwn(codes,action))throw Error('Unknown media control');await desk.system.request('keys',[codes[action]]);return state;});
    handle('pick-app',()=>desk.pick());
    let telemetryBusy=false;handle('read-telemetry',async()=>{if(telemetryBusy)throw Error('Reading keyboard settings.');telemetryBusy=true;try{state.telemetry=await require('./telemetry.cjs').readTelemetry();send();return state;}finally{telemetryBusy=false;}});
    handle('reconnect-keyboard',async()=>{leaveMode();if(strip.updating)throw Error('Wait for the current display update.');monitor.close();try{await strip.close();}catch{}state.strip=false;require('./hid.cjs').shutdown();state.device=await inspectDevice(true);state.strip=strip.connect();appliedAppearance='';send();if(state.strip){if(widgetShortcutReady)await require('./widget-shortcut.cjs').widgetShortcut(hardwareDirectory);await syncAppearance();monitor.start();}state.error='';state.feedback=state.strip?'Keyboard reconnected.':'Connect the keyboard and retry.';send();return state;});
    handle('read-keymap',()=>desk.editor.read());
    handle('list-languages',()=>languages.list());
    handle('set-language',async id=>{const language=await languages.map(id);desk.save({...desk.config,languageId:id});desk.language=language;appliedAppearance='';send();await syncAppearance();send();return state;});
    handle('language-settings',()=>shell.openExternal('ms-settings:regionlanguage'));
    handle('capture-key',enabled=>{if(typeof enabled!=='boolean')throw Error('Invalid capture setting');monitor.capture(enabled&&win.isFocused());return true;});
    handle('search-city',city=>desk.live.search(city));
    handle('windows-location',async()=>{try{return await desk.system.request('windows-location');}catch{throw Error('Windows location is unavailable or disabled. Choose a city manually.');}});
    handle('set-weather',async(location,unit)=>{const next={...desk.config,weather:{location,unit}};desk.save(next);await desk.live.weather(true);send();return state;});
    handle('connect-twitch',async channel=>{twitch.start(channel);send();return state;});
    handle('cancel-twitch',()=>{twitch.cancel();send();return state;});
    handle('disconnect-service',async name=>{if(name==='obs'){await desk.obs?.disconnect();desk.obs=null;}else if(name==='twitch')await twitch.disconnect();else throw Error('Unknown connection');send();return state;});
    handle('setup-keyboard',async()=>{if(state.strip)return state;await require('./setup.cjs').setup(hardwareDirectory);if(widgetShortcutReady)await require('./widget-shortcut.cjs').widgetShortcut(hardwareDirectory);state.strip=strip.connect();await desk.live.sample();send();await syncAppearance();monitor.start();state.feedback='Keyboard setup complete. Your original plugin key is backed up on this PC.';send();return state;});
    handle('restore-keyboard',async()=>{leaveMode();if(strip.updating)throw Error('Wait for the display update to finish.');await strip.close();state.strip=false;await require('./setup.cjs').restore(hardwareDirectory);state.feedback='Original plugin key and overlay restored. Your other remaps remain.';send();return state;});
    handle('change-key',async data=>{await desk.editor.change(data.layer,data.position,data.value,data.mods,data.swap);const keys=await desk.editor.read();desk.baseLabels=keys.layers.find(l=>l.id===0).keys.map(k=>k.label);send();appliedAppearance='';await syncAppearance();return keys;});
    handle('connect-obs',async (password,port)=>{try{await desk.connectObs(password,port);state.error='';state.feedback='OBS connected. Password stays in memory until the app closes.';}catch(e){state.error=e.message;}send();return state;});
    handle('shortcuts', enabled => {
      if (typeof enabled !== 'boolean') throw new Error('Invalid shortcut setting');
      try { state.error = ''; setShortcuts(enabled); state.feedback = enabled ? 'Keyboard shortcuts enabled.' : 'Keyboard shortcuts disabled.'; }
      catch (error) { state.error = error.message; }
      send(); return state;
    });
    let deviceBusy = false;
    handle('inspect-device', async () => {
      if (deviceBusy) return state;
      deviceBusy = true;
      try { state.device = await inspectDevice(true); state.deviceError = ''; }
      catch (error) { state.deviceError = error.message; }
      finally { deviceBusy = false; send(); }
      return state;
    });
    try { const config = JSON.parse(fs.readFileSync(configPath(), 'utf8')); if (config.shortcuts === true && !process.argv.includes('--verify')) setShortcuts(true, false); } catch {}
    await win.loadFile(path.join(__dirname, 'index.html'));
    if(!(widgetShortcutReady=globalShortcut.register('Control+Alt+F12',()=>{try{widgetCycle.press();}catch(e){state.error=e.message;send();}})))state.error='The widget shortcut is in use by another app.';
    if (!globalShortcut.register('Control+Alt+P', enterMode)) state.error = 'L1+P’s companion signal is in use. Use the Enter plugin mode button instead.';
    try { state.device = await inspectDevice(true); } catch (error) { state.deviceError = error.message; }
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))try{state.strip=strip.connect();}catch(error){state.error=error.message;}
    await refresh();
    if(!process.argv.includes('--verify')){community.refresh().then(send).catch(()=>{});xpanelSkins.refresh().then(send).catch(()=>{});}
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))twitch.restore().then(send).catch(()=>{});
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))try{monitor.start();}catch(e){state.deviceError=e.message;}
    if(state.strip){
      try{desk.locks=await desk.system.request('locks');}catch(e){state.error=e.message;}
      if(widgetShortcutReady)try{await require('./widget-shortcut.cjs').widgetShortcut(hardwareDirectory);}catch(e){state.error='Widget shortcut: '+e.message;}
      try{const keys=await desk.editor.read();desk.baseLabels=keys.layers.find(l=>l.id===0).keys.map(k=>k.label);}catch(e){state.error=e.message;}
      try{await desk.live.sample();}catch(e){state.error=e.message;}
      try{send();await syncAppearance();}catch(e){state.error=e.message;}send();
    }
    if (process.argv.includes('--smoke')) {
      console.log(JSON.stringify({ ready: true, keyboard: !!state.device.keyboard, display: !!state.device.display, spotify: !!state.media.available }));
      app.quit(); return;
    }
    if(!process.argv.includes('--verify')){setTimeout(()=>updates.check(),10000).unref();setInterval(()=>updates.check(),6*3600000).unref();}
    timer = setInterval(refresh, 1800);
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))stripTimer=setInterval(async()=>{if(!state.strip||quitting||displayBusy||displayTasks.paused)return;displayBusy=true;try{await strip.reconcile();if(!displayTasks.paused)await strip.refreshLive();}catch(error){state.error=`Keyboard strip: ${error.message}`;state.strip=false;appliedAppearance='';send();}finally{displayBusy=false;}},500);
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))liveTimer=setInterval(async()=>{if(liveBusy||quitting)return;liveBusy=true;try{await desk.live.sample();send();}catch(e){state.error=e.message;send();}finally{liveBusy=false;}},1500);
    if(!process.argv.includes('--verify'))lockTimer=setInterval(async()=>{if(lockBusy||quitting)return;lockBusy=true;try{desk.locks=await desk.system.request('locks');if(state.strip)strip.setLocks(desk.locks);if(strip.error)state.error=`Keyboard selection: ${strip.error}. Apply your slots again to retry.`;send();}catch(e){state.error=e.message;send();}finally{lockBusy=false;}},2000);
    if (process.argv.includes('--verify')) {
      try { await require('../tests/desktop-verify.cjs')({ win, state, media }); }
      catch (error) { console.error(error); process.exitCode = 1; }
      finally { app.quit(); }
    }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', require('./shutdown.cjs').shutdownGate(async()=>{
    quitting=true;clearInterval(timer);clearInterval(stripTimer);clearInterval(lockTimer);clearInterval(liveTimer);clearTimeout(modeTimeout);
    globalShortcut.unregisterAll();community?.close();twitch?.close();widgetCycle?.close();monitor.close();media.close();desk?.close();
    // Drain queued display work and the current transfer before restoring the overlay.
    await displayTasks.run(()=>strip.close());
    await require('./hid.cjs').shutdown();
  },()=>app.quit(),error=>{state.error='Keyboard cleanup did not finish. Please retry Quit from the tray menu.';send();}));
}
