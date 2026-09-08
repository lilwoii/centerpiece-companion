const fs=require('node:fs'),path=require('node:path');
function readUpdateRoot(bytes,exe){const text=bytes?.subarray(0,2).equals(Buffer.from([255,254]))?bytes.toString('utf16le'):bytes?.toString('utf8')||'';const selected=text.match(/^UpdateRoot=(.+)$/mi)?.[1]?.trim();const root=selected||path.win32.dirname(exe)+'-updates';if(!/^[a-z]:\\/i.test(root)||/[\x00-\x1f]/.test(root))throw Error('Choose a local update folder by running the installer again.');return path.win32.join(path.win32.normalize(root),'.centerpiece-companion-updates');}
function updateStorage(app){const exe=app.getPath('exe');let bytes;try{bytes=fs.readFileSync(path.join(path.dirname(exe),'install-locations.ini'));}catch{}return readUpdateRoot(bytes,exe);}
function prepareUpdateTemp(base){const temp=path.join(base,'temporary');fs.mkdirSync(temp,{recursive:true});return temp;}
module.exports={readUpdateRoot,updateStorage,prepareUpdateTemp};
