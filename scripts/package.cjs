const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const target = path.resolve(root, '..', 'CenterpieceCompanion-Community-0.3-preview');
if (fs.existsSync(target)) throw new Error('Output already exists. Choose a new output directory before packaging.');
fs.cpSync(path.join(root, 'node_modules/electron/dist'), target, { recursive: true });
fs.renameSync(path.join(target, 'electron.exe'), path.join(target, 'CenterpieceCompanion.exe'));
const appRoot = path.join(target, 'resources/app');
fs.mkdirSync(appRoot, { recursive: true });
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(appRoot, 'package.json'), JSON.stringify({ name: metadata.name, version: metadata.version, main: metadata.main, license: metadata.license }, null, 2));
for (const item of ['src', 'README.md', 'PLUGIN-GUIDE.md', 'LICENSE', 'PRODUCT.md', 'PRIVACY.md']) fs.cpSync(path.join(root, item), path.join(appRoot, item), { recursive: true });
const npmCLI = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const dirs = execFileSync(process.execPath, [npmCLI, 'ls', '--omit=dev', '--all', '--parseable'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).slice(1);
for (const dir of dirs) {
  const relative = path.relative(root, dir);
  if (relative.startsWith('..') || !relative.startsWith('node_modules')) throw new Error('Unexpected dependency path');
  fs.cpSync(dir, path.join(appRoot, relative), { recursive: true });
}
fs.copyFileSync(path.join(root, 'README.md'), path.join(target, 'START-HERE.md'));
console.log(`Packaged ${target}`);
