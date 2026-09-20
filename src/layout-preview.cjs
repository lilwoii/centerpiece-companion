const sharp=require('sharp');
const {configuredSVG}=require('./strip.cjs');
const {Workspace}=require('./workspace.cjs');
const layout=require('./layout.json');
const {physical}=require('./keymap.cjs');
const {esc}=require('./appearance.cjs');
async function preview(config,data={},flags={}){
 const c=Workspace.prototype.validate.call({},config);
 const guides=layout.keys.map((k,i)=>{const x=(k.x||0)*1920/1800,y=(k.y||0)*550/500,w=k.width*1920/1800,h=k.height*550/500;return `<rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" rx="6" fill="#121924" stroke="#374457"/><text x="${x+w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="Arial" font-size="13" fill="#a8b5c9">${esc((physical[i]||'').slice(0,9))}</text>`;}).join('');
 const selected=['idle','previous','toggle','next','fourth'].includes(flags.selected)?flags.selected:'idle';
 if(flags.freeze){data={...data,animationTime:0};c.weatherMotion=false;}
 const image=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="550"><rect width="1920" height="550" fill="#0b1119"/>${guides}${configuredSVG(selected,c,{caps:flags.caps===true,layer:false},data)}</svg>`;
 if(flags.overlayOnly){const png=await sharp(Buffer.from(configuredSVG(selected,c,{caps:flags.caps===true,layer:false},data))).png().toBuffer();return 'data:image/png;base64,'+png.toString('base64');}
 let rendered;
 if(flags.widgetOnly&&c.widget.type!=='off'){
  // Rasterize vector text at the preview's display density. Enlarging a crop of
  // the keyboard's native 194px widget also enlarges its antialiasing blur.
  const w=c.widget,previewWidth=582,previewHeight=previewWidth*w.height/w.width;
  const detail=image.replace('width="1920" height="550"',`width="${previewWidth}" height="${previewHeight}" viewBox="${w.x} ${w.y} ${w.width} ${w.height}"`);
  rendered=sharp(Buffer.from(detail),{density:144});
 }else rendered=sharp(Buffer.from(image)).resize(1280);
 const png=await rendered.png().toBuffer();return 'data:image/png;base64,'+png.toString('base64');
}
module.exports={preview};
