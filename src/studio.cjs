const HID = require('./hid.cjs');
const protobuf = require('protobufjs');
const path = require('node:path');
const{nextRequestId,validateResponse}=require('./studio-response.cjs');
const root = protobuf.loadSync(path.join(__dirname, 'proto/studio.proto'));
const Request = root.lookupType('zmk.studio.Request'), Response = root.lookupType('zmk.studio.Response');
class Studio {
  constructor() {
    const device = HID.devices().find(d => d.vendorId === 0x361d && d.productId === 0x200 && d.usagePage === 0xff00 && d.usage === 1);
    if (!device) throw new Error('Centerpiece keyboard is not connected');
    this.serial=device.serialNumber;
    this.handle = new HID.HID(device.path); this.pending = null; this.frame = []; this.inFrame = false; this.escape = false;
    this.handle.on('data', raw => {
      if (raw[0] !== 4 || raw[2] !== 16 || raw[1] < 2) return;
      for (const byte of raw.subarray(3, 3 + raw[1] - 2)) {
        if (this.escape) { this.frame.push(byte); this.escape = false; }
        else if (byte === 0xab) { this.frame = []; this.inFrame = true; }
        else if (byte === 0xac && this.inFrame) this.escape = true;
        else if (byte === 0xad && this.inFrame) {
          this.inFrame = false;
          try { const response = Response.toObject(Response.decode(Buffer.from(this.frame)), {defaults:false});
            if (this.pending && response.requestResponse?.requestId === this.pending.id) this.finish(null, validateResponse(this.pending.body,response.requestResponse));
          } catch (error) { this.finish(error); }
        } else if (this.inFrame) this.frame.push(byte);
        if (this.frame.length > 100000) { this.inFrame = false; this.finish(new Error('Oversized keyboard response')); }
      }
    });
    this.handle.on('error', error => this.finish(error));
  }
  finish(error, result) { const p=this.pending;if(!p)return;this.pending=null;clearTimeout(p.timer);error?p.reject(error):p.resolve(result); }
  request(body) {
    if (this.pending) return Promise.reject(new Error('Keyboard request already pending'));
    const id = nextRequestId();
    const bytes = Request.encode(Request.create({...body,requestId:id})).finish();
    const framed=[0xab];for(const b of bytes){if([0xab,0xac,0xad].includes(b))framed.push(0xac);framed.push(b);}framed.push(0xad);
    return new Promise((resolve,reject)=>{
      this.pending={id,body,resolve,reject,timer:setTimeout(()=>this.finish(new Error('Keyboard configuration query timed out')),4000)};
      try {for(let i=0;i<framed.length;i+=60){const chunk=framed.slice(i,i+60),packet=Buffer.alloc(64);packet[0]=3;packet[1]=chunk.length+3;packet[2]=16;Buffer.from(chunk).copy(packet,3);this.handle.write([...packet]);}}
      catch(error){this.finish(error);}
    });
  }
  close(){this.finish(new Error('Keyboard connection closed'));this.handle.close();}
}
module.exports={Studio};
