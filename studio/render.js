(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioRender=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const space=typeof module==='object'&&module.exports?require('./space-effects.js'):globalThis.StudioSpace;
 const collection=typeof module==='object'&&module.exports?require('./collection-effects.js'):globalThis.StudioCollectionEffects;
 const games=typeof module==='object'&&module.exports?require('./games.js'):globalThis.StudioGames;
 const motion=typeof module==='object'&&module.exports?require('./motion.js'):globalThis.StudioMotion;
 let gameSessions=new WeakMap();
 function captureGames(ctx){const values=Object.create(null);for(const[key,session]of gameSessions.get(ctx)||[])values[key]={time:finite(session.previewTime,0),state:session.snapshot()};return values;}
 const TAU=Math.PI*2,imageCache=new Map(),MAX_TRANSIENT_REACTIONS=256;
 const fonts=(typeof module==='object'&&module.exports?require('./model.js'):globalThis.StudioModel).fonts;
 const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
 const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
 const fraction=v=>v-Math.floor(v);
 function random(seed,index=0){let x=((seed>>>0)^Math.imul(index+1,374761393))>>>0;x=Math.imul(x^(x>>>13),1274126177);return((x^(x>>>16))>>>0)/4294967296;}
 function rgba(hex,alpha=1){const s=hex.length===4?hex.slice(1).split('').map(c=>c+c).join(''):hex.slice(1);return'rgba('+parseInt(s.slice(0,2),16)+','+parseInt(s.slice(2,4),16)+','+parseInt(s.slice(4,6),16)+','+(clamp(alpha)*(s.length===8?parseInt(s.slice(6,8),16)/255:1))+')';}
 function ease(value,type){const t=clamp(value);return type==='ease-in'?t*t:type==='ease-out'?1-(1-t)*(1-t):type==='smooth'?t*t*(3-2*t):t;}
 function layerAt(layer,time){
  const out={...layer},groups={};for(const frame of layer.keyframes||[])(groups[frame.property]??=[]).push(frame);
  for(const [property,frames]of Object.entries(groups)){
   frames.sort((a,b)=>a.time-b.time);let previous={time:0,value:layer[property],easing:'linear'};if(time<0){out[property]=previous.value;continue;}
   for(const next of frames){if(next.time<=time){previous=next;continue;}const t=next.time===previous.time?1:ease((time-previous.time)/(next.time-previous.time),next.easing);out[property]=previous.value+(next.value-previous.value)*clamp(t);previous=null;break;}
   if(previous)out[property]=previous.value;
  }
  return out;
 }
 function localPoint(layer,x,y){const a=-(layer.rotation||0)*Math.PI/180,dx=x-layer.x-layer.width/2,dy=y-layer.y-layer.height/2;return{x:dx*Math.cos(a)-dy*Math.sin(a)+layer.width/2,y:dx*Math.sin(a)+dy*Math.cos(a)+layer.height/2};}
 function renderLayerAt(layer,time=0,events=[],options={}){
  const t=Math.max(0,finite(time)),rules=options.rules||[],needsMotion=layer.type==='fish'||layer.motion&&layer.motion.type!=='none'||rules.some(r=>r.effect==='flee'&&(r.target===layer.id||r.target==='all'));
  if(!needsMotion)return layerAt(layer,time);
  if(!motion)throw Error('Movement preview is not loaded. Reload Skin Studio to continue.');
  const clock=Math.max(0,finite(options.motionTime,finite(options.gameTime,t))),usesClock=Number.isFinite(options.motionTime)||Number.isFinite(options.gameTime);
  const inputs=eventsAt(events,t).map(e=>({...e,time:usesClock&&Number.isFinite(e.clock)?e.clock:clock-(t-e.time)}));
  const sampleBase=(at,event)=>{let timeline=event&&Number.isFinite(event.timelineTime)?event.timelineTime:t-(clock-at);if(options.loop&&options.duration>0)timeline=((timeline%options.duration)+options.duration)%options.duration;return layerAt(layer,timeline);};
  return motion.apply(layer,clock,inputs,{rules,sampleBase});
 }
 function captureMotionOrigins(project,time=0,events=[],options={}){const origins=Object.create(null);if(!motion)return origins;for(const layer of project.layers){if(!motion.eligible(layer)&&!(project.rules||[]).some(r=>r.effect==='flee'&&r.target===layer.id))continue;const pose=renderLayerAt(layer,time,events,{rules:project.rules,duration:project.duration,...options});origins[layer.id]={x:pose.x+pose.width/2,y:pose.y+pose.height/2,rotation:pose.rotation};}return origins;}
 function hitTest(project,x,y,time=0,events=[],options={}){if(!Number.isFinite(x)||!Number.isFinite(y))return null;for(let i=project.layers.length-1;i>=0;i--){const original=project.layers[i],layer=renderLayerAt(original,time,events,{rules:project.rules,duration:project.duration,...options});if(!layer.visible||layer.locked||layer.opacity<=0)continue;const p=localPoint(layer,x,y);if(p.x>=0&&p.y>=0&&p.x<=layer.width&&p.y<=layer.height)return original;}return null;}
 function eventsAt(events,time){return(Array.isArray(events)?events:[]).slice(-256).filter(e=>e&&['keyDown','keyUp','pointer','beat','caps'].includes(e.type)&&Number.isFinite(e.time)&&e.time<=time).map(e=>({...e,x:clamp(finite(e.x,960),0,1920),y:clamp(finite(e.y,275),0,550),strength:clamp(finite(e.strength,1),0,4)}));}
 function matches(rule,event){if(event.ruleId&&event.ruleId!==rule.id)return false;if(rule.trigger!==event.type)return false;if(rule.trigger==='beat')return true;return rule.keys?rule.keys.includes(event.key):rule.key==='any'||rule.key===event.key;}
 function activeRules(project,events,time,toggleBase={}){
  const effects=[],rules=project.rules||[],recent=[...events].filter(e=>e.time<=time&&e.strength>0).sort((a,b)=>b.time-a.time);let used=0,limited=false;
  // Toggle parity must survive the transient rendering budget and effect duration.
  for(const rule of rules){if(rule.effect!=='toggle'||rule.strength<=0)continue;let count=toggleBase[rule.id]===true?1:0,last={time,x:960,y:275,strength:1};for(const event of recent)if(matches(rule,event)){count++;last=event;}if(count%2)effects.push({rule,event:last,age:time-last.time,progress:1,strength:rule.strength});}
  for(const event of recent)for(const rule of rules){if(rule.effect==='toggle'||rule.strength<=0||!matches(rule,event))continue;const age=time-event.time;if(age>rule.duration)continue;if(used>=MAX_TRANSIENT_REACTIONS){limited=true;continue;}used++;effects.push({rule,event,age,progress:clamp(age/rule.duration),strength:clamp(rule.strength*event.strength,0,8)});}
  Object.defineProperty(effects,'limited',{value:limited});return effects;
 }
 function glow(ctx,x,y,radius,color,alpha=1){if(radius<=0||alpha<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,rgba(color,alpha));g.addColorStop(.23,rgba(color,alpha*.48));g.addColorStop(1,rgba(color,0));ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);}
 function line(ctx,x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
 function ellipse(ctx,x,y,rx,ry,angle=0){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),angle,0,TAU);}
 function gradient(ctx,l,t){const w=l.width,h=l.height,phase=t*.08*l.speed;const g=ctx.createLinearGradient(w*(.1+Math.sin(phase)*.1),0,w*.85,h);g.addColorStop(0,l.color);g.addColorStop(1,l.color2);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
 function wave(ctx,l,t){const w=l.width,h=l.height,n=Math.max(2,Math.round(l.density/10)),phase=t*l.speed;for(let band=0;band<n;band++){
  const base=h*(.24+band/(n+1)*.52),a=l.size*(.5+random(l.seed,band)*.75),offset=band*.55;
  const point=x=>base+Math.sin(x/w*TAU*1.2+phase+offset)*a+Math.sin(x/w*TAU*2.4-phase*.5+offset)*a*.35;
  const g=ctx.createLinearGradient(0,base-a,0,base+a+35);g.addColorStop(0,rgba(band%2?l.color:l.color2,.04));g.addColorStop(.45,rgba(band%2?l.color:l.color2,.35));g.addColorStop(1,rgba(l.color,0));
  ctx.beginPath();ctx.moveTo(-5,point(0));for(let x=0;x<=w+20;x+=24)ctx.lineTo(x,point(x));for(let x=w+20;x>=-5;x-=24)ctx.lineTo(x,point(x)+12+l.size*.65);ctx.closePath();ctx.fillStyle=g;ctx.fill();
  ctx.beginPath();for(let x=0;x<=w+24;x+=24)x?ctx.lineTo(x,point(x)):ctx.moveTo(x,point(x));ctx.strokeStyle=rgba(band%2?l.color:l.color2,.55);ctx.lineWidth=1.1;ctx.stroke();
 }}
 function particles(ctx,l,t,kind){const w=l.width,h=l.height,n=Math.round(l.density),speed=t*l.speed;for(let i=0;i<n;i++){
  const a=random(l.seed,i*7),b=random(l.seed,i*7+1),c=random(l.seed,i*7+2),d=random(l.seed,i*7+3);let x,y,r,alpha;
  if(kind==='rain'){
   x=fraction(a-speed*(.018+c*.02))*w;y=fraction(b+speed*(.35+c*.7))*h;r=l.size*(.4+c*.8);const g=ctx.createLinearGradient(x-5,y-r,x,y);g.addColorStop(0,rgba(l.color,0));g.addColorStop(1,rgba(i%3?l.color:l.color2,.35+c*.6));line(ctx,x-r*.2,y-r,x,y,g,.5+c*1.2);continue;
  }
  if(kind==='snow'){
   x=fraction(a+Math.sin(speed*.5+i)*.025+speed*.008)*w;y=fraction(b+speed*(.023+c*.075))*h;r=Math.max(.7,l.size*(.2+c*.6));alpha=.22+c*.65;
   if(i%13===0){line(ctx,x-r*1.8,y,x+r*1.8,y,rgba(l.color2,alpha*.7),.7);line(ctx,x,y-r*1.8,x,y+r*1.8,rgba(l.color2,alpha*.7),.7);}
  }else if(kind==='stars'){
   x=fraction(a+speed*.001*(c+.15))*w;y=b*h;r=Math.max(.6,l.size*(.2+c*.7));alpha=.2+(.5+.5*Math.sin(speed*(.7+d)+i))*.65;
   if(c>.9){line(ctx,x-r*3,y,x+r*3,y,rgba(l.color,alpha*.7),.7);line(ctx,x,y-r*3,x,y+r*3,rgba(l.color,alpha*.7),.7);glow(ctx,x,y,r*6,l.color2,alpha*.25);}
  }else if(kind==='fireflies'){
   x=fraction(a+Math.sin(speed*.3+i)*.018+speed*(c-.5)*.006)*w;y=fraction(b+Math.cos(speed*.45+i*.6)*.075)*h;r=Math.max(.8,l.size*(.25+c*.5));alpha=.2+Math.pow(.5+.5*Math.sin(speed*(.9+d)+i*1.7),3)*.8;glow(ctx,x,y,r*5,i%3?l.color:l.color2,alpha*.55);
  }else{
   x=fraction(a+speed*(.01+c*.025))*w;y=fraction(b-speed*(.015+d*.018)+Math.sin(speed*.5+i)*.014)*h;r=Math.max(.7,l.size*(.2+c*.5));alpha=.25+c*.7;
   if(r>3)glow(ctx,x,y,r*3.2,i%2?l.color:l.color2,alpha*.3);
   if(i%5===0)line(ctx,x-r*5,y+r*2,x,y,rgba(l.color,alpha*.18),.7);
  }
  ctx.fillStyle=rgba(i%3?l.color:l.color2,alpha);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
 }}
 function aurora(ctx,l,t){const w=l.width,h=l.height,n=Math.max(3,Math.min(8,Math.round(l.density/12))),phase=t*l.speed*.45;for(let band=0;band<n;band++){
  const base=h*(.25+band*.07),phase2=phase+band*.43;
  const edge=x=>base+Math.sin(x/w*TAU*.82+phase2)*h*.2+Math.sin(x/w*TAU*2.2-phase2*.65)*l.size*.48;
  const g=ctx.createLinearGradient(0,h*.05,0,h*.92);g.addColorStop(0,rgba(l.color2,0));g.addColorStop(.3,rgba(band%2?l.color:l.color2,.03));g.addColorStop(.65,rgba(band%2?l.color:l.color2,.33));g.addColorStop(1,rgba(l.color,0));
  ctx.beginPath();ctx.moveTo(0,edge(0));for(let x=0;x<=w+20;x+=20)ctx.lineTo(x,edge(x));for(let x=w+20;x>=0;x-=20)ctx.lineTo(x,edge(x)+h*.38+Math.sin(x*.01+phase2)*20);ctx.closePath();ctx.fillStyle=g;ctx.fill();
  ctx.beginPath();for(let x=0;x<=w+20;x+=20)x?ctx.lineTo(x,edge(x)+h*.29):ctx.moveTo(x,edge(x)+h*.29);ctx.strokeStyle=rgba(l.color,band===0?.42:.13);ctx.lineWidth=2;ctx.stroke();
 }}
 function plasma(ctx,l,t){const w=l.width,h=l.height,count=Math.max(6,Math.round(l.density/5));ctx.save();ctx.globalCompositeOperation='screen';for(let i=0;i<count;i++){const phase=t*l.speed*.22+i*2.3,x=(.5+Math.sin(phase*(.55+random(l.seed,i)))*.55)*w,y=(.5+Math.cos(phase*.9+i)*.5)*h,r=l.size*(1.2+random(l.seed,i+500)*2.8);glow(ctx,x,y,r,i%2?l.color:l.color2,.24);}ctx.restore();}
 function orbit(ctx,l,t){const w=l.width,h=l.height,count=Math.max(3,Math.min(10,Math.round(l.density/20))),cx=w*.5,cy=h*.52;for(let ring=0;ring<count;ring++){
  const rx=w*(.13+ring*.042),ry=h*(.09+ring*.033),tilt=(ring-count/2)*.09;ellipse(ctx,cx,cy,rx,ry,tilt);ctx.strokeStyle=rgba(ring%2?l.color:l.color2,.12);ctx.lineWidth=1;ctx.stroke();
  const dots=Math.max(3,Math.round(l.density/count));for(let p=0;p<dots;p++){const angle=t*l.speed*(.18+ring*.035)+p/dots*TAU+ring*1.4,dx=Math.cos(angle)*rx,dy=Math.sin(angle)*ry,x=cx+dx*Math.cos(tilt)-dy*Math.sin(tilt),y=cy+dx*Math.sin(tilt)+dy*Math.cos(tilt),r=Math.max(.8,l.size*(.22+random(l.seed,ring*31+p)*.5));glow(ctx,x,y,r*5,l.color,.27);ctx.fillStyle=rgba(p%2?l.color:l.color2,.8);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
 }}
 function rings(ctx,l,t,scattered=false){const w=l.width,h=l.height,count=Math.max(3,Math.min(20,Math.round(l.density/5)));for(let i=0;i<count;i++){
  const cycle=fraction(t*l.speed*.085+i/count),r=10+cycle*(scattered?l.size*3.5:Math.max(w*.48,h)),x=scattered?random(l.seed,i*2)*w:w*.5,y=scattered?random(l.seed,i*2+1)*h:h*.5;
  ellipse(ctx,x,y,r,scattered?r*.36:r*.34,.02*Math.sin(i));ctx.strokeStyle=rgba(i%2?l.color:l.color2,Math.pow(1-cycle,2)*.7);ctx.lineWidth=1.1+(1-cycle)*1.8;ctx.stroke();
 }}
 function grid(ctx,l,t){const w=l.width,h=l.height,horizon=h*.32,n=Math.max(8,Math.round(l.density/3));const g=ctx.createLinearGradient(0,horizon,0,h);g.addColorStop(0,rgba(l.color,0));g.addColorStop(.2,rgba(l.color,.25));g.addColorStop(1,rgba(l.color2,.72));for(let i=-n;i<=n;i++)line(ctx,w*.5+i*w/n*.13,horizon,w*.5+i*w/n,h,g,1);for(let i=0;i<20;i++){const p=fraction(i/20+t*l.speed*.035),y=horizon+p*p*(h-horizon);line(ctx,0,y,w,y,g,.7+p*1.2);}line(ctx,0,horizon,w,horizon,rgba(l.color,.35),1);glow(ctx,w*.5,horizon,w*.35,l.color,.14);}
 function heatmap(ctx,l,t,events){const cols=16,rows=5,gap=5,cw=l.width/cols,ch=l.height/rows;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const cx=(c+.5)*cw,cy=(r+.5)*ch;let heat=0;for(const e of events){if(!['keyDown','caps'].includes(e.type)||t-e.time>4)continue;const p=localPoint(l,e.x,e.y);const distance=Math.hypot((p.x-cx)/cw,(p.y-cy)/ch);heat+=Math.max(0,1-distance)*Math.exp(-(t-e.time)*.65)*e.strength*l.reactivity;}ctx.fillStyle=rgba(heat>.5?l.color2:l.color,clamp(.018+heat*.58,0,.88));ctx.fillRect(c*cw+gap,r*ch+gap,cw-gap*2,ch-gap*2);ctx.strokeStyle=rgba(l.color,.06+clamp(heat)*.5);ctx.lineWidth=1;ctx.strokeRect(c*cw+gap,r*ch+gap,cw-gap*2,ch-gap*2);if(heat>.1)glow(ctx,cx,cy,Math.max(cw,ch)*.7,l.color2,Math.min(.4,heat*.2));}}
 function pruneImages(project){const used=new Set(project.layers.map(l=>l.image).filter(Boolean));for(const key of imageCache.keys())if(!used.has(key))imageCache.delete(key);}
 function cachedImage(data){
  if(!data||typeof Image==='undefined'||!/^data:image\/(?:png|jpeg|webp);base64,/.test(data))return null;
  let item=imageCache.get(data);if(item)return item;
  const bitmap=new Image();let complete;item={bitmap,ready:false,failed:false,promise:new Promise(resolve=>{complete=resolve;})};imageCache.set(data,item);
  bitmap.onload=()=>{item.ready=true;complete(true);};bitmap.onerror=()=>{item.failed=true;complete(false);};bitmap.src=data;
  if(imageCache.size>48)imageCache.delete(imageCache.keys().next().value);return item;
 }
 async function prepareImages(project){pruneImages(project);const images=[...new Set(project.layers.map(l=>l.image).filter(Boolean))].map(cachedImage);if(images.some(item=>!item))throw Error('This preview cannot decode embedded images.');await Promise.all(images.map(item=>item.promise));if(images.some(item=>item.failed))throw Error('An embedded image could not be decoded. Replace it with a valid PNG, JPEG or WebP image.');return images.length;}
 function image(ctx,l){const item=cachedImage(l.image);if(item?.ready)ctx.drawImage(item.bitmap,0,0,l.width,l.height);}
 function lightning(ctx,w,h,seed,progress,color='#dbeaff',width=2,intensity=1,originX=null){
  if(progress<0||progress>=1)return;
  width=Math.max(.65,Math.min(7,width/12));
  const fade=Math.pow(1-progress,1.8)*Math.min(1,intensity),x=originX===null?w*(.1+random(seed,1)*.8):Math.max(w*.04,Math.min(w*.96,originX)),y=h*(.08+random(seed,2)*.16),end=h*(.85+random(seed,3)*.15),points=[{x,y}];
  let bx=x;const drift=(random(seed,4)-.5)*w*.018;for(let i=1;i<=30;i++){bx+=(random(seed,i+20)-.5)*w*.013+drift*.15;points.push({x:bx,y:y+(end-y)*i/30});}
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  for(const scale of [7,2.5,1]){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=rgba(scale===1?'#f5f9ff':color,fade*(scale===7?.07:scale===2.5?.24:1));ctx.lineWidth=Math.max(.6,width*scale);ctx.stroke();}
  for(let n=0;n<3;n++){const i=8+n*6,p=points[i],side=random(seed,80+n)<.5?-1:1;ctx.beginPath();ctx.moveTo(p.x,p.y);for(let j=1;j<=4;j++)ctx.lineTo(p.x+side*w*.009*j+(random(seed,90+n*7+j)-.5)*w*.006,p.y+h*.027*j);ctx.strokeStyle=rgba(color,fade*.5);ctx.lineWidth=Math.max(.5,width*.55);ctx.stroke();}
  ctx.restore();
 }
 function tornado(ctx,l,t){
  const w=l.width,h=l.height,phase=t*l.speed;
  for(let band=0;band<75;band++){const v=band/74,cy=h*(.02+.92*v),cx=w*(.5+.13*Math.sin(v*2.4+phase*.3)),radius=w*(.32*Math.pow(1-v,1.5)+.045);
   for(let side=0;side<5;side++){const angle=phase*(3+v*2)+side*1.256+v*17,px=cx+Math.cos(angle)*radius*.6,py=cy+Math.sin(angle)*h*.012,lit=(Math.sin(angle)+1)*.5;ctx.save();ctx.translate(px,py);ctx.scale(1,h*.04/radius);const g=ctx.createRadialGradient(0,0,0,0,0,radius);g.addColorStop(0,rgba(lit>.7?l.color2:l.color,.3));g.addColorStop(.5,rgba(l.color,.2));g.addColorStop(1,rgba(l.color,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.fill();ctx.restore();}
  }
  for(let i=0;i<24;i++){const a=phase*2+random(l.seed,i)*TAU,r=w*(.03+random(l.seed,i+60)*.12);glow(ctx,w*.5+Math.cos(a)*r,h*.95+Math.sin(a)*h*.018,w*.025,l.color,.15);}
 }
 function paintLayer(ctx,l,t,events,reactions=[],gameData=null){switch(l.type){
  case'lightning':{if(l.speed>0){const period=8/l.speed,n=Math.floor(t/period),age=t-n*period-period*(.2+random(l.seed,n)*.5);lightning(ctx,l.width,l.height,l.seed+n*173,age/.42,l.color,l.size,.65);}break;}
  case'tornado':tornado(ctx,l,t);break;
  case'fish':motion.drawFish(ctx,l,t);break;
  case'collection':{const item=l.image?cachedImage(l.image):null;collection.draw(ctx,l,t,reactions,item?.ready?item.bitmap:null,gameData);break;}
  case'solid':ctx.fillStyle=l.color;ctx.fillRect(0,0,l.width,l.height);break;
  case'gradient':gradient(ctx,l,t);break;case'wave':wave(ctx,l,t);break;case'aurora':aurora(ctx,l,t);break;case'plasma':plasma(ctx,l,t);break;case'orbit':orbit(ctx,l,t);break;case'grid':grid(ctx,l,t);break;
  case'rocket':space.rocket(ctx,l,t);break;case'nebula':space.nebula(ctx,l,t);break;case'meteors':space.meteors(ctx,l,t);break;
  case'rings':rings(ctx,l,t);break;case'ripple':rings(ctx,l,t,true);break;
  case'particles':case'stars':case'rain':case'snow':case'fireflies':particles(ctx,l,t,l.type);break;
  case'heatmap':heatmap(ctx,l,t,events);break;
  case'text':ctx.fillStyle=l.color;ctx.font=(l.fontWeight||'600')+' '+l.fontSize+'px '+(fonts[l.font]||fonts.sans);ctx.textAlign=l.textAlign||'center';ctx.textBaseline='middle';ctx.shadowColor=rgba(l.color2,.65);ctx.shadowBlur=Math.min(30,l.size*.4);{const lines=l.text.split('\n').slice(0,8),leading=l.fontSize*1.16,inset=Math.min(12,l.height*.03),x=l.textAlign==='left'?l.width*.03:l.textAlign==='right'?l.width*.97:l.width/2,y=l.textVertical==='top'?inset+leading/2:l.textVertical==='bottom'?l.height-inset-(lines.length-.5)*leading:l.height/2-(lines.length-1)*leading/2;lines.forEach((line,i)=>ctx.fillText(line,x,y+i*leading,l.width*.94));}break;
  case'image':image(ctx,l);break;
 }}
 function interaction(ctx,item,layer){const{rule,event,progress:p,strength}=item;if(['pulse','toggle','launch','flee'].includes(rule.effect))return;const point=layer?localPoint(layer,event.x,event.y):event,w=layer?.width||1920,h=layer?.height||550,reactivity=layer?.reactivity??1,intensity=strength*reactivity,fade=Math.pow(1-p,1.6);if(intensity<=0)return;
  if(rule.effect==='lightning'){lightning(ctx,w,h,((layer?.seed||739)^Math.round(event.time*100000)^Math.round((event.x||0)*31+(event.y||0)))>>>0,p,rule.color,layer?.size||2,intensity,(event.x||0)-(layer?.x||0));return;}
  if(rule.effect==='flash'){ctx.fillStyle=rgba(rule.color,Math.min(.7,fade*intensity*.45));ctx.fillRect(0,0,w,h);return;}
  if(rule.effect==='heat'){glow(ctx,point.x,point.y,55+intensity*45,rule.color,fade*intensity*.8);return;}
  if(rule.effect==='shockwave'){const radius=6+p*w*.65;ellipse(ctx,point.x,point.y,radius,Math.max(2,radius*.25));ctx.strokeStyle=rgba(rule.color,fade*intensity);ctx.lineWidth=2+fade*5;ctx.stroke();glow(ctx,point.x,point.y,70,rule.color,fade*.3);return;}
  if(rule.effect==='sparkle'){for(let i=0;i<18;i++){const angle=i*2.399,d=30+120*p,x=point.x+Math.cos(angle)*d,y=point.y+Math.sin(angle)*d*.55,r=2+fade*7;line(ctx,x-r,y,x+r,y,rgba(rule.color,fade),1.4);line(ctx,x,y-r,x,y+r,rgba(rule.color,fade),1.4);}return;}
  if(rule.effect==='ripple'){
   const radius=4+p*(170+intensity*120);glow(ctx,point.x,point.y,radius*.9,rule.color,fade*.12*intensity);ellipse(ctx,point.x,point.y,radius,radius,0);ctx.strokeStyle=rgba(rule.color,Math.min(1,fade*intensity));ctx.lineWidth=1+(1-p)*4;ctx.stroke();ellipse(ctx,point.x,point.y,radius*.77,radius*.77);ctx.strokeStyle=rgba(rule.color,fade*.35*intensity);ctx.lineWidth=1;ctx.stroke();return;
  }
  if(rule.effect==='burst'){const seed=(Math.round(event.time*1000)^Math.round(event.x*13+event.y))>>>0;for(let i=0;i<32;i++){const angle=random(seed,i)*TAU,distance=p*(45+random(seed,i+100)*160)*(.5+intensity*.5),x=point.x+Math.cos(angle)*distance,y=point.y+Math.sin(angle)*distance+p*p*55;line(ctx,x-Math.cos(angle)*(6+fade*12),y-Math.sin(angle)*(6+fade*12),x,y,rgba(rule.color,fade*intensity*.75),1+random(seed,i+200)*2);if(i%3===0)glow(ctx,x,y,9,rule.color,fade*.5);}}
 }
 function draw(ctx,project,time=0,events=[],options={}){
  const t=Math.max(0,finite(time)),validEvents=eventsAt(events,t),active=activeRules(project,validEvents,t,options.toggleBase),global=active.filter(item=>item.rule.target==='all');pruneImages(project);
  ctx.save();ctx.clearRect(0,0,1920,550);ctx.fillStyle=project.canvas.background;ctx.fillRect(0,0,1920,550);
  for(const original of project.layers){const l=renderLayerAt(original,t,validEvents,{rules:project.rules,duration:project.duration,...options}),own=active.filter(item=>item.rule.target===l.id),reactions=[...global,...own],toggles=reactions.filter(item=>item.rule.effect==='toggle').length;if(((l.visible?1:0)^(toggles%2))===0)continue;if(l.opacity<=0)continue;
   const launch=reactions.find(item=>item.rule.effect==='launch');l.launchProgress=launch?launch.progress:-1;let pulse=0;for(const item of reactions)if(item.rule.effect==='pulse')pulse+=Math.sin(item.progress*Math.PI)*Math.pow(1-item.progress,.6)*item.strength*l.reactivity*.1;
   let gameData=null;if(l.type==='collection'&&games.ids.includes(l.text)){const key=project.id+':'+l.id+':'+l.text+':'+l.seed,captured=options.capturedGames?.[key];if(captured?.state){gameData={time:finite(captured.time,t),state:captured.state};}else{let sessions=gameSessions.get(ctx);if(!sessions){sessions=new Map();gameSessions.set(ctx,sessions);}let session=sessions.get(key);if(!session){session=games.createSession(l.text,l.seed);if(sessions.size>=48)sessions.delete(sessions.keys().next().value);sessions.set(key,session);}const gameTime=Math.max(0,finite(options.gameTime,t)),gameEvents=Array.isArray(options.gameEvents)?options.gameEvents:validEvents;gameData={time:gameTime,state:session.advance(gameTime,gameEvents)};session.previewTime=gameTime;}}
   ctx.save();if(l.keyMask){ctx.beginPath();for(const r of space.keyRects(l.keyMask))ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();}ctx.globalAlpha=l.opacity;ctx.globalCompositeOperation=l.blend;ctx.translate(l.x+l.width/2,l.y+l.height/2);ctx.rotate(l.rotation*Math.PI/180);ctx.scale(1+pulse,1+pulse);ctx.translate(-l.width/2,-l.height/2);ctx.beginPath();ctx.rect(0,0,l.width,l.height);ctx.clip();const paintTime=l.type==='fish'||motion?.enabled(l)?Math.max(0,finite(options.motionTime,finite(options.gameTime,t))):t;paintLayer(ctx,l,paintTime,validEvents,reactions,gameData);for(const item of own)interaction(ctx,item,l);ctx.restore();
  }
  ctx.save();ctx.globalCompositeOperation='screen';for(const item of global)interaction(ctx,item,null);ctx.restore();ctx.restore();return{layers:project.layers.length,events:validEvents.length,interactions:active.length,reactionLimited:active.limited};
 }
 return{draw,matches,layerAt,renderLayerAt,captureMotionOrigins,hitTest,localPoint,random,ease,rgba,eventsAt,activeRules,prepareImages,clearImageCache:()=>imageCache.clear(),resetGames:()=>{gameSessions=new WeakMap();},captureGames,MAX_TRANSIENT_REACTIONS};
});
