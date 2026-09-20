(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioImageConverter=api;})(globalThis,function(){
 'use strict';
 const W=1920,H=550;
 function geometry(width,height,mode='fill',x=.5,y=.5,upscale=false){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>32000000)throw Error('Choose an image with no more than 32 million pixels.');
  if(!['fill','fit'].includes(mode))throw Error('Choose Fill or Fit.');
  const desired=mode==='fill'?Math.max(W/width,H/height):Math.min(W/width,H/height),scale=upscale?desired:Math.min(1,desired);
  const dw=width*scale,dh=height*scale;
  return{width:W,height:H,dx:(W-dw)*Math.max(0,Math.min(1,x)),dy:(H-dh)*Math.max(0,Math.min(1,y)),dw,dh,scale,needsUpscale:desired>1};
 }
 function sourceDimensions(bytes){
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),str=(a,b)=>String.fromCharCode(...bytes.slice(a,b));let width=0,height=0;
  if(bytes.length>=24&&str(1,4)==='PNG'&&bytes[0]===137){width=v.getUint32(16);height=v.getUint32(20);}
  else if(bytes.length>=10&&['GIF87a','GIF89a'].includes(str(0,6))){width=v.getUint16(6,true);height=v.getUint16(8,true);}
  else if(bytes.length>=26&&str(0,2)==='BM'){const header=v.getUint32(14,true);if(header===12){width=v.getUint16(18,true);height=v.getUint16(20,true);}else if(header>=40){width=v.getInt32(18,true);height=Math.abs(v.getInt32(22,true));}}
  else if(bytes.length>=30&&str(0,4)==='RIFF'&&str(8,12)==='WEBP'){
   const kind=str(12,16);if(kind==='VP8X'){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
   else if(kind==='VP8 '){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
   else if(kind==='VP8L'){const bits=v.getUint32(21,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
  }else if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216){let pos=2;while(pos+4<bytes.length){if(bytes[pos++]!==255)break;while(bytes[pos]===255)pos++;const marker=bytes[pos++];if(marker===218||marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;if(pos+2>bytes.length)break;const len=v.getUint16(pos);if(len<2||pos+len>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&len>=7){height=v.getUint16(pos+3);width=v.getUint16(pos+5);break;}pos+=len;}}
  if(!width||!height)throw Error('Choose a valid PNG, JPEG, WebP, BMP or GIF image.');geometry(width,height);return{width,height};
 }
 function mount({importRaster,download}){
  const $=id=>document.getElementById(id),dialog=$('image-converter');let bitmap=null,filename='skin-image',generation=0,opener=null;
  const canvas=$('converter-preview'),ctx=canvas.getContext('2d');canvas.width=W;canvas.height=H;
  function state(message,error=false){$('converter-status').textContent=message;$('converter-status').classList.toggle('error-text',error);}
  function render(){if(!bitmap)return;const g=geometry(bitmap.width,bitmap.height,$('converter-fit').value,Number($('converter-x').value)/100,Number($('converter-y').value)/100,$('converter-upscale').checked);ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   // Repeated halving avoids throwing away most source samples in one pass.
   let source=bitmap,sw=bitmap.width,sh=bitmap.height;
   while(sw>g.dw*2&&sh>g.dh*2){const step=document.createElement('canvas');step.width=Math.ceil(sw/2);step.height=Math.ceil(sh/2);const c=step.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,0,0,step.width,step.height);source=step;sw=step.width;sh=step.height;}
   ctx.drawImage(source,g.dx,g.dy,g.dw,g.dh);
   state(`${bitmap.width} × ${bitmap.height} → 1920 × 550 · Lossless PNG${g.needsUpscale?(g.scale>1?' · Enlarged: extra detail cannot be recovered.':' · Original detail preserved; transparent space remains.'):' · No enlargement.'}`);
  }
  async function choose(file){if(!file)return;const token=++generation;state('Preparing image…');$('converter-add').disabled=$('converter-save').disabled=true;bitmap?.close();bitmap=null;ctx.clearRect(0,0,W,H);
   try{if(file.size>32*1024*1024)throw Error('Choose an image up to 32 MB.');sourceDimensions(new Uint8Array(await file.arrayBuffer()));if(token!==generation)return;
    const next=await createImageBitmap(file,{imageOrientation:'from-image'});if(token!==generation){next.close();return;}try{geometry(next.width,next.height);}catch(e){next.close();throw e;}bitmap=next;filename=file.name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)||'skin-image';render();$('converter-add').disabled=$('converter-save').disabled=false;
   }catch(e){if(token===generation)state(e.message,true);}
  }
  async function output(add){const token=generation;$('converter-add').disabled=$('converter-save').disabled=true;try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(token!==generation)return;if(!blob)throw Error('Could not convert this image. Choose another image and retry.');if(add){if(await importRaster(new File([blob],filename+'-1920x550.png',{type:'image/png'}))===false)throw Error('The image could not be added. Check the scene layer and image limits, or save the PNG instead.');dialog.close();}else download(blob,filename+'-1920x550.png');}catch(e){state(e.message,true);}finally{if(token===generation&&bitmap)$('converter-add').disabled=$('converter-save').disabled=false;}}
  $('convert-image').disabled=false;$('convert-image').addEventListener('click',()=>{opener=document.activeElement;dialog.showModal();$('converter-choose').focus();});
  $('converter-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{++generation;bitmap?.close();bitmap=null;ctx.clearRect(0,0,W,H);$('converter-add').disabled=$('converter-save').disabled=true;state('Choose an image. Conversion happens on this PC.');opener?.focus();});
  $('converter-choose').addEventListener('click',()=>$('converter-file').click());$('converter-file').addEventListener('change',()=>{const f=$('converter-file').files[0];$('converter-file').value='';choose(f);});
  for(const id of ['converter-fit','converter-x','converter-y','converter-upscale'])$(id).addEventListener('input',render);
  $('converter-close').disabled=$('converter-choose').disabled=false;
  $('converter-add').addEventListener('click',()=>output(true));$('converter-save').addEventListener('click',()=>output(false));
 }
 return{geometry,sourceDimensions,mount};
});
