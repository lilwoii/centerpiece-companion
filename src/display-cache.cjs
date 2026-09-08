const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');const{Som}=require('./som.cjs');
class DisplayCache{
 constructor(directory,render){this.directory=directory;this.render=render;this.som=null;this.manifest=null;this.lastSlot=null;this.updating=false;this.watching=false;this.config=null;this.caps=false;this.layer=false;this.desired='idle';this.cache=new Map();this.frames=new Map();this.data={};this.lastFrame='';this.error='';this.selectionAt=0;}
 key(selected=this.desired,caps=this.caps,layer=this.layer){return selected!=='idle'?`nav:${selected}`:layer?`layer:${caps?1:0}`:`idle:${caps?1:0}`;}
 frame(selected,caps,layer){const config=selected==='idle'?this.config:{...this.config,indicator:{...this.config.indicator,enabled:false}};return this.render(selected,config,{caps,layer},this.data);}
 async write(slot,selected,caps,layer=false,verify=true){const svg=this.frame(selected,caps,layer),png=await sharp(Buffer.from(svg)).png().toBuffer();await this.som.uploadOverlay(slot,png,'Companion strip',verify);this.lastSlot=slot;this.selectionAt=Date.now();const key=this.key(selected,caps,layer);this.cache.set(key,slot);this.frames.set(key,svg);return svg;}
 setWidget(widget){if(!this.config)return;this.config={...this.config,widget:structuredClone(widget)};}
 async apply(config,locks){if(!this.som)throw Error('Keyboard strip is disconnected.');if(this.updating||this.watching)throw Error('Display is busy. Try again.');this.updating=true;this.config=structuredClone(config);this.caps=!!locks.caps;this.cache.clear();this.error='';
  try{await this.write(2,'idle',false);await this.write(3,'idle',true);await this.write(4,'idle',false,true);await this.write(5,'idle',true,true);for(const[name,i]of ['previous','toggle','next','fourth'].map((n,i)=>[n,i]))await this.write(i+6,name,false);this.lastFrame='';}finally{this.updating=false;this.displayReady();}
 }
 connect(){const file=path.join(this.directory,'hardware.json');if(!fs.existsSync(file))return false;this.manifest=JSON.parse(fs.readFileSync(file,'utf8'));if(!this.manifest.verified||this.manifest.restored)return false;this.som=new Som();if(this.som.serial!==this.manifest.serial){this.som.close();this.som=null;throw Error('This keyboard needs its own local setup.');}return true;}
 displayReady(){if(!this.som||!this.config||this.updating||this.watching)return;const slot=this.cache.get(this.key());if(slot&&slot!==this.lastSlot){this.som.selectSlot(slot);this.lastSlot=slot;this.selectionAt=Date.now();}}
 show(nav){this.desired=nav.active?nav.id:'idle';this.displayReady();}
 setLocks(locks){this.caps=!!locks.caps;this.displayReady();}
 setLayer(active){this.layer=!!active;this.displayReady();}
 setData(data){this.data=data;}
 async refreshLive(){if(!this.som||!this.config||this.updating||this.watching)return;const selected=this.desired,caps=this.caps,layer=selected==='idle'&&this.layer;const svg=this.frame(selected,caps,layer);if(svg===this.frames.get(this.key(selected,caps,layer)))return;const used=new Set(this.cache.values());const target=[2,3,4,5,6,7,8,9,10].find(s=>!used.has(s));if(!target)return;this.updating=true;
  try{this.lastFrame=await this.write(target,selected,caps,layer,false);}catch(e){this.error=e.message;throw e;}finally{this.updating=false;this.displayReady();}
 }
 async reconcile(){if(!this.som||this.watching||this.updating||!this.lastSlot||Date.now()-this.selectionAt<300)return;this.watching=true;const expected=this.lastSlot;try{const current=await this.som.currentSlot();this.lastObservedSlot=current;if(!this.som||this.cache.get(this.key())!==expected)return;if(current!==expected){this.som.selectSlot(expected);this.selectionAt=Date.now();}}finally{this.watching=false;this.displayReady();}}
 async close(){if(!this.som)return;const som=this.som;this.som=null;try{await som.activate(this.manifest.originalSlot||0);}finally{som.close();}}
}
module.exports={DisplayCache};
