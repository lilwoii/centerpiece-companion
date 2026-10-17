const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function label(now=Date.now()){return 'Waiting'+'.'.repeat(1+Math.floor(now/650)%3);}
function render(reason,width=194,height=94,now=Date.now()){
 const size=Math.min(22,(width-12)/5.7),max=Math.max(10,Math.floor((width-12)/4.5)),words=String(reason||'Waiting for source').split(' '),lines=[''];
 for(const word of words){let i=lines.length-1;if(lines[i]&&lines[i].length+word.length+1>max){lines.push('');i++;}lines[i]+=(lines[i]?' ':'')+word;}
 return `<text x="8" y="${Math.max(29,height*.48)}" font-family="Arial" font-size="${size}" fill="#ffb45e">${label(now)}</text>`+lines.slice(0,2).map((s,i)=>`<text x="8" y="${height-18+i*11}" font-family="Arial" font-size="9" fill="#a8b5c9">${esc(s)}</text>`).join('');
}
module.exports={label,render};
