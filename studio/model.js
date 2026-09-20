(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const types=['solid','gradient','wave','ripple','particles','stars','rain','snow','fireflies','orbit','aurora','plasma','grid','rings','text','image','heatmap','rocket','nebula','meteors','collection','fish','lightning','tornado'];
 const collectionScenes=['storm-meadow','lantern-festival','paper-ocean','neon-speedway','clockwork-garden','prism-bloom','tidal-observatory','alpine-reflection','storm-window','ember-forge','moon-tranquility','atlas-launch','lighthouse-watch','redwood-sanctuary','coral-current','sakura-tram','desert-caravan','jellyfish-ballet','solar-orbit','rainy-cafe','aurora-valley','volcanic-drift','cloud-courier','prism-breaker','dune-runner'];
 const blends=['source-over','screen','multiply','overlay','lighter','soft-light'];
 const easings=['linear','ease-in','ease-out','smooth'];
 const properties=['x','y','width','height','rotation','opacity','size'];
 const fonts={sans:'Segoe UI, Arial, sans-serif',mono:'Consolas, monospace',serif:'Georgia, serif',rounded:'Trebuchet MS, sans-serif',emoji:'Segoe UI Emoji, sans-serif'};
 const triggers=['keyDown','keyUp','pointer','beat','caps'];
 const effects=['ripple','burst','flash','pulse','toggle','heat','shockwave','sparkle','launch','flee','lightning'];
 const motionTypes=['none','drift','swim','orbit'];
 const limits={layers:48,rules:256,keyframes:256,projectBytes:32*1024*1024,imageBytes:8*1024*1024,totalImageBytes:12*1024*1024,imagePixels:16*1024*1024};
 const ranges={x:[-7680,7680],y:[-2200,2200],width:[1,7680],height:[1,2200],rotation:[-3600,3600],opacity:[0,1],size:[1,300],speed:[0,8],density:[1,200],reactivity:[0,4],fontSize:[8,256],seed:[0,4294967295]};
 let sequence=0;
 function uid(){if(typeof crypto!=='undefined'&&crypto.randomUUID)return crypto.randomUUID();sequence++;return 'studio-'+Date.now().toString(36)+'-'+sequence.toString(36)+'-'+Math.random().toString(36).slice(2,10);}
 function clone(value){return JSON.parse(JSON.stringify(value));}
 function object(value,label){if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be an object.');return value;}
 function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(label+' must be a number from '+min+' to '+max+'.');return value;}
 function integer(value,min,max,label){number(value,min,max,label);if(!Number.isInteger(value))throw Error(label+' must be a whole number.');return value;}
 function text(value,max,label){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error(label+' is invalid or too long.');return value;}
 function id(value,label){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value))throw Error(label+' has an invalid ID.');return value;}
 function choice(value,list,label){if(!list.includes(value))throw Error('Unsupported '+label+'.');return value;}
 function boolean(value,label){if(typeof value!=='boolean')throw Error(label+' must be on or off.');return value;}
 function color(value,label='Color'){if(typeof value!=='string'||!/^#(?:[a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(value))throw Error(label+' must be a hexadecimal color.');return value.length===4?'#'+value.slice(1).split('').map(c=>c+c).join('').toLowerCase():value.toLowerCase();}
 function read32(bytes,n){return (bytes[n]*16777216+bytes[n+1]*65536+bytes[n+2]*256+bytes[n+3])>>>0;}
 function little32(bytes,n){return (bytes[n]+bytes[n+1]*256+bytes[n+2]*65536+bytes[n+3]*16777216)>>>0;}
 function rasterInfo(value){
  if(value==='')return{bytes:0,pixels:0,width:0,height:0};
  if(typeof value!=='string'||value.length>limits.imageBytes*4/3+100)throw Error('Embedded image must be no larger than 8 MB.');
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if(!match||!match[2]||match[2].length%4!==0)throw Error('Use an embedded PNG, JPEG or WebP image; URLs and SVG are not accepted.');
  const encoded=match[2];let bytes;
  try{bytes=typeof Buffer!=='undefined'?Buffer.from(encoded,'base64'):Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));}catch{throw Error('The embedded image data is invalid.');}
  if(bytes.length>limits.imageBytes)throw Error('Embedded image must be no larger than 8 MB.');
  let width=0,height=0;
  if(match[1]==='png'){
   if(bytes.length<33||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR'||read32(bytes,8)!==13)throw Error('The embedded PNG header is invalid.');
   width=read32(bytes,16);height=read32(bytes,20);
   let pos=8,ended=false,pixels=false;
   while(pos+12<=bytes.length){const length=read32(bytes,pos),kind=String.fromCharCode(...bytes.slice(pos+4,pos+8));if(length>bytes.length-pos-12)throw Error('The embedded PNG contains an incomplete chunk.');if(kind==='acTL')throw Error('Animated images are not supported. Use a still PNG, JPEG or WebP image.');if(kind==='IDAT')pixels=true;pos+=length+12;if(kind==='IEND'){if(length!==0||pos!==bytes.length)throw Error('The embedded PNG ending is invalid.');ended=true;break;}}
   if(!ended||!pixels)throw Error('The embedded PNG image is incomplete.');
  }else if(match[1]==='jpeg'){
   if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)throw Error('The embedded JPEG header is invalid.');
   let pos=2;
   while(pos+3<bytes.length){if(bytes[pos++]!==255)break;while(bytes[pos]===255)pos++;const marker=bytes[pos++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const length=bytes[pos]*256+bytes[pos+1];if(length<2||pos+length>bytes.length)break;
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=bytes[pos+3]*256+bytes[pos+4];width=bytes[pos+5]*256+bytes[pos+6];break;}pos+=length;}
  }else{
   const str=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
   if(bytes.length<30||str(0,4)!=='RIFF'||str(8,12)!=='WEBP'||little32(bytes,4)+8!==bytes.length)throw Error('The embedded WebP header is invalid.');
   if(str(12,16)==='VP8X'){if(bytes[20]&2)throw Error('Animated images are not supported. Use a still PNG, JPEG or WebP image.');width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;height=1+bytes[27]+bytes[28]*256+bytes[29]*65536;}
   else if(str(12,16)==='VP8L'&&bytes[20]===47){width=1+bytes[21]+((bytes[22]&63)<<8);height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10);}
   else if(str(12,16)==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=(bytes[26]+bytes[27]*256)&16383;height=(bytes[28]+bytes[29]*256)&16383;}
   let pos=12;while(pos+8<=bytes.length){const kind=str(pos,pos+4),length=little32(bytes,pos+4);if(kind==='ANIM'||kind==='ANMF')throw Error('Animated images are not supported. Use a still PNG, JPEG or WebP image.');if(length>bytes.length-pos-8)throw Error('The embedded WebP contains an incomplete chunk.');pos+=8+length+(length%2);}if(pos!==bytes.length)throw Error('The embedded WebP ending is invalid.');
  }
  if(!width||!height||width>4096||height>4096)throw Error('Image dimensions must be between 1 and 4096 pixels.');
  return{bytes:bytes.length,pixels:width*height,width,height};
 }
 function validateImage(value,images){const info=images?.get(value)||rasterInfo(value);images?.set(value,info);return value;}
 const layerDefaults={x:0,y:0,width:1920,height:550,rotation:0,opacity:1,visible:true,locked:false,blend:'source-over',color:'#45d4e8',color2:'#a787ff',speed:1,density:40,size:24,reactivity:1,text:'',fontSize:72,font:'sans',textAlign:'center',textVertical:'center',fontWeight:'600',image:'',seed:1729,keyframes:[]};
 function validateMotion(input){object(input,'Layer movement');return{type:choice(input.type??'none',motionTypes,'movement type'),speed:number(input.speed??1,0,4,'Movement speed'),distance:number(input.distance??80,0,600,'Movement distance'),turn:boolean(input.turn??true,'Turn with movement')};}
 function validateLayer(input,duration=120,images){
  object(input,'Layer');const value={...layerDefaults,...input},layer={id:id(value.id,'Layer'),name:text(value.name,120,'Layer name'),type:choice(value.type,types,'layer type')};
  for(const [key,range]of Object.entries(ranges))layer[key]=key==='density'||key==='seed'?integer(value[key],...range,key):number(value[key],...range,key);
  if(value.motion!==undefined)layer.motion=validateMotion(value.motion);
  if(value.keyMask!==undefined){if(!Array.isArray(value.keyMask)||!value.keyMask.length||value.keyMask.length>68||value.keyMask.some(v=>!Number.isInteger(v)||v<0||v>67)||new Set(value.keyMask).size!==value.keyMask.length)throw Error('Choose valid keys for the layer mask.');layer.keyMask=[...value.keyMask];}
  layer.visible=boolean(value.visible,'Layer visibility');layer.locked=boolean(value.locked,'Layer lock');layer.blend=choice(value.blend,blends,'blend mode');layer.color=color(value.color);layer.color2=color(value.color2);layer.text=text(value.text,512,'Layer text');layer.image=validateImage(value.image,images);
  if(layer.type==='collection')choice(layer.text,collectionScenes,'collection scene');
  layer.font=choice(value.font,Object.keys(fonts),'font');layer.textAlign=choice(value.textAlign,['left','center','right'],'text alignment');layer.textVertical=choice(value.textVertical,['top','center','bottom'],'text vertical position');layer.fontWeight=choice(value.fontWeight,['400','600','700'],'font weight');
  if(!Array.isArray(value.keyframes)||value.keyframes.length>limits.keyframes)throw Error('A layer can have up to 256 keyframes.');
  const ids=new Set(),positions=new Set();layer.keyframes=value.keyframes.map(frame=>{object(frame,'Keyframe');const key=id(frame.id,'Keyframe');if(ids.has(key))throw Error('Keyframe IDs must be unique within a layer.');ids.add(key);const property=choice(frame.property,properties,'animated property'),time=number(frame.time,0,duration,'Keyframe time'),position=property+':'+time;if(positions.has(position))throw Error('A property can have only one keyframe at the same time.');positions.add(position);return{id:key,time,property,value:number(frame.value,...ranges[property],'Keyframe value'),easing:choice(frame.easing??'linear',easings,'easing')};}).sort((a,b)=>a.time-b.time||a.property.localeCompare(b.property));
  return layer;
 }
 function createLayer(type,overrides={}){return validateLayer({...layerDefaults,id:uid(),name:type.charAt(0).toUpperCase()+type.slice(1),...(type==='collection'?{text:collectionScenes[0]}:{}),...(type==='fish'?{width:180,height:80,color:'#f0e6cf',color2:'#dc623c',motion:{type:'swim',speed:1,distance:80,turn:true}}:{}),...overrides,type},120);}
 function validKey(value){return typeof value==='string'&&/^(?:any|Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Arrow(?:Up|Down|Left|Right)|Space|Escape|Enter|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|(?:Shift|Control|Alt|Meta)(?:Left|Right)|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal)|Intl(?:Backslash|Ro|Yen)|Lang[1-5])$/.test(value);}
 function validateRule(input,layerIds=null){object(input,'Interaction');const key=input.key??'any';if(!validKey(key))throw Error('Choose a supported physical key code or any key.');const keys=input.keys;if(keys!==undefined&&(!Array.isArray(keys)||!keys.length||keys.length>68||keys.some(k=>!validKey(k)||k==='any')||new Set(keys).size!==keys.length))throw Error('Choose 1–68 different physical keys.');const target=input.target??'all';if(target!=='all'&&(!id(target,'Interaction target')||layerIds&&!layerIds.has(target)))throw Error('An interaction targets a layer that no longer exists.');const rule={id:id(input.id,'Interaction'),trigger:choice(input.trigger,triggers,'interaction trigger'),key,...(keys?{keys:[...keys]}:{}),target,effect:choice(input.effect,effects,'interaction effect'),color:color(input.color??'#83efff'),strength:number(input.strength??1,0,4,'Interaction strength'),duration:number(input.duration??1,.05,30,'Interaction duration')};if(rule.effect==='flee'){rule.radius=number(input.radius??260,20,1000,'Flee radius');rule.distance=number(input.distance??180,0,600,'Flee distance');}return rule;}
 function createRule(overrides={}){return validateRule({id:uid(),trigger:'keyDown',key:'any',target:'all',effect:'ripple',color:'#83efff',strength:1,duration:1.4,...overrides});}
 function validate(input){
  object(input,'Project');if(JSON.stringify(input).length>limits.projectBytes)throw Error('Project exceeds the 32 MB local file limit. Export a smaller project.');if(input.format!=='centerpiece-skin-studio'||input.version!==1)throw Error('This is not a supported Skin Studio project.');object(input.canvas,'Canvas');if(input.canvas.width!==1920||input.canvas.height!==550)throw Error('Centerpiece projects use a 1920 × 550 canvas.');
  const project={format:'centerpiece-skin-studio',version:1,id:id(input.id,'Project'),name:text(input.name,120,'Project name'),description:text(input.description??'',2000,'Description'),canvas:{width:1920,height:550,background:color(input.canvas.background??'#07121d')},duration:number(input.duration??12,1,120,'Project duration'),fps:integer(input.fps??30,1,60,'Preview frame rate'),engineTarget:choice(input.engineTarget??'4.27',['4.27','5.x'],'engine target'),layers:[],rules:[]};
  if(!Array.isArray(input.layers)||input.layers.length>limits.layers)throw Error('A project can contain up to 48 layers.');if(!Array.isArray(input.rules??[]))throw Error('Interactions must be a list.');
  if((input.rules??[]).length>limits.rules)throw Error('A skin can contain up to '+limits.rules+' interactions. Reduce the interaction count before importing or saving this skin.');
  let totalBytes=0,totalPixels=0,totalFrames=0;const ids=new Set(),images=new Map();project.layers=input.layers.map(value=>{const layer=validateLayer(value,project.duration,images);if(ids.has(layer.id))throw Error('Layer IDs must be unique.');ids.add(layer.id);const image=images.get(layer.image);totalBytes+=image.bytes;totalPixels+=image.pixels;totalFrames+=layer.keyframes.length;return layer;});
  if(totalBytes>limits.totalImageBytes||totalPixels>limits.imagePixels)throw Error('Embedded images exceed the project limit of 12 MB or 16 megapixels.');if(totalFrames>2048)throw Error('A project can contain up to 2048 keyframes.');
  const ruleIds=new Set();project.rules=(input.rules??[]).map(value=>{const rule=validateRule(value,ids);if(ruleIds.has(rule.id))throw Error('Interaction IDs must be unique.');ruleIds.add(rule.id);return rule;});return project;
 }
 function createProject(name='Untitled skin'){return validate({format:'centerpiece-skin-studio',version:1,id:uid(),name,description:'',canvas:{width:1920,height:550,background:'#07121d'},duration:12,fps:30,engineTarget:'4.27',layers:[],rules:[]});}
 function placeLayer(input,operation,region={x:0,y:0,width:1920,height:550}){
  const l=validateLayer(input);if(l.locked)throw Error('Unlock the layer before changing its placement.');
  if(l.keyframes.some(k=>['x','y','width','height','rotation'].includes(k.property)))throw Error('This layer has animated geometry. Adjust its keyframes before using placement tools.');
  for(const k of ['x','y','width','height'])number(region[k],...(ranges[k]),'Placement '+k);
  const {x,y,width:w,height:h}=region;
  if(operation==='fill')Object.assign(l,{x,y,width:w,height:h,rotation:0});
  else if(operation==='fit'){const scale=Math.min(w/l.width,h/l.height);l.width*=scale;l.height*=scale;l.x=x+(w-l.width)/2;l.y=y+(h-l.height)/2;l.rotation=0;}
  else if(['left','center','right','top','middle','bottom'].includes(operation)){
   const angle=l.rotation*Math.PI/180,bw=Math.abs(l.width*Math.cos(angle))+Math.abs(l.height*Math.sin(angle)),bh=Math.abs(l.width*Math.sin(angle))+Math.abs(l.height*Math.cos(angle));
   if(operation==='left')l.x=x+(bw-l.width)/2;if(operation==='right')l.x=x+w-(bw+l.width)/2;if(operation==='center')l.x=x+(w-l.width)/2;
   if(operation==='top')l.y=y+(bh-l.height)/2;if(operation==='bottom')l.y=y+h-(bh+l.height)/2;if(operation==='middle')l.y=y+(h-l.height)/2;
  }else throw Error('Choose a supported placement action.');
  return validateLayer(l);
 }
 return{collectionScenes,validKey,createProject,createLayer,createRule,validate,validateLayer,validateRule,validateMotion,validateImage,rasterInfo,clone,uid,types,motionTypes,blends,easings,properties,triggers,effects,limits,fonts,placeLayer,defaults:clone(layerDefaults)};
});
