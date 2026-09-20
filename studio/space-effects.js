(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioSpace=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 let layout=typeof module==='object'&&module.exports?require('../src/layout.json').keys:[];
 const tau=Math.PI*2,fract=x=>x-Math.floor(x),rnd=i=>fract(Math.sin(i*127.1+311.7)*43758.5453);
 function glow(c,x,y,r,color,a=1){c.save();c.globalAlpha*=a;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
 function path(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
 function nebula(c,l,t){for(let i=0;i<18;i++){const x=rnd(i+l.seed)*l.width,y=(.15+rnd(i+82)*.6)*l.height+Math.sin(t*l.speed*.1+i)*18;glow(c,x,y,80+rnd(i+19)*180,i%2?l.color:l.color2,.035+.018*Math.sin(i+t*.1));}}
 function meteors(c,l,t){for(let i=0;i<Math.min(20,l.density/5);i++){const p=fract(t*l.speed*.09+i*.231),x=(1.2-p*1.4)*l.width,y=rnd(i+l.seed)*l.height*.65+p*l.height*.3,len=20+l.size*2;const g=c.createLinearGradient(x,y,x+len,y-len*.18);g.addColorStop(0,l.color);g.addColorStop(1,'transparent');c.strokeStyle=g;c.lineWidth=1+rnd(i)*1.3;c.beginPath();c.moveTo(x,y);c.lineTo(x+len,y-len*.18);c.stroke();}}
 function rocket(c,l,t){
  const w=l.width,h=l.height,cx=w*.49,ground=h*.91,p=l.launchProgress??-1,igniting=p>=0,flight=igniting?Math.pow(Math.min(1,Math.max(0,(p-.18)/.66)),1.65):0,lift=flight*h*1.55;
  const pulse=.86+.14*Math.sin(t*19),jet=igniting?(.45+Math.min(1,p*8)):.14;
  // Horizon and a lit platform stay on the ground as the vehicle climbs.
  glow(c,cx,ground,w*.32,l.color,.11+jet*.1);c.fillStyle='#101c2b';c.fillRect(0,ground+18,w,h-ground);
  c.fillStyle='#253d51';c.fillRect(w*.27,ground,w*.44,8);c.fillStyle='#6b8b9a';c.fillRect(w*.29,ground-3,w*.4,3);
  for(let i=0;i<28;i++){const x=w*.27+i*w*.44/27;c.fillStyle=i%3?'#61bbd1':l.color;c.fillRect(x,ground+10,3,2);}
  for(const side of [-1,1]){const x=cx+side*w*.15,top=ground-h*.47;c.fillStyle='#172b40';c.fillRect(x-9,top,18,ground-top);c.strokeStyle='#3f6075';c.lineWidth=2;for(let y=top;y<ground-15;y+=26){c.beginPath();c.moveTo(x-8,y);c.lineTo(x+8,y+26);c.lineTo(x-8,y+26);c.stroke();}c.fillStyle=l.color2;c.fillRect(x-3,top-6,6,5);glow(c,x,top-5,13,l.color2,.6);}
  const base=ground-8-lift;
  // Exhaust with individual flame tongues, rather than a single flat triangle.
  if(base>-h*.7){glow(c,cx,base+35,90+jet*100,l.color,jet*.5);for(let i=0;i<17;i++){const n=rnd(i+l.seed),len=(30+jet*170)*( .55+.45*Math.sin(t*12+i)**2),x=cx+(n-.5)*35;const g=c.createLinearGradient(x,base,x,base+len);g.addColorStop(0,'#fff4be');g.addColorStop(.22,l.color);g.addColorStop(.62,l.color2);g.addColorStop(1,'transparent');path(c,[[x-7,base],[x+7,base],[x+Math.sin(t*20+i)*12,base+len*pulse]],g);}}
  // Smoke rolls out from the pad; particle age is deterministic for repeatable edits.
  for(let i=0;i<60;i++){const a=fract(t*(.07+jet*.04)+i/60),side=i%2?1:-1,x=cx+side*a*w*(.17+jet*.19),y=ground+15-a*h*(.05+jet*.22)+Math.sin(i+a*6)*12,r=(12+a*44)*( .5+jet*.45);const smoke=c.createRadialGradient(x-r*.2,y-r*.2,0,x,y,r);smoke.addColorStop(0,i%4?'rgba(116,128,145,'+((.1+jet*.24)*(1-a))+')':'rgba(255,164,87,'+((.08+jet*.16)*(1-a))+')');smoke.addColorStop(.7,'rgba(50,63,82,'+((.12+jet*.12)*(1-a))+')');smoke.addColorStop(1,'transparent');c.fillStyle=smoke;c.fillRect(x-r,y-r,r*2,r*2);}
  c.save();c.translate(cx+(igniting&&p<.18?Math.sin(t*45)*1.2:0),base);const scale=h/550*1.2;c.scale(scale,scale);
  // White orbiter with graphite wings, copper tank and cyan cockpit.
  const tank=c.createLinearGradient(-42,0,42,0);tank.addColorStop(0,'#6d3420');tank.addColorStop(.45,'#dc9362');tank.addColorStop(1,'#512a23');
  path(c,[[-31,0],[-31,-173],[-19,-219],[0,-233],[20,-219],[31,-173],[31,0]],tank);
  for(const side of [-1,1]){const x=side*44;path(c,[[x-10,0],[x-10,-170],[x,-202],[x+10,-170],[x+10,0]],'#dbe3e4');c.fillStyle='#516174';c.fillRect(x-10,-143,20,8);c.fillRect(x-10,-21,20,8);}
  path(c,[[-14,-123],[-78,-20],[-66,-7],[-18,-26],[18,-26],[66,-7],[78,-20],[14,-123]],'#27364a');
  path(c,[[-10,-133],[-63,-24],[-16,-38],[16,-38],[63,-24],[10,-133]],'#a9bbc5');
  const body=c.createLinearGradient(-23,0,23,0);body.addColorStop(0,'#8da7b5');body.addColorStop(.4,'#f5f4e9');body.addColorStop(1,'#728c9e');
  path(c,[[-18,0],[-22,-95],[-17,-152],[-7,-188],[0,-202],[7,-188],[17,-152],[22,-95],[18,0]],body);
  path(c,[[-11,-154],[0,-173],[11,-154],[9,-144],[-9,-144]],'#10283f');c.fillStyle='#92eaff';c.fillRect(-7,-156,14,3);
  path(c,[[0,-58],[10,-8],[0,6],[-10,-8]],'#4a5f75');c.fillStyle='#203447';c.fillRect(-18,-7,36,10);
  c.restore();
 }
 return{rocket,nebula,meteors,setLayout:v=>{layout=v;},keyRects:indices=>indices.map(i=>layout[i]).filter(Boolean).map(k=>({x:(k.x||0)*1920/1800+5,y:(k.y||0)*550/500+5,w:k.width*1920/1800-10,h:k.height*550/500-10}))};
});
