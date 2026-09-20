const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { inspectPak } = require('../studio/pak-inspector.cjs');
const { exportBundle } = require('../studio/export.cjs');
const Model = require('../studio/model.js');
const sha = bytes => crypto.createHash('sha1').update(bytes).digest();
function u32(value) { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; }
function u64(value) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(value)); return b; }
function string(text) { const b = Buffer.from(text + '\0'); return Buffer.concat([u32(b.length), b]); }
function pakFixture(fileName = 'Preview.uasset') {
  const data = Buffer.from('{"EngineAssociation":"4.27","Modules":[{"Name":"spark"}]}');
  const directory = Buffer.concat([u32(1), string('/spark/Content/'), u32(1), string(fileName), u32(0)]);
  const hashes = Buffer.concat([u32(1), u64(10), u32(0)]), entries = Buffer.alloc(12);
  const primary = Buffer.concat([string('../../../'), u32(1), u64(0), u32(1), Buffer.alloc(36), u32(1), Buffer.alloc(36), u32(entries.length), entries, u32(0)]);
  const pointer = string('../../../').length + 4 + 8 + 4;
  u64(data.length + primary.length).copy(primary, pointer); u64(hashes.length).copy(primary, pointer + 8); sha(hashes).copy(primary, pointer + 16);
  const directoryPointer = pointer + 40;
  u64(data.length + primary.length + hashes.length).copy(primary, directoryPointer); u64(directory.length).copy(primary, directoryPointer + 8); sha(directory).copy(primary, directoryPointer + 16);
  const footer = Buffer.alloc(221); footer.writeUInt32LE(0x5a6f12e1, 17); footer.writeUInt32LE(11, 21); footer.writeBigUInt64LE(BigInt(data.length), 25); footer.writeBigUInt64LE(BigInt(primary.length), 33); sha(primary).copy(footer, 41);
  return { bytes: Buffer.concat([data, primary, hashes, directory, footer]), primaryOffset: data.length, primarySize: primary.length, directoryOffset: data.length + primary.length + hashes.length, pointer, directoryPointer };
}
function rehashPrimary(fixture) { sha(fixture.bytes.subarray(fixture.primaryOffset, fixture.primaryOffset + fixture.primarySize)).copy(fixture.bytes, fixture.bytes.length - 221 + 41); }

test('v11 inspector validates three index hashes and lists metadata without executing assets', () => {
  const fixture = pakFixture(), before = Buffer.from(fixture.bytes), result = inspectPak(fixture.bytes);
  assert.equal(result.readOnly, true); assert.equal(result.version, 11); assert.equal(result.entryCount, 1);
  assert.equal(result.index.hashMatches, true); assert.equal(result.pathHashIndex.hashMatches, true); assert.equal(result.directoryIndex.hashMatches, true);
  assert.deepEqual(result.paths, ['spark/Content/Preview.uasset']); assert.equal(result.clues.engineAssociation, '4.27'); assert.deepEqual(result.clues.runtimeModules, ['spark']);
  assert.equal(result.compatibilityVerified, false); assert.deepEqual(fixture.bytes, before);
});

test('corrupt hash, truncated footer, out-of-range offset and overlapping indexes are rejected', () => {
  const corrupt = pakFixture(); corrupt.bytes[corrupt.primaryOffset + 5] ^= 1;
  assert.throws(() => inspectPak(corrupt.bytes), { code: 'PAK_HASH_MISMATCH' });
  assert.throws(() => inspectPak(Buffer.alloc(100)), { code: 'PAK_UNSUPPORTED' });
  const offset = pakFixture(); offset.bytes.writeBigUInt64LE(0xffffffffffffffffn, offset.bytes.length - 221 + 25);
  assert.throws(() => inspectPak(offset.bytes), { code: 'PAK_INVALID' });
  const overlap = pakFixture(); u64(overlap.primaryOffset).copy(overlap.bytes, overlap.primaryOffset + overlap.pointer); rehashPrimary(overlap);
  assert.throws(() => inspectPak(overlap.bytes), /overlap/);
});

