const HID=require('./hid.cjs');
// XPANEL CMD_LCD_ENABLE (35): boolean byte; query has no payload.
async function enabled(value){
 if(typeof value!=='boolean')throw Error('Invalid display power setting.');
 const d=(await HID.devicesAsync()).find(d=>d.vendorId===0x361d&&d.productId===0x200&&d.usagePage===0xff00&&d.usage===1);
 if(!d)throw Error('Connect your keyboard to change display sleep.');
 const h=new HID.HID(d.path);
 try{return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('The keyboard did not confirm display power.')),2500);const done=(e)=>{clearTimeout(timer);e?reject(e):resolve(value);};h.on('error',done);h.on('data',p=>{if(p[0]===4&&p[2]===241&&p[3]===35&&p[1]>=3){if((p[4]!==0)===value)done();else done(Error('Display power readback did not match.'));}});const packet=Buffer.alloc(64);packet[0]=3;packet[1]=3;packet[2]=240;packet[3]=35;packet[4]=value?1:0;h.write([...packet]);});}finally{h.close();}
}
module.exports={enabled};
