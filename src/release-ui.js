function formatCountdown(seconds){seconds=Math.max(0,Math.ceil(seconds||0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
let captureTimer,releaseLoaded=false,cityRevision=0,widgetRevision=0;
function releaseRoute(){const pages=['library','keyboard','widgets','connections','community','skins'];const page=pages.includes(location.hash.slice(1))?location.hash.slice(1):'library';document.querySelectorAll('[data-page]').forEach(s=>s.hidden=s.dataset.page!==page);document.querySelectorAll('.sidebar a').forEach(a=>{a.hash==='#'+page?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');});const h=document.querySelector(`[data-page="${page}"] h1`);document.title=h.textContent+' · Centerpiece Companion';h.focus();if(page!=='keyboard'){void window.companion.captureKey(false).catch(()=>{});stopCapture();}else if(!keymap&&deskCurrent&&!deskBusy){task(el('read-keyboard'),async()=>{keymap=await window.companion.readKeymap();drawKeyboard();el('key-status').textContent=keymap.sample?'Sample bindings loaded · local preview. Physical keys are unchanged.':'Live bindings loaded. Select a key.';announce('');});}}
window.removeEventListener('hashchange',route);window.addEventListener('hashchange',releaseRoute);releaseRoute();
const oldDrawKeyboard=drawKeyboard;
drawKeyboard=function(){oldDrawKeyboard();if(!keymap)return;const map=el('keyboard-map');const buttons=[...map.querySelectorAll('.key')];map.replaceChildren();map.classList.add('physical-board');buttons.forEach((button,index)=>{const k=keymap.layout.keys[index];button.style.left=((k.x||0)/1800*100)+'%';button.style.top=((k.y||0)/500*100)+'%';button.style.width=(k.width/1800*100)+'%';button.style.height=(k.height/500*100)+'%';button.textContent=selectedLayer().keys[index].label;button.setAttribute('aria-label',`${selectedLayer().keys[index].name}, assigned ${selectedLayer().keys[index].label}`);map.append(button);});const strip=document.createElement('div');strip.className='board-strip';strip.setAttribute('aria-hidden','true');for(const [index,s] of draft.slots.entries()){const p=deskCurrent.desk.catalog.find(p=>p.id===s?.plugin);const tile=document.createElement('div');if(p){const img=document.createElement('img');img.src=`icons/${p.icon}.svg`;img.alt='';tile.append(img);}else tile.textContent='+';if(index===4){tile.className='board-extra-plugin';tile.setAttribute('aria-label','Optional plugin position 5');map.append(tile);}else strip.append(tile);}map.append(strip);const widget=document.createElement('button');widget.className='board-widget';widget.textContent='Screen widget';widget.addEventListener('click',()=>{location.hash='widgets';});map.append(widget);};
function stopCapture(){clearTimeout(captureTimer);el('capture-key').textContent='Press a key to select';el('capture-key').setAttribute('aria-pressed','false');}
el('capture-key').addEventListener('click',()=>task(el('capture-key'),async()=>{if(!keymap){keymap=await window.companion.readKeymap();drawKeyboard();}await window.companion.captureKey(true);el('capture-key').textContent='Press a key now…';el('capture-key').setAttribute('aria-pressed','true');announce('Listening for one physical key for 10 seconds. Nothing is recorded.');captureTimer=setTimeout(()=>{stopCapture();announce('Key selection timed out. Try again.');},10000);}));
window.companion.subscribeKey(position=>{stopCapture();selectedKey=position;drawKeyboard();announce('Selected '+selectedLayer().keys[position].name+'.');});
async function configChange(change){const next=structuredClone(draft);change(next);await saveDesk(next);}
function bind(id,fn){el(id).addEventListener('click',()=>task(el(id),fn));}
bind('save-layer',()=>configChange(c=>c.layerColor=el('layer-match').checked?'':el('layer-color').value));
bind('save-widget',async()=>{const widget={...(window.editingWidget?.()||draft.widget),type:el('widget-type').value,clockSeconds:el('clock-seconds').checked,text:el('widget-text').value,textStyle:window.readTextCustomization?.()||(window.editingWidget?.()||draft.widget).textStyle};for(const k of ['x','y','width','height'])widget[k]=Number(el('widget-'+k).value);const state=await window.companion.saveWidget(widget,window.widgetEditIndex||0);draft=structuredClone(state.desk.config);renderRelease(state);announce(state.error||state.feedback,!!state.error);});
bind('save-sensors',()=>configChange(c=>c.sensors=el('enable-lhm').checked));
async function chooseWeather(location){const state=await window.companion.setWeather(location,el('weather-unit').value);draft=structuredClone(state.desk.config);renderRelease(state);await saveDesk(draft);announce(state.desk.live.weatherError||'Weather location saved on this PC.',!!state.desk.live.weatherError);}
bind('windows-location',async()=>chooseWeather(await window.companion.windowsLocation()));
bind('find-city',async()=>{const revision=++cityRevision;const results=await window.companion.searchCity(el('city-search').value);if(revision!==cityRevision)return;el('city-results').replaceChildren();if(!results.length){announce('No matching city. Try adding a country or region.');return;}for(const result of results){const button=document.createElement('button');button.className='button';button.textContent=result.name;button.addEventListener('click',()=>task(button,()=>chooseWeather(result)));el('city-results').append(button);}announce('Choose the matching location below.');});
el('city-search').addEventListener('input',()=>{cityRevision++;el('city-results').replaceChildren();});
bind('connect-twitch',async()=>{if(deskCurrent?.desk?.chat?.auth?.pending){renderRelease(await window.companion.cancelTwitch());return;}renderRelease(await window.companion.connectTwitch(el('twitch-channel').value.trim()));announce('Approve Twitch in your browser. You can keep using the companion.');});
for(const name of ['obs','twitch'])bind('disconnect-'+name,async()=>{renderRelease(await window.companion.disconnectService(name));announce('Disconnected '+name+'.');});
bind('setup-device',async()=>{const state=await setupUIAction(()=>window.companion.setupKeyboard());if(!state)return;renderRelease(state);announce(state.feedback);if(state.setupRecovery)window.dispatchEvent(new CustomEvent('setup-review-ready',{detail:state.setupRecovery}));});
bind('restore-device',async()=>{const state=await window.companion.restoreKeyboard();renderRelease(state);announce(state.feedback);});
function renderRelease(state){if(!state.desk)return;deskCurrent=state;if((state.widgetRevision||0)!==widgetRevision){widgetRevision=state.widgetRevision;draft.widget=structuredClone(state.desk.config.widget);draft.extraWidgets=structuredClone(state.desk.config.extraWidgets||[]);const editing=window.editingWidget?.()||draft.widget;el('widget-type').value=editing.type;el('widget-text').value=editing.text;el('clock-seconds').checked=!!editing.clockSeconds;for(const k of ['x','y','width','height'])el('widget-'+k).value=editing[k];}el('setup-banner').hidden=!!state.strip||!(state.setupRecovery||state.setupFailure?.canRecover||state.setupReport?.lastSetupFailure?.canRecover);for(const id of ['capture-key','save-layer','save-widget','save-sensors','windows-location','find-city','connect-twitch','disconnect-twitch','disconnect-obs','setup-device','restore-device'])if(!el(id).hasAttribute('aria-busy'))el(id).disabled=false;el('restore-device').disabled=!state.strip||!!state.setupRunning;el('setup-device').disabled=!!state.setupRunning||el('setup-device').hasAttribute('aria-busy');
 if(!releaseLoaded){releaseLoaded=true;const c=state.desk.config;el('layer-match').checked=!c.layerColor;el('layer-color').value=c.layerColor||c.indicator.on;el('widget-type').value=c.widget.type;el('widget-text').value=c.widget.text;el('clock-seconds').checked=!!c.widget.clockSeconds;for(const k of ['x','y','width','height'])el('widget-'+k).value=c.widget[k];el('weather-unit').value=c.weather.unit;el('enable-lhm').checked=c.sensors;}
 const videoNote=document.getElementById('youtube-video-note');if(videoNote)videoNote.hidden=el('widget-type').value!=='youtube';renderYoutubeMusicTarget(state);
 const live=state.desk.live;el('weather-status').textContent=live.weather?`${live.weather.temperature}${live.weather.unit} · ${live.weather.label} · ${live.weather.location||'Selected location'} · Open-Meteo · Reading ${new Date(live.weather.observedAt||live.weather.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}${live.weather.feelsLike!=null?' · Feels like '+live.weather.feelsLike+live.weather.unit:''}${live.weather.humidity!=null?' · Humidity '+live.weather.humidity+'%':''}${live.weather.windKmh!=null?' · Wind '+Math.round(live.weather.unit==='°F'?live.weather.windKmh/1.609344:live.weather.windKmh)+(live.weather.unit==='°F'?' mph':' km/h'):''}${live.weatherError?' · Last reading; refresh unavailable':''}`:live.weatherError;el('sensor-status').textContent=`CPU ${live.cpuLoad??'—'}% · CPU temperature ${live.cpuTemp??'—'}°C · GPU ${live.gpuTemp??'—'}°C. ${live.sensorError}`;el('twitch-status').textContent=state.desk.chat.auth?.status||'Not connected';el('connect-twitch').textContent=state.desk.chat.auth?.pending?'Cancel connection':'Connect with Twitch';if(!el('twitch-channel').value&&state.desk.chat.auth?.channel)el('twitch-channel').value=state.desk.chat.auth.channel;
 const preview=el('widget-preview');const type=el('widget-type').value;const musicWidget=['spotify','youtubemusic','youtube'].includes(type),music=(type==='youtube'?state.youtube:type==='youtubemusic'?state.youtubeMusic:state.media)||{};const heading=document.createElement('strong'),detail=document.createElement('span');heading.textContent=musicWidget?(music.title||(type==='youtube'?'Play YouTube':type!=='spotify'?'YouTube Music':'Open Spotify')):type==='weather'?(live.weather?live.weather.temperature+live.weather.unit:'Choose location'):type==='cpu'?`${live.cpuTemp??live.cpuLoad??'—'}${live.cpuTemp!=null?'°C':'%'}`:type==='gpu'?`${live.gpuTemp??'—'}°C`:type==='timer'?formatCountdown(state.desk.timer?.remaining??1500):type==='obs'?(state.desk.obsStatus?.streaming?'ON AIR':state.desk.obsStatus?.recording?'RECORDING':state.desk.obsStatus?.connected?'OBS READY':'Connect OBS'):type==='twitch'?'TWITCH CHAT':type==='text'?el('widget-text').value:type==='off'?'Widget off':new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',...(el('clock-seconds').checked?{second:'2-digit'}:{})});detail.textContent=musicWidget?(music.artist||''):type==='twitch'?state.desk.chat.message:'Detail display preview';const previewKey=JSON.stringify([type,heading.textContent,detail.textContent,musicWidget?music.art:'',type==='weather'?live.weather?.icon:'']);if(!window.widgetPreviewRendered&&preview.dataset.previewKey!==previewKey){preview.dataset.previewKey=previewKey;preview.replaceChildren(heading,detail);if(type==='weather'){const weather=document.createElement('span');weather.className='weather-motion '+(live.weather?.icon||'cloud');weather.setAttribute('aria-hidden','true');weather.textContent=({moon:'☾ ✦', 'night-cloud':'☾ ☁',partly:'☀ ☁',fog:'≋',sun:'☀',cloud:'☁',rain:'☁',snow:'☁',storm:'ϟ'})[live.weather?.icon]||'☁';preview.prepend(weather);}if(musicWidget&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(music.art||'')){const cover=document.createElement('img');cover.src=music.art;cover.alt='Album cover';cover.className='widget-art';preview.prepend(cover);}}
}
el('widget-type').addEventListener('change',()=>{const type=el('widget-type').value;if(type==='text'){renderRelease(deskCurrent);return;}task(el('widget-type'),async()=>{const state=await window.companion.saveWidget({...((window.widgetEditIndex||0)?deskCurrent.desk.config.extraWidgets[window.widgetEditIndex-1]:deskCurrent.desk.config.widget),type},window.widgetEditIndex||0);draft.widget=structuredClone(state.desk.config.widget);draft.extraWidgets=structuredClone(state.desk.config.extraWidgets||[]);draft.widgetOrder=structuredClone(state.desk.config.widgetOrder);renderRelease(state);renderFeatures(state);announce(state.error||(state.feedback+(state.desk.config.widgetOrder.includes(type)?' Included in L1 + / rotation.':'')),!!state.error);});});el('widget-text').addEventListener('input',()=>{if(el('widget-text').value.trim())el('widget-type').value='text';renderRelease(deskCurrent);});
window.companion.subscribe(renderRelease);window.companion.getState().then(renderRelease).catch(e=>announce(e.message,true));


// Plugin positions own their player; the fixed artwork widget has its own choice.
let youtubeTargetPending=false;
const youtubeTargetHelp={
 desktop:'Use the installed YouTube Music desktop player.',
 web:'Use browser playback. Your browser chooses the active media tab, including other videos.'
};
function renderYoutubeMusicTarget(state=deskCurrent){
 if(!state?.desk?.config)return;
 const value=state.desk.config.youtubeMusicTarget==='web'?'web':'desktop';
 if(draft)draft.youtubeMusicTarget=value;
 el('youtube-music-plugin-target').hidden=selectedPlugin!=='youtubemusic';
 el('youtube-music-widget-target').hidden=el('widget-type').value!=='youtubemusic';
 for(const button of document.querySelectorAll('[data-youtube-music-target]')){
  const plugin=button.dataset.youtubeMusicScope==='plugin',pending=plugin?youtubeSlotTargetPending.has(selectedPosition):youtubeTargetPending;
  button.setAttribute('aria-pressed',String(button.dataset.youtubeMusicTarget===(plugin?selectedMusicTarget:value)));
  button.disabled=plugin?!window.companion.setSlot:youtubeTargetPending||!window.companion.youtubeMusicTarget;
  if(pending)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
 }
 for(const note of document.querySelectorAll('[data-youtube-music-target-help]')){
  const plugin=note.dataset.youtubeMusicScope==='plugin';
  note.textContent=youtubeTargetHelp[plugin?selectedMusicTarget:value]+' '+(plugin?'Saves this position only; other positions keep their own player.':'Used by the fixed YouTube Music widget. Follow selected plugin uses that position’s player.');
 }
}
async function saveYoutubeMusicTarget(value){
 if(youtubeTargetPending||!Object.hasOwn(youtubeTargetHelp,value))return;
 youtubeTargetPending=true;renderYoutubeMusicTarget();announce('Saving YouTube Music widget player…');
 try{
  if(!window.companion.youtubeMusicTarget)throw Error('Music player selection is available in the desktop Companion.');
  const state=await window.companion.youtubeMusicTarget(value);
  if(!state?.desk?.config)throw Error('The player setting could not be confirmed. Try again.');
  // Only merge this setting. Slot actions and other page drafts can change while detection runs.
  const saved=state.desk.config;
  draft.youtubeMusicTarget=saved.youtubeMusicTarget==='web'?'web':'desktop';draft.youtubeMusicSource=saved.youtubeMusicSource||'';
  deskCurrent={...deskCurrent,youtubeMusic:state.youtubeMusic||deskCurrent.youtubeMusic,desk:{...deskCurrent.desk,config:{...deskCurrent.desk.config,youtubeMusicTarget:draft.youtubeMusicTarget,youtubeMusicSource:draft.youtubeMusicSource}}};
  youtubeSourceDirty=false;youtubeSourcesKey='';renderYoutubeMusic(deskCurrent);
  announce(state.error||state.feedback||'YouTube Music widget player saved.',!!state.error);
 }catch(error){announce(String(error?.message||error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,''),true);}
 finally{youtubeTargetPending=false;renderYoutubeMusicTarget();}
}
for(const button of document.querySelectorAll('[data-youtube-music-target]'))button.addEventListener('click',()=>button.dataset.youtubeMusicScope==='plugin'?saveYoutubeMusicSlotTarget(button.dataset.youtubeMusicTarget):saveYoutubeMusicTarget(button.dataset.youtubeMusicTarget));

// Keep the optional advanced source selection stable during live polls.
let youtubeSourcesKey='',youtubeSourceDirty=false;
el('youtube-music-source').addEventListener('change',()=>{youtubeSourceDirty=true;});
bind('save-youtube-music-source',async()=>{
 if(!window.companion.setYoutubeMusicSource)throw Error('Music connections are available in the desktop Companion.');
 const state=await window.companion.setYoutubeMusicSource(el('youtube-music-source').value);
 youtubeSourceDirty=false;youtubeSourcesKey='';draft.youtubeMusicSource=state.desk.config.youtubeMusicSource;renderYoutubeMusic(state);
 announce(state.error||'Music source saved for the selected YouTube Music player.',!!state.error);
});
function renderYoutubeMusic(state){
 if(!state.desk)return;
 renderYoutubeMusicTarget(state);
 const music=state.youtubeMusic||{},saved=state.desk.config.youtubeMusicSource||'',select=el('youtube-music-source');
 const sources=[...new Map((music.sources||[]).filter(s=>s&&typeof s.id==='string').map(s=>[s.id,s])).values()];
 const key=JSON.stringify([saved,sources]);
 if(key!==youtubeSourcesKey&&document.activeElement!==select){
  const selected=youtubeSourceDirty?select.value:saved;youtubeSourcesKey=key;
  select.replaceChildren(option('','Use selected player mode'));
  for(const source of sources)select.append(option(source.id,(source.title?source.title+' · ':'')+source.id));
  if(selected&&!sources.some(s=>s.id===selected))select.append(option(selected,'Saved source · currently unavailable'));
  select.value=selected;
 }
 const status=el('youtube-music-status');status.textContent=music.available?'Connected':'No playback session';status.classList.toggle('connected',!!music.available);
 el('youtube-music-detail').textContent=music.available?[music.title||'Untitled track',music.artist,music.status,music.source].filter(Boolean).join(' · '):(music.message||'YouTube Music connects automatically when the selected player exposes its playback session.');
 const save=el('save-youtube-music-source');if(!save.hasAttribute('aria-busy'))save.disabled=!window.companion.setYoutubeMusicSource;
}
window.companion.subscribe(renderYoutubeMusic);window.companion.getState().then(renderYoutubeMusic).catch(()=>{});
