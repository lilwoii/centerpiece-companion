const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const sharp=require('sharp'),{createHash}=require('node:crypto');
const artworkCache=new Map();
async function sanitizeMedia(result){
 if(!result?.art)return result;
 const raw=result.art;result.art='';
 if(typeof raw!=='string'||raw.length>1400000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(raw))return result;
 const key=createHash('sha256').update(raw).digest('hex');
 if(!artworkCache.has(key)){
  let value='';try{value='data:image/png;base64,'+(await sharp(Buffer.from(raw.slice(raw.indexOf(',')+1),'base64'),{limitInputPixels:16000000}).resize(96,96,{fit:'cover'}).png().toBuffer()).toString('base64');}catch{}
  artworkCache.set(key,value);if(artworkCache.size>8)artworkCache.delete(artworkCache.keys().next().value);
 }
 result.art=artworkCache.get(key);return result;
}


class MediaBridge {
  constructor(provider = 'spotify') { if(!['spotify','youtubemusic','youtube'].includes(provider))throw Error('Unknown music provider');this.provider=provider;this.source='';this.target='auto';this.label=provider==='spotify'?'Spotify':provider==='youtube'?'YouTube':'YouTube Music';this.pending = new Map(); this.sequence = 0; this.process = null; }
  start() {
    if (this.process) return;
    const proc = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'media.ps1')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.process = proc;
    const lines = readline.createInterface({ input: proc.stdout });
    lines.on('line', line => {
      let data;
      try { data = JSON.parse(line); } catch { return; }
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      data.ok ? sanitizeMedia(data.result).then(pending.resolve,pending.reject) : pending.reject(new Error(data.error));
    });
    proc.stderr.resume();
    const ended = () => {
      if (this.process !== proc) return;
      this.process = null;
      this.failAll('The Windows media connection stopped. Try again.');
    };
    proc.on('exit', ended);
    proc.on('error', ended);
    proc.stdin.on('error', ended);
  }
  failAll(message) {
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error(message)); }
    this.pending.clear();
  }
  request(action) {
    if (!['status', 'toggle', 'play', 'pause', 'next', 'previous', 'rewind'].includes(action)) return Promise.reject(new Error('Unknown media action'));
    if (!['auto','desktop','web'].includes(this.target)) return Promise.reject(new Error('Unknown YouTube Music player target'));
    if (this.pending.size > 3) return Promise.reject(new Error(`${this.label} is busy. Please try again.`));
    this.start();
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.failAll(`${this.label} took too long to respond. Check the music app and retry; the action was not retried.`);
        const proc = this.process; this.process = null; proc?.kill();
      }, 9000);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(JSON.stringify({ id, action, provider:this.provider, source:this.source, target:this.target }) + '\n');
    });
  }
  close() { const proc = this.process; this.process = null; this.failAll('App closed'); proc?.kill(); }
}
module.exports = { MediaBridge };
