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
    if (payload.length > 1020) throw new Error('Display packet is too large');
    const packet = Buffer.alloc(1024); packet[0] = 1; packet.writeUInt16LE(payload.length, 1); packet[3] = command; payload.copy(packet, 4); this.handle.write([...packet]);
  }
  wait(match, trigger, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const done = (error, result) => { clearTimeout(timer); this.listeners.delete(listener); error ? reject(error) : resolve(result); };
      const listener = (error, command, payload) => {
        if (error) { done(error); return; }
        try { const result = match(command, payload); if (result !== undefined) done(null, result); } catch (e) { done(e); }
      };
      const timer = setTimeout(() => done(Object.assign(new Error('Keyboard display response timed out.'),{code:'DISPLAY_REQUEST_TIMEOUT'})), timeout);
      this.listeners.add(listener); try { trigger(); } catch (error) { done(error); }
    });
  }
  screenTimeout(value) { if(value!==undefined&&(!Number.isInteger(value)||value<0||value>255))throw Error('Invalid firmware timeout.');return this.wait((cmd,p)=>cmd===51&&p.length?p[0]:undefined,()=>this.send(51,value===undefined?Buffer.alloc(0):Buffer.from([value]))); }
  currentSlot() { return this.wait((cmd, p) => cmd === 50 && p.length ? p[0] : undefined, () => this.send(50)); }
  language(value) { if(value!==undefined&&(!Number.isInteger(value)||value<0||value>4))throw Error('Unsupported native legend language');return this.wait((cmd,p)=>cmd===53&&p.length?p[0]:undefined,()=>this.send(53,value===undefined?Buffer.alloc(0):Buffer.from([value]))); }
  legends(value) { if(value!==undefined&&typeof value!=='boolean')throw Error('Invalid legend visibility');return this.wait((cmd,p)=>cmd===52&&p.length===1?!!p[0]:undefined,()=>this.send(52,value===undefined?Buffer.alloc(0):Buffer.from([Number(value)]))); }
  legendPositions() { return this.wait((cmd,p)=>{if(cmd!==55)return; if(p.length!==340)throw Error('Incomplete keyboard legend positions');const positions=Array(68);for(let n=0;n<p.length;n+=5){const id=p[n],x=p.readUInt16LE(n+1),y=p.readUInt16LE(n+3);if(id>67||positions[id]||x>1920||y>550)throw Error('Invalid keyboard legend positions');positions[id]={x,y};}return positions;},()=>this.send(55)); }
  selectSlot(slot) { if (!Number.isInteger(slot)||slot<1||slot>10) throw new Error('Invalid overlay slot'); this.send(50, Buffer.from([slot])); }
  async activate(slot){const current=await this.currentSlot();if(slot===0){if(current)this.selectSlot(current);}else if(current!==slot)this.selectSlot(slot);}
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
    return this.wait((cmd, p) => {
      if (cmd !== 32 || p.length < 2 || p[1] !== type) return;
      if (p[0] !== 0) throw new Error(`Display rejected upload: ${p.subarray(5).toString('utf8')}`);
      return true;
    }, () => {
      this.send(type);
      for (let offset = 0; offset < bytes.length; offset += 1020) this.send(16, bytes.subarray(offset, offset + 1020));
      this.send(32);
    }, 20000);
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
