const fs=require('node:fs');
const MAX_BYTES=32*1024*1024;
function encode(config,validate,version){return JSON.stringify({format:'centerpiece-companion-settings',version:1,appVersion:version,createdAt:new Date().toISOString(),config:validate(config)},null,2);}
function decode(raw,validate){if(Buffer.byteLength(raw)>MAX_BYTES)throw Error('Configuration backup is too large.');let data;try{data=JSON.parse(raw);}catch{throw Error('This file is not a valid configuration backup.');}if(data?.format!=='centerpiece-companion-settings'||data.version!==1)throw Error('Unsupported configuration backup. Choose a Companion settings export.');return validate(data.config);}
function read(file,validate){if(fs.statSync(file).size>MAX_BYTES)throw Error('Configuration backup is too large.');return decode(fs.readFileSync(file,'utf8'),validate);}
module.exports={encode,decode,read};
