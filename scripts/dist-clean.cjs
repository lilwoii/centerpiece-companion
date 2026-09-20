'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {build,Platform,Arch}=require('electron-builder');
async function main(){
 const root=path.resolve(__dirname,'..'),stage=fs.mkdtempSync(path.join(os.tmpdir(),'centerpiece-release-'));
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 for(const item of ['src','studio','sdk','build','package.json','package-lock.json','README.md','COMMUNITY-PREVIEW.md','PRIVACY.md','LICENSE','PLUGIN-GUIDE.md'])fs.cpSync(path.join(root,item),path.join(stage,item),{recursive:true});
 const npmCLI=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 if(!fs.existsSync(npmCLI))throw Error('Run this packaging command through npm with Node 22.12 or newer.');
 // A real dependency tree prevents junctions in the development workspace from
 // causing electron-builder to omit nested runtime dependencies.
 execFileSync(process.execPath,[npmCLI,'ci','--omit=dev','--ignore-scripts'],{cwd:stage,stdio:'inherit'});
 for(const name of Object.keys(metadata.dependencies))require(require.resolve(name,{paths:[stage]}));
 const output=path.resolve(root,process.argv[2]||metadata.build.directories.output);
 await build({projectDir:stage,targets:Platform.WINDOWS.createTarget(['nsis'],Arch.x64),publish:'never',config:{directories:{output}}});
 console.log('Release artifacts built locally in '+output+'. Nothing was published. Staging: '+stage);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
