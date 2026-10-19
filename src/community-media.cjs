'use strict';
const IMAGE_LIMIT=8*1024*1024,VIDEO_LIMIT=25*1024*1024,RETENTION_SECONDS=10*86400,STORAGE_LIMIT=5000000000;
function inspect(bytes,name='attachment'){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),ascii=(start,end)=>String.fromCharCode(...b.slice(start,end));let mime='',kind='image',ext='';
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)){mime='image/png';ext='png';}
 else if(b[0]===255&&b[1]===216&&b[2]===255){mime='image/jpeg';ext='jpg';}
 else if(['GIF87a','GIF89a'].includes(ascii(0,6))){mime='image/gif';ext='gif';}
 else if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'){mime='image/webp';ext='webp';}
 else if(ascii(4,8)==='ftyp'&&/^(?:isom|iso[2-9]|mp4[12]|M4V |avc1|dash|qt  )$/.test(ascii(8,12))){kind='video';ext=ascii(8,12)==='qt  '?'mov':'mp4';mime=ext==='mov'?'video/quicktime':'video/mp4';}
 else if([26,69,223,163].every((v,i)=>b[i]===v)&&ascii(0,Math.min(256,b.length)).includes('webm')){kind='video';ext='webm';mime='video/webm';}
 else throw Error('Choose a PNG, JPEG, GIF, WebP, MP4, WebM or MOV file.');
 if(b.length<12||b.length>(kind==='image'?IMAGE_LIMIT:VIDEO_LIMIT))throw Error(kind==='image'?'Images must be 8 MB or smaller.':'Videos must be 25 MB or smaller.');
 const base=String(name).split(/[\\/]/).pop().replace(/[^\p{L}\p{N} ._()-]/gu,'_').slice(0,100).replace(/\.[^.]*$/,'')||'attachment';return{kind,mime,name:base+'.'+ext,size:b.length};
}
function publicMedia(row){return{id:row.id,kind:row.kind,mime:row.mime,name:row.name,size:row.bytes,expires:row.expires,expired:row.expires<=Math.floor(Date.now()/1000)};}
module.exports={inspect,publicMedia,IMAGE_LIMIT,VIDEO_LIMIT,RETENTION_SECONDS,STORAGE_LIMIT};
