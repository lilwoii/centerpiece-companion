import {reserveR2,releaseStorage} from './r2-budget.mjs';
import media from '../src/community-media.cjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const idOK=id=>/^[a-f0-9]{64}$/.test(id||'');
export async function mediaRows(env,rows){if(!rows.length)return rows;const result=await env.DB.prepare('SELECT * FROM request_media WHERE submission_id IN ('+rows.map(()=>'?').join(',')+') ORDER BY created,id').bind(...rows.map(row=>row.id)).all();return rows.map(row=>({...row,media:(result.results||[]).filter(m=>m.submission_id===row.id).map(media.publicMedia)}));}
export async function validMedia(env,ids,user){if(ids===undefined)return[];if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!idOK(id)))fail('Choose up to three attached files.');const rows=[];for(const id of ids){const row=await env.DB.prepare('SELECT id FROM request_media WHERE id=? AND user_id=? AND ready=1 AND submission_id IS NULL AND expires>?').bind(id,user.user_id,Math.floor(Date.now()/1000)).first();if(!row)fail('An attachment expired or is no longer available. Remove it and add it again.');rows.push(id);}return rows;}
let activeUploads=0;
export async function uploadMedia(request,env,user,limit,random){if(activeUploads>=1)fail('Uploads are busy. Please retry in a moment.',429);activeUploads++;try{return await receiveMedia(request,env,user,limit,random);}finally{activeUploads--;}}
async function receiveMedia(request,env,user,limit,random){
 if(!env.MEDIA)fail('Media uploads are not enabled yet.',503);await limit(env,'media:'+user.user_id,20,86400);const reader=request.body?.getReader();if(!reader)fail('Choose a file first.');let size=0;const chunks=[];try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>media.VIDEO_LIMIT){await reader.cancel();fail('Files must be 25 MB or smaller.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}chunks.length=0;let info;try{info=media.inspect(bytes,decodeURIComponent(request.headers.get('X-Media-Name')||'attachment'));}catch(error){fail(error.message);}
 const id=random(),created=Math.floor(Date.now()/1000),expires=created+media.RETENTION_SECONDS;
 await reserveR2(env,{a:1,bytes:size,id});
 try{await env.DB.prepare('INSERT INTO request_media(id,user_id,name,kind,mime,bytes,created,expires) VALUES(?,?,?,?,?,?,?,?)').bind(id,user.user_id,info.name,info.kind,info.mime,size,created,expires).run();await env.MEDIA.put('requests/'+id,bytes,{storageClass:'Standard',httpMetadata:{contentType:info.mime},customMetadata:{expires:String(expires)}});await env.DB.prepare('UPDATE request_media SET ready=1 WHERE id=?').bind(id).run();}
 catch(error){/* A timed-out PUT may finish after a compensating DELETE. Keep the
 reservation quarantined; delayed cleanup handles incomplete writes after the
 retention window. Never refund an operation that might have reached R2. */throw error;}
 return json(media.publicMedia({id,...info,bytes:size,expires}),201);
}
export async function serveMedia(request,env,id){
 if(!idOK(id))fail('Media not found.',404);const row=await env.DB.prepare("SELECT m.* FROM request_media m JOIN submissions s ON s.id=m.submission_id WHERE m.id=? AND m.ready=1 AND s.status!='hidden'").bind(id).first();if(!row)fail('Media not found.',404);if(row.expires<=Math.floor(Date.now()/1000))fail('This attachment expired after 10 days.',410);if(!env.MEDIA)fail('Media unavailable.',503);
 await reserveR2(env,{b:1});
 const object=await env.MEDIA.get('requests/'+id,{range:request.headers});if(!object)fail('Attachment no longer available.',410);const headers=new Headers({'Content-Type':row.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Accept-Ranges':'bytes','Referrer-Policy':'no-referrer','Content-Disposition':`inline; filename="attachment.${row.mime.split('/')[1].replace('quicktime','mov').replace('jpeg','jpg')}"`});let status=200;
 if(object.range&&Number.isInteger(object.range.offset)&&Number.isInteger(object.range.length)){status=206;headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);headers.set('Content-Length',String(object.range.length));}else headers.set('Content-Length',String(object.size));return new Response(object.body,{status,headers});
}
export async function deleteMedia(env,id,user){if(!idOK(id))fail('Attachment not found.',404);const row=await env.DB.prepare('SELECT user_id FROM request_media WHERE id=?').bind(id).first();if(!row)fail('Attachment not found.',404);if(!user.isAdmin&&row.user_id!==user.user_id)fail('Only the author or owner can delete this attachment.',403);if(!env.MEDIA)fail('Media unavailable.',503);await env.MEDIA.delete('requests/'+id);await releaseStorage(env,id);await env.DB.prepare('UPDATE request_media SET expires=0 WHERE id=?').bind(id).run();return json({ok:true});}
export async function cleanupMedia(env){if(!env.MEDIA)return;const time=Math.floor(Date.now()/1000);const rows=await env.DB.prepare(`SELECT id FROM (
 SELECT m.id FROM request_media m WHERE
 (m.ready=1 AND m.expires>0 AND (m.expires<=? OR (m.submission_id IS NULL AND m.created<?)))
 OR (?=1 AND m.ready=0 AND m.expires>0 AND m.created<?)
 UNION SELECT r.id FROM r2_storage_reservations r LEFT JOIN request_media m ON m.id=r.id WHERE ?=1 AND m.id IS NULL AND r.created<?
 ) LIMIT 100`).bind(time,time-86400,env.MEDIA_QUARANTINE_CLEANUP==='approved'?1:0,time-11*86400,env.MEDIA_QUARANTINE_CLEANUP==='approved'?1:0,time-11*86400).all();for(const row of rows.results||[]){await env.MEDIA.delete('requests/'+row.id);await releaseStorage(env,row.id);await env.DB.prepare('UPDATE request_media SET ready=0,expires=0 WHERE id=?').bind(row.id).run();}}
