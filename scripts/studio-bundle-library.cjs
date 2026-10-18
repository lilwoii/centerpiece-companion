'use strict';
// Maintainer packaging step: accept only completed builds of the exact shipped
// projects. Does not connect to a keyboard or mark playback as verified.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {StudioBuilder}=require('../src/studio-build.cjs'),M=require('../studio/model.js');
function bundle(buildDirectory,output,ids){
 const builder=new StudioBuilder(buildDirectory),entries=[];
 fs.mkdirSync(output,{recursive:true});
 for(const name of ids){
  if(!/^[a-z][a-z0-9-]+$/.test(name))throw Error('Invalid collection name.');
  const project=M.validate(JSON.parse(fs.readFileSync(path.join(__dirname,'../studio/examples/community-collection',name+'.cpskin'),'utf8')));
  const hash=crypto.createHash('sha256').update(JSON.stringify(project,null,2)+'\n').digest('hex');
  const job=builder.latest(hash);if(job?.state!=='ready')throw Error('Build the exact shipped '+name+' project first.');
  const artifact=builder.artifact(job.id,hash);
  if(!artifact.cooked||!artifact.blueprintCompiled||!artifact.packageIntegrityVerified)throw Error('Incomplete build: '+name);
  fs.copyFileSync(artifact.file,path.join(output,job.id+'.pak'));
  entries.push({id:job.id,collectionId:name,projectName:project.name,sceneSha256:hash,sha256:artifact.sha256,size:artifact.size,validationRevision:artifact.validationRevision,createdAt:job.createdAt});
 }
 const manifest=path.join(output,'manifest.json');fs.writeFileSync(manifest+'.tmp',JSON.stringify({format:1,entries},null,2)+'\n');fs.renameSync(manifest+'.tmp',manifest);
 const library=new(require('../src/studio-prebuilt.cjs').StudioPrebuilt)(output);for(const entry of entries)library.artifact(entry.id,entry.sceneSha256);
 return entries;
}
if(require.main===module){const [directory,...ids]=process.argv.slice(2);if(!directory||!ids.length)throw Error('Usage: node scripts/studio-bundle-library.cjs <build directory> <collection ids...>');console.log(JSON.stringify(bundle(directory,path.join(__dirname,'../studio/prebuilt'),ids).map(e=>({name:e.collectionId,size:e.size})),null,2));}
module.exports={bundle};
