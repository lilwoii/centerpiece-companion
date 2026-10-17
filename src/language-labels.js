(function(root){
 const names=['Esc','1','2','3','4','5','6','7','8','9','0','-','=','Backspace','Previous','Next','Tab','Q','W','E','R','T','Y','U','I','O','P','[',']','\\','Play / pause','Volume','Caps Lock','A','S','D','F','G','H','J','K','L',';',"'",'Enter','Left Shift','Z','X','C','V','B','N','M',',','.','/','Right Shift','Up','Left Ctrl','Windows','Left Alt','Space','Right Alt','L1','Right Ctrl','Left','Down','Right'];
 function languageLabel(label,language,locks={}){if(!language||!Array.isArray(language.labels)||(language.id==='qwerty'&&!language.caps))return label;const labels=(locks.caps?(locks.shift?language.capsShift:language.caps):(locks.shift?language.shift:language.labels))||language.labels;return String(label).split('+').map(part=>{if(language.backquote&&(part==='`'||part==='Esc / `'))return part==='`'?language.backquote:'Esc / '+language.backquote;const i=names.indexOf(part);return i>=0?labels[i]||part:part;}).join('+');}
 function bindingLegend(label,binding,language,locks={}){
  if(binding?.behaviorId!==50397)return languageLabel(label,language,locks);
  const value=binding.param1>>>0,usage=value&0xffff,mods=value>>>24;
  if(((value>>>16)&255)!==7||(mods&13))return languageLabel(label,language,locks);
  const punctuation={45:'-',46:'=',47:'[',48:']',49:'\\',50:'#',51:';',52:"'",53:'`',54:',',55:'.',56:'/',100:'\\'};
  const base=usage>=4&&usage<=29?String.fromCharCode(usage+61):usage>=30&&usage<=39?String((usage-29)%10):punctuation[usage];
  if(!base)return languageLabel(label,language,locks);
  const state={...locks,shift:!!locks.shift||!!(mods&2)};
  if(usage===50)return state.shift?'~':'#';
  if(language?.labels&&names.includes(base))return languageLabel(base,language,state);
  if(/^[A-Z]$/.test(base))return !('caps' in locks)&&!('shift' in locks)?base:state.shift!==!!state.caps?base:base.toLowerCase();
  const shifted={'1':'!','2':'@','3':'#','4':'$','5':'%','6':'^','7':'&','8':'*','9':'(','0':')','-':'_','=':'+','[':'{',']':'}','\\':'|',';':':',"'":'"','`':'~',',':'<','.':'>','/':'?'};
  return state.shift?(shifted[base]||base):base;
 }
 if(typeof module!=='undefined')module.exports={languageLabel,bindingLegend};else {root.languageLabel=languageLabel;root.bindingLegend=bindingLegend;}
})(typeof window==='undefined'?globalThis:window);
