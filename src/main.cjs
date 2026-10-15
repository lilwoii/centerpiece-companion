const { app, BrowserWindow, ipcMain, globalShortcut, session, shell, dialog, safeStorage, Tray, Menu, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
app.setPath('userData',path.join(app.getPath('appData'),'centerpiece-companion'));

const { pathToFileURL } = require('node:url');
const {PlaybackClock}=require('./playback-clock.cjs');const playbackClock=new PlaybackClock();
const {MediaPoll,trackKey}=require('./media-poll.cjs');let mediaPoll,youtubeMusicPoll,youtubePoll;const youtubeClock=new PlaybackClock();let youtubePolling=false;
const {Startup,openCompanion,hideCompanion}=require('./startup.cjs');let startup,refreshTray=()=>{};
const {XpanelSkins}=require('./xpanel-skins.cjs');let xpanelSkins;
const {Community}=require('./community.cjs');const {Updates}=require('./updates.cjs');let community,updates,twitch,widgetCycle,widgetShortcutReady=false;
const { MediaBridge } = require('./media.cjs');
const { inspectDevice } = require('./device.cjs');
const plugins = require('./plugins/index.cjs');
const { PluginNavigation } = require('./navigation.cjs');
const { StripController } = require('./strip.cjs');
const { Workspace } = require('./workspace.cjs');
const{KeyboardMonitor}=require('./keyboard-monitor.cjs');const monitor=new KeyboardMonitor();const hardwareDirectory=path.join(app.getPath('userData'),'hardware');let liveTimer,liveBusy=false;
let profiles,profileTimer,profilePollBusy=false;
const skinLibrary=new(require('./skin-library.cjs').SkinLibrary)(app.getPath('userData'));
let connectionRecovery,connectionTimer,recoveryVerified=false;
const shortcutHealth=new(require('./shortcut-health.cjs').ShortcutHealth)();
let setupBusy=false, setupPlan=null, automaticSetupTimer, automaticSetupSuspended=false, setupFinished=Promise.resolve();
function suspendAutomaticSetup(){automaticSetupSuspended=true;clearInterval(automaticSetupTimer);automaticSetupTimer=null;}
const updateNotes=new(require('./update-notes.cjs').UpdateNotes)({directory:app.getPath('userData'),version:app.getVersion()});
let desk, lockTimer, lockBusy=false, appliedAppearance='';
function deskState(){if(desk){state.desk=desk.view();if(desk.settingsError)state.error=desk.settingsError;}if(profiles)state.profiles=profiles.view();}
function updateNavigation(){
 navigation.plugins=[{id:'strip',name:'Keyboard strip',actions:desk.config.slots.map((s,i)=>({id:['previous','toggle','next','fourth'][i],label:s?`${desk.view().catalog.find(p=>p.id===s.plugin).name} · ${desk.view().catalog.find(p=>p.id===s.plugin).actions.find(a=>a.id===s.action).label}`:'Empty position'}))}];
 navigation.category=0;state.navigation=navigation.selection();
}
let keyAppearanceTimer;
function refreshKeyAppearance(){clearTimeout(keyAppearanceTimer);keyAppearanceTimer=setTimeout(()=>{appliedAppearance='';void syncAppearance().catch(error=>{state.error='Key saved; display refresh failed: '+error.message;send();});},120);}
async function syncAppearance(){if(quitting||desk?.settingsError)return;return displayTasks.run(async()=>{if(quitting||!state.strip)return;const key=JSON.stringify(desk.config);if(key===appliedAppearance)return;if((desk.config.physicalLanguage||desk.config.languageId!=='auto')&&!desk.bindingLayers){const keys=await desk.editor.read();desk.baseLabels=keys.layers.find(l=>l.id===0).keys.map(k=>k.label);desk.bindingLayers=Object.fromEntries(keys.layers.map(l=>[l.id,l.keys.map(k=>k.binding)]));send();}await strip.apply(desk.config,desk.locks);appliedAppearance=key;});}
async function runSlot(index){if(executing){state.error='A plugin action is already running.';send();return state;}executing=true;leaveMode();try{await desk.run(index);state.error='';state.feedback='Plugin action sent.';}catch(e){state.error=e.message;}finally{executing=false;}deskState();send();return state;}

const media = new MediaBridge();const youtubeMusic=new(require('./music-players.cjs').MusicPlayers)({directory:app.getPath('userData'),canRefresh:()=>!executing&&!quitting,onChange:(target,view,previous)=>{if(!desk||quitting)return;state.youtubeMusic=youtubeMusic.view();state.youtubeMusicByTarget=youtubeMusic.views;send();if(trackKey(previous)!==trackKey(view)||previous?.art!==view.art)void refreshStrip(false);}});const youtube=new MediaBridge('youtube');
let unrealDock;
let widgetSources;let sleepService;let win, tray, timer, stripTimer, displayBusy=false, polling = false, executing = false, quitting = false;
const state = { youtube:{available:false,message:'Play YouTube in your browser.'}, youtubeMusic:youtubeMusic.view(),youtubeMusicByTarget:youtubeMusic.views,media: { available: false, message: 'Connecting to Spotify…' }, device: {}, plugins: plugins.list(), shortcuts: false, feedback: '', error: '', deviceError: '' };
const navigation = new PluginNavigation(state.plugins);
state.navigation = navigation.selection();
const strip = new StripController(hardwareDirectory);
const displayTasks=new(require('./display-tasks.cjs').DisplayTasks)(strip);
state.strip = false;
let modeTimeout;
let pluginKeyCapture=false;
const modeKeys = ['Left', 'Right', 'Up', 'Down', 'Return', 'Escape'];
function leaveMode() {
  clearTimeout(modeTimeout);
  for (const key of modeKeys) globalShortcut.unregister(key);
  navigation.active = false; state.navigation = navigation.selection(); send();
}
function armModeTimeout() { clearTimeout(modeTimeout); modeTimeout = setTimeout(leaveMode, 45000); }
function enterMode() {
  if(!state.strip||strip.error){state.error='Plugin navigation needs a working keyboard display. Companion is reconnecting; try L1 + P when the display is ready.';send();return;}
  if(desk?.config.stripEnabled===false){state.feedback='Plugin strip is off. Enable it in Plugin library to navigate plugins.';send();return;}
  // DisplayCache keeps the desired state and selects its cached frame after an upload.
  if (navigation.active) { leaveMode(); return; }
  for (const key of modeKeys) {
    if (!globalShortcut.register(key, () => {
      if(!state.strip||strip.error){leaveMode();state.error='Plugin navigation stopped because the keyboard display is unavailable. Companion is reconnecting.';send();return;}
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
  state.updateNotes=updateNotes.view();state.keyboardReady=!!(state.strip&&appliedAppearance);deskState();
  if(twitch&&desk)desk.chat.state.auth=twitch.state;if(xpanelSkins)state.xpanelSkins=xpanelSkins.state;if(community)state.community=community.state;if(updates)state.updates=updates.state;
  if(desk)strip.setData({timer:desk.countdown.view(),obs:desk.obsStatus,live:desk.live.state,media:state.media,youtubeMusic:state.youtubeMusic,youtubeMusicByTarget:state.youtubeMusicByTarget,youtube:state.youtube,chat:desk.chat.state,selected:navigation.action,baseLabels:desk.baseLabels,bindingLayers:desk.bindingLayers,language:desk.language});
  if(state.strip&&!quitting)try{strip.show(state.navigation);}catch(error){state.error=`Keyboard strip: ${error.message}`;state.strip=false;}
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
  polling = true;const previousTrack=trackKey(state.media);
  try { state.media = playbackClock.update(await media.request('status'));state.media.receivedAt=Date.now(); }
  catch (error) { state.media = playbackClock.update({ available: false, message: error.message }); }
  finally { polling = false; send();if(previousTrack!==trackKey(state.media))void refreshStrip(false); }
}
async function refreshYoutubeMusic(){return youtubeMusic.refresh();}
async function refreshYoutube(){
 if(youtubePolling||executing||quitting)return;youtubePolling=true;const previous=trackKey(state.youtube);
 try{state.youtube={...youtubeClock.update(await youtube.request('status')),receivedAt:Date.now()};}
 catch(error){state.youtube=youtubeClock.update({available:false,message:error.message});}
 finally{youtubePolling=false;if(!quitting){send();if(previous!==trackKey(state.youtube))void refreshStrip(false);}}
}
async function refreshStrip(reconcile=true){if(!state.strip||quitting||displayBusy||displayTasks.paused)return;displayBusy=true;try{await strip.refreshLive();if(reconcile&&!displayTasks.paused)await strip.reconcile();}catch(error){state.error=`Keyboard strip: ${error.message}`;state.strip=false;appliedAppearance='';send();}finally{displayBusy=false;}}
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
    if(setupBusy&&['change-key','undo-key','restore-keyboard','reconnect-keyboard','read-keymap','inspect-device','read-telemetry','keyboard-skins','update-install'].includes(name))throw Error('Keyboard setup is in progress. Wait for it to finish.');
    return fn(...args);
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else if(process.argv.includes('--quit')) app.quit();
else {
  function diagnostics(){
    const directory=path.join(__dirname,'../diagnostics');fs.mkdirSync(directory,{recursive:true});
      fs.writeFileSync(path.join(directory,'state.json'),JSON.stringify({strip:state.strip,navigation:state.navigation,error:state.error,deviceError:state.deviceError,expectedSlot:strip.lastSlot,layer:state.layer,monitor:monitor.status(),updating:strip.updating,cacheKeys:[...strip.cache.keys()],observedSlot:strip.lastObservedSlot,desired:strip.desired,media:{available:state.media.available,status:state.media.status,position:state.media.position,duration:state.media.duration,receivedAt:state.media.receivedAt},youtubeMusic:{available:state.youtubeMusic.available,source:state.youtubeMusic.source,status:state.youtubeMusic.status,target:youtubeMusic.target,position:state.youtubeMusic.position,duration:state.youtubeMusic.duration,hasArtwork:!!state.youtubeMusic.art,receivedAt:state.youtubeMusic.receivedAt},widgetType:desk?.config.widget?.type,widgetSources:widgetSources?.view(),pluginBinding:desk?.editor.snapshot?.layers.find(l=>l.id===1)?.bindings[26]},null,2));
  }
  app.on('second-instance', (_event,args) => { if(args.includes('--diagnostics')){diagnostics();return;} if(args.includes('--quit')){app.quit();return;} if(args.includes('--background'))return;if (win) openCompanion(win); });
  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    startup=new Startup(app,process.execPath,app.getPath('userData'));try{state.startup=startup.initialize();}catch(e){state.startup=startup.read();state.error=e.message;}xpanelSkins=new XpanelSkins(shell);community=new Community(app.getPath('userData'),shell,safeStorage);updates=new Updates(app);updates.start();updates.on('change',send);
    desk=new Workspace(app.getPath('userData'),shell,dialog,media,youtubeMusic,youtube);youtubeMusic.target=desk.config.youtubeMusicTarget;youtubeMusic.source=desk.config.youtubeMusicSource;state.youtubeMusic=youtubeMusic.view();const shortcutRecord=require('./plugin-shortcuts.cjs').read(hardwareDirectory);if(shortcutRecord&&!shortcutRecord.inProgress)desk.config.pluginShortcuts=require('./plugin-shortcuts.cjs').normalize(shortcutRecord.settings);monitor.pluginPosition=desk.config.pluginShortcuts.position;twitch=new(require('./twitch-auth.cjs').TwitchConnection)(app.getPath('userData'),shell,safeStorage,desk.chat,require('./distribution.json').twitchClientId);twitch.on('change',send);widgetCycle=new(require('./widget-cycle.cjs').WidgetCycle)(desk,async()=>{try{await displayTasks.run(async()=>{if(!state.strip)return;strip.setWidget(desk.config.widget);await strip.refreshLive();appliedAppearance=JSON.stringify(desk.config);});state.error='';}catch(e){state.error=e.message;}send();},()=>{leaveMode();state.widgetRevision=(state.widgetRevision||0)+1;state.feedback='Screen widget: '+desk.config.widget.type;send();});desk.language=null; // Keyboard language overlays are temporarily disabled.
if(desk.settingsError)suspendAutomaticSetup();deskState();updateNavigation();
    const autoAllowed=()=>!quitting&&!win?.isFocused()&&!navigation.active&&!executing&&!displayBusy&&!displayTasks.paused;
    profiles=new(require('./profiles.cjs').Profiles)(app.getPath('userData'),desk,async(config,automatic)=>{
      if(automatic&&!autoAllowed())return false;
      leaveMode();widgetCycle.close();desk.save(config);state.profileRevision=(state.profileRevision||0)+1;state.widgetRevision=(state.widgetRevision||0)+1;updateNavigation();send();appliedAppearance='';await syncAppearance();send();return true;
    },autoAllowed);
    sleepService=new(require('./sleep-service.cjs').SleepService)({run:fn=>displayTasks.run(fn),onError:error=>{state.error='Display sleep: '+error.message;send();}});
    desk.system.on('activity',()=>sleepService.activity());
    handle('test-display-sleep',async()=>{await sleepService.test();return true;});
    handle('set-display-sleep',async minutes=>{if(desk.settingsError)throw Error(desk.settingsError);const previous=desk.config.sleepMinutes;try{await sleepService.configure(minutes);desk.save({...desk.config,sleepMinutes:minutes});}catch(error){try{if(previous===null)await sleepService.close();else await sleepService.configure(previous);}catch{}throw error;}send();return state;});
    desk.system.on('locks',locks=>{if(navigation.active&&desk.locks.caps!==locks.caps)leaveMode();desk.locks=locks;if(state.strip)strip.setLocks(locks);send();});
    monitor.on('disconnected',()=>{shortcutHealth.record('monitor-disconnected',{monitorConnected:false,displayConnected:state.strip});state.device.keyboard=false;state.deviceError='Keyboard connection interrupted. Reconnecting automatically…';state.strip=false;recoveryVerified=false;appliedAppearance='';send();});
    monitor.on('layer',active=>{state.layer=active;if(state.strip)strip.setLayer(active);send();});
    monitor.on('selected',position=>{if(win?.isFocused())win.webContents.send(pluginKeyCapture?'plugin-selected-key':'selected-key',position);pluginKeyCapture=false;});
    win = new BrowserWindow({ icon:path.join(__dirname,'assets/community.png'), width: 1320, height: 920, minWidth: 560, minHeight: 600, show: !process.argv.includes('--background') && !process.argv.includes('--verify') && !process.argv.includes('--smoke'), backgroundColor: '#11151d', title: 'Centerpiece Companion', autoHideMenuBar: true,
      frame:false, skipTaskbar:process.argv.includes('--background'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke')){
        tray=new Tray(path.join(__dirname,'assets/community.ico'));
        tray.setToolTip('Centerpiece Companion — keyboard controls running');
        const open=()=>openCompanion(win);
        refreshTray=()=>tray.setContextMenu(Menu.buildFromTemplate([
          {label:'Open companion',click:open},
          {label:'Start with Windows',type:'checkbox',checked:state.startup.enabled,enabled:state.startup.available,click:item=>{try{state.startup=startup.set(item.checked);}catch(e){state.error=e.message;}refreshTray();send();}},
          {type:'separator'},
          {label:'Quit companion (stops live controls)',click:()=>app.quit()}
        ]));refreshTray();tray.on('double-click',open);
        win.on('close',event=>{if(!quitting){event.preventDefault();hideCompanion(win);monitor.capture(false);}});
      }
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.on('blur',()=>monitor.capture(false));
    handle('get-state', () => state);
    handle('set-startup',enabled=>{state.startup=startup.set(enabled);refreshTray();send();return state;});
    win.on('focus',()=>{if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))void updates.check({background:true});state.startup=startup.read();refreshTray();send();});
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
    handle('set-strip-visible',async enabled=>{if(typeof enabled!=='boolean')throw Error('Invalid plugin strip setting');leaveMode();desk.save({...desk.config,stripEnabled:enabled});try{appliedAppearance='';await syncAppearance();state.error='';state.feedback=(enabled?'Plugin strip shown.':'Plugin strip hidden. Screen widgets stay visible.')+(!state.strip?' Saved; reconnect the keyboard to apply.':'');}catch(e){state.error='Setting saved, but the display could not update. Reconnect the keyboard and retry. '+e.message;}send();return state;});
    handle('save-widget-order',(order,weatherMotion)=>{if(typeof weatherMotion!=='boolean')throw Error('Choose a weather animation setting.');desk.save({...desk.config,widgetFavorites:order,weatherMotion});state.widgetRotationRevision=(state.widgetRotationRevision||0)+1;if(strip.config)strip.config.weatherMotion=weatherMotion;send();return state;});
    handle('timer-command',async(action,minutes)=>{if(action==='start'){desk.save({...desk.config,timerMinutes:minutes});}desk.countdown.command(action,desk.config.timerMinutes);send();await refreshStrip(false);return state;});
    const keyboardSkins=new(require('./keyboard-skins.cjs').KeyboardSkins)(app.getPath('userData'));
    handle('keyboard-skins',(action,input)=>{if(action==='select'||action==='default')leaveMode();return displayTasks.run(()=>keyboardSkins.action(action,input));});
    handle('open-unreal-setup',()=>require('./unreal-tools.cjs').openSetup(url=>shell.openExternal(url)));
    handle('open-support',()=>shell.openExternal('https://buymeacoffee.com/woii'));
    unrealDock=new(require('./unreal-dock.cjs').UnrealDock)(()=>win);
    const studioService=require('./studio-service.cjs').createStudioService(app.getPath('userData'),{editorDock:unrealDock,runExclusive:task=>displayTasks.run(()=>{leaveMode();return task();})});
    handle('studio-request',studioService);
    void studioService('dependencies-resume',null).catch(error=>{console.error('Creator tools check:',error.message);});
    handle('skin-library',()=>skinLibrary.view());
    handle('skin-import',(name,bytes)=>{const id=skinLibrary.import(name,bytes);return{...skinLibrary.view(),importedId:id};});
    handle('skin-archive',(id,value)=>{skinLibrary.archive(id,value);return skinLibrary.view();});
    handle('skin-select',id=>{if(id){const item=skinLibrary.find(id);if(item.archived)throw Error('Restore this skin before selecting it.');}desk.save({...desk.config,skinId:id});state.feedback='Skin selected for your saved profile. This does not install or change the keyboard skin.';send();return state;});
    handle('skin-export',async id=>{const item=skinLibrary.find(id),result=await dialog.showSaveDialog(win,{title:'Export library skin',defaultPath:item.name,filters:[{name:'Unreal skin',extensions:['pak']}]});if(!result.canceled&&result.filePath)await fs.promises.copyFile(skinLibrary.file(id),result.filePath);return{cancelled:result.canceled};});
    handle('profile-action',async(action,input={})=>{if(!input||typeof input!=='object')throw Error('Invalid profile request');if(action==='create'||action==='replace')profiles.save(input.name,action==='replace'?input.id:undefined);else if(action==='link')profiles.link(input.id,input.app);else if(action==='remove')profiles.remove(input.id);else if(action==='enable'){if(input.enabled)throw Error('Automatic app profiles have been retired. Choose your design in Skin Studio.');profiles.enable(false);}else if(action==='load')await profiles.load(input.id);else throw Error('Unknown profile action');send();return state;});
    handle('pick-profile-app',async()=>{const result=await dialog.showOpenDialog(win,{title:'Choose an app for this profile',properties:['openFile'],filters:[{name:'Windows app',extensions:['exe']}]});return result.canceled?'':path.win32.basename(result.filePaths[0]).toLowerCase();});
    handle('preview-layout',(config,flags)=>require('./layout-preview.cjs').preview(config,{media:state.media,youtubeMusic:state.youtubeMusic,youtubeMusicByTarget:state.youtubeMusicByTarget,youtube:state.youtube,live:desk.live.state,chat:desk.chat.state,timer:desk.countdown.view(),obs:desk.obsStatus,language:desk.referenceLanguage,locks:desk.locks,bindingLayers:desk.bindingLayers},flags));
    handle('youtube-music-target',async target=>{desk.saveMusicTarget(target);youtubeMusic.target=desk.config.youtubeMusicTarget;youtubeMusic.source='';state.youtubeMusic=youtubeMusic.view();state.error='';state.feedback='YouTube Music widget player saved.';send();await refreshYoutubeMusic();return state;});
    handle('youtube-music-source',async source=>{source=require('./music-source.cjs').validateSource(source);if(source&&!state.youtubeMusic.sources?.some(s=>s.id===source)&&source!==desk.config.youtubeMusicSource)throw Error('Play a track and select an available Windows media source.');desk.save({...desk.config,youtubeMusicSource:source});youtubeMusic.source=source;state.youtubeMusic=youtubeMusic.view();send();await refreshYoutubeMusic();return state;});
    handle('save-widget',async widget=>{leaveMode();try{if(widget?.type==='text'&&!widget.text?.trim())throw Error('Enter some custom text first.');let next={...desk.config,widget,widgetOrder:require('./widget-cycle.cjs').includeWidget(desk.config.widgetOrder,widget?.type)};if(widget?.type==='weather'&&!next.weather.location)try{next.weather={...next.weather,location:await desk.system.request('windows-location')};}catch{}desk.save(next);widgetSources?.sample(widget?.type);if(widget?.type==='weather'&&desk.config.weather.location)await desk.live.weather(true);state.widgetRotationRevision=(state.widgetRotationRevision||0)+1;state.widgetRevision=(state.widgetRevision||0)+1;await displayTasks.run(async()=>{if(!state.strip)return;strip.setWidget(desk.config.widget);await strip.refreshLive();appliedAppearance=JSON.stringify(desk.config);});state.error='';state.feedback=state.strip?'Screen widget saved and displayed.':'Widget saved. Reconnect the keyboard to display it.';}catch(e){state.error=e.message;}send();return state;});
    handle('save-desk', async config=>{config={...config,sleepMinutes:desk.config.sleepMinutes,languageId:desk.config.languageId,physicalLanguage:desk.config.physicalLanguage,youtubeMusicTarget:desk.config.youtubeMusicTarget,youtubeMusicSource:desk.config.youtubeMusicSource,pluginShortcuts:desk.config.pluginShortcuts};leaveMode();try{if(!config.weather?.location&&(config.slots?.some(s=>s?.plugin==='weather')||config.widget?.type==='weather'))try{config.weather={location:await desk.system.request('windows-location'),unit:config.weather?.unit||'auto'};}catch{}const weatherChanged=JSON.stringify(config.weather)!==JSON.stringify(desk.config.weather);desk.save(config);if(weatherChanged&&config.weather?.location)void desk.live.weather(true).then(send).catch(()=>{});updateNavigation();appliedAppearance='';await syncAppearance();state.error='';state.feedback=state.strip?'Saved to the companion and keyboard strip.':'Saved to the companion. Reconnect the keyboard to apply the strip.';}catch(e){state.error=`${e.message} Settings may be saved locally; retry Apply to refresh the keyboard.`;}send();return state;});
    handle('set-slot',async input=>{desk.saveSlot(input);leaveMode();updateNavigation();send();try{await syncAppearance();state.error='';state.feedback=state.strip?'Plugin action saved to keyboard.':'Plugin action saved. Reconnect the keyboard to display it.';}catch(error){state.error='Action saved locally, but the keyboard display could not update. '+error.message;}send();return state;});
    handle('run-slot', index=>runSlot(index));
    handle('media-key',async action=>{const codes={previous:177,next:176,toggle:179,volumeup:175,volumedown:174,volumemute:173};if(!Object.hasOwn(codes,action))throw Error('Unknown media control');await desk.system.request('keys',[codes[action]]);return state;});
    handle('pick-app',()=>desk.pick());
    let telemetryBusy=false;handle('read-telemetry',async()=>{if(telemetryBusy)throw Error('Reading keyboard settings.');telemetryBusy=true;try{state.telemetry=await require('./telemetry.cjs').readTelemetry();send();return state;}finally{telemetryBusy=false;}});
    handle('reconnect-keyboard',async()=>{if(connectionRecovery)connectionRecovery.blocked=false;automaticSetupSuspended=false;await recoverKeyboardConnection();return state;});
    handle('read-keymap',async()=>{const keys=await desk.editor.read();desk.baseLabels=keys.layers.find(l=>l.id===0).keys.map(k=>k.label);desk.bindingLayers=Object.fromEntries(keys.layers.map(l=>[l.id,l.keys.map(k=>k.binding)]));send();appliedAppearance='';await syncAppearance();return keys;});
    handle('list-languages',()=>require('./languages.cjs').list());
    widgetSources=new(require('./widget-sources.cjs').WidgetSources)(app.getPath('userData'));
    handle('widget-sources',()=>widgetSources.view());
    handle('enable-game-monitoring',async()=>{
      const script=path.join(__dirname,'enable-game-monitoring.ps1');
      const escaped=script.replace(/'/g,"''");
      const command=`$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $args='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${escaped}" -UserSid '+$sid; try {$p=Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList $args -Wait -PassThru; if($p.ExitCode -ne 0){exit 1}}catch{exit 1}`;
      await new Promise((resolve,reject)=>require('node:child_process').execFile('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,timeout:120000},error=>error?reject(Error('Game monitoring permission was cancelled or could not be enabled.')):resolve()));
      return 'Permission added. Sign out of Windows and sign back in before starting game capture. Companion does not sign you out automatically.';
    });

    handle('save-widget-sources',input=>{const result=widgetSources.save(input);Object.assign(desk.live.state,widgetSources.state);widgetSources.sample(desk.config.widget.type);send();return result;});
    handle('pick-widget-source',async kind=>{if(kind!=='game')throw Error('Unknown widget source');const r=await dialog.showOpenDialog({title:'Choose game executable',properties:['openFile'],filters:[{name:'Windows executable',extensions:['exe']}]});if(r.canceled)return widgetSources.view();const file=r.filePaths[0];if(path.extname(file).toLowerCase()!=='.exe')throw Error('Choose a game executable');widgetSources.game=path.basename(file);return widgetSources.save(widgetSources.config);});
    handle('screenshot-folder',()=>desk.system.request('screenshot-folder'));
    handle('choose-screenshot-folder',async()=>{const result=await dialog.showOpenDialog({title:'Choose Windows screenshot folder',properties:['openDirectory','createDirectory']});if(result.canceled||!result.filePaths[0])return desk.system.request('screenshot-folder');return desk.system.request('set-screenshot-folder',result.filePaths[0]);});
    handle('set-language',async(id,save=true)=>{
      if(typeof save!=='boolean')throw Error('Invalid layout setting');if(save&&desk.settingsError)throw Error(desk.settingsError);
      const language=await require('./languages.cjs').map(id);
      if(!save){desk.referenceLanguage=language;return {...language,native:null};}
      if(!state.strip)throw Error('Connect the keyboard and wait for the display to be ready before applying a language.');
      const previous=desk.config;
      await displayTasks.run(async()=>{if(!strip.legends.model)await strip.languageDefault.capture(strip.som);else if(!strip.languageDefault.read(strip.som)){if(id!=='qwerty')throw Error('Choose Default first to restore your XPANEL artwork and save it before switching languages.');await strip.legends.restore(strip.som);await strip.languageDefault.capture(strip.som);}});
      const previousNative=await displayTasks.run(()=>strip.som.language());
      const native={applied:true,renderer:id==='qwerty'?'original':'companion'};
      try{
        desk.config=desk.validate({...previous,languageId:id,physicalLanguage:native.renderer==='companion'});
        appliedAppearance='';await syncAppearance();if(!state.strip||appliedAppearance!==JSON.stringify(desk.config))throw Error('The keyboard disconnected before the layout could be applied. Reconnect and retry.');native.renderer=strip.legends.model?'companion':id==='qwerty'?'original':'native';desk.save(desk.config);desk.referenceLanguage=language;state.error='';send();
      }catch(error){desk.config=previous;appliedAppearance='';try{await displayTasks.run(async()=>{if(!strip.som)throw Error('Keyboard disconnected');await strip.som.language(previousNative);if(await strip.som.language()!==previousNative)throw Error('Legend language readback differed');});await syncAppearance();}catch(restoreError){throw Error(error.message+' The previous layout could not be restored: '+restoreError.message);}throw error;}
      return {...language,native};
    });
    handle('language-settings',()=>shell.openExternal('ms-settings:regionlanguage'));
    handle('capture-key',enabled=>{if(typeof enabled!=='boolean')throw Error('Invalid capture setting');monitor.capture(enabled&&win.isFocused());return true;});
    handle('capture-plugin-key',enabled=>{if(typeof enabled!=='boolean')throw Error('Invalid capture setting');pluginKeyCapture=enabled&&win.isFocused();monitor.capture(pluginKeyCapture);return true;});
    handle('search-city',city=>desk.live.search(city));
    handle('windows-location',async()=>{try{return await desk.system.request('windows-location');}catch{throw Error('Windows location is unavailable or disabled. Choose a city manually.');}});
    handle('set-weather',async(location,unit)=>{const next={...desk.config,weather:{location,unit}};desk.save(next);await desk.live.weather(true);send();return state;});
    handle('connect-twitch',async channel=>{twitch.start(channel);send();return state;});
    handle('cancel-twitch',()=>{twitch.cancel();send();return state;});
    handle('disconnect-service',async name=>{if(name==='obs'){await desk.obs?.disconnect();desk.obs=null;desk.obsStatus={connected:false};}else if(name==='twitch')await twitch.disconnect();else throw Error('Unknown connection');send();return state;});
    handle('check-setup',async()=>{if(setupBusy||desk.editor.busy)throw Error('Wait for the current keyboard operation.');setupBusy=true;try{state.setupReport=await displayTasks.run(()=>require('./setup-report.cjs').collectSetupReport({version:app.getVersion(),directory:hardwareDirectory}));state.setupReport.shortcutListeners={plugin:globalShortcut.isRegistered('Control+Alt+P'),widget:globalShortcut.isRegistered('Control+Alt+F12')};state.setupReport.shortcutHistory=shortcutHealth.view();state.setupReport.runtime={monitorConnected:monitor.status().connected,displayConnected:!!state.strip,appearanceApplied:!!appliedAppearance,recoveryBlocked:!!connectionRecovery?.blocked};if(state.setupFailure)state.setupReport.lastSetupFailure=state.setupFailure;send();return state;}finally{setupBusy=false;}});
    handle('dismiss-update-notes',version=>{const next=updateNotes.dismiss(version);send();return next;});
    handle('set-plugin-shortcuts',async settings=>{
      leaveMode();
      const saved=await setupOperation(()=>require('./plugin-shortcuts.cjs').configure(hardwareDirectory,settings));
      desk.save({...desk.config,pluginShortcuts:saved});monitor.pluginPosition=saved.position;state.shortcutWarning='';
      appliedAppearance='';await syncAppearance();state.error='';state.feedback='Keyboard shortcuts saved. '+require('./plugin-shortcuts.cjs').label(saved)+' opens plugins.';send();return state;
    });
    handle('copy-setup-report',()=>{if(!state.setupReport)throw Error('Run Check setup first.');clipboard.writeText(JSON.stringify(state.setupReport,null,2));return true;});
    const setupReview=plan=>({token:plan.id,pending:plan.pending,shortcuts:plan.includeWidget?['L1 + P','L1 + /']:['L1 + P'],layerCount:plan.map.layers.length,displaySlots:plan.ownedSlots,preservedOverlaySlots:plan.preservedSlots});
    async function setupOperation(action, initialize=false){
      if(quitting)throw Error('The companion is closing. Open it again before starting keyboard setup.');
      if(setupBusy||desk.editor.busy)throw Error('Wait for the current keyboard operation.');
      let completeSetup;setupFinished=new Promise(resolve=>{completeSetup=resolve;});
      setupBusy=true;state.setupRunning=true;state.setupFailure=null;
      try{send();const result=await displayTasks.run(action);
        if(quitting)return initialize?state:result;
        if(initialize&&result?.needsConfirmation){setupPlan=result.plan;state.setupRecovery=setupReview(setupPlan);state.error='';state.feedback='Setup found pending keyboard settings. Recovery is ready; confirm keeping the current configuration to continue.';send();return state;}
        const backup=result?.backup||result;
        if(initialize){
          const result=await displayTasks.run(()=>require('./plugin-shortcuts.cjs').configureStartup(hardwareDirectory,desk.config.pluginShortcuts));
          desk.save({...desk.config,pluginShortcuts:result.settings});monitor.pluginPosition=result.settings.position;state.shortcutWarning=result.warning;
          if(quitting)return state;
        }
        if(initialize){state.strip=strip.connect();appliedAppearance='';send();try{await desk.live.sample();}catch{}if(quitting)return state;try{await syncAppearance();if(quitting)return state;monitor.start();}catch(error){error.configurationVerified=true;error.writesAttempted=true;error.code='KEYBOARD_DISPLAY_INITIALIZATION_FAILED';error.stage='initialize_display';error.message='Shortcuts were saved, but the display could not initialize. '+error.message;throw error;}state.feedback='Keyboard setup complete. Original settings are backed up on this PC.';}
        if(initialize){recoveryVerified=true;automaticSetupSuspended=false;}state.error='';if(initialize&&backup?.preservedSlots?.length)state.feedback+=' Existing display overlays were preserved.';if(initialize&&backup?.pendingAfterSetup)state.feedback+=' The firmware still reports a pending flag, but saving and the current settings were verified.';send();return initialize?state:result;
      }catch(error){state.setupFailure=require('./keyboard-errors.cjs').setupFailure(error);state.error=state.setupFailure.message;send();throw error;}finally{setupBusy=false;state.setupRunning=false;try{send();}finally{completeSetup();}}
    }
    async function beginKeyboardSetup(){if(state.strip)return state;return setupOperation(()=>{setupPlan=null;state.setupRecovery=null;return require('./setup-transaction.cjs').startSetup(hardwareDirectory,{includeWidget:widgetShortcutReady});},true);}
    async function recoverKeyboardConnection(){
      if(desk.settingsError){state.error=desk.settingsError;send();return;}
      if(quitting||setupBusy||displayTasks.paused||desk.editor.busy||state.setupRecovery||automaticSetupSuspended)return;
      leaveMode();state.connectionRecovering=true;send();
      try{
        await setupOperation(async()=>{
          monitor.close();strip.detach();state.strip=false;appliedAppearance='';
          await require('./hid.cjs').shutdown();
          state.device=await inspectDevice(false);
          if(quitting)throw Object.assign(Error('Companion is closing.'),{code:'APP_CLOSING'});
          if(!state.device.keyboard||!state.device.display)throw Object.assign(Error('Waiting for both keyboard USB interfaces. Reconnecting automatically…'),{code:'CONNECTION_UNAVAILABLE',writesAttempted:false});
          const file=path.join(hardwareDirectory,'hardware.json');
          if(fs.existsSync(file)){const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.restored||saved.setupInProgress)throw Object.assign(Error(saved.restored?'Keyboard settings were restored. Review current settings to enable Companion again.':'An earlier setup did not finish. Review current settings before continuing.'),{code:'SETUP_REVIEW_REQUIRED',writesAttempted:false});}
          return require('./setup-transaction.cjs').startSetup(hardwareDirectory,{includeWidget:widgetShortcutReady});
        },true);
        recoveryVerified=!!state.strip&&!state.setupRecovery;
        if(state.setupRecovery&&win.isVisible())win.webContents.send('automatic-setup-review',state.setupRecovery);
        if(recoveryVerified){state.deviceError='';state.setupFailure=null;state.feedback='Keyboard connected. Saved plugins and widgets are live.';}
      }catch(error){recoveryVerified=false;throw error;}
      finally{state.connectionRecovering=false;send();}
    }
    handle('setup-keyboard',()=>{suspendAutomaticSetup();return beginKeyboardSetup();});
    handle('prepare-setup-recovery',()=>{suspendAutomaticSetup();return setupOperation(async()=>{setupPlan=null;state.setupRecovery=null;const plan=await require('./setup-transaction.cjs').prepareSetup(hardwareDirectory,{includeWidget:widgetShortcutReady,reviewPending:true});if(plan.alreadyInstalled)return{alreadyInstalled:true};setupPlan=plan;state.setupRecovery=setupReview(plan);return state.setupRecovery;});});
    handle('confirm-setup-recovery',token=>{suspendAutomaticSetup();return setupOperation(()=>{if(typeof token!=='string'||!setupPlan||setupPlan.id!==token)throw Error('Review the current keyboard settings again before continuing.');const plan=setupPlan;setupPlan=null;state.setupRecovery=null;return require('./setup-transaction.cjs').commitSetup(hardwareDirectory,plan,{acceptPending:true});},true);});
    handle('cancel-setup-recovery',()=>{suspendAutomaticSetup();if(setupBusy)throw Error('Wait for the current keyboard operation.');setupPlan=null;state.setupRecovery=null;state.feedback='Setup review closed. You can start setup again.';send();return true;});
    handle('restore-keyboard',async()=>{leaveMode();if(strip.updating)throw Error('Wait for the display update to finish.');await strip.close();state.strip=false;await require('./setup.cjs').restore(hardwareDirectory);state.feedback='Original plugin key and overlay restored. Your other remaps remain.';send();return state;});
    handle('change-key',async data=>{await desk.editor.change(data.layer,data.position,data.value,data.mods,data.swap);const keys=desk.editor.view();desk.baseLabels=keys.layers.find(l=>l.id===0).keys.map(k=>k.label);desk.bindingLayers=Object.fromEntries(keys.layers.map(l=>[l.id,l.keys.map(k=>k.binding)]));send();refreshKeyAppearance();return keys;});
    handle('undo-key',async()=>{await desk.editor.undo();const keys=desk.editor.view();desk.baseLabels=keys.layers.find(l=>l.id===0).keys.map(k=>k.label);desk.bindingLayers=Object.fromEntries(keys.layers.map(l=>[l.id,l.keys.map(k=>k.binding)]));send();refreshKeyAppearance();return keys;});
    handle('save-key-icons',async icons=>{desk.save({...desk.config,keyIcons:require('./media-icons.js').normalize(icons)});refreshKeyAppearance();send();return desk.config.keyIcons;});
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
    await refresh();
    if(!process.argv.includes('--verify')){community.refresh().then(send).catch(()=>{});xpanelSkins.refresh().then(send).catch(()=>{});}
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))twitch.restore().then(send).catch(()=>{});
    if (process.argv.includes('--smoke')) {
      console.log(JSON.stringify({ ready: true, keyboard: !!state.device.keyboard, display: !!state.device.display, spotify: !!state.media.available }));
      app.quit(); return;
    }
    if(!process.argv.includes('--verify')){setTimeout(()=>updates.check({background:true}),10000).unref();setInterval(()=>updates.check({background:true}),5*60000).unref();}
    mediaPoll=new MediaPoll(refresh,()=>state.media);mediaPoll.start();youtubeMusicPoll=youtubeMusic;youtubeMusicPoll.start();youtubePoll=new MediaPoll(refreshYoutube,()=>state.youtube);youtubePoll.start();
    if(desk.config.sleepMinutes!==null&&!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))setTimeout(()=>sleepService.configure(desk.config.sleepMinutes).catch(error=>{state.error='Display sleep: '+error.message;send();}),20000).unref();
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))stripTimer=setInterval(()=>{if(desk.countdown.view().running)send();if(strip.data)strip.data.timer=desk.countdown.view();refreshStrip();},500);
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke'))liveTimer=setInterval(async()=>{if(liveBusy||quitting)return;liveBusy=true;try{await desk.live.sample();const needPerformance=desk.config.widget.type==='performance'||desk.config.slots.some(s=>s?.plugin==='performance');const foreground=needPerformance?await desk.system.request('foreground-app').catch(()=>''):'';if(needPerformance)widgetSources?.sample('performance',foreground);if(desk.config.widget.type!=='performance')widgetSources?.sample(desk.config.widget.type,foreground,needPerformance);Object.assign(desk.live.state,widgetSources?.state||{});await desk.sampleObs();send();}catch(e){state.error=e.message;send();}finally{liveBusy=false;}},1500);
    if(!process.argv.includes('--verify'))lockTimer=setInterval(async()=>{if(lockBusy||quitting)return;lockBusy=true;try{desk.locks=await desk.system.request('locks');if(state.strip)strip.setLocks(desk.locks);if(strip.error)state.error=`Keyboard selection: ${strip.error}. Apply your slots again to retry.`;send();}catch(e){state.error=e.message;send();}finally{lockBusy=false;}},2000);
    if(!process.argv.includes('--verify')&&!process.argv.includes('--smoke')){
      connectionRecovery=new(require('./connection-recovery.cjs').ConnectionRecovery)();let lastBindingCheck=0,checkingConnection=false;
      async function maintainConnection(){
        if(checkingConnection||quitting||setupBusy||displayBusy||displayTasks.paused||desk.editor.busy||state.setupRecovery||automaticSetupSuspended)return;
        checkingConnection=true;
        try{
          if(state.strip&&recoveryVerified&&!monitor.status().connected){shortcutHealth.record('monitor-stopped',{displayConnected:true,monitorConnected:false});state.strip=false;recoveryVerified=false;state.deviceError='Keyboard input monitoring stopped. Reconnecting automatically…';}
          if(state.strip&&recoveryVerified&&!strip.error&&Date.now()-lastBindingCheck>60000){
            lastBindingCheck=Date.now();
            const keys=await desk.editor.read();
            shortcutHealth.record('binding-check',{shortcuts:require('./shortcut-status.cjs').shortcutStatus(keys),monitorConnected:monitor.status().connected,displayConnected:state.strip});
            if(!require('./shortcut-status.cjs').shortcutsReady(keys,widgetShortcutReady)){state.strip=false;recoveryVerified=false;state.deviceError='Keyboard shortcuts changed. Checking L1, L1 + P and L1 + /…';}
          }
          await connectionRecovery.run({eligible:!state.strip||!recoveryVerified||!!strip.error,recover:recoverKeyboardConnection});
        }catch(error){state.error=error.message;if(require('./connection-recovery.cjs').retryable(error)){state.strip=false;recoveryVerified=false;state.deviceError='Keyboard connection interrupted. Reconnecting automatically…';}send();}
        finally{checkingConnection=false;}
      }
      connectionTimer=setInterval(()=>void maintainConnection(),10000);connectionTimer.unref();void maintainConnection();
    }
    if (process.argv.includes('--verify')) {
      try { await require('../tests/desktop-verify.cjs')({ win, state, media }); }
      catch (error) { console.error(error); process.exitCode = 1; }
      finally { app.quit(); }
    }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', require('./shutdown.cjs').shutdownGate(async()=>{
    if(unrealDock)await unrealDock.shutdown();
    quitting=true;clearInterval(connectionTimer);clearInterval(automaticSetupTimer);clearInterval(profileTimer);clearInterval(timer);clearInterval(stripTimer);clearInterval(lockTimer);clearInterval(liveTimer);clearTimeout(modeTimeout);
    globalShortcut.unregisterAll();mediaPoll?.close();youtubeMusicPoll?.close();youtubePoll?.close();
    // A setup transaction may still be saving or finishing its display upload.
    // Keep its resources alive until it exits; quitting guards prevent new init.
    await setupFinished;
    if(sleepService)await sleepService.close().catch(error=>{state.error='Could not restore display sleep on exit: '+error.message;});
    community?.close();twitch?.close();widgetCycle?.close();monitor.close();media.close();youtubeMusic.close();youtube.close();widgetSources?.close();desk?.close();
    // Drain queued display work and the current transfer before restoring the overlay.
    await displayTasks.run(()=>strip.close());
    await require('./hid.cjs').shutdown();
  },()=>app.quit(),error=>{state.error='Keyboard cleanup did not finish. Please retry Quit from the tray menu.';send();}));
}
