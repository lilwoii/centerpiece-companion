'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Only exact, independently verified catalog files qualify as restoration copies.
const catalog=Object.freeze([{fileID:'ce023cc2-56b5-485a-b5dc-cf106f8d96c7',fileName:'Flames',fileExtension:'mp4',fileSize:12357971,sha256:'3602ff35a1359f8cab92ba2e70cafb48bf47ae1da37177e45b029b899c0cb948',sourceUrl:'https://assets.freethinkerportal.com/video/flames/flames_encode.mp4'}]);
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function createRestorationProvider(directory,{fetchImpl=globalThis.fetch}={}){
 return async function restoreCopies(slots){
  const result=[];
  for(const slot of slots){
   const entry=catalog.find(item=>['fileID','fileName','fileExtension','fileSize'].every(key=>item[key]===slot[key]));if(!entry)continue;
   const folder=path.join(directory,'catalog-restoration'),file=path.join(folder,entry.sha256+'.mp4');
   try{
    let bytes;try{const stat=fs.lstatSync(file);if(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===entry.fileSize)bytes=fs.readFileSync(file);}catch{}
    if(!bytes||digest(bytes)!==entry.sha256){
     const response=await fetchImpl(entry.sourceUrl,{redirect:'error',signal:AbortSignal.timeout(60000)});
     if(!response.ok||!response.body)throw Error('Download unavailable');
     const chunks=[];let size=0;
     for await(const chunk of response.body){size+=chunk.length;if(size>entry.fileSize)throw Error('Restoration file too large');chunks.push(Buffer.from(chunk));}
     bytes=Buffer.concat(chunks);if(bytes.length!==entry.fileSize||digest(bytes)!==entry.sha256)throw Error('Restoration checksum mismatch');
     fs.mkdirSync(folder,{recursive:true});
     const temporary=path.join(folder,crypto.randomUUID()+'.tmp');
     try{fs.writeFileSync(temporary,bytes,{flag:'wx'});fs.renameSync(temporary,file);}finally{try{fs.unlinkSync(temporary);}catch{}}
    }
    result.push({slot:slot.slot,file,sha256:entry.sha256,sourceUrl:entry.sourceUrl,metadata:{...slot}});
   }catch{}
  }
  return result;
 };
}
module.exports={createRestorationProvider,catalog};
