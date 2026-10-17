(()=>{
 const panel=document.querySelector('.key-binding-panel'),row=document.createElement('div');
 row.className='binding-capture';
 row.innerHTML='<button type="button" class="button" id="capture-binding" aria-pressed="false">Record a shortcut</button><button type="button" class="button" id="hash-us"># · US</button><button type="button" class="button" id="hash-uk"># · UK</button><p class="note" id="capture-binding-status" role="status">Select a key, then record a combination or choose a binding below. Save applies it to the keyboard. Characters follow your Windows input language.</p>';
 panel.querySelector('#key-current').after(row);
 for(const [id,text,value] of [['backslash-us','\\ · US',0x70031],['backslash-uk','\\ · UK',0x70064]]){const shortcut=document.createElement('button');shortcut.type='button';shortcut.className='button';shortcut.id=id;shortcut.textContent=text;row.insertBefore(shortcut,row.querySelector('p'));shortcut.addEventListener('click',()=>choose(value,0));}
 const button=el('capture-binding'),status=el('capture-binding-status');let armed=false,timer;
 function stop(message){armed=false;clearTimeout(timer);button.setAttribute('aria-pressed','false');button.textContent='Record a shortcut';if(message)status.textContent=message;}
 function choose(value,mods){if(deskBusy||!keymap||el('save-key').disabled){stop('Select an editable key first, and wait for any save to finish.');return;}
  const target=el('key-target');if(![...target.options].some(o=>Number(o.value)===value)){stop('This key is not available on this keyboard. Choose a binding below.');return;}
  target.value=String(value);for(const [name,bit] of [['ctrl',1],['shift',2],['alt',4],['win',8]])el('key-'+name).checked=!!(mods&bit);
  target.dispatchEvent(new Event('change',{bubbles:true}));stop('Ready: '+['ctrl','shift','alt','win'].filter(n=>el('key-'+n).checked).map(n=>({ctrl:'Ctrl',shift:'Shift',alt:'Alt',win:'Windows'}[n])).concat(target.selectedOptions[0].textContent).join(' + ')+'. Click Save binding to keyboard.');
 }
 button.addEventListener('click',()=>{if(armed){stop('Recording cancelled.');return;}if(!keymap||el('save-key').disabled||deskBusy){stop('Select an editable key first.');return;}armed=true;button.setAttribute('aria-pressed','true');button.textContent='Press your shortcut…';status.textContent='Press a key with any modifiers. Escape or Tab cancels. Windows may intercept system shortcuts; use the selectors below for those.';timer=setTimeout(()=>stop('Recording timed out. Try again.'),10000);});
 document.addEventListener('keydown',e=>{if(!armed)return;if(e.code==='Tab'||e.code==='Escape'){stop('Recording cancelled.');if(e.code==='Escape')e.preventDefault();return;}e.preventDefault();e.stopImmediatePropagation();const binding=window.CompanionBindingCapture.capture(e);if(binding)choose(binding.value,binding.mods);else if(!/^(Control|Shift|Alt|Meta)/.test(e.code))status.textContent='Cannot record this combination. Choose the key and modifiers below.';},true);
 button.addEventListener('blur',()=>{if(armed)stop('Recording cancelled.');});window.addEventListener('hashchange',()=>stop());window.addEventListener('blur',()=>stop());
 el('key-target').addEventListener('change',()=>{if(Number(el('key-target').value)===0x02070020)choose(0x70020,2);});
 el('hash-us').addEventListener('click',()=>choose(0x70020,2));el('hash-uk').addEventListener('click',()=>choose(0x70032,0));
})();
