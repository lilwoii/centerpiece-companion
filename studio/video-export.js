(()=>{
 'use strict';
 const MIME='video/mp4;codecs=avc1.42002a',MAX_BYTES=120*1048576;
 function supported(){return typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(MIME);}
 function verify(blob,duration,signal){return new Promise((resolve,reject)=>{const video=document.createElement('video'),url=URL.createObjectURL(blob);let settled=false;const done=error=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve();};const abort=()=>done(signal.reason||new DOMException('Video export cancelled.','AbortError'));const timer=setTimeout(()=>done(Error('The video could not be checked. Your editable project is unchanged.')),10000);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}video.muted=true;video.preload='auto';video.onloadeddata=()=>done(video.videoWidth!==1920||video.videoHeight!==550||!Number.isFinite(video.duration)||Math.abs(video.duration-duration)>Math.max(.2,duration*.03)?Error('Recording lost frames or timing. Keep the editor visible and try again.'):null);video.onerror=()=>done(Error('The generated MP4 could not be decoded. Try PNG export or a reactive build.'));video.src=url;});}
 async function render(project,{renderer,model,duration=12,signal,onProgress=()=>{}}={}){
  if(!supported())throw Error('MP4 recording is unavailable on this PC. You can still export a PNG or build a reactive skin.');
  if(!Number.isFinite(duration)||duration<2||duration>30)throw Error('Choose a video length between 2 and 30 seconds.');
  const snapshot=model.validate(project);await renderer.prepareImages(snapshot);signal?.throwIfAborted();
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=550;const ctx=canvas.getContext('2d',{alpha:false});
  renderer.draw(ctx,snapshot,0,[]);const stream=canvas.captureStream(30),chunks=[];let bytes=0,frame=0,timer=0,settled=false;
  try{return await new Promise((resolve,reject)=>{
   const recorder=new MediaRecorder(stream,{mimeType:MIME,videoBitsPerSecond:10000000});
   const cleanup=()=>{cancelAnimationFrame(frame);clearTimeout(timer);document.removeEventListener('visibilitychange',hidden);signal?.removeEventListener('abort',abort);stream.getTracks().forEach(track=>track.stop());};
   const fail=error=>{if(settled)return;settled=true;cleanup();if(recorder.state!=='inactive')recorder.stop();reject(error);};
   const abort=()=>fail(signal.reason||new DOMException('Video export cancelled.','AbortError'));
   const hidden=()=>{if(document.hidden)fail(Error('Video export stopped because the editor was hidden. Keep the editor visible while recording; your project is unchanged.'));};
   recorder.addEventListener('dataavailable',event=>{if(settled||!event.data.size)return;bytes+=event.data.size;if(bytes>MAX_BYTES)return fail(Error('This video exceeds the keyboard file limit. Choose a shorter loop.'));chunks.push(event.data);});
   recorder.addEventListener('error',event=>fail(event.error||Error('Windows could not finish the video recording.')));
   recorder.addEventListener('stop',async()=>{if(settled)return;settled=true;cleanup();if(!bytes)return reject(Error('No video frames were recorded. Try again.'));try{const blob=new Blob(chunks,{type:'video/mp4'});await verify(blob,duration,signal);signal?.throwIfAborted();resolve(blob);}catch(error){reject(error);}});
   signal?.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',hidden);
   const started=performance.now();let last=-1;
   const paint=()=>{if(settled)return;try{const time=Math.min(duration,(performance.now()-started)/1000),tick=Math.floor(time*30);if(tick!==last){renderer.draw(ctx,snapshot,time,[]);last=tick;onProgress(Math.min(1,time/duration));}if(time>=duration){recorder.stop();return;}frame=requestAnimationFrame(paint);}catch(error){fail(error);}};
   recorder.start(1000);timer=setTimeout(()=>fail(Error('Video recording stalled. Keep the editor visible and retry.')),(duration+10)*1000);frame=requestAnimationFrame(paint);if(signal?.aborted)abort();else hidden();
  });}finally{stream.getTracks().forEach(track=>track.stop());}
 }
 function setup({anchor,project,renderer,model,notify,download}){
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const button=make('button','Export video loop');button.type='button';button.className='button';anchor.after(button);
  const dialog=make('dialog');dialog.id='studio-video-dialog';dialog.setAttribute('aria-labelledby','studio-video-heading');
  const title=make('h2','Video loop · no Unreal needed');title.id='studio-video-heading';
  const note=make('p','Export this scene as a 1920 × 550 MP4 video. Animation is recorded locally at up to 30 FPS. Live key reactions and playable games require a reactive skin build.');
  const label=make('label','Loop length'),duration=make('select');duration.setAttribute('aria-label','Video loop length');for(const seconds of [6,12,18,24,30]){const option=make('option',seconds+' seconds');option.value=seconds;option.selected=seconds===12;duration.append(option);}label.append(duration);
  const progress=make('progress');progress.max=1;progress.value=0;progress.setAttribute('aria-label','Video export progress');progress.hidden=true;
  const status=make('p','Keep this editor visible during recording. Your existing keyboard skin keeps playing.');status.setAttribute('role','status');status.className='panel-note';
  const actions=make('div');actions.className='dialog-actions';const close=make('button','Close'),start=make('button','Create MP4'),cancel=make('button','Cancel recording');for(const b of [close,start,cancel]){b.type='button';b.className='button';}start.classList.add('primary');cancel.hidden=true;actions.append(close,cancel,start);dialog.append(title,note,label,progress,status,actions);document.body.append(dialog);let controller=null;
  button.addEventListener('click',()=>{if(!supported()){notify('MP4 recording is unavailable on this PC. PNG export and reactive builds remain available.',true);return;}dialog.showModal();start.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('cancel',event=>{if(controller){event.preventDefault();controller.abort();}});dialog.addEventListener('close',()=>button.focus());cancel.addEventListener('click',()=>controller?.abort());
  start.addEventListener('click',async()=>{if(controller)return;const current=controller=new AbortController();start.disabled=duration.disabled=close.disabled=true;cancel.hidden=false;progress.hidden=false;progress.value=0;status.textContent='Recording your animation…';try{const snapshot=model.validate(project());if(snapshot.layers.some(l=>['cloud-courier','dune-runner','prism-breaker'].includes(l.text)))throw Error('A video cannot preserve game controls. Use Build for your keyboard for this game.');const blob=await render(snapshot,{renderer,model,duration:Number(duration.value),signal:current.signal,onProgress:value=>{progress.value=value;}});download(blob,(snapshot.name||'Studio skin').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)+'.mp4');status.textContent='MP4 saved. Keep the editable project to change this design later.';}catch(error){status.textContent=error.name==='AbortError'?'Recording cancelled. Your project is unchanged.':error.message;}finally{controller=null;start.disabled=duration.disabled=close.disabled=false;cancel.hidden=true;}});
  return{dialog,button};
 }
 window.StudioVideoExport={render,setup,supported};
})();
