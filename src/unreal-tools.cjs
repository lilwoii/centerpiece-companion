const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const DOWNLOAD_URL = 'https://www.unrealengine.com/download';
// Fixed destination only. Scene files and renderer messages never supply a URL or command.
const LAUNCHER_URL = 'com.epicgames.launcher://ue/library';
const CACHE_MS = 4000;
function registry(args) {
  return new Promise(resolve => execFile('reg.exe', args, { encoding: 'utf8', windowsHide: true, timeout: 1200, maxBuffer: 512 * 1024 }, (error, stdout) => resolve(error ? '' : stdout)));
}
function visualStudio(executable){
  return new Promise(resolve=>execFile(executable,['-latest','-products','*','-version','[16.0,17.0)','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath'],{encoding:'utf8',windowsHide:true,timeout:1200,maxBuffer:65536},(error,stdout)=>resolve(error?'':stdout)));
}
function createDetector(options = {}) {
  const io = options.fs || fs, env = options.env || process.env, platform = options.platform || process.platform;
  const query = options.registry || registry, now = options.now || Date.now, p = platform === 'win32' ? path.win32 : path;
  let cached, checkedAt = 0, pending;
  const exists = file => { try { return io.existsSync(file); } catch { return false; } };
  function json(file, limit = 1024 * 1024) { try { if (io.statSync(file).size > limit) return null; return JSON.parse(io.readFileSync(file, 'utf8')); } catch { return null; } }
  const dirs = file => { try { return io.readdirSync(file, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name).slice(0, 100); } catch { return []; } };
  async function scan() {
    const [enginesRegistry, sourceRegistry, launcherRegistry, userEnginesRegistry, windowsSdkRegistry] = platform === 'win32' ? await Promise.all([
      query(['query', 'HKLM\\SOFTWARE\\EpicGames\\Unreal Engine', '/s']),
      query(['query', 'HKCU\\SOFTWARE\\Epic Games\\Unreal Engine\\Builds']),
      query(['query', 'HKCR\\com.epicgames.launcher\\shell\\open\\command', '/ve']),
      query(['query', 'HKCU\\SOFTWARE\\EpicGames\\Unreal Engine', '/s']),
      query(['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots', '/v', 'KitsRoot10'])
    ]) : ['', '', '', ''];
    const candidates = new Set();
    const add = value => { if (typeof value === 'string' && value.length < 2048 && !/[\0\r\n]/.test(value) && p.isAbsolute(value)) candidates.add(p.normalize(value)); };
    const manifest = json(p.join(env.ProgramData || 'C:\\ProgramData', 'Epic/UnrealEngineLauncher/LauncherInstalled.dat'));
    for (const entry of (Array.isArray(manifest?.InstallationList) ? manifest.InstallationList.slice(0, 200) : [])) if (/^UE_[45]\.\d/.test(entry.AppName || '')) add(entry.InstallLocation);
    for (const match of (enginesRegistry+'\n'+userEnginesRegistry).matchAll(/InstalledDirectory\s+REG_SZ\s+([^\r\n]+)/g)) add(match[1].trim());
    for (const line of sourceRegistry.split(/\r?\n/)) { const match = line.match(/\sREG_SZ\s+(.+)$/); if (match) add(match[1].trim()); }
    for (const drive of ['C', 'D', 'E', 'F']) for (const base of ['Program Files\\Epic Games', 'Epic Games', 'EpicGames']) {
      const root = drive + ':\\' + base; for (const dir of dirs(root)) if (/^UE_[45]\.\d+(?:\.\d+)?$/.test(dir)) add(p.join(root, dir));
    }
    const engines = [];
    for (const folder of candidates) {
      const version = json(p.join(folder, 'Engine/Build/Build.version'), 65536);
      if (![4, 5].includes(version?.MajorVersion) || !Number.isInteger(version.MinorVersion) || !Number.isInteger(version.PatchVersion)) continue;
      const major = version.MajorVersion, minor = version.MinorVersion, patch = version.PatchVersion;
      if (minor < 0 || minor > 100 || patch < 0 || patch > 1000) continue;
      const editor = major === 4 ? 'UE4Editor.exe' : 'UnrealEditor.exe';
      if (!exists(p.join(folder, 'Engine/Binaries/Win64', editor)) || !exists(p.join(folder, 'Engine/Build/BatchFiles/RunUAT.bat'))) continue;
      if (exists(p.join(folder, '.egstore/bps/Install')) || exists(p.join(folder, '.egstore/Pending'))) continue;
      engines.push({ version: `${major}.${minor}.${patch}`, folder, major, minor, patch, sourceReady: true, keyboardTarget: major === 4 && minor === 27 });
    }
    engines.sort((a, b) => b.major - a.major || b.minor - a.minor || b.patch - a.patch);
    const engine427 = engines.find(x => x.keyboardTarget), primary = engine427 || engines[0];
    const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || p.join(env.LOCALAPPDATA || '', 'Android/Sdk');
    const ndks = ['21.1.6352462', '21.4.7075529'].filter(version => exists(p.join(sdk, 'ndk', version, 'source.properties')));
    const sdkFound = exists(p.join(sdk, 'platforms/android-30/android.jar')) && exists(p.join(sdk, 'build-tools/30.0.3/aapt2.exe'));
    const jdk = env.JAVA_HOME || env.JDK_HOME || '';
    let javaVersion = '';
    try { const release = io.readFileSync(p.join(jdk, 'release'), 'utf8'); javaVersion = release.match(/^JAVA_VERSION="([^"]+)"/m)?.[1] || ''; } catch { /* An unconfigured JDK is reported separately. */ }
    const javaFound = !!jdk && exists(p.join(jdk, 'bin/javac.exe')) && /^(?:1\.8\.|8[.+])/.test(javaVersion);
    const androidFound = sdkFound && ndks.length > 0 && javaFound;
    const vswhere=p.join(env['ProgramFiles(x86)']||'C:\\Program Files (x86)','Microsoft Visual Studio/Installer/vswhere.exe');
    const cppFolder=platform==='win32'&&exists(vswhere)?String(await (options.visualStudio||visualStudio)(vswhere)).trim():'';
    const windowsCppFound=!!cppFolder&&!/[\0\r\n]/.test(cppFolder)&&p.isAbsolute(cppFolder)&&exists(p.join(cppFolder,'VC/Auxiliary/Build/vcvars64.bat'));
    const windowsSdkRoot=windowsSdkRegistry.match(/KitsRoot10\s+REG_SZ\s+([^\r\n]+)/)?.[1]?.trim()||env.WindowsSdkDir||p.join(env['ProgramFiles(x86)']||'C:\\Program Files (x86)','Windows Kits/10');
    const windowsSdkVersions=dirs(p.join(windowsSdkRoot,'Include')).filter(v=>/^10\.0\.\d+\.0$/.test(v)&&['Include/'+v+'/um/Windows.h','Include/'+v+'/ucrt/stdio.h','Lib/'+v+'/um/x64/kernel32.lib','Lib/'+v+'/ucrt/x64/ucrt.lib','bin/'+v+'/x64/rc.exe','bin/'+v+'/x64/mt.exe'].every(rel=>exists(p.join(windowsSdkRoot,rel))));
    const windowsSdkFound=windowsSdkVersions.length>0;
    const launcherMatch = launcherRegistry.match(/REG_SZ\s+"([^"]+EpicGamesLauncher\.exe)"/i);
    const launcherFound = !!launcherMatch && exists(launcherMatch[1]);
    const issues = [];
    if (!engine427) issues.push(engines.length ? 'An Unreal editor is available for source work. Install Unreal 4.27 alongside it for the current keyboard compatibility target.' : 'Install Unreal Engine through Epic Games Launcher. The current keyboard compatibility target is 4.27.');
    if (!sdkFound) issues.push('The Android SDK 30 and build tools 30.0.3 were not detected.');
    if (!ndks.length) issues.push('An Android NDK 21 installation was not detected.');
    if (!javaFound) issues.push(javaVersion ? `Java ${javaVersion} is configured. The current 4.27 device target needs JDK 8.` : 'JDK 8 configured through JAVA_HOME or JDK_HOME was not detected.');
    if(!windowsCppFound)issues.push('Visual Studio 2019 C++ build tools were not detected. They are needed to compile the native source plugins.');
    issues.push('A native source build, device loading and input compatibility still require verification.');
    checkedAt = now();
    cached = { engineFound: !!primary, engineVersion: primary?.version || null, engineFolder: primary?.folder || '', androidFound, engines,
      engine427Found: !!engine427, ue5Found: engines.some(x => x.major === 5), launcherFound, windowsCppFound, windowsSdkFound, windowsSdkVersions,
      status: !engines.length ? 'missing' : !engine427 ? 'source-only' : !androidFound ? 'android-missing' : 'engine-ready',
      android: { sdkFound, ndks, javaFound, javaVersion }, issues, checkedAt, downloadUrl: DOWNLOAD_URL, launcherUrl: LAUNCHER_URL,
      verifiedBuild: false, keyboardCompatibilityVerified: false, canBuildKeyboardPak: false };
    return cached;
  }
  async function detect({force=false}={}) {
    if (!force && cached && now() - checkedAt < CACHE_MS) return cached;
    if (!pending) pending = scan().finally(() => { pending = null; });
    return pending;
  }
  return { detect };
}
const detector = createDetector();
async function openSetup(openExternal, detect = detector.detect) {
  const result = await detect();
  if (result.launcherFound) {
    try { await openExternal(LAUNCHER_URL); return { opened: 'launcher' }; } catch { /* OS handler failed: offer Epic's official website. */ }
  }
  await openExternal(DOWNLOAD_URL); return { opened: 'website' };
}
module.exports = { detect: detector.detect, createDetector, openSetup, DOWNLOAD_URL, LAUNCHER_URL };
