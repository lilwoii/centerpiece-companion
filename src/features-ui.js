const widgetNames={spotify:'Spotify',clock:'Local time',weather:'Weather',cpu:'CPU',gpu:'GPU',mic:'Microphone',twitch:'Twitch chat',text:'Custom text',timer:'Countdown timer',obs:'OBS status',off:'Off'};
let favoritesLoaded=false,featuresProfileRevision=0,profileListRevision=-1,confirmProfileId='';
function drawFavorites(order){
 const host=el('widget-favorites');host.replaceChildren();
 for(const type of [...order,...Object.keys(widgetNames).filter(t=>!order.includes(t))]){
  const row=document.createElement('div');row.className='favorite-row';row.dataset.widget=type;
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=order.includes(type);check.id='favorite-'+type;label.append(check,document.createTextNode(widgetNames[type]));row.append(label);
  for(const [direction,symbol]of [['up','↑'],['down','↓']]){const button=document.createElement('button');button.className='button';button.textContent=symbol;button.setAttribute('aria-label',`Move ${widgetNames[type]} ${direction}`);button.addEventListener('click',()=>{if(direction==='up'&&row.previousElementSibling)host.insertBefore(row,row.previousElementSibling);if(direction==='down'&&row.nextElementSibling)host.insertBefore(row.nextElementSibling,row);button.focus();});row.append(button);}host.append(row);
 }
}
function selectedProfile(){return deskCurrent?.profiles?.items.find(p=>p.id===el('profile-select').value);}
function profileFields(){const p=selectedProfile();el('profile-name').value=p?.name||'';el('profile-app').value=p?.app||'';}
function renderFeatures(state){
 if(!state.desk)return;
 const changed=(state.profileRevision||0)!==featuresProfileRevision;featuresProfileRevision=state.profileRevision||0;
 if(!favoritesLoaded||changed){favoritesLoaded=true;drawFavorites(state.desk.config.widgetOrder||['spotify','clock','weather','cpu','gpu','mic','twitch','text','off']);el('timer-minutes').value=state.desk.config.timerMinutes||25;el('weather-animation').checked=state.desk.config.weatherMotion!==false;}
 const timer=state.desk.timer||{remaining:1500};el('timer-status').textContent=formatCountdown(timer.remaining)+' · '+(timer.finished?'Time is up':timer.running?'Running':'Paused');el('timer-toggle').textContent=timer.running?'Pause timer':'Resume timer';
 for(const id of ['save-favorites','timer-start','timer-toggle','timer-reset','timer-show','profile-create','profiles-auto','profile-default','profile-load','profile-replace','profile-remove','profile-pick','profile-link','profile-delete'])if(!el(id).hasAttribute('aria-busy'))el(id).disabled=false;
 const profiles=state.profiles;if(!profiles)return;
 el('profiles-auto').checked=profiles.enabled;const active=profiles.items.find(p=>p.id===profiles.active);el('profile-active').textContent=active?.name||(profiles.active==='default'?'Default setup':'Current setup');
 el('profiles-status').textContent=profiles.error||(profiles.enabled?'Automatic switching is on. Editing in this window pauses switching.':'Automatic switching is off. Your current setup stays active.');
 if(profileListRevision!==profiles.revision){profileListRevision=profiles.revision;const previous=el('profile-select').value;el('profile-select').replaceChildren(...profiles.items.map(p=>option(p.id,p.name)));if(profiles.items.some(p=>p.id===previous))el('profile-select').value=previous;el('profile-empty').hidden=!!profiles.items.length;el('profile-editor').hidden=!profiles.items.length;profileFields();}
}
bind('save-favorites',async()=>{const order=[...el('widget-favorites').children].filter(row=>row.querySelector('input').checked).map(row=>row.dataset.widget);const state=await window.companion.saveWidgetOrder(order,el('weather-animation').checked);draft.widgetOrder=state.desk.config.widgetOrder;draft.weatherMotion=state.desk.config.weatherMotion;renderFeatures(state);announce('Widget rotation saved. Use L1 + / to cycle your choices.');});
for(const action of ['start','toggle','reset'])bind('timer-'+action,async()=>{const state=await window.companion.timerCommand(action,Number(el('timer-minutes').value));draft.timerMinutes=state.desk.config.timerMinutes;renderFeatures(state);announce(action==='start'?'New timer started.':action==='reset'?'Timer reset.':state.desk.timer.running?'Timer resumed.':'Timer paused.');});
bind('timer-show',async()=>{const state=await window.companion.saveWidget({...deskCurrent.desk.config.widget,type:'timer'});renderRelease(state);announce(state.error||state.feedback,!!state.error);});
async function profileAction(action,input,message){const state=await window.companion.profileAction(action,input);renderDesk(state);renderRelease(state);renderFeatures(state);announce(message);return state;}
bind('profile-create',async()=>{const state=await profileAction('create',{name:el('profile-new-name').value},'Profile saved from your current setup.');el('profile-new-name').value='';el('profile-select').value=state.profiles.items.at(-1).id;profileFields();el('profile-select').focus();});
el('profile-select').addEventListener('change',profileFields);
bind('profile-replace',()=>profileAction('replace',{id:el('profile-select').value,name:el('profile-name').value},'Profile replaced with your current setup.'));
bind('profile-load',()=>profileAction('load',{id:el('profile-select').value},'Profile loaded. Automatic switching is off.'));
bind('profile-default',()=>profileAction('load',{id:'default'},'Default setup loaded. Automatic switching is off.'));
bind('profile-link',()=>profileAction('link',{id:el('profile-select').value,app:el('profile-app').value.trim().toLowerCase()},'App link saved.'));
bind('profile-pick',async()=>{const name=await window.companion.pickProfileApp();if(name)el('profile-app').value=name;announce(name?'App selected. Click Save app link.':'App selection cancelled.');});
el('profiles-auto').addEventListener('change',()=>task(el('profiles-auto'),async()=>{try{await profileAction('enable',{enabled:el('profiles-auto').checked},'Automatic profile setting saved.');}catch(e){el('profiles-auto').checked=deskCurrent.profiles.enabled;throw e;}}));
el('profile-remove').addEventListener('click',()=>{confirmProfileId=el('profile-select').value;el('profile-confirm-title').textContent='Remove '+(selectedProfile()?.name||'profile')+'?';el('profile-delete-error').textContent='';el('profile-cancel').disabled=false;el('profile-confirm').showModal();el('profile-cancel').focus();});
el('profile-cancel').addEventListener('click',()=>{el('profile-confirm').close();el('profile-remove').focus();});
el('profile-confirm').addEventListener('cancel',event=>{if(el('profile-delete').hasAttribute('aria-busy'))event.preventDefault();});
bind('profile-delete',async()=>{el('profile-cancel').disabled=true;try{await profileAction('remove',{id:confirmProfileId},'Saved profile removed. Current keyboard setup is unchanged.');el('profile-confirm').close();el('profile-create').focus();}catch(e){el('profile-delete-error').textContent=e.message;throw e;}finally{el('profile-cancel').disabled=false;}});
window.companion.subscribe(renderFeatures);window.companion.getState().then(renderFeatures).catch(()=>{});
