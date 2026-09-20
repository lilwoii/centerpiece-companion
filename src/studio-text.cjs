const sharp=require('sharp'),crypto=require('node:crypto');
const M=require('../studio/model.js');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function svg(layer,advances=[]){
 const l=M.validateLayer(layer,3600),w=Math.ceil(l.width),h=Math.ceil(l.height);
 if(w*h>16*1024*1024)throw Error('This text layer is too large to render. Reduce its dimensions.');
 const lines=l.text.split('\n').slice(0,8),leading=l.fontSize*1.16,inset=Math.min(12,h*.03),x=l.textAlign==='left'?w*.03:l.textAlign==='right'?w*.97:w/2,y=l.textVertical==='top'?inset+leading/2:l.textVertical==='bottom'?h-inset-(lines.length-.5)*leading:h/2-(lines.length-1)*leading/2;
 const anchor={left:'start',center:'middle',right:'end'}[l.textAlign];
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="glow" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="${Math.min(30,l.size*.4)/2}"/></filter></defs><g xml:space="preserve" font-family="${escape(M.fonts[l.font])}" font-weight="${l.fontWeight}" font-size="${l.fontSize}" text-anchor="${anchor}" dominant-baseline="central">${lines.map((line,i)=>`<g transform="translate(${x} 0) scale(${advances[i]>w*.94?w*.94/advances[i]:1} 1) translate(${-x} 0)"><text x="${x}" y="${y+i*leading}" fill="${l.color2}" opacity=".65" filter="url(#glow)">${escape(line)}</text><text x="${x}" y="${y+i*leading}" fill="${l.color}">${escape(line)}</text></g>`).join('')}</g></svg>`;
}
async function prepareTextAssets(bundle,project){
 const text=project.layers.filter(l=>l.type==='text');if(!text.length)return bundle;
 const manifestEntry=bundle.files.find(f=>f.path==='project/image-manifest.json');if(!manifestEntry)throw Error('The image manifest is missing.');const manifest=JSON.parse(manifestEntry.content);
 for(const layer of text){const advances=[];for(const line of layer.text.split('\n').slice(0,8)){if(!line.trim()){advances.push(0);continue;}const measured=await sharp({text:{text:escape(line),font:M.fonts[layer.font].split(',')[0]+' '+({'400':'','600':'Semi-Bold','700':'Bold'}[layer.fontWeight])+' 16',rgba:true}}).png().toBuffer({resolveWithObject:true});advances.push(measured.info.width*layer.fontSize/16);}const prepared=atlas(layer,advances);const bytes=await sharp(Buffer.from(prepared.svg),{limitInputPixels:16*1024*1024}).png().toBuffer(),hash=crypto.createHash('sha256').update(bytes).digest('hex');const relative='project/images/'+hash+'.png';
  if(!bundle.files.some(f=>f.path===relative))bundle.files.push({path:relative,content:bytes.toString('base64'),encoding:'base64'});
  manifest.images.push({path:relative,sha256:hash,width:prepared.layout.width,height:prepared.layout.height,mimeType:'image/png',layerIds:[layer.id],purpose:'native-text',textLayout:prepared.layout});
 }
 manifestEntry.content=JSON.stringify(manifest,null,2)+'\n';
 const bytes=bundle.files.reduce((n,f)=>n+Buffer.byteLength(f.content,f.encoding==='base64'?'base64':'utf8'),0);if(bytes>40*1024*1024)throw Error('Rendered text exceeds the native build size limit. Reduce text layer dimensions.');return bundle;
}
function atlas(layer,advances){
 const l=M.validateLayer(layer,3600),lines=l.text.split('\n').slice(0,8),width=Math.ceil(Math.max(l.width,...l.keyframes.filter(f=>f.property==='width').map(f=>f.value))),pitch=Math.ceil(l.fontSize*1.7+4),height=pitch*lines.length;
 if(width*height>16*1024*1024)throw Error('This animated text atlas is too large. Reduce its width, font size or line count.');
 const layout={width,height,pitch,advances:lines.map((_,i)=>Math.min(width*.94,advances[i]||0))};
 const content=lines.map((line,i)=>{const scale=advances[i]>width*.94?width*.94/advances[i]:1;return `<g transform="translate(${width/2} ${pitch*(i+.5)}) scale(${scale} 1)"><text x="0" y="0" fill="${l.color}">${escape(line)}</text></g>`;}).join('');
 return{layout,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g xml:space="preserve" font-family="${escape(M.fonts[l.font])}" font-weight="${l.fontWeight}" font-size="${l.fontSize}" text-anchor="middle" dominant-baseline="central">${content}</g></svg>`};
}
module.exports={svg,atlas,prepareTextAssets};
