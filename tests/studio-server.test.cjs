const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{PassThrough}=require('node:stream');
const {createServer,startServer,readBody,EXPORT_BYTES,INSPECT_BYTES}=require('../studio/server.cjs');
const {zip,crc32,MAX_BYTES}=require('../studio/zip.cjs'),{trustedDocument,controlWindow,guardWindow,electronEntry,DESKTOP_PORT}=require('../studio/main.cjs'),Model=require('../studio/model.js');
async function preview(t,options){const server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));return{server,port:server.address().port,origin:'http://127.0.0.1:'+server.address().port};}
function request(server,{method='GET',path='/',headers={},body}={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:server.port,method,path,headers:{Connection:'close',...headers}},res=>{const parts=[];res.on('data',data=>parts.push(data));res.on('end',()=>{const bytes=Buffer.concat(parts);resolve({status:res.statusCode,headers:res.headers,bytes,text:bytes.toString('utf8')});});});req.on('error',reject);req.end(body);});}
function post(server,action,body,headers={}){return request(server,{method:'POST',path:'/api/'+action,headers:{Origin:server.origin,'X-Studio-Request':action,'Content-Type':action==='export'?'application/json':'application/octet-stream',...headers},body});}
function entries(archive){const result=[];let at=0;while(archive.readUInt32LE(at)===0x04034b50){const length=archive.readUInt32LE(at+18),nameLength=archive.readUInt16LE(at+26),extraLength=archive.readUInt16LE(at+28),start=at+30+nameLength+extraLength,name=archive.subarray(at+30,at+30+nameLength).toString('utf8'),data=archive.subarray(start,start+length);assert.equal(archive.readUInt16LE(at+8),0);assert.equal(archive.readUInt32LE(at+14),crc32(data));result.push({name,data});at=start+length;}return result;}

test('preview is bound to loopback and exposes only fixed static files',async t=>{
 const server=await preview(t);assert.equal(server.server.address().address,'127.0.0.1');
 const health=await request(server,{path:'/api/health'});assert.equal(health.status,200);assert.deepEqual(JSON.parse(health.text),{app:'Centerpiece Skin Studio',localOnly:true,hardwareAccess:false,updatesEnabled:false});
 const page=await request(server);assert.equal(page.status,200);assert.match(page.headers['content-security-policy'],/frame-ancestors 'none'/);assert.equal(page.headers['cross-origin-resource-policy'],'same-origin');assert.equal(page.headers['x-content-type-options'],'nosniff');
 for(const address of ['/package.json','/src/main.cjs','/studio/main.cjs','/studio/server.cjs','/studio/../../.git/config','/sdk/README.md','/C:/Users/private.json'])assert.equal((await request(server,{path:address})).status,404,address);
 assert.equal((await request(server,{path:'http://example.com/api/health'})).status,400);
 const fixed=await startServer();assert.match(fixed.url,/^http:\/\/127\.0\.0\.1:\d+$/);await new Promise(resolve=>fixed.server.close(resolve));
});

test('Host, Origin, fetch-site and action headers gate local POST work',async t=>{
 let calls=0;const server=await preview(t,{exporter:()=>{calls++;return{files:[]};}}),body=JSON.stringify(Model.createProject('Test'));
 for(const headers of [{Host:'attacker.example'},{Origin:'https://example.com'},{Origin:'null'},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await request(server,{path:'/api/health',headers})).status,403);
 assert.equal((await request(server,{method:'POST',path:'/api/export',headers:{'Content-Type':'application/json','X-Studio-Request':'export'},body})).status,403);
 assert.equal((await post(server,'export',body,{'X-Studio-Request':'inspect'})).status,403);
 assert.equal((await post(server,'export',body,{Origin:'http://127.0.0.1:1'})).status,403);
 assert.equal((await post(server,'export',body,{'Content-Encoding':'gzip'})).status,415);
 assert.equal((await post(server,'export',body,{'Content-Type':'text/plain'})).status,415);
 assert.equal((await request(server,{method:'OPTIONS',path:'/api/export'})).status,405);
 assert.equal((await post(server,'missing',body)).status,404);assert.equal(calls,0);
});

test('export validates project data and produces a bounded source ZIP',async t=>{
 let normalized;const server=await preview(t,{exporter:project=>{normalized=project;return{files:[{path:'project/test.json',content:JSON.stringify(project)}]};}}),project=Model.createProject('Export');
 assert.equal((await post(server,'export','{invalid')).status,400);
 assert.equal((await post(server,'export',JSON.stringify({...project,format:'wrong'}))).status,422);
 const response=await post(server,'export',JSON.stringify({...project,untrustedExtra:'discard'}));assert.equal(response.status,200);assert.equal(normalized.untrustedExtra,undefined);assert.equal(response.headers['content-type'],'application/zip');assert.equal(entries(response.bytes)[0].name,'project/test.json');
});

