/* Shared insertion behavior for Decoration, bottom hints and widget messages. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CompanionEmojiInput=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function insert(text,emoji,start,end,limit=200){
  if(typeof text!=='string'||typeof emoji!=='string')throw Error('Choose an emoji to insert.');
  const clamp=n=>Number.isInteger(n)?Math.max(0,Math.min(text.length,n)):text.length;
  let left=clamp(start),right=clamp(end);if(right<left)[left,right]=[right,left];
  // Do not split flags, skin tones or joined emoji if a selection ends inside one.
  const boundaries=[0];let offset=0;
  const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(p=>p.segment):Array.from(text);
  for(const part of parts){offset+=part.length;boundaries.push(offset);}
  if(left===right){left=right=boundaries.find(n=>n>=left)??text.length;}
  else{left=boundaries.filter(n=>n<=left).at(-1)??0;right=boundaries.find(n=>n>=right)??text.length;}
  const value=text.slice(0,left)+emoji+text.slice(right);
  if(Number.isFinite(limit)&&limit>=0&&value.length>limit)throw Error('The emoji does not fit. Shorten the text first.');
  return{value,caret:left+emoji.length};
 }
 return Object.freeze({insert});
});
