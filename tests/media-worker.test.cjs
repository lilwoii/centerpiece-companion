const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {MediaBridge,MediaTransport}=require('../src/media.cjs');
test('all providers share one worker, route independently and release only after last user',async()=>{
 let count=0,killed=0;const requests=[];const proc=new EventEmitter();proc.stdout=new PassThrough();proc.stderr=new PassThrough();proc.stdin=new EventEmitter();proc.stdin.write=line=>{const r=JSON.parse(line);requests.push(r);queueMicrotask(()=>proc.stdout.write(JSON.stringify({id:r.id,ok:true,result:{available:true,source:r.provider+'/'+r.target}})+'\n'));};proc.kill=()=>{killed++;};
 const transport=new MediaTransport('spotify',()=>{count++;return proc;}),spotify=new MediaBridge('spotify',transport),web=new MediaBridge('youtubemusic',transport),desktop=new MediaBridge('youtubemusic',transport),youtube=new MediaBridge('youtube',transport);web.target='web';desktop.target='desktop';
 const [a,b,c,d]=await Promise.all([spotify.request('status'),web.request('status'),desktop.request('status'),youtube.request('status')]);assert.equal(count,1);assert.equal(b.source,'youtubemusic/web');assert.equal(c.source,'youtubemusic/desktop');assert.equal(a.source,'spotify/auto');assert.equal(d.source,'youtube/auto');
 spotify.close();web.close();assert.equal(killed,0);await desktop.request('next');assert.equal(requests.at(-1).action,'next');desktop.close();youtube.close();assert.equal(killed,1);
});
test('duplicate status reads coalesce without combining control commands',async()=>{let calls=0,resolve;const t={request:()=>{calls++;return new Promise(r=>resolve=r);},close(){}};const b=new MediaBridge('spotify',t);const a=b.request('status'),c=b.request('status');assert.equal(a,c);assert.equal(calls,1);resolve({});await a;b.close();});

test('media pipe write failure retires helper and cancels its timeout immediately',async()=>{let killed=0;const proc=new EventEmitter();proc.stdout=new PassThrough();proc.stderr=new PassThrough();proc.stdin=new EventEmitter();proc.stdin.write=()=>{throw Error('broken pipe');};proc.kill=()=>killed++;const t=new MediaTransport('spotify',()=>proc);await assert.rejects(t.request('next'),/broken pipe/);assert.equal(t.pending.size,0);assert.equal(t.process,null);assert.equal(killed,1);});

test('media output pipe errors retire the helper without uncaught stream errors or replaying controls',async()=>{
 for(const name of ['stdout','stderr']){
  let killed=0,writes=0;const proc=new EventEmitter();proc.stdout=new PassThrough();proc.stderr=new PassThrough();proc.stdin=new EventEmitter();proc.stdin.write=()=>{writes++;};proc.kill=()=>killed++;
  const transport=new MediaTransport('spotify',()=>proc),request=transport.request('next');const rejection=assert.rejects(request,/connection stopped/);
  assert.doesNotThrow(()=>proc[name].emit('error',new Error('pipe closed unexpectedly')));
  await rejection;assert.equal(transport.pending.size,0);assert.equal(transport.process,null);assert.equal(killed,1);assert.equal(writes,1);
 }
});

test('late pipe errors from a retired media worker cannot close its replacement',async()=>{
 const workers=[];const transport=new MediaTransport('spotify',()=>{const proc=new EventEmitter();proc.stdout=new PassThrough();proc.stderr=new PassThrough();proc.stdin=new EventEmitter();proc.stdin.write=line=>{proc.request=JSON.parse(line);};proc.kill=()=>{proc.killed=true;};workers.push(proc);return proc;});
 const first=transport.request('status'),failed=assert.rejects(first,/connection stopped/);workers[0].stdout.emit('error',new Error('closed'));await failed;
 const second=transport.request('status');workers[0].stderr.emit('error',new Error('late old pipe error'));assert.equal(transport.process,workers[1]);assert.equal(workers[1].killed,undefined);
 workers[1].stdout.write(JSON.stringify({id:workers[1].request.id,ok:true,result:{available:true,title:'Current track'}})+'\n');assert.equal((await second).title,'Current track');transport.close();
});


test('malformed media output cannot throw from the asynchronous line callback',async()=>{
 const proc=new EventEmitter();proc.stdout=new PassThrough();proc.stderr=new PassThrough();proc.stdin=new EventEmitter();let id;proc.stdin.write=line=>{id=JSON.parse(line).id;};proc.kill=()=>{};
 const transport=new MediaTransport('spotify',()=>proc),request=transport.request('status');
 assert.doesNotThrow(()=>proc.stdout.write('null\n[]\n"noise"\nnot json\n'));
 assert.equal(transport.pending.size,1);proc.stdout.write(JSON.stringify({id,ok:true,result:{available:true,title:'Valid'}})+'\n');assert.equal((await request).title,'Valid');transport.close();
});

test('malformed successful helper results become unavailable without escaping the real player poll',async()=>{
 const {MusicPlayers}=require('../src/music-players.cjs');
 for(const result of [null,[],true,12,'invalid']){
  const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.stdin=new EventEmitter();let response=result,writes=0;
  p.stdin.write=line=>{writes++;const {id}=JSON.parse(line);queueMicrotask(()=>p.stdout.write(JSON.stringify({id,ok:true,result:response})+'\n'));};p.kill=()=>{};
  const transport=new MediaTransport('youtubemusic',()=>p),timers=[];
  const players=new MusicPlayers({bridgeFactory:()=>new MediaBridge('youtubemusic',transport),timers:{setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}}});
  try{players.start();await timers[0]();assert.equal(players.view('desktop').available,false);assert.equal(writes,1);assert.equal(transport.pending.size,0);
   response={available:true,status:'Paused',title:'Recovered',artist:'Artist',source:'youtube-music-desktop-app.exe',duration:120,position:2};await players.refresh('desktop');assert.equal(players.view('desktop').title,'Recovered');assert.equal(writes,2);
  }finally{players.close();}
 }
});
