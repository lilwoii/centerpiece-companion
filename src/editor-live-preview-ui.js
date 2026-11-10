/* Shared editor model is pure; the browser adapter never writes keyboard settings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.EditorLivePreview=api;api.mount();}})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const names=['previous','toggle','next','fourth','fifth'];
 function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a).filter(k=>!['receivedAt','updatedAt','observedAt','timestamp','sampledAt'].includes(k)),other=Object.keys(b).filter(k=>!['receivedAt','updatedAt','observedAt','timestamp','sampledAt'].includes(k));return keys.length===other.length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
 function content(state,now=Date.now()){
  const c=state.desk.config,widgets=[c.widget,...(c.extraWidgets||[])];
  const media=m=>m?{available:m.available,remembered:m.remembered,title:m.title,artist:m.artist,art:m.art,status:m.status,duration:m.duration,position:Math.floor(m.position||0),target:m.target}:null;
  const live=state.desk.live||{},fresh=Object.fromEntries(['network','ram','vram','performance'].map(k=>[k,!!live[k]?.updatedAt&&now-live[k].updatedAt<(k==='performance'?4000:15000)]));
  fresh.weather=!!live.weather&&now-(live.weather.observedAt||live.weather.updatedAt||now)<1800000;
  const ticking=widgets.some(w=>['clock','calendar','timer','spotify','youtubemusic','youtube','downloads','market','performance'].includes(w?.type))||c.slots.some(s=>['clock','calendar','timer'].includes(s?.plugin));
  return{config:c,selected:state.navigation?.active?state.navigation.id:'idle',live,fresh,media:media(state.media),youtubeMusic:media(state.youtubeMusic),youtube:media(state.youtube),timer:state.desk.timer,chat:state.desk.chat,obs:state.desk.obsStatus,tick:ticking?Math.floor(now/1000):0};
 }
 function highlights(state,layout){
  const c=state.desk.config,i=c.indicator||{},caps=!!state.desk.locks?.caps,shapes=[];
  const rect=(id,x,y,width,height,color,opacity=.65,stroke=0)=>shapes.push({id,tag:'rect',x,y,width,height,rx:8,fill:color,'fill-opacity':opacity,stroke:color,'stroke-width':stroke});
  if(i.enabled&&(!c.appearance?.transparentCaps||caps)){
   const color=caps?i.on:i.off;
   if(i.style==='dot'){if(caps||i.dotOff){const r=(i.dotSize||8)/2,gap=r+4,pos=i.dotPosition||'top-right';shapes.push({id:'caps',tag:'circle',cx:pos.includes('left')?i.x+gap:pos.includes('right')?i.x+i.width-gap:i.x+i.width/2,cy:pos.startsWith('top')?i.y+gap:pos.startsWith('bottom')?i.y+i.height-gap:i.y+i.height/2,r,fill:color});}}
   else rect('caps',i.x,i.y,i.width,i.height,color,i.opacity??.48,4);
  }
  function keyRect(id,position,color,shortcut=false){const k=layout?.keys?.[position];if(!k)return;const x=(k.x||0)*1920/1800,y=(k.y||0)*550/500,w=k.width*1920/1800,h=k.height*550/500;if(shortcut)rect(id,x+w/2-44,y+h/2-40,88,80,color,.65,3);else rect(id,x+4,y+4,w-8,h-8,color);}
  if(state.layer){const p=c.pluginShortcuts?.custom?c.pluginShortcuts.position:26;if(c.stripEnabled!==false)keyRect('plugin-shortcut',p,c.layerColor||i.on,true);keyRect('widget-shortcut',55,c.layerColor||i.on,true);if(c.pluginShortcuts?.hideLegendsShortcut)keyRect('legend-shortcut',62,c.legendShortcutColor||'#ff4040');}
  const selection=state.navigation?.active?names.indexOf(state.navigation.id):-1;
  if(selection>=0&&['spotify','youtubemusic'].includes(c.slots[selection]?.plugin))for(const p of [65,67,56])keyRect('music-'+p,p,c.musicNavigationColor||'#1db954');
  if(selection>=0&&c.stripEnabled!==false){const x=selection===4?1490:1605,y=selection===4?451:15+selection*86;shapes.push({id:'selection',tag:'rect',x,y,width:80,height:78,rx:9,fill:'none',stroke:'#9bb9ff','stroke-width':3});}
  return shapes;
 }
 function shouldRefresh(previous,next,elapsed,force=false){return !same(previous,next)&&(force||!previous||previous.selected!==next.selected||elapsed>=900);}
 function mount(){
  const map=document.getElementById('keyboard-map'),page=map?.closest('[data-page]');if(!map||!window.companion?.previewLayout)return;
  let current=null,image=null,colors=null,hotspots=null,previous=null,lastImage='',shapeKey='',running=false,lastRequest=0,retryAt=0,intersecting=true;
  const ns='http://www.w3.org/2000/svg';
  const shown=()=>!page.hidden&&!document.hidden&&intersecting;
  function ensure(){
   if(!image||!map.contains(image)){image=document.createElement('img');image.className='editor-live-content';image.alt='Live configured plugins and widgets';image.draggable=false;if(lastImage)image.src=lastImage;colors=document.createElementNS(ns,'svg');colors.classList.add('editor-live-indicators');colors.setAttribute('viewBox','0 0 1920 550');colors.setAttribute('preserveAspectRatio','none');colors.setAttribute('aria-hidden','true');hotspots=document.createElement('div');hotspots.className='editor-widget-hotspots';map.append(image,colors,hotspots);shapeKey='';}
  }
  function paint(){if(!current?.desk||!shown())return;ensure();const c=current.desk.config,layout=typeof keymap!=='undefined'?keymap?.layout:null,shapes=highlights(current,layout),next=JSON.stringify(shapes);if(next!==shapeKey){shapeKey=next;colors.replaceChildren(...shapes.map(shape=>{const node=document.createElementNS(ns,shape.tag);for(const[k,v]of Object.entries(shape))if(k!=='tag'&&k!=='id')node.setAttribute(k,String(v));node.dataset.indicator=shape.id;return node;}));}
   const widgets=[c.widget,...(c.extraWidgets||[])].filter(w=>w&&w.type!=='off'),areas=c.widgetLayout!=='free'&&c.extraWidgets?.length?[{x:1710,y:219,width:194,height:211,connected:true}]:widgets;
   const areaKey=JSON.stringify(areas.map(w=>[w.x,w.y,w.width,w.height,w.connected]));if(hotspots.dataset.areas!==areaKey){hotspots.dataset.areas=areaKey;hotspots.replaceChildren(...areas.map((w,index)=>{const button=document.createElement('button');button.type='button';button.className='editor-widget-hotspot';button.setAttribute('aria-label',index?'Edit extra screen widget '+index:'Edit screen widget');button.title='Edit screen widgets';for(const[k,v]of Object.entries({left:w.x/1920*100+'%',top:w.y/550*100+'%',width:w.width/1920*100+'%',height:w.height/550*100+'%'}))button.style[k]=v;if(w.connected)button.style.clipPath='polygon(0 0,100% 0,100% 100%,54.1% 100%,54.1% 44.5%,0 44.5%)';button.addEventListener('click',()=>{location.hash='widgets';});return button;}));}
  }
  async function refresh(force=false){if(!current?.desk||!shown()||running||Date.now()<retryAt)return;paint();const snapshot=content(current);if(!shouldRefresh(previous,snapshot,Date.now()-lastRequest,force))return;running=true;lastRequest=Date.now();try{const result=await window.companion.previewLayout(snapshot.config,{editorOverlay:true,selected:snapshot.selected,freeze:true});if(map.contains(image)&&shown()&&same(snapshot.config,current.desk.config)&&snapshot.selected===(current.navigation?.active?current.navigation.id:'idle')){lastImage=result;image.src=result;image.title='Live keyboard content';previous=snapshot;}}catch(error){retryAt=Date.now()+5000;if(image)image.title='Live preview unavailable. '+error.message;}finally{running=false;if(shown()&&current?.desk&&snapshot.selected!==(current.navigation?.active?current.navigation.id:'idle'))void refresh(true);}}
  function render(state){current=state;if(!shown())return;paint();void refresh();}
  document.addEventListener('companion-keyboard-drawn',()=>{paint();void refresh();});window.addEventListener('hashchange',()=>requestAnimationFrame(()=>{paint();void refresh();}));document.addEventListener('visibilitychange',()=>{if(shown())void refresh();});
  if(typeof IntersectionObserver==='function')new IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting!==false;if(shown()){paint();void refresh();}},{rootMargin:'80px'}).observe(map);
  window.companion.subscribe(render);window.companion.getState().then(render).catch(()=>{});setInterval(()=>{if(shown())void refresh();},1000);
 }
 return{same,content,highlights,shouldRefresh,mount};
});
