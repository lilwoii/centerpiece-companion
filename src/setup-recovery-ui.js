(() => {
  const review = document.createElement('button');
  review.id='review-setup'; review.className='button'; review.textContent='Review current settings'; review.hidden=true;
  el('setup-banner').querySelector('.form-actions').append(review);
  const progress=document.createElement('p');progress.id='setup-progress';progress.className='note';progress.hidden=true;progress.setAttribute('role','status');el('setup-banner').firstElementChild.append(progress);
  const failure = document.createElement('p');
  failure.id='setup-failure-detail'; failure.className='note error-text'; failure.hidden=true;failure.setAttribute('role','status');
  el('setup-banner').after(failure);
  const modal=document.createElement('dialog');
  modal.id='setup-recovery-dialog'; modal.className='profile-confirm';
  modal.setAttribute('aria-labelledby','setup-recovery-title');modal.setAttribute('aria-describedby','setup-recovery-description');
  // Static application copy only. Device results are always assigned as text.
  modal.innerHTML='<h2 id="setup-recovery-title">Keep your current keyboard settings?</h2><p id="setup-recovery-description"></p><ul><li>A private backup of the current keymap and layout will be saved on this PC before changing any keys.</li><li id="setup-recovery-shortcuts"></li><li>Your skin, other current key assignments and existing overlays stay stored. The companion overlay is active while the companion runs.</li><li>Close XPANEL and other keyboard editors while setup runs.</li></ul><p id="setup-recovery-error" class="error-text" role="status"></p><div class="form-actions"><button id="setup-recovery-cancel" class="button" autofocus>Cancel</button><button id="setup-recovery-confirm" class="button primary">Keep settings and set up</button></div>';
  document.body.append(modal);
  let token=null, confirming=false, origin=review;
  let previousFailure=null;
  function render(state){
    const f=state.setupFailure;
    review.hidden=!!state.strip||!(state.setupRecovery||(f?f.canRecover:state.setupReport?.lastSetupFailure?state.setupReport.lastSetupFailure.canRecover:state.setupReport?.classification==='pending_reported_consistently'));
    if(!review.hasAttribute('aria-busy'))review.disabled=!!state.setupRunning;
    progress.hidden=!state.setupRunning;progress.textContent=state.setupRunning?'Setting up your keyboard…':'';
    const feedback=el('desk-feedback').textContent;
    if(previousFailure&&(feedback===previousFailure.message||feedback.includes(previousFailure.code)))announce('');
    previousFailure=f;
    failure.hidden=!f;
    failure.textContent=f?`${f.code} · ${setupPhase(f.stage)} — ${f.message}`:'';
  }
  function restoreFocus(){const target=origin?.isConnected&&origin.getClientRects().length?origin:document.querySelector('main [data-page]:not([hidden]) h1');target?.focus();}
  async function cancel(){if(confirming)return;token=null;await window.companion.cancelSetupRecovery();modal.close();announce('Setup review closed. You can start setup again.');restoreFocus();}
  modal.addEventListener('cancel',event=>{event.preventDefault();if(!confirming)void cancel().catch(e=>{el('setup-recovery-error').textContent=e.message;});});
  bind('setup-recovery-cancel',cancel);
  function showReview(result, source){
    if(modal.open||confirming||!result?.token)return;
    origin=source;token=result.token;el('setup-recovery-confirm').disabled=false;el('setup-recovery-error').textContent='';
    el('setup-recovery-description').textContent=result.pending?'The keyboard reports pending settings even if XPANEL shows none. Continuing saves the configuration currently on the keyboard, including any pending key or layout changes. Older saved settings will not be restored.':'The keyboard now reports no pending settings. Continuing backs up the current configuration and installs the companion shortcuts.';
    el('setup-recovery-shortcuts').textContent='Only '+result.shortcuts.join(' and ')+' will be assigned to companion controls. Setup uses available display slots.';
    modal.showModal();el('setup-recovery-cancel').focus();
  }
  window.addEventListener('setup-review-ready',event=>showReview(event.detail,el('setup-device')));
  window.addEventListener('setup-state-refreshed',event=>render(event.detail));
  window.companion.subscribeSetupReview(result=>showReview(result,el('setup-device')));
  bind('review-setup',async()=>{
    const result=await setupUIAction(()=>window.companion.prepareSetupRecovery());if(!result)return;
    if(result.alreadyInstalled){const state=await setupUIAction(()=>window.companion.setupKeyboard());if(!state)return;renderRelease(state);announce(state.feedback);if(state.setupRecovery)showReview(state.setupRecovery,review);return;}
    showReview(result,review);
  });
  el('setup-recovery-confirm').addEventListener('click',()=>task(el('setup-recovery-confirm'),async()=>{
    if(!token){el('setup-recovery-error').textContent='Close this review and prepare the current settings again.';return;}
    confirming=true;el('setup-recovery-cancel').disabled=true;el('setup-recovery-error').textContent='Backing up and setting up the keyboard…';
    const currentToken=token;token=null;
    try{const state=await window.companion.confirmSetupRecovery(currentToken);modal.close();renderRelease(state);announce(state.feedback);restoreFocus();}
    catch(e){const currentFailure=await refreshSetupFailure(e);el('setup-recovery-error').textContent=setupErrorMessage(currentFailure)+' Close this review before retrying.';}
    finally{confirming=false;el('setup-recovery-cancel').disabled=false;}
  }).finally(()=>{el('setup-recovery-confirm').disabled=!token;}));
  window.companion.subscribe(render);window.companion.getState().then(render).catch(()=>{});
})();