test('inspection receives bytes only and known parser errors remain useful',async t=>{
 const server=await preview(t,{inspector:data=>{assert.ok(Buffer.isBuffer(data));if(data.toString()==='bad')throw Object.assign(Error('This is not a supported Unreal PAK v11 file.'),{code:'PAK_UNSUPPORTED'});return{paths:['../../../spark/Content/M_EntryPoint.uasset'],bytes:data.length};}});
 const good=await post(server,'inspect',Buffer.from('bytes'));assert.equal(good.status,200);assert.equal(JSON.parse(good.text).bytes,5);
 const bad=await post(server,'inspect',Buffer.from('bad'));assert.equal(bad.status,422);assert.equal(JSON.parse(bad.text).code,'PAK_UNSUPPORTED');
});

test('I/O and unexpected failures never expose local file paths',async t=>{
 const privatePath='C:\\Users\\Private\\secrets.json';let typed=true;
 const server=await preview(t,{exporter:()=>{throw typed?Object.assign(Error('ENOENT: cannot open '+privatePath),{code:'ENOENT',path:privatePath}):Error('Cannot load '+privatePath);}}),body=JSON.stringify(Model.createProject('Test'));
 for(let i=0;i<2;i++){const response=await post(server,'export',body);assert.equal(response.status,500);assert.doesNotMatch(response.text,/Private|secrets|ENOENT|C:/);assert.match(response.text,/Your project was kept/);typed=false;}
});

test('declared and streamed body limits fail before processing',async t=>{
 let calls=0;const server=await preview(t,{exporter:()=>{calls++;return{files:[]};},inspector:()=>{calls++;return{};}});
 assert.equal((await post(server,'export','',{'Content-Length':String(EXPORT_BYTES+1)})).status,413);
 assert.equal((await post(server,'inspect','',{'Content-Length':String(INSPECT_BYTES+1)})).status,413);assert.equal(calls,0);
 const stream=new PassThrough();stream.headers={};const body=readBody(stream,4);stream.write(Buffer.from('abc'));stream.end(Buffer.from('de'));await assert.rejects(body,error=>error.status===413);
 const exact=new PassThrough();exact.headers={};const success=readBody(exact,4);exact.end(Buffer.from('abcd'));assert.equal((await success).toString(),'abcd');
 const timed=new PassThrough();timed.headers={};await assert.rejects(readBody(timed,4,5),error=>error.status===408);timed.end();
 const aborted=new PassThrough();aborted.headers={};const pending=readBody(aborted,4);aborted.emit('aborted');await assert.rejects(pending,/canceled/);aborted.end();
});

test('concurrent uploads have a fixed capacity and recover after completion',async t=>{
 const releases=[];let started=0;const server=await preview(t,{inspector:async()=>{started++;await new Promise(resolve=>releases.push(resolve));return{done:true};}});
 const first=post(server,'inspect','a'),second=post(server,'inspect','b');
 for(let tries=0;started<2&&tries<100;tries++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(started,2);
 assert.equal((await post(server,'inspect','c')).status,503);releases.splice(0).forEach(resolve=>resolve());assert.equal((await first).status,200);assert.equal((await second).status,200);
});

test('ZIP rejects traversal, Windows aliases, duplicate names and malformed contents',()=>{
 for(const name of ['../secret','dir/../secret','/absolute','C:/drive','dir\\file','dir//file','dir/./file','CON','aux.txt','LPT1.cpp','folder./file','file.','file:stream','a\u0000b'])assert.throws(()=>zip([{path:name,content:'x'}]),error=>error.code==='ZIP_PATH',name);
 assert.throws(()=>zip([{path:'Source/Foo.cpp',content:'a'},{path:'Source/foo.cpp',content:'b'}]),error=>error.code==='ZIP_PATH');
 for(const content of ['????','QQ===','Q==='])assert.throws(()=>zip([{path:'asset.bin',encoding:'base64',content}]),error=>error.code==='ZIP_CONTENTS');
 assert.throws(()=>zip([{path:'a.txt',encoding:'',content:'x'}]),error=>error.code==='ZIP_CONTENTS');assert.throws(()=>zip([null]),error=>error.code==='ZIP_FILES');
 assert.throws(()=>zip([{path:'too-large.txt',content:'x'.repeat(MAX_BYTES+1)}]),error=>error.code==='ZIP_TOO_LARGE');
 const archive=zip([{path:'README.md',content:'123456789'},{path:'asset.bin',encoding:'base64',content:'AQID'}]),files=entries(archive);assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);assert.equal(files[0].data.toString(),'123456789');assert.deepEqual([...files[1].data],[1,2,3]);assert.equal(archive.readUInt32LE(archive.length-22),0x06054b50);
});

