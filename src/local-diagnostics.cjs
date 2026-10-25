const fs=require('node:fs'),path=require('node:path');
function write(directory,snapshot,io=fs){
 try{const folder=path.join(directory,'diagnostics');io.mkdirSync(folder,{recursive:true});io.writeFileSync(path.join(folder,'state.json'),JSON.stringify(snapshot,null,2));return true;}catch{return false;}
}
module.exports={write};
