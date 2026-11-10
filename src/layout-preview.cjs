const sharp=require('sharp');
const {configuredSVG}=require('./strip.cjs');
const {Workspace}=require('./workspace.cjs');
const layout=require('./layout.json');
const {physical}=require('./keymap.cjs');
const {languageLabel}=require('./language-labels.js');
const {esc}=require('./appearance.cjs');
// Only the app's bundled, trusted vector icons can be expanded. Imported images
// remain bounded PNG/JPEG data and retain their original display behavior.
const editorIcons=new Map(Object.values(require('./icons.json')).map(svg=>['data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),svg]));
function editorVectorSVG(svg){
 return svg.replace(/^<svg\b/,'<svg viewBox="0 0 1920 550" preserveAspectRatio="none"').replace(/<image\b([^>]*?)href="(data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+)"([^>]*?)\/>/g,(image,before,uri,after)=>{const icon=editorIcons.get(uri);return icon?icon.replace('<svg','<svg '+before+after):image;});
}

async function preview(config,data={},flags={}){
 const c=Workspace.prototype.validate.call({},config);
 if(flags.editorOverlay){
  // Reuse the device renderer without rasterizing a full board. Editable keys and
  // instant lock/shortcut colors are separate DOM layers in the keyboard editor.
  c.indicator={...c.indicator,enabled:false};c.keyAppearance={};c.keyIcons={};
  c.weatherMotion=false;
  const selected=['idle','previous','toggle','next','fourth','fifth'].includes(flags.selected)?flags.selected:'idle';
  const svg=configuredSVG(selected,c,{caps:false,layer:false},{...data,animationTime:0,selected:Math.max(0,['previous','toggle','next','fourth','fifth'].indexOf(selected))}).replace(/<g data-navigation-key="\d+">[\s\S]*?<\/g>/g,'');
  return 'data:image/svg+xml;base64,'+Buffer.from(editorVectorSVG(svg)).toString('base64');
 }

 const guides=layout.keys.map((k,i)=>{const x=(k.x||0)*1920/1800,y=(k.y||0)*550/500,w=k.width*1920/1800,h=k.height*550/500;return `<rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" rx="6" fill="#121924" stroke="#374457"/><text x="${x+w/2}" y="${y+h/2+5}" text-anchor="middle" font-family="Segoe UI,Microsoft YaHei,Malgun Gothic,Arial,sans-serif" font-size="13" fill="#a8b5c9">${c.hideLegends?'':esc(languageLabel(physical[i]||'',data.language,{...data.locks,caps:flags.caps===true||data.locks?.caps===true}).slice(0,9))}</text>`;}).join('');
 const selected=['idle','previous','toggle','next','fourth','fifth'].includes(flags.selected)?flags.selected:'idle';
 if(flags.freeze){data={...data,animationTime:0};c.weatherMotion=false;}
 const image=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="550"><rect width="1920" height="550" fill="#0b1119"/>${guides}${configuredSVG(selected,c,{caps:flags.caps===true,layer:false},data)}</svg>`;
 if(flags.overlayOnly){const png=await sharp(Buffer.from(configuredSVG(selected,c,{caps:flags.caps===true,layer:false},data))).png().toBuffer();return 'data:image/png;base64,'+png.toString('base64');}
 let rendered;
 const previewWidget=Number.isInteger(flags.widgetIndex)&&flags.widgetIndex>0?c.extraWidgets[flags.widgetIndex-1]:c.widget;
 if(flags.widgetOnly&&previewWidget&&previewWidget.type!=='off'){
  // Rasterize vector text at the preview's display density. Enlarging a crop of
  // the keyboard's native 194px widget also enlarges its antialiasing blur.
  const w=c.widgetLayout!=='free'&&c.extraWidgets.length?require('./widget-panel.cjs').bounds:previewWidget,previewWidth=582,previewHeight=previewWidth*w.height/w.width;
  const detail=image.replace('width="1920" height="550"',`width="${previewWidth}" height="${previewHeight}" viewBox="${w.x} ${w.y} ${w.width} ${w.height}"`);
  rendered=sharp(Buffer.from(detail),{density:144});
 }else rendered=sharp(Buffer.from(image)).resize(1280);
 const png=await rendered.png().toBuffer();return 'data:image/png;base64,'+png.toString('base64');
}
module.exports={preview,editorVectorSVG};
