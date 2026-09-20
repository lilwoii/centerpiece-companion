(()=>{
 const link=document.getElementById('support-project'),status=document.getElementById('support-status');let opening=false;
 link.addEventListener('click',async event=>{
  // Browser preview uses the ordinary link; installed Companion opens the OS browser.
  if(location.protocol!=='file:')return;
  event.preventDefault();if(opening)return;opening=true;link.setAttribute('aria-busy','true');status.textContent='';
  try{await window.companion.openSupport();status.textContent='Opened in your browser.';}
  catch{status.textContent='Could not open your browser. Visit buymeacoffee.com/woii or try again.';}
  finally{opening=false;link.removeAttribute('aria-busy');}
 });
})();
