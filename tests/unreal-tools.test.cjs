const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createDetector,openSetup,DOWNLOAD_URL,LAUNCHER_URL}=require('../src/unreal-tools.cjs');
function harness(){
 let now=10000,calls=0,vsFolder='';const files=new Map(),existing=new Set(),p=path.win32;
 const normalize=x=>p.normalize(x).toLowerCase();
 const put=(x,value='')=>{files.set(normalize(x),JSON.stringify(value));existing.add(normalize(x));};
 const root='G:\\Custom engines';const manifest='C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat';
 let engineDirs=[];put(manifest,{InstallationList:[]});
 const env={LOCALAPPDATA:'C:\\Local',JAVA_HOME:'G:\\Java8'};
 const detector=createDetector({platform:'win32',env,now:()=>now,visualStudio:async()=>vsFolder,registry:async args=>{calls++;if(args[1].includes('HKCR'))return '    (Default) REG_SZ "M:\\Epic\\EpicGamesLauncher.exe" %1';return '';},fs:{existsSync:x=>existing.has(normalize(x)),statSync:x=>({size:files.get(normalize(x))?.length||0}),readFileSync:x=>{if(!files.has(normalize(x)))throw Error('missing');return files.get(normalize(x));},readdirSync:()=>[]}});
 function engine(major,minor,patch,complete=true){const folder=p.join(root,`UE_${major}.${minor}`);engineDirs.push({AppName:`UE_${major}.${minor}`,InstallLocation:folder});put(manifest,{InstallationList:engineDirs});put(p.join(folder,'Engine/Build/Build.version'),{MajorVersion:major,MinorVersion:minor,PatchVersion:patch});put(p.join(folder,'Engine/Build/BatchFiles/RunUAT.bat'));if(complete)put(p.join(folder,'Engine/Binaries/Win64',major===4?'UE4Editor.exe':'UnrealEditor.exe'));return folder;}
 function android(javaVersion="1.8.0_442"){for(const rel of ['platforms/android-30/android.jar','build-tools/30.0.3/aapt2.exe','ndk/21.4.7075529/source.properties'])put(p.join(env.LOCALAPPDATA,'Android/Sdk',rel));put(p.join(env.JAVA_HOME,'bin/javac.exe'));files.set(normalize(p.join(env.JAVA_HOME,'release')),'JAVA_VERSION="'+javaVersion+'"');}
 function cpp(valid=true){put('C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe');vsFolder='G:\\VS2019';if(valid)put(p.join(vsFolder,'VC/Auxiliary/Build/vcvars64.bat'));}
 return{detect:detector.detect,engine,android,cpp,put,advance:()=>{now+=5000;},calls:()=>calls};
}
test('detects a completed custom-drive installation without restarting',async()=>{const h=harness();assert.equal((await h.detect()).engineFound,false);const folder=h.engine(4,27,2);h.android();h.advance();const result=await h.detect();assert.equal(result.engineFolder,folder);assert.equal(result.engineVersion,'4.27.2');assert.equal(result.androidFound,true);assert.equal(result.verifiedBuild,false);assert.equal(result.canBuildKeyboardPak,false);});
test('UE5 is source-only and never advertised as a compatible keyboard cooker',async()=>{const h=harness();h.engine(5,8,2);const result=await h.detect();assert.equal(result.engineVersion,'5.8.2');assert.equal(result.status,'source-only');assert.equal(result.engine427Found,false);assert.equal(result.canBuildKeyboardPak,false);assert.match(result.issues[0],/alongside/);});
test('side-by-side engine inventory prefers 4.27 keyboard target and retains newer source engine',async()=>{const h=harness();h.engine(5,8,2);h.engine(4,27,2);const result=await h.detect();assert.equal(result.engines.length,2);assert.equal(result.engineVersion,'4.27.2');assert.equal(result.status,'android-missing');assert.equal(result.ue5Found,true);});
test('partial installs are not reported ready and rechecks are coalesced',async()=>{const h=harness();h.engine(5,8,2,false);const [a,b]=await Promise.all([h.detect(),h.detect()]);assert.equal(a,b);assert.equal(a.engineFound,false);assert.equal(h.calls(),5);h.engine(4,27,2);assert.equal(await h.detect(),a);h.advance();assert.equal((await h.detect()).engineFound,true);});
test('registered launcher is detected on a custom drive',async()=>{const h=harness();h.put('M:\\Epic\\EpicGamesLauncher.exe');assert.equal((await h.detect()).launcherFound,true);});
test('setup opens only a fixed launcher route and falls back to official website on handler failure',async()=>{const urls=[];const result=await openSetup(async url=>{urls.push(url);if(url===LAUNCHER_URL)throw Error('missing handler');},async()=>({launcherFound:true}));assert.deepEqual(urls,[LAUNCHER_URL,DOWNLOAD_URL]);assert.equal(result.opened,'website');});
test('setup skips the custom protocol when Epic is absent',async()=>{const urls=[];const result=await openSetup(async url=>urls.push(url),async()=>({launcherFound:false}));assert.deepEqual(urls,[DOWNLOAD_URL]);assert.equal(result.opened,'website');});

