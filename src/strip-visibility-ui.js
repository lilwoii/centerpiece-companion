function renderStripVisibility(state){
 if(!state.desk)return;
 const enabled=state.desk.config.stripEnabled!==false,button=el('strip-visibility');
 if(draft)draft.stripEnabled=enabled;
 button.setAttribute('aria-checked',String(enabled));button.textContent='Plugin strip · '+(enabled?'On':'Off');
 let displayStatus=document.getElementById('strip-display-status');if(!displayStatus){displayStatus=document.createElement('span');displayStatus.id='strip-display-status';displayStatus.className='note';displayStatus.setAttribute('role','status');button.after(displayStatus);}
 displayStatus.textContent=state.keyboardReady?'Display connection ready':state.setupRunning||state.connectionRecovering?'Connecting to keyboard display…':'Waiting for keyboard display';
 displayStatus.title='The On switch is your saved preference. The desktop preview does not confirm what the physical keyboard is showing.';
 if(!button.hasAttribute('aria-busy'))button.disabled=false;
 el('plugin-mode').disabled=!enabled;el('strip-mini').hidden=!enabled;
 if(!enabled&&state.strip){el('strip-heading').textContent='Plugin strip hidden';el('strip-detail').textContent='Screen widgets and Caps Lock indication remain available. Your plugin assignments are saved. Turn the strip on in Plugin library to restore keyboard plugin navigation.';}
}
bind('strip-visibility',async()=>{const state=await window.companion.setStripVisible(el('strip-visibility').getAttribute('aria-checked')!=='true');renderStripVisibility(state);announce(state.error||state.feedback,!!state.error);});
window.companion.subscribe(renderStripVisibility);window.companion.getState().then(renderStripVisibility).catch(()=>{});
