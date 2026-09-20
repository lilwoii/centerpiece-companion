const MAX_BYTES=40*1024*1024;
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let value=0xffffffff;for(const b of bytes)value=table[(value^b)&255]^(value>>>8);return(value^0xffffffff)>>>0;}
function failure(code,message){return Object.assign(new Error(message),{code});}
function safeName(value,names){
 if(typeof value!=='string'||value.length>220||!value.length||!/^[A-Za-z0-9_./-]+$/.test(value)||value.startsWith('/')||value.split('/').some(p=>!p||p==='.'||p==='..'||p.endsWith('.')||/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))||names.has(value.toLowerCase()))throw failure('ZIP_PATH','Export contains an unsafe or duplicate file path.');
 names.add(value.toLowerCase());return Buffer.from(value,'utf8');
}
function zip(files){
 if(!Array.isArray(files)||files.length>512)throw failure('ZIP_FILES','Invalid export file list.');const records=[],directory=[];let offset=0,total=0;const names=new Set();
 for(const f of files){
  if(!f||typeof f!=='object')throw failure('ZIP_FILES','Invalid export file entry.');
  const name=safeName(f.path,names),encoding=f.encoding===undefined?'utf8':f.encoding;
  if(!['utf8','base64'].includes(encoding)||typeof f.content!=='string')throw failure('ZIP_CONTENTS','Invalid export file contents.');
  if(encoding==='base64'&&(f.content.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.content)))throw failure('ZIP_CONTENTS','An export file contains invalid base64 data.');
  const size=encoding==='base64'?f.content.length/4*3-(f.content.endsWith('==')?2:f.content.endsWith('=')?1:0):Buffer.byteLength(f.content,'utf8');
  total+=size;if(total>MAX_BYTES)throw failure('ZIP_TOO_LARGE','Source export exceeds 40 MB. Reduce embedded image sizes before exporting.');
  const data=Buffer.from(f.content,encoding),checksum=crc32(data),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt32LE(checksum,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);records.push(local,name,data);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt32LE(checksum,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);directory.push(central,name);offset+=local.length+name.length+data.length;
 }
 const cd=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...records,cd,end]);
}
module.exports={zip,crc32,MAX_BYTES};
