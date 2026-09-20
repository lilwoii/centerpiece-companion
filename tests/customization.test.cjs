const test=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const A=require('../src/appearance.cjs'),{Workspace,defaults}=require('../src/workspace.cjs'),{configuredSVG}=require('../src/strip.cjs'),{detailSVG,calendarSVG}=require('../src/widgets.cjs'),{validateSlot}=require('../src/catalog.cjs');
const validate=c=>Workspace.prototype.validate.call({},c),svg=(c,on=false,now=0,selected='idle')=>configuredSVG(selected,validate(c),{caps:on},{now});
test('old settings retain original colors, full-key indicator, hint and explicit weather unit',()=>{const old={...defaults(),weather:{unit:'fahrenheit',location:null}};const c=validate(old);assert.equal(c.appearance.stripBackground,'#111820');assert.equal(c.appearance.slotBackground,'#243040');assert.equal(c.appearance.tileBorder,'#374457');assert.equal(c.appearance.motion,'off');assert.equal(c.appearance.hint.mode,'default');assert.equal(c.indicator.style,'fill');assert.equal(c.weather.unit,'fahrenheit');assert.match(svg(old),/y="391"[^>]*>L1 \+ P/);assert.equal(validate(defaults()).weather.unit,'auto');});
test('regional units support Europe and explicit overrides',()=>{for(const locale of ['en-GB','de-DE','fr-FR','ko-KR'])assert.equal(A.regionalUnit(locale),'celsius');assert.equal(A.regionalUnit('en-US'),'fahrenheit');assert.equal(A.resolvedUnit('celsius'),'celsius');assert.equal(A.resolvedUnit('fahrenheit'),'fahrenheit');});
test('custom content escapes markup, rejects executable images and keeps Unicode graphemes intact',()=>{assert.throws(()=>A.visual({icon:'https://bad.test/x.png'}));assert.throws(()=>A.visual({icon:'data:image/svg+xml;base64,AAAA'}));assert.throws(()=>A.appearance({stripBackground:'url(x)'}));assert.throws(()=>A.textStyle({font:'bad" onload="x'}));const p=defaults();p.slots[3]={plugin:'decoration',action:'display',visual:{kind:'text',text:'<script> & 🎮',fontSize:12}};const out=svg(p);assert.ok(!out.includes('<script>'));assert.match(out,/&lt;script/);assert.match(out,/🎮/);});
test('PNG imports validate and malformed compressed payloads are rejected',async()=>{const bytes=await sharp({create:{width:16,height:16,channels:4,background:'#f08030'}}).png().toBuffer(),uri='data:image/png;base64,'+bytes.toString('base64');assert.equal(A.icon(uri),uri);const broken=Buffer.from(bytes);broken.fill(0,50,60);assert.throws(()=>A.icon('data:image/png;base64,'+broken.toString('base64')));const large=await sharp({create:{width:300,height:10,channels:4,background:'#fff'}}).png().toBuffer();assert.throws(()=>A.icon('data:image/png;base64,'+large.toString('base64')));});
test('every Caps dot placement is contained in the key and off is hidden by default',()=>{for(const pos of A.positions){const p=defaults();Object.assign(p.indicator,{enabled:true,style:'dot',dotPosition:pos,dotSize:10});const c=validate(p),on=A.capsSVG(c.indicator,true);assert.match(on,/<circle/);assert.equal(A.capsSVG(c.indicator,false),'');const x=Number(on.match(/cx="([\d.]+)"/)[1]),y=Number(on.match(/cy="([\d.]+)"/)[1]);assert.ok(x-5>=p.indicator.x&&x+5<=p.indicator.x+p.indicator.width);assert.ok(y-5>=p.indicator.y&&y+5<=p.indicator.y+p.indicator.height);}const bad=defaults();Object.assign(bad.indicator,{enabled:true,style:'dot',width:9,dotSize:8});assert.throws(()=>validate(bad));});
test('hint can be hidden or replaced without removing assigned tiles',()=>{const p=defaults();p.appearance={hint:{mode:'hidden'}};assert.ok(!svg(p).includes('L1 + P'));assert.match(svg(p),/width="80" height="78"/);p.appearance.hint={mode:'text',text:'HELLO'};assert.match(svg(p),/HELLO/);assert.ok(!svg(p).includes('PLUGINS'));});
test('color animation changes idle images and is stable during plugin navigation',()=>{const p=defaults();p.appearance={motion:'cycle',period:12};assert.notEqual(svg(p,false,0),svg(p,false,6000));assert.equal(svg(p,false,0,'previous'),svg(p,false,6000,'previous'));p.appearance={motion:'off'};assert.equal(svg(p,false,0),svg(p,false,6000));});
test('calendar uses all rows and marks the current local date once, including leap day',async()=>{for(const date of [new Date(2024,1,29,12),new Date(2026,7,31,12),new Date(2026,8,12,12)]){const out=calendarSVG(194,94,date);assert.equal((out.match(/data-today/g)||[]).length,1);assert.match(out,/#c93243/);assert.ok(!/NaN|undefined|Infinity/.test(out));await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="194" height="94">'+out+'</svg>')).png().toBuffer();}});
test('standalone text preserves font/color/alignment through validation and profiles',()=>{const p=defaults();p.widget={type:'text',text:'Focus time',x:1710,y:219,width:194,height:94,textStyle:{font:'mono',fontSize:28,color:'#f08030',align:'center',vertical:'bottom',bold:true}};const c=validate(p),out=detailSVG(c,{});assert.match(out,/Consolas/);assert.match(out,/font-size="28"/);assert.match(out,/text-anchor="middle"/);assert.match(out,/#f08030/);const snap=require('../src/profiles.cjs').snapshot(c);assert.deepEqual(snap.widget.textStyle,c.widget.textStyle);});
test('decorations and functional plugins coexist without changing actions',()=>{const functional=validateSlot({plugin:'spotify',action:'next',visual:{kind:'emoji',text:'⏭'}});assert.equal(functional.action,'next');assert.throws(()=>validateSlot({plugin:'decoration',action:'hotkey',value:'Ctrl+K'}));});
test('detail preview rasterizes calendar at high density instead of enlarging native pixels',async()=>{const p=validate(defaults());p.widget.type='calendar';const {preview}=require('../src/layout-preview.cjs');const uri=await preview(p,{now:new Date(2026,8,12,12).getTime()},{widgetOnly:true,freeze:true});const bytes=Buffer.from(uri.split(',')[1],'base64');const metadata=await sharp(bytes).metadata();assert.equal(metadata.width,1164);assert.ok(metadata.height>=500);const stats=await sharp(bytes).stats();assert.ok(stats.channels[0].stdev>15);});

test('emoji insertion uses the caret and preserves arbitrary pasted Unicode',()=>{
 const E=require('../src/emoji-input.js'),message='안녕 👩🏽‍🚀 Привет';
 assert.deepEqual(E.insert('Good morning','☀️',5,5,200),{value:'Good ☀️morning',caret:7});
 const result=E.insert(message,'🌌',message.length,message.length,200);
 assert.equal(result.value,message+'🌌');assert.equal(result.caret,result.value.length);
 assert.deepEqual(E.insert('A whole word B','✨',2,12,200),{value:'A ✨ B',caret:3});
});
test('emoji insertion never cuts flags, joined family emoji or skin tones',()=>{
 const E=require('../src/emoji-input.js');
 for(const emoji of ['🇰🇷','👩🏽‍🚀','👨‍👩‍👧‍👦']){
  const text='A'+emoji+'B';
  assert.equal(E.insert(text,'✨',2,2,200).value,'A'+emoji+'✨B');
  assert.equal(E.insert(text,'✨',2,3,200).value,'A✨B');
 }
});
test('emoji insertion honors the same text limit used by saved widget settings',()=>{
 const E=require('../src/emoji-input.js');
 assert.throws(()=>E.insert('x'.repeat(199),'🚀',199,199,200),/does not fit/);
 const result=E.insert('x'.repeat(200),'🚀',198,200,200);
 assert.equal(result.value.length,200);
 const p=defaults();p.widget={type:'text',text:result.value,x:1710,y:219,width:194,height:94};
 assert.equal(validate(p).widget.text,result.value);
});
