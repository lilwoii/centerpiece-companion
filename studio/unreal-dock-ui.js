(()=>{'use strict';window.StudioUnrealDockUI={mount({request}){
 const $=id=>document.getElementById(id),dialog=$('unreal-editor-panel'),host=$('unreal-editor-host'),status=$('unreal-editor-status');let timer=null,token=0,workspace=null,attached=false;
 $('unreal-workspace-dock').hidden=true;
 const capabilities=request('unreal-capabilities',null).catch(()=>({embedded:false}));void capabilities.then(value=>{$('unreal-workspace-dock').hidden=!value.embedded;$('unreal-workspace-open').hidden=true;});
 async function update(version){if(version!==token||!dialog.open)return;const r=host.getBoundingClientRect();try{const value=await request('unreal-dock',{id:workspace,bounds:{x:r.x,y:r.y,width:r.width,height:r.height}});if(version!==token)return;attached=!value.waiting;status.textContent=value.waiting?'Starting Unreal Editor… Its full interface will appear here when ready.':'Unreal Editor · editing your saved local project';if(value.waiting)timer=setTimeout(()=>void update(version),2000);}catch(error){status.textContent=error.message;}}
 window.StudioEditorDockOpen=async id=>{if(!(await capabilities).embedded)throw Error('Use the desktop Companion app to edit Unreal in this page.');if(!id)throw Error('Choose a saved Unreal project first.');workspace=id;attached=false;dialog.showModal();status.textContent='Opening Unreal inside Companion…';void update(++token);};
 $('unreal-workspace-dock').disabled=false;$('unreal-workspace-dock').addEventListener('click',()=>void window.StudioEditorDockOpen($('unreal-workspace-list').value).catch(error=>{$('export-result').textContent=error.message;}));
 $('unreal-editor-close').disabled=false;$('unreal-editor-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{token++;clearTimeout(timer);void request('unreal-undock',null).catch(()=>{});});
 let resizeTimer;new ResizeObserver(()=>{if(dialog.open&&attached){clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>void update(token),150);}}).observe(host);
 window.StudioEditorDockClose=()=>{if(dialog.open)dialog.close();};
}};})();
