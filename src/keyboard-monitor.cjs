const HID=require('./hid.cjs');const{EventEmitter}=require('node:events');const hardwareCodes=require('./hardware-codes.json');
class KeyboardMonitor extends EventEmitter{
 constructor(){super();this.handle=null;this.timer=null;this.layer=false;this.captureUntil=0;this.lastReportAt=0;this.layerChanges=0;}
 status(){return{connected:!!this.handle,layer:this.layer,lastReportAt:this.lastReportAt,layerChanges:this.layerChanges};}
 start(){if(this.handle)return;const d=HID.devices().find(d=>d.vendorId===0x361d&&d.productId===0x200&&d.usagePage===0xff00&&d.usage===1);if(!d)return;this.handle=new HID.HID(d.path);
  this.handle.on('data',raw=>{if(raw.length<8||raw[0]!==4||!((raw[1]===6&&[1,2].includes(raw[2]))||(raw[1]===8&&raw[2]===3&&raw.length>=10)))return;this.lastReportAt=Date.now();const position=hardwareCodes.indexOf(raw[3]),pressed=raw[4]!==0;
   // Raw positions are used only for L1 state or an explicitly armed editor selection.
   // These are selected-sensor reports, not a complete multi-key pressed set.
   // P and slash belong to the L1 chord, so their reports must not hide its hint.
   // An L1 release or an unrelated sensor clears the hint.
   const layer=position===63?pressed:[26,55].includes(position)?this.layer:false;if(this.layer!==layer){this.layer=layer;this.layerChanges++;this.emit('layer',layer);}
   if(pressed&&position>=0&&position<68&&Date.now()<this.captureUntil){this.captureUntil=0;this.emit('selected',position);}
  });this.handle.on('error',()=>{this.close();this.emit('disconnected');});const tick=()=>{try{const packet=Buffer.alloc(64);packet[0]=3;packet[1]=2;packet[2]=240;packet[3]=29;this.handle?.write([...packet]);}catch{this.close();}};tick();this.timer=setInterval(tick,2500);
 }
 capture(enabled){this.captureUntil=enabled?Date.now()+10000:0;}
 close(){clearInterval(this.timer);this.timer=null;this.captureUntil=0;try{this.handle?.close();}catch{}this.handle=null;this.layer=false;}
}
module.exports={KeyboardMonitor};