test('desktop controls trust only the editor main frame and preserve close veto',()=>{
 const origin='http://127.0.0.1:'+DESKTOP_PORT,frame={url:origin+'/'},calls=[],contents={mainFrame:frame},window={webContents:contents,isDestroyed:()=>false,minimize:()=>calls.push('minimize'),isMaximized:()=>false,maximize:()=>calls.push('maximize'),unmaximize:()=>calls.push('unmaximize'),close:()=>calls.push('close')},event={sender:contents,senderFrame:frame};
 assert.equal(DESKTOP_PORT,41736);for(const value of ['not a URL',origin+'/api/export','file:///tmp/private',origin.replace('127.0.0.1','localhost')+'/',origin.replace('http:','https:')+'/',origin.replace('127.0.0.1','user@127.0.0.1')+'/'])assert.equal(trustedDocument(value,origin),false,value);
 controlWindow(event,'minimize',window,origin);controlWindow(event,'maximize',window,origin);controlWindow(event,'close',window,origin);assert.deepEqual(calls,['minimize','maximize','close']);
 for(const unsafe of [{...event,sender:{}},{...event,senderFrame:{url:origin+'/'}},{...event,senderFrame:null}])assert.throws(()=>controlWindow(unsafe,'close',window,origin),/Untrusted/);
 assert.throws(()=>controlWindow(event,'execute',window,origin),/Unknown/);assert.throws(()=>controlWindow(event,'close',{...window,isDestroyed:()=>true},origin),/Untrusted/);
 const handlers={};guardWindow({webContents:{setWindowOpenHandler:handler=>{assert.deepEqual(handler(),{action:'deny'});},on:(name,handler)=>{handlers[name]=handler;}}},origin);
 for(const name of ['will-navigate','will-redirect']){let blocked=false;handlers[name]({preventDefault:()=>{blocked=true;}},'file:///tmp/secret');assert.equal(blocked,true);blocked=false;handlers[name]({preventDefault:()=>{blocked=true;}},origin+'/#export');assert.equal(blocked,false);}
 assert.equal(handlers['will-prevent-unload'],undefined,'the shell must not bypass browser unsaved-draft protection');
});

test('Electron direct entry launches even when its loader replaces require.main',()=>{
 const path=require('node:path'),filename=path.resolve(__dirname,'../studio/main.cjs'),runtime={versions:{electron:'41.0.0'},type:'browser',argv:['electron.exe',filename]};
 assert.equal(electronEntry(runtime,filename),true);
 assert.equal(electronEntry({...runtime,argv:['electron.exe',path.resolve(__dirname,'studio-server.test.cjs')]},filename),false,'importing from an Electron test must not launch a user window');
 assert.equal(electronEntry({...runtime,versions:{}},filename),false);assert.equal(electronEntry({...runtime,type:'renderer'},filename),false);assert.equal(electronEntry({...runtime,argv:['electron.exe']},filename),false);
});

test('native build routes require same-origin JSON controls and preserve safe error codes',async t=>{
 const seen=[],server=await preview(t,{studioService:async(action,input)=>{seen.push([action,input]);if(action==='build-download')return new Uint8Array([1,2,3]);if(action==='build-start')throw Object.assign(Error('A build is already running.'),{code:'STUDIO_BUILD_BUSY'});return null;}});
 assert.equal((await post(server,'build-latest','null',{'Content-Type':'application/json',Origin:'https://bad.example'})).status,403);
 assert.equal((await post(server,'build-latest','null')).status,415);
 const latest=await post(server,'build-latest','null',{'Content-Type':'application/json'});assert.equal(latest.status,200);assert.equal(latest.text,'null');
 const failed=await post(server,'build-start','{}',{'Content-Type':'application/json'});assert.equal(failed.status,422);assert.equal(JSON.parse(failed.text).code,'STUDIO_BUILD_BUSY');
 const download=await post(server,'build-download','{"id":"known"}',{'Content-Type':'application/json'});assert.equal(download.status,200);assert.deepEqual([...download.bytes],[1,2,3]);assert.equal(seen.length,3);
});
