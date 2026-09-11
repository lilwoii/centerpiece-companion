const HID = require('./hid.cjs');
const protobuf = require('protobufjs');
const path = require('node:path');
const {nextRequestId, requestInfo, studioError, nativeError, validateResponse} = require('./studio-response.cjs');
const root = protobuf.loadSync(path.join(__dirname, 'proto/studio.proto'));
const Request = root.lookupType('zmk.studio.Request'), Response = root.lookupType('zmk.studio.Response');
class Studio {
  constructor() {
    let matches;
    try { matches = HID.devices().filter(d => d.vendorId === 0x361d && d.productId === 0x200 && d.usagePage === 0xff00 && d.usage === 1); }
    catch (error) { throw nativeError(error, null, 'discover_devices'); }
    const devices = [...new Map(matches.map(d => [d.path, d])).values()];
    if (!devices.length) throw studioError('STUDIO_NOT_CONNECTED', 'The Centerpiece keyboard configuration interface is not connected. A display connection alone is not enough to set up shortcuts. Reconnect the keyboard in the app.');
    if (devices.length > 1) throw studioError('STUDIO_MULTIPLE_KEYBOARDS', 'More than one Centerpiece keyboard configuration interface is connected. Connect only the keyboard you want to set up, then retry.');
    this.serial = devices[0].serialNumber;
    try { this.handle = new HID.HID(devices[0].path); }
    catch (error) { throw nativeError(error, null, 'open_configuration'); }
    this.pending = null; this.frame = []; this.inFrame = false; this.escape = false; this.closed = false; this.transportError = null;
    this.handle.on('data', raw => {
      if (this.closed || raw[0] !== 4 || raw[2] !== 16 || raw[1] < 2) return;
      for (const byte of raw.subarray(3, 3 + raw[1] - 2)) {
        if (this.escape) { this.frame.push(byte); this.escape = false; }
        else if (byte === 0xab) { this.frame = []; this.inFrame = true; }
        else if (byte === 0xac && this.inFrame) this.escape = true;
        else if (byte === 0xad && this.inFrame) {
          this.inFrame = false;
          let response;
          try { response = Response.toObject(Response.decode(Buffer.from(this.frame)), {defaults:false}); }
          catch { this.finish(studioError('STUDIO_DECODE_FAILED', 'the companion could not decode the keyboard reply. This operation was not confirmed. Run Check setup.', this.pending?.body)); continue; }
          if (this.pending && response.requestResponse?.requestId === this.pending.id) {
            try { this.finish(null, validateResponse(this.pending.body, response.requestResponse)); }
            catch (error) { this.finish(error); }
          }
        } else if (this.inFrame) this.frame.push(byte);
        if (this.frame.length > 100000) { this.inFrame = false; this.frame = []; this.escape = false; this.finish(studioError('STUDIO_RESPONSE_TOO_LARGE', 'the keyboard reply exceeded the supported size. This operation was not confirmed. Run Check setup.', this.pending?.body)); }
      }
    });
    this.handle.on('error', error => {
      if (this.closed) return;
      this.transportError = nativeError(error, this.pending?.body);
      this.finish(this.transportError);
    });
  }
  finish(error, result) { const p=this.pending;if(!p)return;this.pending=null;clearTimeout(p.timer);error?p.reject(error):p.resolve(result); }
  request(body) {
    if (this.closed) return Promise.reject(studioError('STUDIO_CLOSED', 'the configuration connection is closed. Reconnect it in the app before retrying.', body));
    if (this.transportError) return Promise.reject(studioError(this.transportError.code, 'the configuration connection is unavailable after a USB error. Reconnect it in the app before retrying.', body, {transportStage: this.transportError.transportStage}));
    if (this.pending) return Promise.reject(studioError('STUDIO_BUSY', 'another configuration request is still running. Wait for it to finish, then retry.', body));
    if (!requestInfo(body)) return Promise.reject(studioError('STUDIO_REQUEST_INVALID', 'the companion generated an invalid configuration request. Run Check setup and report this error.', body));
    const id = nextRequestId(), payload = {...body, requestId:id};
    let bytes;
    try {
      if (Request.verify(payload)) return Promise.reject(studioError('STUDIO_REQUEST_INVALID', 'the companion generated invalid configuration parameters. Run Check setup and report this error.', body));
      bytes = Request.encode(Request.create(payload)).finish();
    } catch { return Promise.reject(studioError('STUDIO_ENCODE_FAILED', 'the companion could not encode the configuration request. Nothing was sent for this request. Run Check setup.', body)); }
    const framed=[0xab];for(const b of bytes){if([0xab,0xac,0xad].includes(b))framed.push(0xac);framed.push(b);}framed.push(0xad);
    return new Promise((resolve,reject)=>{
      this.pending={id,body,resolve,reject,timer:setTimeout(()=>this.finish(studioError('STUDIO_TIMEOUT', 'the keyboard did not respond within 4 seconds. This operation was not confirmed. Close other keyboard configuration connections and run Check setup.', body)),4000)};
      try {for(let i=0;i<framed.length;i+=60){const chunk=framed.slice(i,i+60),packet=Buffer.alloc(64);packet[0]=3;packet[1]=chunk.length+3;packet[2]=16;Buffer.from(chunk).copy(packet,3);this.handle.write([...packet]);}}
      catch(error){this.finish(nativeError(error,body,'write_request'));}
    });
  }
  close(){
    if(this.closed)return;
    this.closed=true;
    this.finish(studioError('STUDIO_CLOSED','the configuration connection closed before its result was confirmed.',this.pending?.body));
    // Closing a logical client must not mask the earlier operation failure.
    try{this.handle.close();}catch(error){this.transportError=nativeError(error,null,'close_configuration');}
  }
}
module.exports={Studio};
