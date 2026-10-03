(()=>{
 const host=document.querySelector('[data-page="library"] .page-heading');if(!host)return;
 const panel=document.createElement('section');panel.className='section';panel.setAttribute('aria-label','Plugin keyboard shortcuts');
 panel.innerHTML='<h2>Plugin shortcuts</h2><label><input id="custom-plugin-shortcut" type="checkbox"> Use a custom L1 shortcut</label><label for="plugin-shortcut-key">Click the box, then press a key</label><input id="plugin-shortcut-key" type="text" readonly disabled value="L1 + P" aria-describedby="plugin-shortcut-help"><p id="plugin-shortcut-help" class="note">Press the key by itself; L1 is added automatically. Existing XPANEL assignments and overlay switches are preserved. L1 + P remains available as a fallback.</p><label><input id="plugin-engine-recovery" type="checkbox"> Enable L1 + Esc recovery shortcut</label><p class="note">Press L1 + Esc only while the Finalmouse waiting box is visible. It toggles that screen closed; pressing it again can reopen it.</p><button id="apply-plugin-shortcuts" class="button primary">Save shortcut</button><p id="plugin-shortcut-status" class="note" role="status"></p>';
 host.after(panel);
 const custom=panel.querySelector('#custom-plugin-shortcut'),box=panel.querySelector('#plugin-shortcut-key'),recovery=panel.querySelector('#plugin-engine-recovery'),button=panel.querySelector('#apply-plugin-shortcuts'),status=panel.querySelector('[role="status"]'),names=window.ShortcutKeys.names;
 let dirty=false,pending=false,capturing=false,position=26,timer;
 function controls(){custom.disabled=pending;recovery.disabled=pending;box.disabled=!custom.checked||pending;box.value=capturing?'Press a key…':'L1 + '+names[custom.checked?position:26];}
 function stop(){capturing=false;clearTimeout(timer);void window.companion.capturePluginKey(false).catch(()=>{});controls();}
 function selectKey(next){
  if(!capturing||!Number.isInteger(next)||next<0||next>=names.length)return;
  if([55,63].includes(next)||next===0&&recovery.checked){status.textContent='That key is reserved for L1, widgets or recovery. Press a different key.';return;}
  position=next;dirty=true;stop();status.textContent='L1 + '+names[position]+' selected. Click Save shortcut to apply.';
 }
 function start(){if(box.disabled||pending)return;capturing=true;controls();status.textContent='Press one key without holding L1. Tab cancels.';clearTimeout(timer);timer=setTimeout(()=>{stop();status.textContent='Key capture timed out. Click the box to try again.';},10000);void window.companion.capturePluginKey(true).catch(()=>{});}
 box.addEventListener('click',start);
 box.addEventListener('keydown',e=>{
  if(e.code==='Tab'){stop();return;}e.preventDefault();e.stopPropagation();if(e.repeat)return;
  if(!capturing){start();return;}const next=window.ShortcutKeys.position(e.code);
  if(next>=0)selectKey(next);else status.textContent='Waiting for the physical keyboard key…';
 });
 box.addEventListener('blur',stop);window.addEventListener('blur',stop);window.addEventListener('hashchange',stop);
 window.companion.subscribePluginKey(selectKey);
 for(const input of [custom,recovery])input.addEventListener('change',()=>{dirty=true;stop();});
 function render(state){
  const saved=state.desk?.config?.pluginShortcuts||{custom:false,position:26,engineRecovery:true};
  if(!dirty&&!pending&&!capturing){custom.checked=saved.custom;position=saved.position;recovery.checked=saved.engineRecovery;controls();}
  if(state.shortcutWarning&&!pending&&!dirty&&!capturing)status.textContent=state.shortcutWarning;
  const chord='L1 + '+names[saved.custom?saved.position:26],hint=document.querySelector('.sidebar-foot kbd');if(hint)hint.textContent=chord;
  const description=document.querySelector('#mode-heading')?.parentElement.querySelector('p');if(description)description.textContent=chord+' to enter · ↑ ↓ position · Enter to run · Esc to exit';
  const help=document.querySelector('#mode-heading')?.closest('section').querySelector('.note');if(help)help.textContent='Release L1 after pressing '+names[saved.custom?saved.position:26]+', then use the arrows. Enter runs the action and exits. Mode also exits after 45 seconds without input.';
  if(typeof draft!=='undefined'&&draft)draft.pluginShortcuts=saved;
 }
 button.addEventListener('click',async()=>{
  if(pending)return;stop();pending=true;button.disabled=true;button.setAttribute('aria-busy','true');controls();status.textContent='Saving shortcut to the keyboard…';
  try{const state=await window.companion.setPluginShortcuts({custom:custom.checked,position,engineRecovery:recovery.checked});dirty=false;status.textContent=state.feedback;render(state);}
  catch(e){status.textContent=String(e.message||e).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
  finally{pending=false;button.disabled=false;button.removeAttribute('aria-busy');controls();}
 });
 window.companion.subscribe(render);window.companion.getState().then(render).catch(()=>{});
})();
