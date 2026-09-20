(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioMotionPath=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function frames(points,layer,duration,{loop=true,samples=24}={}){
  if(!Array.isArray(points)||points.length<2||points.length>4096)throw Error('Draw a path with at least two points.');
  if(!Number.isFinite(duration)||duration<=0||duration>120)throw Error('Choose a duration up to 120 seconds.');
  if(!Number.isInteger(samples)||samples<2||samples>64)throw Error('Choose 2–64 path samples.');
  const clean=points.map(p=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1920||p.y<0||p.y>550)throw Error('Draw inside the keyboard canvas.');return{x:p.x,y:p.y};});
  if(loop)clean.push({...clean[0]});
  const distances=[0];for(let i=1;i<clean.length;i++)distances.push(distances[i-1]+Math.hypot(clean[i].x-clean[i-1].x,clean[i].y-clean[i-1].y));
  const total=distances.at(-1);if(total<2)throw Error('Draw a longer path.');const result=[];let segment=1;
  for(let i=0;i<samples;i++){const d=total*i/(samples-1);while(segment<clean.length-1&&distances[segment]<d)segment++;const a=clean[segment-1],b=clean[segment],fraction=(d-distances[segment-1])/(distances[segment]-distances[segment-1]||1),time=duration*i/(samples-1);
   for(const [property,size]of [['x',layer.width],['y',layer.height]])result.push({time,property,value:a[property]+(b[property]-a[property])*fraction-size/2,easing:'linear'});
  }return result;
 }
 function mount({selected,project,commit,notify}){
  const $=id=>document.getElementById(id),dialog=$('motion-path-dialog'),canvas=$('motion-path-canvas'),ctx=canvas.getContext('2d');let points=[],drawing=false,target=null,opener=null;
  function paint(){ctx.clearRect(0,0,1920,550);ctx.fillStyle='#11151d';ctx.fillRect(0,0,1920,550);ctx.strokeStyle='#374457';ctx.lineWidth=2;for(let x=0;x<1920;x+=120){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,550);ctx.stroke();}for(let y=0;y<550;y+=110){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1920,y);ctx.stroke();}if(points.length){ctx.strokeStyle='#9bb9ff';ctx.lineWidth=5;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.fillStyle='#8ad8b1';ctx.beginPath();ctx.arc(points[0].x,points[0].y,14,0,Math.PI*2);ctx.fill();} $('motion-path-apply').disabled=points.length<2;}
  function point(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1920,(e.clientX-r.left)*1920/r.width)),y:Math.max(0,Math.min(550,(e.clientY-r.top)*550/r.height))};}
  for(const id of ['motion-path-close','motion-path-clear'])$(id).disabled=false;
  $('draw-motion-path').disabled=false;$('draw-motion-path').addEventListener('click',()=>{const l=selected();if(!l||l.locked){notify('Select an unlocked layer first.',true);return;}target=l.id;points=[];opener=document.activeElement;$('motion-path-target').textContent='Path for '+l.name+' · green dot marks the start';dialog.showModal();paint();$('motion-path-title').focus();});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drawing=true;points=[point(e)];canvas.setPointerCapture(e.pointerId);paint();});
  canvas.addEventListener('pointermove',e=>{if(!drawing||points.length>=4096)return;const p=point(e),last=points.at(-1);if(Math.hypot(p.x-last.x,p.y-last.y)>3){points.push(p);paint();}});
  canvas.addEventListener('pointerup',()=>{drawing=false;});canvas.addEventListener('pointercancel',()=>{drawing=false;});
  $('motion-path-clear').addEventListener('click',()=>{points=[];paint();});$('motion-path-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{drawing=false;opener?.focus();});
  $('motion-path-apply').addEventListener('click',()=>{try{const p=project(),layer=p.layers.find(l=>l.id===target);if(!layer||layer.locked)throw Error('The selected layer changed. Reopen the path tool.');const f=frames(points,layer,p.duration,{loop:$('motion-path-loop').checked});if(commit(target,f))dialog.close();}catch(error){$('motion-path-target').textContent=error.message;}});
 }
 return{frames,mount};
});
