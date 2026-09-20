const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const note=content=>json({type:4,data:{content,flags:64,allowed_mentions:{parse:[]}}});
export function approvalButtons(id){if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid submission');return[{type:1,components:[{type:2,style:3,label:'Approve skin',custom_id:'skin:approved:'+id},{type:2,style:4,label:'Decline',custom_id:'skin:declined:'+id}]}];}
export async function discordInteraction(request,env){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const signature=request.headers.get('X-Signature-Ed25519')||'',timestamp=request.headers.get('X-Signature-Timestamp')||'';
 if(!/^[a-f0-9]{64}$/i.test(env.DISCORD_PUBLIC_KEY||''))return json({error:'Discord interactions are not configured'},503);
 if(!/^[a-f0-9]{128}$/i.test(signature)||!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)return json({error:'Invalid signature'},401);
 const reader=request.body?.getReader();if(!reader)return json({error:'Missing body'},400);let size=0,parts=[];try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return json({error:'Body too large'},413);}parts.push(value);}}finally{reader.releaseLock();}
 const raw=new Uint8Array(size);let offset=0;for(const p of parts){raw.set(p,offset);offset+=p.length;}const ts=new TextEncoder().encode(timestamp),signed=new Uint8Array(ts.length+size);signed.set(ts);signed.set(raw,ts.length);
 const bytes=hex=>Uint8Array.from(hex.match(/../g),x=>parseInt(x,16));
 const key=await crypto.subtle.importKey('raw',bytes(env.DISCORD_PUBLIC_KEY),{name:'Ed25519'},false,['verify']);if(!await crypto.subtle.verify('Ed25519',key,bytes(signature),signed))return json({error:'Invalid signature'},401);
 let event;try{event=JSON.parse(new TextDecoder().decode(raw));}catch{return json({error:'Invalid JSON'},400);}
 if(event.application_id!==env.DISCORD_CLIENT_ID)return json({error:'Wrong application'},403);
 if(event.type===1)return json({type:1});
 if(event.type!==3||event.data?.component_type!==2)return note('Unsupported interaction.');
 const actor=event.member?.user?.id||event.user?.id;if(actor!==env.DISCORD_OWNER_ID)return note('Only the community owner can approve or decline skins.');
 const match=/^skin:(approved|declined):([a-f0-9]{64})$/.exec(event.data?.custom_id||'');if(!match)return note('This approval button is invalid.');
 const[,status,id]=match;
 const row=await env.DB.prepare("UPDATE submissions SET status=? WHERE id=? AND kind='skin' AND status='pending' RETURNING id,title").bind(status,id).first();
 if(!row)return note('This skin was already reviewed or is no longer available. Refresh the community list to see its current status.');
 return json({type:7,data:{content:status==='approved'?'Skin approved and published to the community.':'Skin declined.',components:[],allowed_mentions:{parse:[]}}});
}
