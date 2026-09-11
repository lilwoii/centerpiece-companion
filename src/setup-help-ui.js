let setupReportSignature='';
function setupPhase(stage){return({connect:'Connecting to keyboard',read_keymap:'Reading key assignments',read_pending_status:'Reading pending settings',read_layout:'Reading keyboard layout',verify_snapshot:'Checking current settings',write_local_backup:'Saving the local backup',check_display_slots:'Checking available display slots',assign_plugin_shortcut:'Assigning L1 + P',assign_widget_shortcut:'Assigning L1 + /',verify_before_save:'Checking the shortcut changes',save_configuration:'Saving keyboard configuration',verify_saved_configuration:'Verifying saved settings',initialize_display:'Starting the keyboard display'})[stage]||(stage?.startsWith('read_overlay_')?'Checking display slot '+stage.split('_').pop():'Keyboard setup');}
function setupErrorMessage(error){return(error?.message||'Keyboard setup could not finish.').replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'');}
async function refreshSetupFailure(error){
 let state;try{state=await window.companion.getState();}catch{}
 const message=setupErrorMessage(error),reported=state?.setupFailure;
 const failure=reported&&setupErrorMessage(reported)===message?reported:{code:'KEYBOARD_SETUP_FAILED',stage:'setup',message,canRecover:false};
 const next={...(state||deskCurrent),setupFailure:failure};
 renderRelease(next);renderSetupHelp(next);window.dispatchEvent(new CustomEvent('setup-state-refreshed',{detail:next}));
 announce('');return failure;
}
async function setupUIAction(action){try{return await action();}catch(error){await refreshSetupFailure(error);return null;}}
function renderSetupHelp(state){
 for(const id of ['check-setup','check-setup-connections'])if(!el(id).hasAttribute('aria-busy'))el(id).disabled=!!state.setupRunning;
 const report=state.setupReport;if(!report)return;const text=JSON.stringify(report,null,2);
 if(text!==setupReportSignature){setupReportSignature=text;el('setup-report-panel').hidden=false;el('setup-report-text').textContent=text;}
 const pending=report.classification==='pending_reported_consistently',failure=state.setupFailure||(!state.strip?report.lastSetupFailure:null);
 const summary=({pending_reported_consistently:'The keyboard reported pending configuration changes on all three checks. This does not identify which settings changed. Copy this report for support.',no_pending_reported:'The keyboard reported no pending changes. You can retry setup; other compatibility checks still apply.',pending_status_changed:'The pending-change status changed during the check. Copy this report for support.',query_failed:'One or more status checks failed. Copy this report so support can inspect the response codes.',keyboard_query_unavailable:'Keyboard configuration could not be read. Copy this report for support.'})[report.classification]||'Setup check finished. Copy the report for support.';
 el('setup-report-summary').textContent=failure&&failure.code!=='KEYBOARD_PENDING_CHANGES'?`Last setup blocker: ${setupErrorMessage(failure)} (${failure.code} · ${setupPhase(failure.stage)}). ${pending?'The keyboard also reports a pending flag; that is separate from this blocker. ':''}Copy the report for support.`:(state.strip&&!state.setupFailure&&report.lastSetupFailure?'Companion setup is now installed. This report includes a previous setup failure. ':'')+summary;
 el('copy-setup-report').disabled=false;el('hide-setup-report').disabled=false;
}
for(const id of ['check-setup','check-setup-connections'])bind(id,async()=>{setupReportSignature='';renderSetupHelp(await window.companion.checkSetup());el('setup-report-panel').scrollIntoView({block:'start'});announce('Read-only setup check finished. No keyboard settings were changed.');});
bind('copy-setup-report',async()=>{await window.companion.copySetupReport();announce('Setup report copied. Paste it into your support conversation.');});
bind('hide-setup-report',()=>{el('setup-report-panel').hidden=true;const button=el('setup-banner').hidden?el('check-setup-connections'):el('check-setup');button.focus();});
window.companion.subscribe(renderSetupHelp);window.companion.getState().then(renderSetupHelp).catch(()=>{});
