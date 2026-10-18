(function(){
 'use strict';
 const select=document.getElementById('caps-target-key'),status=document.getElementById('caps-target-status');let positions=[];
 const fields=['x','y','width','height'];
 function match(){const match=positions.find(p=>fields.every(k=>Number(document.getElementById('caps-'+k).value)===p[k]));select.value=match?.id||'custom';}
 function choose(id){const p=positions.find(p=>p.id===id);if(!p)return;for(const k of fields)document.getElementById('caps-'+k).value=p[k];status.textContent='Previewing the light on '+p.label+'. Click Apply indicator to keyboard to save.';document.getElementById('caps-x').dispatchEvent(new Event('input',{bubbles:true}));select.value=id;}
 select.addEventListener('change',()=>choose(select.value));
 document.getElementById('caps-target-reset').addEventListener('click',()=>{for(const [k,v]of Object.entries({x:8,y:201,width:161,height:84}))document.getElementById('caps-'+k).value=v;document.getElementById('caps-x').dispatchEvent(new Event('input',{bubbles:true}));match();status.textContent='Original Caps Lock position restored in preview. Click Apply to save.';});
 for(const k of fields)document.getElementById('caps-'+k).addEventListener('input',match);
 if(!window.companion.indicatorPositions){status.textContent='Open the desktop app to choose an indicator key.';return;}
 window.companion.indicatorPositions().then(items=>{positions=items;select.replaceChildren(new Option('Custom area / current position','custom'),...items.map(p=>new Option(p.label,p.id)));select.disabled=false;match();}).catch(e=>{status.textContent='Could not load key positions. Use the area controls below or reopen the page.';});
 window.companion.subscribe(state=>{if(!document.getElementById('caps-editor').contains(document.activeElement))match();const saved=state.desk?.config?.indicator;if(saved&&fields.every(k=>saved[k]===Number(document.getElementById('caps-'+k).value)))status.textContent='Saved light location: '+(positions.find(p=>p.id===select.value)?.label||'custom area')+'. Caps Lock typing behavior is unchanged.';});
})();
