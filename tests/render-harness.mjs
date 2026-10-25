import ts from "typescript";
import {readFile,writeFile,mkdir,readdir} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
const output=path.resolve(".sites-runtime/render-test");await mkdir(path.join(output,"render/three"),{recursive:true});
for(const folder of ["lib","lib/render","lib/render/three"]){
  for(const name of await readdir(folder)){
    if(!name.endsWith(".ts"))continue;
    const destination=path.join(output,path.relative("lib",folder),name.replace(/\.ts$/,".mjs"));
    const source=(await readFile(path.join(folder,name),"utf8")).replace(/(from\s*|import\s*\()(["'])(\.[^"']+?)(["'])/g,(_,prefix,quote,p,close)=>`${prefix}${quote}${p}.mjs${close}`);
    await writeFile(destination,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  }
}
export const moduleFor=name=>import(pathToFileURL(path.join(output,name+".mjs")).href);
