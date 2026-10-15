const{spawn}=require('node:child_process'),path=require('node:path');
const {physical}=require('./keymap.cjs');
function invoke(action,id){return new Promise((resolve,reject)=>{const child=spawn(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'languages.ps1')],{windowsHide:true});let out='',failed=false;const timer=setTimeout(()=>{failed=true;child.kill();reject(Error('Windows layout lookup timed out.'));},8000);child.stdout.setEncoding('utf8');child.stdout.on('data',b=>{out+=b;if(out.length>200000){failed=true;child.kill();reject(Error('Layout response too large.'));}});child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(Error('Windows layout lookup is unavailable.'));});child.on('exit',code=>{clearTimeout(timer);if(failed)return;try{if(code)throw Error();resolve(JSON.parse(out));}catch{reject(Error('Windows could not read that layout.'));}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({action,id}));});}
const supported=Object.freeze([
 {id:'qwerty',name:'Default · My XPANEL layout'},
 {id:'00000409',name:'English · US QWERTY'},
 {id:'00000809',name:'English · UK QWERTY'},
 {id:'korean-2',name:'한국어 · Korean 2-set',ime:true},
 {id:'00000411',name:'日本語 · Japanese Romaji',ime:true},
 {id:'japanese-kana',name:'日本語 · Japanese Kana',ime:true},
 {id:'00000419',name:'Русский · Russian ЙЦУКЕН'},
 {id:'00000804',name:'中文 · Chinese Pinyin',ime:true},
 {id:'00000407',name:'Deutsch · German QWERTZ'}
]);
async function list(){return supported.map(item=>({...item}));}
const readMap=map;
async function supportedMap(id){
 if(id==='japanese-kana'){
  const us=await readMap('00000409'),labels=[...us.labels];
  // Microsoft Windows ANSI 101 Kana key positions (not the extra-key JIS 106 layout):
  // github.com/microsoft/Windows-driver-samples/blob/main/input/layout/fe_kbds/jpn/101/kbd101.c
  for(const [start,text]of [[1,'ぬふあうえおやゆよわほへ'],[17,'たていすかんなにらせ゛゜む'],[33,'ちとしはきくまのりれけ'],[46,'つさそひこみもねるめ']])Array.from(text).forEach((c,i)=>labels[start+i]=c);
  const shift=[...labels];for(const [i,c]of [[3,'ぁ'],[4,'ぅ'],[5,'ぇ'],[6,'ぉ'],[7,'ゃ'],[8,'ゅ'],[9,'ょ'],[10,'を'],[11,'ー'],[19,'ぃ'],[27,'「'],[28,'」'],[46,'っ'],[53,'、'],[54,'。'],[55,'・']])shift[i]=c;
  return {...supported.find(item=>item.id===id),labels,shift,caps:[...labels],capsShift:[...shift],backquote:'ろ'};
 }
 // Romaji and Pinyin use the Latin input keys of this ANSI keyboard. Windows
 // IME performs composition; inventing a Chinese character per key is incorrect.
 const input=['00000411','00000804'].includes(id)?'00000409':id;
 const result=await readMap(input),choice=supported.find(item=>item.id===id);
 return choice?{...result,...choice}:result;
}
async function map(id){if(id==='auto'){const detected=await invoke('current');const value=await map(detected.id);return {...value,id:'auto',resolvedId:detected.id,name:'Windows · '+value.name};}if(typeof id==='string'&&/^[0-9a-f]{4}0412$/i.test(id))return {...await map('korean-2'),id};if(id==='qwerty')return {...await map('00000409'),id};if(id==='korean-2'){const us=await map('00000409'),labels=[...us.labels];for(const[start,text]of [[17,'ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ'],[33,'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ'],[46,'ㅋㅌㅊㅍㅠㅜㅡ']])Array.from(text).forEach((c,i)=>labels[start+i]=c);const shift=[...us.shift];for(let i=17;i<=55;i++)if(/[ㄱ-ㅣ]/.test(labels[i]))shift[i]=labels[i];for(const [i,c]of [[17,'ㅃ'],[18,'ㅉ'],[19,'ㄸ'],[20,'ㄲ'],[21,'ㅆ'],[25,'ㅒ'],[26,'ㅖ']])shift[i]=c;return{id,name:'한국어 · Korean 2-set',labels,shift,caps:[...labels],capsShift:[...shift],ime:true};}if(typeof id!=='string'||!/^[0-9a-f]{8}$/i.test(id))throw Error('Choose a valid layout.');const result=await invoke('map',id);if(!Array.isArray(result.labels)||result.labels.length!==68)throw Error('Invalid Windows layout.');const clean=values=>physical.map((fallback,i)=>i===61?'Space':typeof values?.[i]==='string'&&values[i].trim()&&!/[\x00-\x1f]/.test(values[i])?values[i]:fallback);return{...result,labels:clean(result.labels),shift:clean(result.shift),caps:clean(result.caps),capsShift:clean(result.capsShift)};}
module.exports={list,map:supportedMap};
