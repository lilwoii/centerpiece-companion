// PAK entries are relative to their recorded mount point, not always to project root.
function contentPaths(report){
 if(report?.version!==11||report.encryptedIndex||report.unsafePaths?.length||!Array.isArray(report.paths)||!report.paths.length)return null;
 const prefix=report.mountPoint==='../../../spark/Content/'?'':report.mountPoint==='../../../'?'spark/Content/':null;
 if(prefix===null)return null;
 const paths=[];
 for(const entry of report.paths){
  if(typeof entry!=='string'||!entry.startsWith(prefix))return null;
  const relative=entry.slice(prefix.length);
  if(!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:uasset|uexp|ubulk|umap|ufont)$/.test(relative)||/^(?:Engine|Config|Binaries)\//i.test(relative))return null;
  paths.push(relative);
 }
 return paths.includes('map/M_EntryPoint.umap')?paths:null;
}
module.exports={contentPaths};
