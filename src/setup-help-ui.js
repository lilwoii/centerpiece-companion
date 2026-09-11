let setupReportSignature='';
function renderSetupHelp(state){
 for(const id of ['check-setup','check-setup-connections'])if(!el(id).hasAttribute('aria-busy'))el(id).disabled=false;
 const report=state.setupReport;if(!report)return;const text=JSON.stringify(report,null,2);if(text===setupReportSignature)return;setupReportSignature=text;
 el('setup-report-panel').hidden=false;el('setup-report-text').textContent=text;
 el('setup-report-summary').textContent=({pending_reported_consistently:'The keyboard reported pending configuration changes on all three checks. This does not identify which settings changed. Copy this report for support.',no_pending_reported:'The keyboard reported no pending changes. You can retry setup; other compatibility checks still apply.',pending_status_changed:'The pending-change status changed during the check. Copy this report for support.',query_failed:'One or more status checks failed. Copy this report so support can inspect the response codes.',keyboard_query_unavailable:'Keyboard configuration could not be read. Copy this report for support.'})[report.classification]||'Setup check finished. Copy the report for support.';
 el('copy-setup-report').disabled=false;el('hide-setup-report').disabled=false;
}
for(const id of ['check-setup','check-setup-connections'])bind(id,async()=>{setupReportSignature='';renderSetupHelp(await window.companion.checkSetup());el('setup-report-panel').scrollIntoView({block:'start'});announce('Read-only setup check finished. No keyboard settings were changed.');});
bind('copy-setup-report',async()=>{await window.companion.copySetupReport();announce('Setup report copied. Paste it into your support conversation.');});
bind('hide-setup-report',()=>{el('setup-report-panel').hidden=true;const button=el('setup-banner').hidden?el('check-setup-connections'):el('check-setup');button.focus();});
window.companion.subscribe(renderSetupHelp);window.companion.getState().then(renderSetupHelp).catch(()=>{});