test('malicious directory names stay metadata and are never treated as local destinations', () => {
  const result = inspectPak(pakFixture('../../escape.exe').bytes);
  assert.deepEqual(result.unsafePaths, ['spark/Content/../../escape.exe']); assert.match(result.warnings.join(' '), /never uses archive paths/);
});

test('encrypted metadata is reported without decrypting or claiming index verification', () => {
  const fixture = pakFixture(); fixture.bytes[fixture.bytes.length - 221 + 16] = 1;
  const result = inspectPak(fixture.bytes); assert.equal(result.encryptedIndex, true); assert.equal(result.index.hashMatches, null); assert.deepEqual(result.paths, []);
});

test('inspection through a local file leaves bytes and modification time unchanged', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-pak-read-')), file = path.join(directory, 'sample.pak'), original = pakFixture().bytes;
  t.after(() => fs.rmSync(directory, { recursive: true, force: true })); fs.writeFileSync(file, original); const before = fs.statSync(file);
  inspectPak(file); assert.deepEqual(fs.readFileSync(file), original); assert.equal(fs.statSync(file).mtimeMs, before.mtimeMs);
});

test('source bundle preserves the validated scene and exports reusable Unreal code with honest status', () => {
  const project = Model.createProject('Community scene'); project.layers.push(Model.createLayer('wave')); project.rules.push(Model.createRule());
  const original = Model.clone(project), bundle = exportBundle(project), files = new Map(bundle.files.map(file => [file.path, file.content]));
  assert.deepEqual(project, original); assert.deepEqual(JSON.parse(files.get('project/skin-studio.project.json')), Model.validate(project));
  assert.equal(files.get('project/skin-studio.project.json'), files.get('Unreal/Content/Studio/Scene.json'));
  assert.ok(bundle.files.some(file => file.path.endsWith('SkinStudioRuntime.cpp') && file.content.includes('NotifyInput')));
  assert.ok(bundle.files.some(file => file.path.endsWith('SkinStudioRuntimeTests.cpp') && file.content.includes('Keyframe interpolation')));
  assert.equal(JSON.parse(files.get('Unreal/SkinStudioPreview.uproject')).EngineAssociation, '4.27');
  const manifest = JSON.parse(files.get('export-manifest.json')); assert.equal(manifest.cookedPakIncluded, false); assert.equal(manifest.nativeBuildVerified, false); assert.equal(manifest.keyboardCompatibilityVerified, false);
  assert.equal(manifest.sceneSha256, crypto.createHash('sha256').update(files.get('Unreal/Content/Studio/Scene.json')).digest('hex'));
  assert.ok(bundle.files.every(file => !file.path.endsWith('.pak'))); assert.match(bundle.warnings.join(' '), /not been compiled/);
});

test('project text cannot inject source filenames, executable code or ZIP traversal paths', () => {
  const project = Model.createProject('../../outside $(bad) `command`'); project.layers.push(Model.createLayer('text', { text: '#include "evil.h"\n</script>"; system("bad");' }));
  const bundle = exportBundle(project), baseline = exportBundle(Model.createProject());
  assert.deepEqual(bundle.files.map(file => file.path), baseline.files.map(file => file.path));
  for (const file of bundle.files) { assert.ok(!file.path.includes('..')); if (/\.(?:cpp|h|cs)$/.test(file.path)) assert.equal(file.content, baseline.files.find(item => item.path === file.path).content); }
  const scene = JSON.parse(bundle.files.find(file => file.path === 'project/skin-studio.project.json').content); assert.equal(scene.name, project.name); assert.equal(scene.layers[0].text, project.layers[0].text);
  assert.throws(() => exportBundle({ ...project, canvas: { width: 1, height: 1 } }));
});

