const HID=require('./hid.cjs');const{EventEmitter}=require('node:events');const hardwareCodes=require('./hardware-codes.json');
class KeyboardMonitor extends EventEmitter{
 constructor(){super();this.handle=null;this.timer=null;this.layer=false;this.captureUntil=0;this.lastReportAt=0;this.layerChanges=0;this.travelWatching=false;this.lastSensor=null;this.lastActivityAt=-Infinity;}
 status(){return{connected:!!this.handle,layer:this.layer,lastReportAt:this.lastReportAt,layerChanges:this.layerChanges};}
 start(){if(this.handle)return;const d=HID.devices().find(d=>d.vendorId===0x361d&&d.productId===0x200&&d.usagePage===0xff00&&d.usage===1);if(!d)return;this.handle=new HID.HID(d.path);const handle=this.handle;
  handle.on('data',raw=>{if(this.handle!==handle)return;if(raw.length<8||raw[0]!==4||!((raw[1]===6&&[1,2].includes(raw[2]))||(raw[1]===8&&raw[2]===3&&raw.length>=10)))return;this.lastReportAt=Date.now();const position=hardwareCodes.indexOf(raw[3]),pressed=raw[4]!==0;
   // The optional editor meter consumes the existing selected-sensor stream.
   // Byte 5 is calibrated travel in tenths of a millimetre; never infer travel
   // from ordinary down/up events, voltage, or another sensor's value.
   if(this.travelWatching&&raw[1]===8&&raw[2]===3&&position>=0&&position<68&&raw[5]<=40){const sample={position,depthMm:raw[5]/10,pressed,at:this.lastReportAt};
    // XPANEL's RT visualizer reads payload[7/8] (raw[8/9] with report ID)
    // as the firmware's moving press/release thresholds, in tenths of mm.
    if(raw[8]<=40&&raw[9]<=40){sample.rtPressMm=raw[8]/10;sample.rtReleaseMm=raw[9]/10;}this.emit('travel',sample);}
   // A payload-free fallback for games that swallow Windows keyboard hooks.
   // Do not turn repeated idle/held sensor reports into endless activity.
   if(position>=0&&position<68&&raw[5]<=40){const prior=this.lastSensor,depth=raw[5],changed=!prior||prior.position!==position||prior.pressed!==pressed||Math.abs(prior.depth-depth)>=2;
    const active=pressed||depth>=2||(prior?.position===position&&(prior.pressed||prior.depth>=2));
    this.lastSensor={position,pressed,depth};if(changed&&active&&this.lastReportAt-this.lastActivityAt>=250){this.lastActivityAt=this.lastReportAt;this.emit('activity');}}
   // Raw positions are otherwise used only for L1 state or armed selection.
   // These are selected-sensor reports, not a complete multi-key pressed set.
   // P and slash belong to the L1 chord, so their reports must not hide its hint.
   // An L1 release or an unrelated sensor clears the hint.
   if(position===63&&pressed)this.emit('layer-press');
   const layer=position===63?pressed:[26,55,this.pluginPosition??26].includes(position)?this.layer:false;if(this.layer!==layer){this.layer=layer;this.layerChanges++;this.emit('layer',layer);}
   if(pressed&&position>=0&&position<68&&Date.now()<this.captureUntil){this.captureUntil=0;this.emit('selected',position);}
  });handle.on('error',()=>{if(this.handle===handle)this.disconnected();});const tick=()=>{try{const packet=Buffer.alloc(64);packet[0]=3;packet[1]=2;packet[2]=240;packet[3]=29;this.handle?.write([...packet]);}catch{this.disconnected();}};tick();if(this.handle){this.timer=setInterval(tick,2500);this.emit('connected');}
 }
 disconnected(){if(!this.handle)return;this.close();this.emit('disconnected');}
 capture(enabled){this.captureUntil=enabled?Date.now()+10000:0;}
 watchTravel(enabled){this.travelWatching=enabled===true;}
 close(){clearInterval(this.timer);this.timer=null;this.captureUntil=0;this.travelWatching=false;this.lastSensor=null;this.lastActivityAt=-Infinity;try{this.handle?.close();}catch{}this.handle=null;this.layer=false;}
}
module.exports={KeyboardMonitor};
