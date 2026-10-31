import ts from "typescript";
import {readFile,writeFile,mkdir,readdir} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
const output=path.resolve(".sites-runtime/render-test");await mkdir(path.join(output,"render/three"),{recursive:true});
async function compileFolder(folder){
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const file=path.join(folder,entry.name);if(entry.isDirectory()){await compileFolder(file);continue;}if(!entry.name.endsWith(".ts"))continue;
  const destination=path.join(output,path.relative("lib",file).replace(/\.ts$/,".mjs"));await mkdir(path.dirname(destination),{recursive:true});
  const source=(await readFile(file,"utf8")).replace(/(from\s*|import\s*\()(["'])(\.[^"']+?)(["'])/g,(_,prefix,quote,p,close)=>`${prefix}${quote}${p}.mjs${close}`);
  await writeFile(destination,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
 }
}
await compileFolder("lib");
export const moduleFor=name=>import(pathToFileURL(path.join(output,name+".mjs")).href);
