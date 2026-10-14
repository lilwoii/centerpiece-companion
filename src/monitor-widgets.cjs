const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const titles={performance:'GAME PERFORMANCE',downloads:'DOWNLOAD PROGRESS',market:'MARKET WATCHLIST'};
function render(type,r,width,height,now=Date.now()){
 if(!titles[type])return null;const text=(s,x,y,size=11,color='#edf2fa')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" fill="${color}">${esc(s)}</text>`;
 let out=text(type==='performance'&&r?.game?r.game.slice(0,26):titles[type],8,16,10,'#a8b5c9');const maxAge=type==='performance'?4000:130000;
 if(!r||r.error||!r.updatedAt||(type!=='market'&&now-r.updatedAt>maxAge)){const msg=r?.error||'Waiting for source';return out+text('Unavailable',8,44,20,'#ffb45e')+text(msg.slice(0,29),8,66,9,'#a8b5c9')+text(msg.slice(29,58),8,80,9,'#a8b5c9');}
 if(type==='performance'){out+=text(Math.round(r.fps)+' FPS',8,42,24)+text(r.frameMs.toFixed(1)+' ms',width-66,40,11);const a=r.graph||[],max=Math.max(33.3,...a),points=a.map((v,i)=>`${8+i*(width-16)/Math.max(1,a.length-1)},${height-8-Math.min(1,v/max)*28}`).join(' ');out+=`<polyline points="${points}" fill="none" stroke="#83dbba" stroke-width="1.5"/>`;}
 if(type==='downloads'){const items=r.items||[],item=items[Math.floor(now/5000)%Math.max(1,items.length)];if(!item)return out+text('No tracked downloads',8,48,14);out+=text(item.name.slice(0,25),8,35,12);{const valid=Number.isFinite(item.total)&&item.total>0&&Number.isFinite(item.done)&&item.done>=0&&item.done<=item.total;if(!valid)return out+text('Size unavailable',8,61,16);out+=text(Math.floor(item.done/item.total*100)+'%',8,60,24)+text(((item.total-item.done)/1073741824).toFixed(2)+' GiB left',70,60,11)+text((item.source+(item.observedAt?' · '+Math.max(0,Math.floor((now-item.observedAt)/60000))+'m old':'')).slice(0,42),8,height-6,8,'#a8b5c9');}}
 if(type==='market'){
  const items=(r.items||[r]).slice(0,4),cols=items.length===1?1:2,rows=Math.ceil(items.length/cols),cw=width/cols,ch=height/rows;out='';
  for(const [index,q] of items.entries()){const x=(index%cols)*cw,y=Math.floor(index/cols)*ch,icon=require('./market-logo.cjs').logo(q.symbol),name=q.label||require('./market-symbols.cjs').label(q.symbol||'');
   out+=`<rect x="${x+1}" y="${y+1}" width="${cw-2}" height="${ch-2}" rx="4" fill="#202c3b"/>`;
   if(icon)out+=`<image x="${x+5}" y="${y+4}" width="12" height="12" href="${icon}"/>`;else out+=text(name.slice(0,2),x+4,y+13,8,'#9bb9ff');
   out+=text(name.slice(0,10),x+21,y+13,9,'#cbd8ea');
   if(!Number.isFinite(q.price)){out+=text(q.loading?'Loading…':'Unavailable',x+5,y+28,10,'#ffb45e');continue;}
   const price=new Intl.NumberFormat('en-US',{maximumFractionDigits:q.price<1?4:2}).format(q.price),age=Math.max(0,Math.floor((now-q.observedAt)/60000));
   out+=text(price,x+5,y+28,price.length>10?10:13)+text((q.change>=0?'+':'')+q.change.toFixed(2)+'%',x+5,y+40,10,q.change>=0?'#83dbba':'#ff8b9b');
   out+=text((q.warning?'! ':'' )+(age<1?'<1m':age<60?age+'m':Math.floor(age/60)+'h'),x+cw-24,y+40,7,'#a8b5c9');
  }
 }
 return out;
}
module.exports={render};