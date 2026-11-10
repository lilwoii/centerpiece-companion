(()=>{
 const api=window.companion;
 const header=document.querySelector('.app-header');
 const sizeHeader=()=>document.documentElement.style.setProperty('--app-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
 new ResizeObserver(sizeHeader).observe(header);sizeHeader();
 const update=state=>{const button=document.getElementById('window-maximize');button.textContent=state.maximized?'❐':'□';button.setAttribute('aria-label',state.maximized?'Restore window':'Maximize');button.title=state.maximized?'Restore window':'Maximize';};
 for(const action of ['minimize','maximize','close']){const button=document.getElementById('window-'+action);button.disabled=false;button.addEventListener('click',async()=>{try{update(await api.windowControl(action));}catch{button.title='Window control unavailable. Try again.';}});}
 api.subscribeWindow(update);
})();
