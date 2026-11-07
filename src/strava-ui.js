(()=>{
 if(!window.companion.saveStravaApp||!el('strava-section'))return;
 let view=null;
 function show(v){
  view=v;const s=v.summary;
  el('strava-status').textContent=v.connected?'Connected'+(v.athlete?' · '+v.athlete:''):v.pending?'Waiting for approval':'Not connected';
  el('strava-week').textContent=!v.configured?'Save your Strava API app to begin.':v.error||(v.connected?`This week: ${s.distance.toFixed(1)} of ${s.goal} ${s.unit} · ${s.runs} run${s.runs===1?'':'s'}`+(v.updatedAt?` · updated ${new Date(v.updatedAt).toLocaleTimeString()}`:''):v.status);
  if(document.activeElement!==el('strava-client-id')&&v.clientId)el('strava-client-id').value=v.clientId;
  el('strava-connect').textContent=v.pending?'Cancel sign-in':v.connected?'Reconnect Strava':'Connect Strava';
  el('strava-connect').disabled=!v.configured;el('strava-refresh').disabled=!v.connected;el('strava-disconnect').disabled=!v.connected&&!v.pending;
  if(document.activeElement!==el('strava-goal'))el('strava-goal').value=v.goal;if(document.activeElement!==el('strava-unit'))el('strava-unit').value=v.unit;
 }
 el('strava-save-app').onclick=()=>task(el('strava-save-app'),async()=>{const v=await window.companion.saveStravaApp({clientId:el('strava-client-id').value,clientSecret:el('strava-client-secret').value});el('strava-client-secret').value='';show(v);announce('Strava app saved.');});
 el('strava-connect').onclick=()=>task(el('strava-connect'),async()=>show(await(view?.pending?window.companion.cancelStrava():window.companion.connectStrava())));
 el('strava-refresh').onclick=()=>task(el('strava-refresh'),async()=>show(await window.companion.refreshStrava()));
 el('strava-disconnect').onclick=()=>task(el('strava-disconnect'),async()=>show(await window.companion.disconnectStrava()));
 el('strava-save-goal').onclick=()=>task(el('strava-save-goal'),async()=>{show(await window.companion.saveStrava({goal:Number(el('strava-goal').value),unit:el('strava-unit').value}));announce('Weekly goal saved.');});
 const render=state=>{if(state?.desk?.strava)show(state.desk.strava);};
 window.companion.subscribe(render);window.companion.getState().then(render).catch(()=>{});
})();
