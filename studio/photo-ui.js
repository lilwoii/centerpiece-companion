(()=>{
 'use strict';
 window.StudioPhotoUI={mount({request,addSubject,notify}){
  const $=id=>document.getElementById(id),dialog=$('photo-dialog');let timer=null,result=null,bitmap=null,generation=0,opener=null,frame=null,start=0;
  const status=text=>$('photo-status').textContent=text;
  function stop(){clearTimeout(timer);timer=null;cancelAnimationFrame(frame);frame=null;}
  function paint(now){
   if(!dialog.open||!bitmap)return;const canvas=$('photo-preview'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
   const t=(now-start)/1000,s=Number($('photo-speed').value),d=Number($('photo-distance').value)*.4,m=$('photo-motion').value;
   const scale=Math.min(380/bitmap.width,180/bitmap.height,1),w=bitmap.width*scale,h=bitmap.height*scale;
   const x=canvas.width/2-w/2+(m==='none'?0:Math.sin(t*s)*d),y=canvas.height/2-h/2+(m==='orbit'?Math.cos(t*s)*d*.35:m==='swim'?Math.sin(t*s*2)*8:0);
   ctx.drawImage(bitmap,x,y,w,h);frame=requestAnimationFrame(paint);
  }
  async function poll(token){try{const job=await request('photo-status',null);if(token!==generation||!dialog.open)return;status(job.phase||'Ready');if(job.state==='ready'){
    const next=job.result;const decoded=await createImageBitmap(new Blob([Uint8Array.from(atob(next.image.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'}));if(token!==generation||!dialog.open){decoded.close();return;}result=next;bitmap?.close();bitmap=decoded;
    $('photo-add').disabled=false;$('photo-process').disabled=false;start=performance.now();frame=requestAnimationFrame(paint);
   }else if(job.state==='working')timer=setTimeout(()=>void poll(token),500);else{$('photo-process').disabled=false;}
   }catch(error){status(error.message);$('photo-process').disabled=false;}}
  for(const id of ['photo-close','photo-process'])$(id).disabled=false;
  $('animate-photo').disabled=false;$('animate-photo').addEventListener('click',()=>{opener=document.activeElement;dialog.showModal();$('photo-title').focus();if(bitmap){start=performance.now();frame=requestAnimationFrame(paint);}});
  $('photo-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{generation++;stop();void request('photo-cancel',null).catch(()=>{});$('photo-process').disabled=false;opener?.focus();});
  $('photo-process').addEventListener('click',async()=>{const file=$('photo-file').files[0];if(!file){status('Choose a PNG, JPEG or WebP photo first.');return;}
   if(file.size>8*1024*1024){status('Choose an image up to 8 MB.');return;}
   stop();result=null;$('photo-add').disabled=true;$('photo-process').disabled=true;const token=++generation;
   try{const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The photo could not be read.'));reader.readAsDataURL(file);});if(token!==generation||!dialog.open)return;window.StudioModel.rasterInfo(image);await request('photo-start',{image});if(token===generation)await poll(token);}catch(error){if(token===generation){status(error.message);$('photo-process').disabled=false;}}
  });
  $('photo-add').addEventListener('click',async()=>{if(!result)return;try{const accepted=await addSubject(result,{name:($('photo-file').files[0]?.name||'Photo subject').replace(/\.[^.]+$/,''),motion:$('photo-motion').value,speed:Number($('photo-speed').value),distance:Number($('photo-distance').value),effect:$('photo-effect').value});if(accepted)dialog.close();}catch(error){notify(error.message,true);status(error.message);}});
 }};
})();
