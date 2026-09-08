const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const sharp=require('sharp'),{createHash}=require('node:crypto');
let artworkKey='',artworkValue='';
async function sanitizeMedia(result){if(!result?.art)return result;const raw=result.art;result.art='';if(typeof raw!=='string'||raw.length>1400000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(raw))return result;const key=createHash('sha256').update(raw).digest('hex');if(key!==artworkKey){try{artworkValue='data:image/png;base64,'+(await sharp(Buffer.from(raw.slice(raw.indexOf(',')+1),'base64'),{limitInputPixels:16000000}).resize(96,96,{fit:'cover'}).png().toBuffer()).toString('base64');}catch{artworkValue='';}artworkKey=key;}result.art=artworkValue;return result;}


class MediaBridge {
  constructor() { this.pending = new Map(); this.sequence = 0; this.process = null; }
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
    if (!['status', 'toggle', 'play', 'pause', 'next', 'previous'].includes(action)) return Promise.reject(new Error('Unknown media action'));
    if (this.pending.size > 3) return Promise.reject(new Error('Spotify is busy. Please try again.'));
    this.start();
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.failAll('Spotify took too long to respond. Check Spotify and retry; the action was not retried.');
        const proc = this.process; this.process = null; proc?.kill();
      }, 9000);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(JSON.stringify({ id, action }) + '\n');
    });
  }
  close() { const proc = this.process; this.process = null; this.failAll('App closed'); proc?.kill(); }
}
module.exports = { MediaBridge };
