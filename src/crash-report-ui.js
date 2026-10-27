const crashElement=id=>document.getElementById(id);

(()=>{const button=crashElement('save-crash-report'),status=crashElement('crash-report-status');let saving=false;button.addEventListener('click',async()=>{if(saving)return;saving=true;button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='Saving crash report…';try{status.textContent=(await window.companion.saveCrashReport()).message;}catch(error){status.textContent='Could not save report: '+error.message;}finally{saving=false;button.disabled=false;button.removeAttribute('aria-busy');}});})();

for(const event of ['error','unhandledrejection'])window.addEventListener(event,detail=>{const error=detail.error||detail.reason;void window.companion.reportRendererError({kind:event,message:String(error?.message||detail.message||error||'Unknown renderer error').slice(0,2000),stack:String(error?.stack||'').slice(0,4000)}).catch(()=>{});});
