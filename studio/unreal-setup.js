(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioUnrealSetup=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function state(info={}){
  // Only the detector's completed 4.27 installation result dismisses setup.
  // A UE5 installation or Android tools alone do not meet that requirement.
  const installed=info.engine427Found===true;
  const engines=Array.isArray(info.engines)?info.engines:[],ue5=engines.find(e=>e.major===5);
  const message=installed?'Unreal 4.27 detected. Native editor components are checked when you build a skin.'
   :ue5?'Unreal '+ue5.version+' detected for source projects. Add Unreal 4.27 for the current keyboard runtime.'
   :'Install Unreal 4.27 using Epic Games Launcher to build for the current keyboard runtime.';
  return{installed,message,launcherLabel:info.launcherFound?'Open Epic Games Launcher ↗':'Get Epic Games Launcher ↗'};
 }
 function apply(document,info,options={}){
  const view=state(info),get=id=>document.getElementById(id),bar=get('creator-setup-bar');
  // Avoid leaving keyboard focus inside the callout as an install finishes.
  const hideCallout=view.installed||options.showCallout===false;
  if(hideCallout&&bar?.contains(document.activeElement))get('show-unreal-tools').focus({preventScroll:true});
  if(bar)bar.hidden=hideCallout;
  get('native-tools-status').textContent=view.message;
  get('creator-setup-summary').textContent=view.installed?view.message:'Install Unreal Engine 4.27 through Epic Games Launcher to build your skin for the keyboard. Companion will detect it automatically and remove this notice.';
  get('native-tools-heading').textContent=view.installed?'Installed tools':'Creator setup';
  get('native-install-instructions').hidden=view.installed;
  get('unreal-setup-link').textContent=view.launcherLabel;
  return view;
 }
 function creationSession(document){
  let creating=false,info=null;
  function render(){if(info)apply(document,info,{showCallout:creating});else document.getElementById('creator-setup-bar').hidden=true;}
  return{start(){creating=true;render();},exit(){creating=false;render();},update(value){info=value;render();}};
 }
 return{state,apply,creationSession};
});
