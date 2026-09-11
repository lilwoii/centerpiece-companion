(() => {
  const review = document.createElement('button');
  review.id='review-setup'; review.className='button'; review.textContent='Review current settings'; review.hidden=true;
  el('setup-banner').querySelector('.form-actions').append(review);
  const failure = document.createElement('p');
  failure.id='setup-failure-detail'; failure.className='note error'; failure.hidden=true;
  el('setup-banner').after(failure);
  const modal=document.createElement('dialog');
  modal.id='setup-recovery-dialog'; modal.className='profile-confirm';
  modal.setAttribute('aria-labelledby','setup-recovery-title');modal.setAttribute('aria-describedby','setup-recovery-description');
  // Static application copy only. Device results are always assigned as text.
  modal.innerHTML='<h2 id="setup-recovery-title">Keep your current keyboard settings?</h2><p id="setup-recovery-description"></p><ul><li>A private backup of the current keymap and layout will be saved on this PC before changing any keys.</li><li id="setup-recovery-shortcuts"></li><li>Your skin and other current key assignments stay in place.</li><li>Close XPANEL and other keyboard editors while setup runs.</li></ul><p id="setup-recovery-error" class="error" role="status"></p><div class="form-actions"><button id="setup-recovery-cancel" class="button" autofocus>Cancel</button><button id="setup-recovery-confirm" class="button primary">Keep settings and set up</button></div>';
  document.body.append(modal);
  let token=null, confirming=false;
  const phaseNames={connect:'Connecting to keyboard',read_keymap:'Reading key assignments',read_pending_status:'Reading pending settings',read_layout:'Reading keyboard layout',verify_snapshot:'Checking current settings',write_local_backup:'Saving the local backup',assign_plugin_shortcut:'Assigning L1 + P',assign_widget_shortcut:'Assigning L1 + /',verify_before_save:'Checking the shortcut changes',save_configuration:'Saving keyboard configuration',verify_saved_configuration:'Verifying saved settings',initialize_display:'Starting the keyboard display'};
  function render(state){
    const f=state.setupFailure;
    review.hidden=!!state.strip||!(f?.canRecover||state.setupReport?.classification==='pending_reported_consistently');
    if(!review.hasAttribute('aria-busy'))review.disabled=false;
    failure.hidden=!f;
    if(f)failure.textContent=`${f.code} · ${phaseNames[f.stage]||(f.stage?.startsWith('read_overlay_')?'Checking display slot '+f.stage.split('_').pop():'Keyboard setup')} — ${f.message}`;
  }
  function restoreFocus(){const target=review.hidden?document.querySelector('main [data-page]:not([hidden]) h1'):review;target?.focus();}
  async function cancel(){if(confirming)return;token=null;await window.companion.cancelSetupRecovery();modal.close();restoreFocus();}
  modal.addEventListener('cancel',event=>{event.preventDefault();if(!confirming)void cancel().catch(e=>{el('setup-recovery-error').textContent=e.message;});});
  bind('setup-recovery-cancel',cancel);
  bind('review-setup',async()=>{
    const result=await window.companion.prepareSetupRecovery();
    if(result.alreadyInstalled){const state=await window.companion.setupKeyboard();renderRelease(state);announce(state.feedback);return;}
    token=result.token;el('setup-recovery-confirm').disabled=false;el('setup-recovery-error').textContent='';
    el('setup-recovery-description').textContent=result.pending?'The keyboard reports pending settings even if XPANEL shows none. Continuing saves the configuration currently on the keyboard, including any pending key or layout changes. Older saved settings will not be restored.':'The keyboard now reports no pending settings. Continuing backs up the current configuration and installs the companion shortcuts.';
    el('setup-recovery-shortcuts').textContent='Only '+result.shortcuts.join(' and ')+' will be assigned to companion controls. Display slots 2–10 must be available.';
    modal.showModal();el('setup-recovery-cancel').focus();
  });
  el('setup-recovery-confirm').addEventListener('click',()=>task(el('setup-recovery-confirm'),async()=>{
    if(!token){el('setup-recovery-error').textContent='Close this review and prepare the current settings again.';return;}
    confirming=true;el('setup-recovery-cancel').disabled=true;el('setup-recovery-error').textContent='Backing up and setting up the keyboard…';
    const currentToken=token;token=null;
    try{const state=await window.companion.confirmSetupRecovery(currentToken);modal.close();renderRelease(state);announce(state.feedback);restoreFocus();}
    catch(e){el('setup-recovery-error').textContent=e.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'')+' Close this review before retrying.';}
    finally{confirming=false;el('setup-recovery-cancel').disabled=false;}
  }).finally(()=>{el('setup-recovery-confirm').disabled=!token;}));
  window.companion.subscribe(render);window.companion.getState().then(render).catch(()=>{});
})();
