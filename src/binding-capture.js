(function(root){
 'use strict';
 const codes={Enter:40,Escape:41,Backspace:42,Tab:43,Space:44,Minus:45,Equal:46,BracketLeft:47,BracketRight:48,Backslash:49,Semicolon:51,Quote:52,Backquote:53,Comma:54,Period:55,Slash:56,CapsLock:57,PrintScreen:70,ScrollLock:71,Pause:72,Insert:73,Home:74,PageUp:75,Delete:76,End:77,PageDown:78,ArrowRight:79,ArrowLeft:80,ArrowDown:81,ArrowUp:82,NumLock:83,NumpadDivide:84,NumpadMultiply:85,NumpadSubtract:86,NumpadAdd:87,NumpadEnter:88,Numpad0:98,NumpadDecimal:99,IntlBackslash:100,ContextMenu:101,NumpadEqual:103,IntlRo:135,KanaMode:136,IntlYen:137,Convert:138,NonConvert:139,Lang1:144,Lang2:145};
 for(let n=0;n<26;n++)codes['Key'+String.fromCharCode(65+n)]=4+n;
 for(let n=1;n<=9;n++){codes['Digit'+n]=29+n;codes['Numpad'+n]=88+n;}codes.Digit0=39;
 for(let n=1;n<=24;n++)codes['F'+n]=n<=12?57+n:91+n;
 const media={MediaTrackPrevious:0xb6,MediaTrackNext:0xb5,MediaPlayPause:0xcd,AudioVolumeUp:0xe9,AudioVolumeDown:0xea,AudioVolumeMute:0xe2};
 function capture(event){
  if(event.isComposing||event.repeat||event.getModifierState?.('AltGraph'))return null;
  // UK keyboards report their # key as Backslash. The separate ISO usage
  // preserves that physical key; Windows owns the character interpretation.
  const code=event.code==='Backslash'&&['#','~'].includes(event.key)?50:codes[event.code];
  const value=code?0x70000+code:media[event.code]?0xc0000+media[event.code]:null;
  return value===null?null:{value,mods:(event.ctrlKey?1:0)|(event.shiftKey?2:0)|(event.altKey?4:0)|(event.metaKey?8:0)};
 }
 if(typeof module==='object'&&module.exports)module.exports={capture};else root.CompanionBindingCapture={capture};
})(typeof window==='object'?window:globalThis);
