(function(root){
 const names=['Esc','1','2','3','4','5','6','7','8','9','0','-','=','Backspace','Previous','Next','Tab','Q','W','E','R','T','Y','U','I','O','P','[',']','\\','Play / pause','Volume','Caps Lock','A','S','D','F','G','H','J','K','L',';',"'",'Enter','Left Shift','Z','X','C','V','B','N','M',',','.','/','Right Shift','Up','Left Ctrl','Windows','Left Alt','Space','Right Alt','L1','Right Ctrl','Left','Down','Right'];
 function languageLabel(label,language){if(!language||language.id==='qwerty')return label;return String(label).split('+').map(part=>{const i=names.indexOf(part);return i>=0?language.labels[i]||part:part;}).join('+');}
 if(typeof module!=='undefined')module.exports={languageLabel};else root.languageLabel=languageLabel;
})(typeof window==='undefined'?globalThis:window);
