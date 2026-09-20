const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const EXPORT_BYTES=32*1024*1024,INSPECT_BYTES=128*1024*1024;
const staticFiles=new Map([
 ['/','studio/index.html'],['/studio/index.html','studio/index.html'],['/studio/studio.css','studio/studio.css'],['/studio/app.js','studio/app.js'],['/studio/motion-path.js','studio/motion-path.js'],['/studio/unreal-dock-ui.js','studio/unreal-dock-ui.js'],['/studio/unreal-cook-ui.js','studio/unreal-cook-ui.js'],['/studio/photo-ui.js','studio/photo-ui.js'],['/studio/image-converter.js','studio/image-converter.js'],['/studio/build-ui.js','studio/build-ui.js'],['/studio/device-test-ui.js','studio/device-test-ui.js'],['/studio/model.js','studio/model.js'],['/studio/reaction-presets.js','studio/reaction-presets.js'],['/studio/reaction-presets-ui.js','studio/reaction-presets-ui.js'],['/studio/presets.js','studio/presets.js'],['/studio/collection-presets.js','studio/collection-presets.js'],['/studio/collection-effects.js','studio/collection-effects.js'],['/studio/collection-v2-effects.js','studio/collection-v2-effects.js'],['/studio/games.js','studio/games.js'],['/studio/interactions.js','studio/interactions.js'],['/studio/unreal-setup.js','studio/unreal-setup.js'],['/studio/motion.js','studio/motion.js'],['/studio/pond-presets.js','studio/pond-presets.js'],['/studio/space-effects.js','studio/space-effects.js'],['/studio/render.js','studio/render.js'],['/studio/history.js','studio/history.js'],['/studio/storage.js','studio/storage.js'],['/studio/scene-library.js','studio/scene-library.js'],['/studio/project-loader.js','studio/project-loader.js'],['/studio/embedded.js','studio/embedded.js'],['/src/styles.css','src/styles.css'],['/src/layout.json','src/layout.json'],['/src/assets/community.png','src/assets/community.png']
]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
class RequestError extends Error{constructor(status,message){super(message);this.status=status;}}
function respond(res,status,value){if(res.destroyed||res.writableEnded)return;if(status>=400)res.setHeader('Connection','close');res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
function readBody(req,limit,timeoutMs=30000){return new Promise((resolve,reject)=>{
 let total=0,parts=[],done=false;
 const timer=setTimeout(()=>finish(new RequestError(408,'The upload timed out. Try a smaller file.')),timeoutMs);
 function finish(error,data){if(done)return;done=true;clearTimeout(timer);if(error){parts=[];req.resume();reject(error);}else{parts=[];resolve(data);}}
 req.on('error',()=>finish(new RequestError(400,'The upload could not be read. Try again.')));
 req.on('aborted',()=>finish(new RequestError(400,'The upload was canceled.')));
 const length=req.headers['content-length'];
 if(length!==undefined&&(!/^\d+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>limit)){finish(new RequestError(413,'The uploaded file is too large.'));return;}
 req.on('data',chunk=>{if(done)return;total+=chunk.length;if(total>limit)return finish(new RequestError(413,'The uploaded file is too large.'));parts.push(chunk);});
 req.on('end',()=>{if(!done)finish(null,Buffer.concat(parts,total));});
 });}
function failureResponse(error){
 if(error instanceof RequestError)return{status:error.status,error:error.message};
 // Native filesystem and unexpected errors can contain private local paths.
 if(/^(?:PAK|EXPORT|ZIP|STUDIO)_[A-Z_]+$/.test(error?.code||''))return{status:422,error:String(error.message).slice(0,700),code:error.code};
 return{status:500,error:'The local preview could not complete this action. Check that its source files are available, then retry. Your project was kept.'};
}
function createServer({exporter,inspector,studioService}={}){
 let buildService=studioService;
 let activeActions=0;
 const server=http.createServer({maxHeaderSize:8192,requestTimeout:45000,headersTimeout:10000},async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  const host='127.0.0.1:'+req.socket.localPort,origin='http://'+host;
  if(!['127.0.0.1','::ffff:127.0.0.1','::1'].includes(req.socket.remoteAddress)||req.headers.host!==host)return respond(res,403,{error:'This preview is available only from its local address.'});
  if(req.headers.origin!==undefined&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')return respond(res,403,{error:'Requests from another site are not allowed.'});
  if(typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//')||/[\\\x00-\x20\x7f]/.test(req.url))return respond(res,400,{error:'Invalid preview address.'});
  let pathname;try{pathname=new URL(req.url,origin).pathname;}catch{return respond(res,400,{error:'Invalid preview address.'});}
  try{
   if(req.method==='GET'){
    if(pathname==='/api/health')return respond(res,200,{app:'Centerpiece Skin Studio',localOnly:true,hardwareAccess:false,updatesEnabled:false});
    const collectionAsset=/^\/studio\/examples\/community-collection\/(?:previews\/[a-z][a-z0-9-]{0,79}\.png|[a-z][a-z0-9-]{0,79}\.cpskin)$/.test(pathname)?pathname.slice(1):null;const file=staticFiles.get(pathname)||collectionAsset;if(!file)return respond(res,404,{error:'This preview page was not found.'});
    const data=fs.readFileSync(path.join(ROOT,file));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);return;
   }
   if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return respond(res,405,{error:'This action is not supported.'});}
   const action=pathname==='/api/export'?'export':pathname==='/api/inspect'?'inspect':pathname==='/api/physical-test'?'physical-test':/^\/api\/(?:photo-(?:start|status|cancel)|unreal-(?:create|list|open|capabilities|dock|undock|cook-(?:start|status|cancel|download))|build-(?:start|latest|status|cancel|download)|device-(?:prepare|execute|restore|status|readiness)|dependencies-(?:check|status|install))$/.test(pathname)?pathname.slice(5):null;
   if(!action)return respond(res,404,{error:'This preview action was not found.'});
   if(req.headers.origin!==origin||req.headers['x-studio-request']!==action)return respond(res,403,{error:'Use the editor controls to perform this action.'});
   if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity')return respond(res,415,{error:'Compressed request bodies are not supported. Use the original project or package file.'});
   if(activeActions>=2)return respond(res,503,{error:'Two local actions are already running. Wait for one to finish, then retry.'});
   activeActions++;
   try{
    if(action.startsWith('photo-')||action.startsWith('unreal-')||action.startsWith('build-')||action.startsWith('device-')||action.startsWith('dependencies-')){
     if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new RequestError(415,'Use the native build controls.');
     const bytes=await readBody(req,['build-start','photo-start','unreal-create'].includes(action)?EXPORT_BYTES:1024);let input;
     try{input=JSON.parse(bytes.toString('utf8'));}catch{throw new RequestError(400,'The build request is not valid JSON.');}
     if(!buildService)buildService=require('../src/studio-service.cjs').createStudioService(path.join(ROOT,'.local-studio'));
     const result=await buildService(action,input);
     if(['build-download','unreal-cook-download'].includes(action)){const data=Buffer.from(result);res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':data.length});res.end(data);return;}
     return respond(res,200,result);
    }
    if(action==='physical-test'){const bytes=await readBody(req,EXPORT_BYTES);let project;try{project=JSON.parse(bytes.toString('utf8'));}catch{throw new RequestError(400,'The project file is not valid JSON.');}return respond(res,200,await require('../src/studio-service.cjs').studioRequest('physical-test',project));}
    if(action==='export'){
     if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new RequestError(415,'Choose a valid Skin Studio project.');
     const body=await readBody(req,EXPORT_BYTES);let value;try{value=JSON.parse(body.toString('utf8'));}catch{throw new RequestError(400,'The project file is not valid JSON.');}
     let project;try{project=require('./model.js').validate(value);}catch(error){throw new RequestError(422,error.message);}
     const result=await(exporter||require('./export.cjs').exportBundle)(project),archive=require('./zip.cjs').zip(result.files);
     res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="centerpiece-unreal-source.zip"','Content-Length':archive.length});res.end(archive);return;
    }
    if(!/^application\/octet-stream(?:;|$)/i.test(req.headers['content-type']||''))throw new RequestError(415,'Choose a .pak file.');
    const data=await readBody(req,INSPECT_BYTES),report=await(inspector||require('./pak-inspector.cjs').inspectPak)(data);respond(res,200,report);
   }finally{activeActions--;}
  }catch(error){const failure=failureResponse(error);respond(res,failure.status,{error:failure.error,...(failure.code?{code:failure.code}:{})});}
 });
 server.maxConnections=12;server.maxRequestsPerSocket=25;
 return server;
}
function startServer(port=0){return new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve({server,url:'http://127.0.0.1:'+server.address().port}));});}
if(require.main===module){const i=process.argv.indexOf('--port'),port=i>=0?Number(process.argv[i+1]):41735;startServer(port).then(({url,server})=>{process.stdout.write('Skin Studio local preview: '+url+'\n');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));}).catch(()=>{process.stderr.write('Skin Studio could not start. Check that its local port is available.\n');process.exitCode=1;});}
module.exports={createServer,startServer,readBody,EXPORT_BYTES,INSPECT_BYTES};
