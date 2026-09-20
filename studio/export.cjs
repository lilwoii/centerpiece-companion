const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Model = require('./model.js');
const Native = require('./native-compatibility.cjs');
const SDK_ROOT = path.resolve(__dirname, '../sdk');
const MAX_BUNDLE_BYTES = 40 * 1024 * 1024;
const PLUGIN = 'Unreal/Plugins/CenterpieceSkinStudio/';
const MODULE = PLUGIN + 'Source/CenterpieceSkinStudio/';
// Deliberate source inventory. Adding a local file to sdk/ never silently adds
// it to a community export; new SDK assets must be reviewed into this list.
const SDK_FILES = Object.freeze([
  'README.md', 'COMPATIBILITY.md', 'LICENSE', 'Unreal/SkinStudioPreview.uproject',
  'Unreal/Config/DefaultEngine.ini', 'Unreal/Config/DefaultInput.ini',
  'Unreal/Source/SkinStudioPreview.Target.cs', 'Unreal/Source/SkinStudioPreviewEditor.Target.cs',
  'Unreal/Source/SkinStudioPreview/SkinStudioPreview.Build.cs', 'Unreal/Source/SkinStudioPreview/SkinStudioPreview.cpp',
  PLUGIN + 'CenterpieceSkinStudio.uplugin', MODULE + 'CenterpieceSkinStudio.Build.cs',
  MODULE + 'Public/SkinStudioRuntime.h', MODULE + 'Public/SkinStudioPreviewActors.h',
  MODULE + 'Private/CenterpieceSkinStudio.cpp', MODULE + 'Private/SkinStudioRuntime.cpp',
  MODULE + 'Private/SkinStudioPreviewActors.cpp', MODULE + 'Private/Tests/SkinStudioRuntimeTests.cpp',
  MODULE + 'Public/SkinStudioCollectionScene.h', MODULE + 'Private/SkinStudioCollectionScene.cpp',
  'Device/CenterpieceDevice.uproject', 'Device/README.md', 'Device/SKINAPI-LICENSE.txt',
  'Device/Config/DefaultEngine.ini', 'Device/Config/DefaultGame.ini',
  'Device/Tools/generate_device.py', 'Device/Tools/device_materials.py', 'Device/Tools/device_composite.py', 'Device/Tools/device_particles.py', 'Device/Tools/device_text.py', 'Device/Tools/device_patterns.py', 'Device/Tools/device_games.py', 'Device/Tools/device_prism.py', 'Device/Tools/device_orbit.py', 'Device/Tools/device_collections.py',
  'Device/Plugins/SkinApi/SkinApi.uplugin', 'Device/Plugins/SkinApi/Source/SkinApi.Build.cs',
  'Device/Plugins/SkinApi/Source/Public/KeyEventReceiver.h', 'Device/Plugins/SkinApi/Source/Public/SkinCreatorLibrary.h',
  'Device/Plugins/SkinApi/Source/Private/SkinApi.cpp',
  'Device/Plugins/SkinStudioDeviceBuilder/SkinStudioDeviceBuilder.uplugin',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/SkinStudioDeviceBuilder.Build.cs',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/Public/SkinStudioDeviceBuilder.h',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/Private/SkinStudioDeviceBuilder.cpp',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/Private/LayerBlueprintBuilder.cpp',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/Private/ParticleMeshBuilder.cpp',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/Private/GameBlueprintLogic.inl',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/Private/PrismBlueprintLogic.inl',
  'Device/Plugins/SkinStudioDeviceBuilder/Source/Private/HeatmapBlueprintLogic.inl'
]);
function sdkFiles() {
  if (fs.lstatSync(SDK_ROOT).isSymbolicLink()) throw new Error('The local SDK source directory cannot be a symbolic link.');
  return SDK_FILES.map(name => {
    const file = path.resolve(SDK_ROOT, ...name.split('/'));
    if (!file.startsWith(SDK_ROOT + path.sep)) throw new Error('The local SDK source path is invalid.');
    let current = SDK_ROOT;
    for (const component of name.split('/')) { current = path.join(current, component); if (fs.lstatSync(current).isSymbolicLink()) throw new Error('SDK source paths cannot contain symbolic links.'); }
    const info = fs.statSync(file); if (!info.isFile() || info.size > 1024 * 1024) throw new Error('An SDK template is not a supported source file.');
    return { path: name, content: fs.readFileSync(file, 'utf8'), encoding: 'utf8' };
  });
}
function exportBundle(input) {
  const project = Model.validate(input), json = JSON.stringify(project, null, 2) + '\n';
  if (Buffer.byteLength(json, 'utf8') > Model.limits.projectBytes) throw Object.assign(new Error('The project exceeds the 32 MiB source export limit.'), { code: 'EXPORT_TOO_LARGE' });
  const warnings = [
    'Source export only: no cooked .pak or installable keyboard skin is produced.',
    'Unreal C++ source has not been compiled here; Finalmouse runtime ABI, cooker and hardware loading remain unverified.',
    'The native Canvas scaffold approximates browser effects; advanced blend modes and embedded images need native rendering work.'
  ];
  if (project.engineTarget === '5.x') warnings.push('UE5 is a source portability target. Select a specific installed UE5 version and rebuild; its cooked assets are not assumed compatible with this keyboard.');
  if (project.layers.some(layer => layer.type === 'image')) warnings.push('Images are also exported to project/images with an import manifest. Import these files as Unreal textures; the native scaffold does not load them automatically.');
  if (project.layers.some(layer => layer.type === 'text')) warnings.push('Desktop font faces, text alignment and weight are preserved in JSON. The native Canvas scaffold uses its default Unreal font and needs a matching text renderer for visual parity.');
  const files = sdkFiles();
  const capabilities = Native.describe(project);
  for (const id of capabilities.previewOnlyScenes) warnings.push(id + ': browser animation and game logic still need native Unreal implementations before keyboard use.');
  if (capabilities.previewOnlyBehaviors.length) warnings.push('Unverified native behavior: ' + capabilities.previewOnlyBehaviors.join(', ') + '. Browser references are included; these behaviors do not yet have verified device builds.');
  for (const name of ['model.js','render.js','interactions.js','motion.js','space-effects.js','collection-effects.js','collection-v2-effects.js','games.js']) {
    const file = path.join(__dirname, name), stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024*1024) throw new Error('A browser reference is not a supported source file.');
    files.push({path:'Reference/Browser/'+name,content:fs.readFileSync(file,'utf8'),encoding:'utf8'});
  }
  const descriptor = files.find(file => file.path === 'Unreal/SkinStudioPreview.uproject');
  const parsed = JSON.parse(descriptor.content); parsed.EngineAssociation = project.engineTarget === '4.27' ? '4.27' : '';
  descriptor.content = JSON.stringify(parsed, null, 2) + '\n';
  const physicalCodes=['Escape',...Array.from({length:10},(_,i)=>'Digit'+((i+1)%10)),'Minus','Equal','Backspace','MediaTrackPrevious','MediaTrackNext','Tab',...'QWERTYUIOP'.split('').map(c=>'Key'+c),'BracketLeft','BracketRight','Backslash','MediaPlayPause','AudioVolumeMute','CapsLock',...'ASDFGHJKL'.split('').map(c=>'Key'+c),'Semicolon','Quote','Enter','ShiftLeft',...'ZXCVBNM'.split('').map(c=>'Key'+c),'Comma','Period','Slash','ShiftRight','ArrowUp','ControlLeft','MetaLeft','AltLeft','Space','AltRight','ContextMenu','ControlRight','ArrowLeft','ArrowDown','ArrowRight'];
  const keyboardGeometry=require('../src/layout.json');if(physicalCodes.length!==keyboardGeometry.keys.length)throw Error('Keyboard geometry does not match the Studio key selection.');
  files.push({path:'project/keyboard-layout.json',content:JSON.stringify({...keyboardGeometry,keys:keyboardGeometry.keys.map((k,i)=>({...k,code:physicalCodes[i]}))}),encoding:'utf8'});
  files.push({ path: 'project/skin-studio.project.json', content: json, encoding: 'utf8' });
  files.push({ path: 'Unreal/Content/Studio/Scene.json', content: json, encoding: 'utf8' });
  const images = new Map();
  for (const layer of project.layers) {
    if (!layer.image) continue;
    const info = Model.rasterInfo(layer.image), match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(layer.image);
    const bytes = Buffer.from(match[2], 'base64'), hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const imagePath = 'project/images/' + hash + '.' + (match[1] === 'jpeg' ? 'jpg' : match[1]);
    if (!images.has(hash)) {
      images.set(hash, { path: imagePath, sha256: hash, mimeType: 'image/' + match[1], width: info.width, height: info.height, layerIds: [] });
      files.push({ path: imagePath, content: bytes.toString('base64'), encoding: 'base64' });
    }
    images.get(hash).layerIds.push(layer.id);
  }
  files.push({ path: 'project/image-manifest.json', content: JSON.stringify({ version: 1, images: [...images.values()], instructions: 'Import image files into Unreal Content Browser as textures. Use layerIds to bind them to your native renderer. No native texture references are created automatically.' }, null, 2) + '\n', encoding: 'utf8' });
  files.push({ path: 'export-manifest.json', content: JSON.stringify({ format: 'centerpiece-community-source-export', version: 1, projectName: project.name, engineTarget: project.engineTarget, sceneSha256: crypto.createHash('sha256').update(json).digest('hex'), ...capabilities, nativeBuildVerified: false, keyboardCompatibilityVerified: false, cookedPakIncluded: false, warnings }, null, 2) + '\n', encoding: 'utf8' });
  const names = new Set(); let bytes = 0;
  for (const file of files) {
    if (!/^[A-Za-z0-9_./-]+$/.test(file.path) || file.path.startsWith('/') || file.path.split('/').some(part => !part || part === '..' || part === '.') || names.has(file.path)) throw new Error('An export path failed validation.');
    names.add(file.path); bytes += Buffer.byteLength(file.content, file.encoding === 'base64' ? 'base64' : 'utf8');
  }
  if (bytes > MAX_BUNDLE_BYTES) throw Object.assign(new Error('The source bundle exceeds 40 MiB. Reduce embedded image sizes before exporting.'), { code: 'EXPORT_TOO_LARGE' });
  return { files, warnings };
}
module.exports = { exportBundle, MAX_BUNDLE_BYTES, SDK_FILES };
