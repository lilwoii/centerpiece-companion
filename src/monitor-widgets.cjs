const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const titles={performance:'GAME PERFORMANCE',downloads:'DOWNLOAD PROGRESS',market:'MARKET WATCHLIST'};
function render(type,r,width,height,now=Date.now()){
 if(!titles[type])return null;const text=(s,x,y,size=11,color='#edf2fa')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" fill="${color}">${esc(s)}</text>`;
 let out=text(type==='performance'&&r?.game?r.game.slice(0,26):titles[type],8,16,10,'#a8b5c9');const maxAge=type==='performance'?4000:130000;
 if(!r||r.error||!r.updatedAt||(type!=='market'&&now-r.updatedAt>maxAge)){const msg=r?.error||({performance:'Waiting for game launch',downloads:'Waiting for active download',market:'Waiting for market source'})[type];return out+require('./waiting.cjs').render(msg,width,height,now);}
 if(type==='performance'){out+=text(Math.round(r.fps)+' FPS',8,42,24)+text(r.frameMs.toFixed(1)+' ms',width-66,40,11);const a=r.graph||[],max=Math.max(33.3,...a),points=a.map((v,i)=>`${8+i*(width-16)/Math.max(1,a.length-1)},${height-8-Math.min(1,v/max)*28}`).join(' ');out+=`<polyline points="${points}" fill="none" stroke="#83dbba" stroke-width="1.5"/>`;}
 if(type==='downloads'){const items=r.items||[],item=items[Math.floor(now/5000)%Math.max(1,items.length)];if(!item)return out+require('./waiting.cjs').render('Waiting for active download',width,height,now);out+=text(item.name.slice(0,25),8,35,12);{const valid=Number.isFinite(item.total)&&item.total>0&&Number.isFinite(item.done)&&item.done>=0&&item.done<=item.total;if(!valid)return out+text('Size unavailable',8,61,16);out+=text(Math.floor(item.done/item.total*100)+'%',8,60,24)+text(((item.total-item.done)/1073741824).toFixed(2)+' GiB left',70,60,11)+text((item.source+(item.observedAt?' · '+Math.max(0,Math.floor((now-item.observedAt)/60000))+'m old':'')).slice(0,42),8,height-6,8,'#a8b5c9');}}
 if(type==='market'){
  const items=(r.items||[r]).slice(0,4),cols=items.length===1?1:2,rows=Math.ceil(items.length/cols),cw=width/cols,ch=height/rows;out='';
  for(const [index,q] of items.entries()){const x=(index%cols)*cw,y=Math.floor(index/cols)*ch,icon=require('./market-logo.cjs').logo(q.symbol),name=q.label||require('./market-symbols.cjs').label(q.symbol||'');
   out+=`<rect x="${x+1}" y="${y+1}" width="${cw-2}" height="${ch-2}" rx="4" fill="#202c3b"/>`;
   if(icon)out+=`<image x="${x+5}" y="${y+4}" width="12" height="12" href="${icon}"/>`;else out+=text(name.slice(0,2),x+4,y+13,8,'#9bb9ff');
   out+=text(name.slice(0,10),x+21,y+13,9,'#cbd8ea');
   if(!Number.isFinite(q.price)){out+=text(require('./waiting.cjs').label(now),x+5,y+28,10,'#ffb45e')+text('Waiting for quote',x+5,y+40,7,'#a8b5c9');continue;}
   const price=new Intl.NumberFormat('en-US',{maximumFractionDigits:q.price<1?4:2}).format(q.price),age=Math.max(0,Math.floor((now-q.observedAt)/60000));
   out+=text(price,x+5,y+28,price.length>10?10:13)+text((q.change>=0?'+':'')+q.change.toFixed(2)+'%',x+5,y+40,10,q.change>=0?'#83dbba':'#ff8b9b');
   out+=text((q.warning?'! ':'' )+(age<1?'<1m':age<60?age+'m':Math.floor(age/60)+'h'),x+cw-24,y+40,7,'#a8b5c9');
  }
 }
 return out;
}
function compactMarket(r,width,height,now=Date.now()){
 if(!r||r.error||!r.updatedAt)return height<50?`<text x="6" y="10" font-family="Arial" font-size="7" fill="#a8b5c9">MARKET</text><text x="6" y="24" font-family="Arial" font-size="13" fill="#ffb45e">${require('./waiting.cjs').label(now)}</text><text x="6" y="${height-3}" font-family="Arial" font-size="6.5" fill="#a8b5c9">Waiting for quotes</text>`:require('./waiting.cjs').render('Waiting for quotes',width,height,now);
 const items=(r.items||[r]).slice(0,4),cols=height>=items.length*27?1:2,rows=Math.ceil(items.length/cols),cw=width/cols,ch=height/rows;
 const text=(s,x,y,size,color='#edf2fa')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" fill="${color}">${esc(s)}</text>`;
 const fit=(s,size,space)=>Math.min(size,space/Math.max(1,String(s).length*.6));
 return '<g data-market-layout="adaptive">'+items.map((q,i)=>{
  const x=i%cols*cw,y=Math.floor(i/cols)*ch,tight=ch<27,iconSize=tight?6:Math.min(12,ch*.29),name=q.label||require('./market-symbols.cjs').label(q.symbol||''),icon=require('./market-logo.cjs').logo(q.symbol);
  const headerY=y+iconSize+2,priceY=y+ch*.66,footerY=y+ch-2,price=Number.isFinite(q.price)?new Intl.NumberFormat('en-US',{maximumFractionDigits:q.price<1?4:2}).format(q.price):require('./waiting.cjs').label(now);
  let out=`<rect x="${x+1}" y="${y+1}" width="${cw-2}" height="${ch-2}" rx="3" fill="#202c3b"/>`;
  if(icon)out+=`<image x="${x+4}" y="${y+2}" width="${iconSize}" height="${iconSize}" href="${icon}"/>`;
  out+=text(name,x+iconSize+7,headerY,fit(name,tight?5.5:9,cw-iconSize-11),'#cbd8ea');
  out+=text(price,x+4,priceY,fit(price,Math.min(18,ch*.39),cw-8),Number.isFinite(q.price)?'#edf2fa':'#ffb45e');
  const change=Number.isFinite(q.change)?(q.change>=0?'+':'')+q.change.toFixed(2)+'%':'—',age=Math.max(0,Math.floor((now-q.observedAt)/60000)),ageLabel=(q.warning?'! ':'')+(age<1?'<1m':age<60?age+'m':Math.floor(age/60)+'h');
  out+=text(change,x+4,footerY,fit(change,tight?5:Math.min(10,ch*.25),cw-27),q.change>=0?'#83dbba':'#ff8b9b');
  if(Number.isFinite(q.price))out+=text(ageLabel,x+cw-20,footerY,tight?4:6,'#a8b5c9');
  return out;
 }).join('')+'</g>';

}
module.exports={render,compactMarket};