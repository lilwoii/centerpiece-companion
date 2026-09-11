function renderStripVisibility(state){
 if(!state.desk)return;
 const enabled=state.desk.config.stripEnabled!==false,button=el('strip-visibility');
 if(draft)draft.stripEnabled=enabled;
 button.setAttribute('aria-checked',String(enabled));button.textContent='Plugin strip · '+(enabled?'On':'Off');
 if(!button.hasAttribute('aria-busy'))button.disabled=false;
 el('plugin-mode').disabled=!enabled;el('strip-mini').hidden=!enabled;
 if(!enabled&&state.strip){el('strip-heading').textContent='Plugin strip hidden';el('strip-detail').textContent='Screen widgets and Caps Lock indication remain available. Your plugin assignments are saved. Turn the strip on in Plugin library to restore keyboard plugin navigation.';}
}
bind('strip-visibility',async()=>{const state=await window.companion.setStripVisible(el('strip-visibility').getAttribute('aria-checked')!=='true');renderStripVisibility(state);announce(state.error||state.feedback,!!state.error);});
window.companion.subscribe(renderStripVisibility);window.companion.getState().then(renderStripVisibility).catch(()=>{});
