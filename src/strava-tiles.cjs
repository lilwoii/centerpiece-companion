const {summary}=require('./strava.cjs');
// Strava plugin tiles: content drawn inside the strip's 80x78 tile frame. Each
// display action shows one part of the week, so positions 1-4 stack into
// goal ring, Mon-Tue, Wed-Thu, Fri-Sun.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const ACTIONS=[['goal','Weekly goal ring'],['mon-tue','Mon–Tue runs'],['wed-thu','Wed–Thu runs'],['fri-sun','Fri–Sun runs']];
const GROUPS={'mon-tue':[0,1],'wed-thu':[2,3],'fri-sun':[4,5,6]};
const NAMES=['MON','TUE','WED','THU','FRI','SAT','SUN'];
const ORANGE='#fc4c02',GREEN='#34c759',TRACK='#2c3644',MUTED='#a8b5c9',TEXT='#edf2fa';
// Two decimals like Strava (3.15); longer values drop decimals to fit the tile.
const amount=v=>v>=100?String(Math.round(v)):v.toFixed(v>=10?1:2);
const whole=v=>String(v);
const text=(s,x,y,size,color=TEXT,anchor='middle',weight='normal')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial" font-weight="${weight}" font-size="${size}" fill="${color}">${esc(s)}</text>`;
function ring(cx,cy,r,progress,stroke){
 const c=2*Math.PI*r,p=Math.max(0,Math.min(1,progress));
 const arc=p<=0?'':`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p>=1?GREEN:ORANGE}" stroke-width="${stroke}" stroke-linecap="${p>=1?'butt':'round'}" stroke-dasharray="${p>=1?`${c} 0`:`${c*p} ${c}`}" transform="rotate(-90 ${cx} ${cy})"/>`;
 return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="${stroke}"/>`+arc;
}
function dot(day,cx,cy,r){
 if(day.ran)return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${GREEN}"/>`;
 return `<circle cx="${cx}" cy="${cy}" r="${r-1}" fill="none" stroke="${day.today?TEXT:day.future?TRACK:'#4a5668'}" stroke-width="${day.today?2:1.5}"${day.future?' stroke-dasharray="2 2"':''}/>`;
}
// Moving time as Strava shows it: 32:15 or 1:05:12.
const clock=s=>{s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s/60)%60,p=n=>String(n).padStart(2,'0');return h?`${h}:${p(m)}:${p(s%60)}`:`${m}:${p(s%60)}`;};
// Every day row is the same size and spacing, centered in its tile, so two-day
// and three-day tiles line up. A day you ran shows distance over moving time.
const ROW=25;
function day(d,name,y){const size=11;return text(name,6,d.ran&&d.time?y-1:y+size*.35,size,d.today?TEXT:MUTED,'start',d.today?'bold':'normal')+(d.ran?text(amount(d.distance),57,d.time?y-1:y+size*.35,11,GREEN,'end','bold')+(d.time?text(clock(d.time),57,y+9.5,9,MUTED,'end'):''):'')+dot(d,68,y,6);}
// Returns null when Strava has no data yet, so the strip shows its normal icon tile.
function tile(action,data,now=Date.now()){
 if(!data?.connected||!data.updatedAt||!ACTIONS.some(([id])=>id===action))return null;
 const s=summary(data,now);
 if(action==='goal')return ring(40,33,23,s.distance/s.goal,5)+text(amount(s.distance),40,38,14,TEXT,'middle','bold')+text(`/ ${whole(s.goal)} ${s.unit}`,40,70,10,MUTED);
 const days=GROUPS[action];
 return days.map((i,n)=>day(s.days[i],NAMES[i],39+(n-(days.length-1)/2)*ROW)).join('');
}
module.exports={ACTIONS,tile};
