(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2,MAX_FLEE_REACTIONS=256,MAX_DISPLACEMENT=600;
 const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const random=(seed,n=0)=>{let v=((seed>>>0)^Math.imul(n+1,374761393))>>>0;v=Math.imul(v^(v>>>13),1274126177);return((v^(v>>>16))>>>0)/4294967296;};
 const enabled=layer=>['drift','swim','roam','orbit'].includes(layer.motion?.type);
 const eligible=layer=>layer.type==='fish'||enabled(layer);
 const smooth=p=>{const t=clamp(p);return t*t*(3-2*t);};
 function matches(rule,event){if(event.ruleId&&event.ruleId!==rule.id)return false;if(rule.trigger!==event.type)return false;if(rule.trigger==='beat')return true;return rule.keys?rule.keys.includes(event.key):rule.key==='any'||rule.key===event.key;}
 function idle(layer,time=0){
  const out={...layer},m=layer.motion;if(!enabled(layer)||m.speed<=0||m.distance<=0)return out;
  const t=Math.max(0,finite(time)),phase=random(layer.seed,21)*TAU,d=clamp(finite(m.distance,80),0,600),speed=clamp(finite(m.speed,1),0,4);
  const rate=speed*(m.type==='drift'?.17:m.type==='orbit'?.24:.32)*( .85+random(layer.seed,22)*.3),u=phase+(m.type==='roam'?t*rate:(t*rate)%TAU);
  let dx,dy,vx,vy;
  if(m.type==='roam'){const q=u*.618+phase*.7;dx=d*(.42*(Math.sin(u)-Math.sin(phase))+.12*(Math.sin(q)-Math.sin(phase*1.318)));dy=d*.13*(Math.sin(u*.731+phase)-Math.sin(phase*1.731));vx=.42*Math.cos(u)+.12*.618*Math.cos(q);vy=.13*.731*Math.cos(u*.731+phase);}
  else if(m.type==='orbit'){dx=.5*d*(Math.cos(u)-Math.cos(phase));dy=.5*d*(Math.sin(u)-Math.sin(phase));vx=-Math.sin(u);vy=Math.cos(u);}
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
 const swimmers=new Map();
 function swimForward(layer,time,events,rules){
  const signature=JSON.stringify([layer.x,layer.y,layer.width,layer.height,layer.rotation,layer.seed,layer.motion,rules]);let s=swimmers.get(layer.id);if(!s||s.signature!==signature||time<s.time){s={signature,time:0,x:layer.x+layer.width/2,y:layer.y+layer.height/2,angle:layer.rotation*Math.PI/180,speed:60,escape:-1000,away:{x:0,y:0},held:null,seen:new Set()};swimmers.set(layer.id,s);if(swimmers.size>48)swimmers.delete(swimmers.keys().next().value);}
  const flee=rules.find(r=>r.effect==='flee'&&(r.target===layer.id||r.target==='all')),curious=rules.find(r=>r.effect==='investigate'&&(r.target===layer.id||r.target==='all'));
  if(time-s.time>20)s.time=time-20;
  while(s.time<time-1e-7){const dt=Math.min(1/60,time-s.time),t=s.time+dt;for(const e of events){const id=e.id??[e.time,e.type,e.key].join(':');if(e.time>t||s.seen.has(id))continue;s.seen.add(id);if(e.type==='keyUp'&&s.held?.key===e.key)s.held=null;if(e.type!=='keyDown'||e.repeat)continue;const dx=s.x-e.x,dy=s.y-e.y,d=Math.hypot(dx,dy);if(flee&&matches(flee,e)&&d<flee.radius){const angle=d>.01?Math.atan2(dy,dx):s.angle;s.away={x:s.away.x*.45+Math.cos(angle)*360*.55,y:s.away.y*.45+Math.sin(angle)*360*.55};s.escape=t;}if(curious&&matches(curious,e)&&d<curious.radius)s.held={key:e.key,x:e.x,y:e.y,time:t};}
   let curiosity=0;let gx=960+(layer.x+layer.width/2-960)*.35+1050*Math.sin(t*(.07+random(layer.seed,86)*.10)+random(layer.seed,81)*TAU),gy=275+(layer.y+layer.height/2-275)*.6+150*Math.sin(t*(.11+random(layer.seed,87)*.13)+random(layer.seed,82)*TAU);
   if(s.held&&t-s.held.time>curious.delay){const weight=smooth((t-s.held.time-curious.delay)/.8),a=random(layer.seed,72)*TAU+t*.18;curiosity=weight;gx+=(s.held.x+100*Math.cos(a)-gx)*weight;gy+=(s.held.y+65*Math.sin(a)-gy)*weight;}
   const fade=Math.pow(1-clamp((t-s.escape)/(flee?.duration||2.2)),2);const escapeWeight=clamp(fade*3);gx+=(s.x+s.away.x-gx)*escapeWeight;gy+=(s.y+s.away.y-gy)*escapeWeight;const aimLength=Math.max(1,Math.hypot(gx-s.x,gy-s.y));gx=s.x+(gx-s.x)*350/aimLength;gy=s.y+(gy-s.y)*350/aimLength;
   for(const [id,other]of swimmers){if(id===layer.id)continue;const dx=s.x-other.x,dy=s.y-other.y,d=Math.hypot(dx,dy);if(d>0&&d<320){const k=650*(1-d/320)/d;gx+=dx*k;gy+=dy*k;}}
   const cx=s.x-960,cy=s.y-275;gx-=cx*2*clamp((Math.abs(cx)-1180)/180);gy-=cy*3*clamp((Math.abs(cy)-350)/140);
   const desired=Math.atan2(gy-s.y,gx-s.x),turn=Math.atan2(Math.sin(desired-s.angle),Math.cos(desired-s.angle));const turnRate=95+fade*200;s.angle+=clamp(turn,-dt*turnRate*Math.PI/180,dt*turnRate*Math.PI/180);s.speed+=(90+random(layer.seed,84)*20+fade*330+curiosity*35-s.speed)*Math.min(1,dt*(1.5+fade*8));s.x+=Math.cos(s.angle)*s.speed*dt;s.y+=Math.sin(s.angle)*s.speed*dt;s.time=t;
  }
  return {...layer,x:s.x-layer.width/2,y:s.y-layer.height/2,rotation:s.angle*180/Math.PI};
 }
 function apply(layer,time,events=[],options={}){
  if(layer.motion?.type==='roam')return swimForward(layer,Math.max(0,finite(time)),events,options.rules||[]);
  const now=Math.max(0,finite(time)),sample=options.sampleBase||(()=>({...layer})),base=idle(sample(now),now),items=candidates(layer,options.rules,events,now);
  if(layer.reactivity<=0)return base;
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
  return investigate(base,layer,now,events,options.rules||[]);
 }
 function investigate(base,layer,time,events,rules){
  for(const rule of rules.filter(r=>r.effect==='investigate'&&r.strength>0&&(r.target===layer.id||r.target==='all'&&eligible(layer)))){
   const ordered=events.filter(e=>e&&Number.isFinite(e.time)&&e.time<=time&&!e.repeat).slice(-256).sort((a,b)=>a.time-b.time);
   let press=null,release=null;for(const event of ordered){if(event.type==='keyDown'&&matches(rule,event)){const origin=originOf(event,layer)||{x:layer.x+layer.width/2,y:layer.y+layer.height/2};if(Math.hypot(origin.x-event.x,origin.y-event.y)<rule.radius){press=event;release=null;}}else if(press&&event.type==='keyUp'&&event.key===press.key&&!release)release=event;}
   if(!press)continue;const elapsed=(release?release.time:time)-press.time-rule.delay;if(elapsed<=0)continue;
   const weight=smooth(elapsed/2.5)*(release?1-smooth((time-release.time)/1.2):1)*clamp(rule.strength*finite(layer.reactivity,1));
   const angle=random(layer.seed,72)*TAU,targetX=press.x+Math.cos(angle)*rule.distance,targetY=press.y+Math.sin(angle)*rule.distance;
   base.x+=(targetX-base.width/2-base.x)*weight;base.y+=(targetY-base.height/2-base.y)*weight;
   const facing=Math.atan2(press.y-(base.y+base.height/2),press.x-(base.x+base.width/2))*180/Math.PI;
   base.rotation+=(((facing-base.rotation+540)%360+360)%360-180)*weight;
  }return base;
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