test("a newer Java compiler is not treated as the 4.27 device toolchain",async()=>{const h=harness();h.engine(4,27,2);h.android("21.0.8");const result=await h.detect();assert.equal(result.androidFound,false);assert.equal(result.android.javaFound,false);assert.match(result.issues.join(" "),/needs JDK 8/);});

const setup=require('../studio/unreal-setup.js');
function setupDocument(){
 const nodes=Object.fromEntries(['creator-setup-bar','show-unreal-tools','native-tools-status','creator-setup-summary','native-tools-heading','native-install-instructions','unreal-setup-link'].map(id=>[id,{hidden:false,textContent:''}]));
 const document={activeElement:null,getElementById:id=>nodes[id]};
 nodes['creator-setup-bar'].contains=element=>element==='setup-button';
 nodes['show-unreal-tools'].focus=()=>{document.activeElement='export-button';};
 return{document,nodes};
}
test('finishing a valid 4.27 install removes the setup callout without waiting for Android tools',async()=>{
 const h=harness(),ui=setupDocument();setup.apply(ui.document,await h.detect());assert.equal(ui.nodes['creator-setup-bar'].hidden,false);
 h.engine(4,27,2);h.advance();ui.document.activeElement='setup-button';
 setup.apply(ui.document,await h.detect());
 assert.equal(ui.nodes['creator-setup-bar'].hidden,true);assert.equal(ui.nodes['native-install-instructions'].hidden,true);
 assert.equal(ui.document.activeElement,'export-button');assert.equal(ui.nodes['native-tools-heading'].textContent,'Installed tools');
 assert.match(ui.nodes['native-tools-status'].textContent,/components are checked when you build/);
 h.android();h.advance();setup.apply(ui.document,await h.detect());assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 assert.match(ui.nodes['native-tools-status'].textContent,/components are checked when you build/);
});
test('UE5 and incomplete 4.27 downloads keep setup available, including stale general engine flags',async()=>{
 const h=harness(),ui=setupDocument();h.engine(5,8,2);h.engine(4,27,2,false);
 setup.apply(ui.document,await h.detect());assert.equal(ui.nodes['creator-setup-bar'].hidden,false);assert.match(ui.nodes['native-tools-status'].textContent,/5.8.2/);
 assert.equal(setup.state({engineFound:true,androidFound:true}).installed,false);
 assert.equal(setup.state({engine427Found:'true'}).installed,false);
});
test('an Epic install still being staged does not dismiss setup',async()=>{
 const h=harness(),folder=h.engine(4,27,2);h.put(path.win32.join(folder,'.egstore/bps/Install'));const result=await h.detect();
 assert.equal(result.engine427Found,false);assert.equal(setup.state(result).installed,false);
});
test('setup is restored if a later successful scan no longer finds 4.27, without stealing unrelated focus',()=>{
 const ui=setupDocument();ui.document.activeElement='canvas';setup.apply(ui.document,{engine427Found:true});
 setup.apply(ui.document,{engine427Found:false});assert.equal(ui.nodes['creator-setup-bar'].hidden,false);
 assert.equal(ui.nodes['native-install-instructions'].hidden,false);assert.equal(ui.document.activeElement,'canvas');
});
test('compiler detection requires an installed C++ component and never implies native build verification',async()=>{
 const h=harness();h.engine(4,27,2);h.android();assert.equal((await h.detect()).windowsCppFound,false);
 h.cpp(false);h.advance();assert.equal((await h.detect()).windowsCppFound,false);
 h.cpp();h.advance();const ready=await h.detect();assert.equal(ready.windowsCppFound,true);assert.equal(ready.canBuildKeyboardPak,false);assert.equal(ready.keyboardCompatibilityVerified,false);
});

test('designer suppresses installation banners while build tools keep accurate requirements',()=>{
 const ui=setupDocument();setup.apply(ui.document,{engine427Found:false},{showCallout:false});
 assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 assert.equal(ui.nodes['native-install-instructions'].hidden,false);
 assert.match(ui.nodes['native-tools-status'].textContent,/Install Unreal 4.27/);
 setup.apply(ui.document,{engine427Found:true},{showCallout:false});
 assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 assert.equal(ui.nodes['native-install-instructions'].hidden,true);
});

test('creation notice is scoped to an explicit flow and late detection cannot reopen it after exit',()=>{
 const ui=setupDocument(),session=setup.creationSession(ui.document);
 session.update({engine427Found:false});assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 session.start();assert.equal(ui.nodes['creator-setup-bar'].hidden,false);
 assert.match(ui.nodes['creator-setup-summary'].textContent,/detect it automatically and remove/);
 session.exit();assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 session.update({engine427Found:false});assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 session.start();assert.equal(ui.nodes['creator-setup-bar'].hidden,false);
 session.update({engine427Found:true});assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 session.exit();session.start();assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
});

test('starting creation waits for real detection instead of briefly claiming an installed engine is missing',()=>{
 const ui=setupDocument(),session=setup.creationSession(ui.document);
 session.start();assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
 session.update({engine427Found:true});assert.equal(ui.nodes['creator-setup-bar'].hidden,true);
});
