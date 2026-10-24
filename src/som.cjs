const HID = require('./hid.cjs');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
class Som {
  constructor() {
    const device = HID.devices().find(d => d.vendorId === 0x361d && d.productId === 0x202 && d.usagePage === 0xff00 && d.usage === 1);
    if (!device) throw new Error('Centerpiece display is not connected.');
    this.serial = device.serialNumber;this.identity=String(device.serialNumber||device.path||'');
    this.handle = new HID.HID(device.path); this.listeners = new Set();
    this.handle.on('data', raw => {
      if (raw[0] !== 3 || raw.length < 4) return;
      const length = raw.readUInt16LE(1);
      if (length > raw.length - 4) return;
      for (const listener of this.listeners) listener(null, raw[3], raw.subarray(4, 4 + length));
    });
    this.handle.on('error', error => { for (const listener of this.listeners) listener(error); });
  }
  send(command, payload = Buffer.alloc(0)) {
    this.handle.write([...this.packet(command,payload)]);
  }
  packet(command, payload = Buffer.alloc(0)) {
    if (payload.length > 1020) throw new Error('Display packet is too large');
    const packet = Buffer.alloc(1024); packet[0] = 1; packet.writeUInt16LE(payload.length, 1); packet[3] = command; payload.copy(packet, 4); return packet;
  }
  wait(match, trigger, timeout = 10000) {
    return new Promise((resolve, reject) => {
      let settled=false;
      const done = (error, result) => { if(settled)return;settled=true;clearTimeout(timer); this.listeners.delete(listener); error ? reject(error) : resolve(result); };
      const listener = (error, command, payload) => {
        if (error) { done(error); return; }
        try { const result = match(command, payload); if (result !== undefined) done(null, result); } catch (e) { done(e); }
      };
      const timer = setTimeout(() => done(Object.assign(new Error('Keyboard display response timed out.'),{code:'DISPLAY_REQUEST_TIMEOUT'})), timeout);
      this.listeners.add(listener); try { Promise.resolve(trigger()).catch(done); } catch (error) { done(error); }
    });
  }
  screenTimeout(value) { if(value!==undefined&&(!Number.isInteger(value)||value<0||value>255))throw Error('Invalid firmware timeout.');return this.wait((cmd,p)=>cmd===51&&p.length?p[0]:undefined,()=>this.send(51,value===undefined?Buffer.alloc(0):Buffer.from([value]))); }
  currentSlot() { return this.wait((cmd, p) => cmd === 50 && p.length ? p[0] : undefined, () => this.send(50)); }
  language(value) { if(value!==undefined&&(!Number.isInteger(value)||value<0||value>4))throw Error('Unsupported native legend language');return this.wait((cmd,p)=>cmd===53&&p.length?p[0]:undefined,()=>this.send(53,value===undefined?Buffer.alloc(0):Buffer.from([value]))); }
  legends(value) { if(value!==undefined&&typeof value!=='boolean')throw Error('Invalid legend visibility');return this.wait((cmd,p)=>cmd===52&&p.length===1?!!p[0]:undefined,()=>this.send(52,value===undefined?Buffer.alloc(0):Buffer.from([Number(value)]))); }
  legendPositions() { return this.wait((cmd,p)=>{if(cmd!==55)return; if(p.length!==340)throw Error('Incomplete keyboard legend positions');const positions=Array(68);for(let n=0;n<p.length;n+=5){const id=p[n],x=p.readUInt16LE(n+1),y=p.readUInt16LE(n+3);if(id>67||positions[id]||x>1920||y>550)throw Error('Invalid keyboard legend positions');positions[id]={x,y};}return positions;},()=>this.send(55)); }
  selectSlot(slot) { if (!Number.isInteger(slot)||slot<1||slot>10) throw new Error('Invalid overlay slot'); this.send(50, Buffer.from([slot])); }
  async activate(slot){
    if(!Number.isInteger(slot)||slot<0||slot>10)throw Error('Invalid overlay restoration slot');
    const current=await this.currentSlot();
    if(!Number.isInteger(current)||current<0||current>10)throw Error('Invalid active overlay; restoration canceled.');
    if(current===slot)return;
    this.selectSlot(slot===0?current:slot);
    // A queued write is not proof of restoration. Require two matching reads,
    // allowing a delayed selection reply to drain before releasing the handle.
    let matched=0;
    for(let attempt=0;attempt<5;attempt++){
      const actual=await this.currentSlot();
      if(!Number.isInteger(actual)||actual<0||actual>10)throw Error('Invalid overlay restoration readback.');
      matched=actual===slot?matched+1:0;if(matched===2)return;
      if(attempt<4)await new Promise(resolve=>setTimeout(resolve,25));
    }
    throw Object.assign(Error('The keyboard did not confirm its previous overlay. Retry Quit to restore it.'),{code:'DISPLAY_RESTORE_FAILED'});
  }
  readOverlay(slot) {
    const chunks = new Map(); let expected;
    return this.wait((cmd, p) => {
      if (cmd !== 9 || p.length < 5 || p[0] !== slot) return;
      const index = p.readUInt16LE(1), total = p.readUInt16LE(3);
      if (!total && !index) return null;
      if (total > 16000 || index >= total || (expected !== undefined && total !== expected)) throw new Error('Invalid overlay response');
      expected = total; chunks.set(index, Buffer.from(p.subarray(5)));
      if (chunks.size === total) return Buffer.concat(Array.from({length:total}, (_, n) => chunks.get(n)));
    }, () => this.send(9, Buffer.from([slot])), 20000);
  }
  async transfer(type, bytes) {
    let ending=false,stopped=false;
    try{return await this.wait((cmd, p) => {
      if (cmd !== 32 || p.length < 2 || p[1] !== type) return;
      if(!ending)throw new Error('Display upload acknowledgement arrived before the transfer ended.');
      if (p[0] !== 0) throw new Error(`Display rejected upload: ${p.subarray(5).toString('utf8')}`);
      return true;
    }, async () => {
      this.send(type);
      let batch=[],beat=0;
      const flush=async()=>{if(!batch.length||stopped)return;const packets=batch;batch=[];if(this.handle.writeBatch)await this.handle.writeBatch(packets);else{for(const packet of packets)this.handle.write([...packet]);await new Promise(resolve=>setImmediate(resolve));}};
      for (let offset = 0; offset < bytes.length&&!stopped; offset += 1020){
        const part=bytes.subarray(offset,offset+1020);batch.push(this.packet(16,part));beat+=part.length;
        if(batch.length===64)await flush();
        if(stopped)return;
        if(beat>=1024*1024){batch.push(this.packet(17));beat=0;if(batch.length===64)await flush();}
      }
      await flush();if(stopped)return;ending=true;this.send(32);
    }, 20000);}finally{stopped=true;}
  }
  async uploadOverlay(slot, bytes, name = 'Companion strip', verify = true) {
    if (!Number.isInteger(slot)||slot<1||slot>10 || bytes.length > 8*1024*1024 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid overlay PNG');
    const manifest = Buffer.from(JSON.stringify({slot, fileName:name, fileExtension:'png', fileSize:bytes.length, fileID:randomUUID()}));
    await this.transfer(1, manifest); await this.transfer(4, bytes);
    if(!verify)return; // Live frames retain both firmware acknowledgements; setup verifies full previews.
    await require('./overlay-preview.cjs').verifyOverlayPreview(bytes,()=>this.readOverlay(slot));
  }
  close() { this.handle.close(); }
}
module.exports = { Som };