test('UE5 source export requires selecting a concrete engine rather than inventing a compatible build', () => {
  const project = Model.createProject(); project.engineTarget = '5.x'; const result = exportBundle(project);
  const descriptor = JSON.parse(result.files.find(file => file.path.endsWith('.uproject')).content);
  assert.equal(descriptor.EngineAssociation, ''); assert.match(result.warnings.join(' '), /specific installed UE5 version/);
});
test('source bundle exports original raster bytes once with safe hash names and layer mapping',async()=>{const bytes=await require('sharp')({create:{width:8,height:8,channels:4,background:'#20a0f0'}}).png().toBuffer();const p=Model.createProject(),image='data:image/png;base64,'+bytes.toString('base64');p.layers=[Model.createLayer('image',{image}),Model.createLayer('image',{image})];const bundle=exportBundle(p),assets=bundle.files.filter(f=>f.path.startsWith('project/images/'));assert.equal(assets.length,1);assert.deepEqual(Buffer.from(assets[0].content,assets[0].encoding),bytes);const manifest=JSON.parse(bundle.files.find(f=>f.path==='project/image-manifest.json').content);assert.deepEqual(manifest.images[0].layerIds,p.layers.map(l=>l.id));assert.equal(manifest.images[0].width,8);assert.equal(manifest.images[0].sha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.ok(require('../studio/zip.cjs').zip(bundle.files).length>bytes.length);});

test('collection exports distinguish native scaffolds from preview-only implementations without claiming readiness',()=>{
  const scaffoldIds=['lantern-festival','paper-ocean','neon-speedway','clockwork-garden','prism-bloom','tidal-observatory','alpine-reflection','storm-window','ember-forge','moon-tranquility','atlas-launch'];
  for(const id of Model.collectionScenes){
    const p=Model.createProject(id);p.layers=[Model.createLayer('collection',{text:id})];p.rules=[Model.createRule({target:p.layers[0].id})];
    const bundle=exportBundle(p),files=new Map(bundle.files.map(f=>[f.path,f.content]));
    const scaffold=files.get('Unreal/Plugins/CenterpieceSkinStudio/Source/CenterpieceSkinStudio/Private/SkinStudioCollectionScene.cpp');
    assert.equal(scaffold.includes('TEXT("'+id+'")'),scaffoldIds.includes(id));
    const device=JSON.parse(files.get('Device/CenterpieceDevice.uproject'));
    assert.equal(device.EngineAssociation,'4.27');assert.ok(device.Plugins.some(p=>p.Name==='SkinApi'));
    assert.ok(!device.Plugins.some(p=>p.Name==='CenterpieceSkinStudio'));
    const builder=JSON.parse(files.get('Device/Plugins/SkinStudioDeviceBuilder/SkinStudioDeviceBuilder.uplugin'));
    assert.equal(builder.Modules[0].Type,'Editor');
    assert.doesNotMatch(files.get('Device/Config/DefaultEngine.ini'),/GameInstanceClass/);
    assert.match(files.get('Device/Config/DefaultGame.ini'),/BlueprintNativizationMethod=Disabled/);
    assert.match(files.get('Device/Plugins/SkinApi/Source/Public/KeyEventReceiver.h'),/uint8,HCode,bool,IsActuated,int32,Percentage/);
    assert.match(files.get('Device/Tools/generate_device.py'),/chunk_id=1337/);
    assert.match(files.get('Device/README.md'),/device verification is still in progress/);
    const manifest=JSON.parse(files.get('export-manifest.json'));assert.equal(manifest.cookedPakIncluded,false);assert.equal(manifest.keyboardCompatibilityVerified,false);
    if(['tidal-observatory','cloud-courier','dune-runner','prism-breaker'].includes(id)){assert.deepEqual(manifest.nativeSceneSources,[id]);assert.deepEqual(manifest.previewOnlyScenes,[]);}else{assert.deepEqual(manifest.previewOnlyScenes,[id]);assert.ok(manifest.warnings.some(w=>w.includes(id)&&w.includes('still need native')));assert.ok(files.has('Reference/Browser/games.js'));assert.ok(files.has('Reference/Browser/collection-v2-effects.js'));}
  }
});
