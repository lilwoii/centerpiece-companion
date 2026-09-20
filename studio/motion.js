(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2,MAX_FLEE_REACTIONS=256,MAX_DISPLACEMENT=600;
 const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const random=(seed,n=0)=>{let v=((seed>>>0)^Math.imul(n+1,374761393))>>>0;v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967296;};
 const enabled=layer=>['drift','swim','orbit'].includes(layer.motion?.type);
 const eligible=layer=>layer.type==='fish'||enabled(layer);
 const smooth=p=>{const t=clamp(p);return t*t*(3-2*t);};
 function matches(rule,event){if(event.ruleId&&event.ruleId!==rule.id)return false;if(rule.trigger!==event.type)return false;if(rule.trigger==='beat')return true;return rule.keys?rule.keys.includes(event.key):rule.key==='any'||rule.key===event.key;}
 function idle(layer,time=0){
  const out={...layer},m=layer.motion;if(!enabled(layer)||m.speed<=0||m.distance<=0)return out;
  const t=Math.max(0,finite(time)),phase=random(layer.seed,21)*TAU,d=clamp(finite(m.distance,80),0,600),speed=clamp(finite(m.speed,1),0,4);
  const rate=speed*(m.type==='drift'?.17:m.type==='orbit'?.24:.32)*( .85+random(layer.seed,22)*.3),u=phase+(t*rate)%TAU;
  let dx,dy,vx,vy;
  if(m.type==='orbit'){dx=.5*d*(Math.cos(u)-Math.cos(phase));dy=.5*d*(Math.sin(u)-Math.sin(phase));vx=-Math.sin(u);vy=Math.cos(u);}
  else if(m.type==='swim'){dx=.45*d*(Math.sin(u)-Math.sin(phase));dy=.17*d*(Math.sin(2*u)-Math.sin(2*phase));vx=.45*Math.cos(u);vy=.34*Math.cos(2*u);}
  else{dx=.4*d*(Math.sin(u)-Math.sin(phase));dy=.25*d*(Math.cos(u)-Math.cos(phase));vx=.4*Math.cos(u);vy=-.25*Math.sin(u);}
  const angle=finite(layer.rotation)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  out.x=layer.x+dx*c-dy*s;out.y=layer.y+dx*s+dy*c;
  if(m.turn!==false)out.rotation=layer.rotation+Math.atan2(vy,vx)*180/Math.PI;
  return out;
 }
 // A quick, eased escape followed by a slower return. Both endpoints have zero velocity.
 function envelope(age,duration){if(age<=0||age>=duration)return 0;const p=age/duration;return p<.22?smooth(p/.22):1-smooth((p-.22)/.78);}
 function displacement(impulses,time){let x=0,y=0,activity=0,turn=0,turnWeight=0;for(const impulse of impulses){const amount=envelope(time-impulse.time,impulse.duration),weight=amount*finite(impulse.turnWeight);x+=impulse.dx*amount;y+=impulse.dy*amount;activity=Math.max(activity,amount*impulse.intensity);turn+=finite(impulse.turn)*weight;turnWeight+=weight;}const length=Math.hypot(x,y);if(length>MAX_DISPLACEMENT){x*=MAX_DISPLACEMENT/length;y*=MAX_DISPLACEMENT/length;}return{x,y,activity:clamp(activity,0,4),turn:turn/Math.max(1,turnWeight)};}
 function fallbackAngle(layer,event){let seed=layer.seed>>>0;for(const char of String(event.key||event.type||''))seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;return random(seed,31)*TAU;}
 function originOf(event,layer){const value=event.origins&&Object.prototype.hasOwnProperty.call(event.origins,layer.id)?event.origins[layer.id]:null;return value&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Math.abs(value.x)<=20000&&Math.abs(value.y)<=20000?value:null;}
 function candidates(layer,rules,events,time){
  const relevant=(rules||[]).filter(rule=>rule.effect==='flee'&&rule.strength>0&&(rule.target===layer.id||rule.target==='all'&&eligible(layer)));
  if(!relevant.length)return[];
  const seen=new Set(),ordered=(events||[]).filter(e=>e&&Number.isFinite(e.time)&&e.time<=time&&e.strength>0&&!e.repeat).slice(-256).sort((a,b)=>a.time-b.time),items=[];
  for(let i=ordered.length-1;i>=0;i--){const event=ordered[i],token=event.id!==undefined?'id:'+event.id:[event.time,event.type,event.key,event.x,event.y,event.ruleId||''].join('|');if(seen.has(token))continue;seen.add(token);if(event.type==='pointer'&&!event.ruleId&&ordered.some(other=>other.type==='keyDown'&&!other.ruleId&&other.time===event.time&&other.key===event.key&&other.x===event.x&&other.y===event.y&&relevant.some(rule=>matches(rule,other))))continue;for(const rule of relevant)if(matches(rule,event)){items.push({rule,event});if(items.length===MAX_FLEE_REACTIONS)return items.reverse();}}
  // Fixed work budget protects imported projects with very large rule lists.
  return items.reverse();
 }
 function apply(layer,time,events=[],options={}){
  const now=Math.max(0,finite(time)),sample=options.sampleBase||(()=>({...layer})),base=idle(sample(now),now),items=candidates(layer,options.rules,events,now);
  if(!items.length||layer.reactivity<=0)return base;
  const impulses=[];
  for(const{rule,event}of items){
   const saved=originOf(event,layer),at=idle(sample(event.time,event),event.time),previous=saved?null:displacement(impulses,event.time);
   const origin=saved||{x:at.x+at.width/2+previous.x,y:at.y+at.height/2+previous.y};
   let dx=origin.x-finite(event.x,960),dy=origin.y-finite(event.y,275),distance=Math.hypot(dx,dy);const radius=clamp(finite(rule.radius,260),20,1000);
   // Qualification is sampled at the press, never at the current animation position.
   if(distance>=radius)continue;
   if(distance<1e-6){const a=fallbackAngle(layer,event);dx=Math.cos(a);dy=Math.sin(a);distance=1;}else{dx/=distance;dy/=distance;}
   const proximity=1-smooth(Math.hypot(origin.x-finite(event.x,960),origin.y-finite(event.y,275))/radius),intensity=clamp(rule.strength*event.strength*finite(layer.reactivity,1),0,8);
   const amount=Math.min(MAX_DISPLACEMENT,clamp(finite(rule.distance,180),0,600)*intensity*proximity);
   const heading=Math.atan2(dy,dx)*180/Math.PI,originRotation=finite(saved?.rotation,at.rotation+finite(previous?.turn)),turn=((heading-originRotation+540)%360+360)%360-180;
   impulses.push({time:event.time,duration:clamp(finite(rule.duration,1.4),.05,30),dx:dx*amount,dy:dy*amount,intensity,turn,turnWeight:smooth(Math.min(1,amount/70))});
  }
  const offset=displacement(impulses,now);base.x+=offset.x;base.y+=offset.y;
  // Fix the turn direction at the press too. Rechoosing a shortest turn every frame
  // would flip by 180 degrees when a swimming object crosses the opposite heading.
  if(offset.activity>0&&eligible(layer)&&layer.motion?.turn!==false)base.rotation+=offset.turn;
  return base;
 }
 function drawFish(ctx,l,time=0){
  const w=l.width,h=l.height,t=Math.max(0,finite(time))*finite(l.speed,1),phase=random(l.seed,8)*TAU,beat=Math.sin(t*5.4+phase),bend=(x)=>Math.sin(t*5.4+phase-x/w*3.7)*h*.08*Math.pow(1-x/w,2);
  const polygon=(points,fill)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  const oval=(x,y,rx,ry,fill,angle=0)=>{ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),angle,0,TAU);ctx.fillStyle=fill;ctx.fill();};
  const body=()=>{ctx.beginPath();for(let side=0;side<2;side++)for(let i=0;i<=28;i++){const p=side?1-i/28:i/28,x=w*(.2+.7*p),width=h*(.032+.218*Math.sin(Math.PI*p)**.68),y=h*.5+bend(x)+(side?-width:width);if(!side&&!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();};
  ctx.save();
  // Paired fins and a split, flexing tail remain inside the editable layer rectangle.
  ctx.globalAlpha*=.66;
  polygon([[w*.62,h*.49],[w*.46,h*(.1+beat*.025)],[w*.67,h*.29],[w*.73,h*.48]],l.color);
  polygon([[w*.62,h*.51],[w*.46,h*(.9-beat*.025)],[w*.67,h*.71],[w*.73,h*.52]],l.color);
  const tailY=h*.5+bend(w*.18),tip=h*.5+beat*h*.15;
  polygon([[w*.25,tailY],[w*.04,tip-h*.29],[w*.1,tip],[w*.035,tip+h*.29]],l.color2);
  ctx.globalAlpha/=.66;
  const bodyGradient=ctx.createLinearGradient(0,h*.24,0,h*.78);bodyGradient.addColorStop(0,l.color);bodyGradient.addColorStop(.48,l.color);bodyGradient.addColorStop(1,'#8b9898');body();ctx.fillStyle=bodyGradient;ctx.fill();ctx.save();body();ctx.clip();
  // Independent seed gives each fish its own koi markings without external assets.
  for(let i=0;i<7;i++){const x=w*(.28+random(l.seed,i*4)*.51),y=h*(.35+random(l.seed,i*4+1)*.3),rx=w*(.035+random(l.seed,i*4+2)*.065),ry=h*(.07+random(l.seed,i*4+3)*.11);oval(x,y,rx,ry,l.color2,(random(l.seed,i+80)-.5)*1.6);}
  for(let row=0;row<3;row++)for(let col=0;col<11;col++){const x=w*(.27+col*.045),y=h*(.42+row*.072)+bend(x);ctx.beginPath();ctx.arc(x,y,h*.055,-Math.PI*.48,Math.PI*.48);ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=Math.max(.35,h*.006);ctx.stroke();}
  const sheen=ctx.createLinearGradient(0,h*.36,0,h*.65);sheen.addColorStop(0,'rgba(255,255,255,0)');sheen.addColorStop(.35,'rgba(255,255,255,.28)');sheen.addColorStop(1,'rgba(255,255,255,0)');body();ctx.fillStyle=sheen;ctx.fill();ctx.restore();
  for(const side of [-1,1]){oval(w*.815,h*.5+side*h*.095+bend(w*.815),w*.023,h*.033,'#253137');oval(w*.824,h*.5+side*h*.091+bend(w*.815),w*.007,h*.012,'#f5f9ef');}
  ctx.beginPath();ctx.moveTo(w*.868,h*.474+bend(w*.87));ctx.lineTo(w*.88,h*.5+bend(w*.87));ctx.lineTo(w*.868,h*.526+bend(w*.87));ctx.strokeStyle='rgba(57,64,64,.4)';ctx.lineWidth=Math.max(.5,h*.012);ctx.stroke();ctx.restore();
 }
 return{enabled,eligible,matches,idle,apply,envelope,displacement,drawFish,MAX_FLEE_REACTIONS,MAX_DISPLACEMENT};
});
