// Executes the actual API source against SQLite through the D1 interface.
// The adapter serializes each batch as one transaction, like D1.
import { DatabaseSync } from "node:sqlite";
import { readFile,writeFile,mkdir,readdir } from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";
import ts from "typescript";
const output=path.resolve(".sites-runtime/handler-test");await mkdir(output,{recursive:true});
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
for(const name of ["game","bot-settings","room-engine","movement-sync"]){
 let text=await readFile(`lib/${name}.ts`,"utf8");text=text.replaceAll('"./game"','"./game.mjs"').replaceAll('"./bot-settings"','"./bot-settings.mjs"');
 await writeFile(path.join(output,`${name}.mjs`),compile(text));
}
await writeFile(path.join(output,"env.mjs"),"export const env = {};\n");
let route=(await readFile("app/api/room/route.ts","utf8")).replace('"cloudflare:workers"','"./env.mjs"');
for(const name of ["game","bot-settings","room-engine"])route=route.replace(`"../../../lib/${name}"`,`"./${name}.mjs"`);
await writeFile(path.join(output,"route.mjs"),compile(route));
const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys = ON");
for(const filename of (await readdir("drizzle")).filter(x=>x.endsWith(".sql")).sort())sqlite.exec(await readFile(`drizzle/${filename}`,"utf8"));
class Prepared{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Prepared(this.sql,args);}
 async first(column){const row=sqlite.prepare(this.sql).get(...this.args);return column?row?.[column]??null:row??null;}
 async all(){return{results:sqlite.prepare(this.sql).all(...this.args),success:true};}
 execute(){const statement=sqlite.prepare(this.sql);if(statement.columns().length)return{results:statement.all(...this.args),success:true,meta:{changes:0}};const r=statement.run(...this.args);return{results:[],success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
 async run(){return this.execute();}
}
let batchCalls=0;let lastBatchSize=0;
const {env}=await import(pathToFileURL(path.join(output,"env.mjs")).href);
env.DB={prepare:sql=>new Prepared(sql),async batch(statements){batchCalls++;lastBatchSize=statements.length;sqlite.exec("BEGIN");try{const results=statements.map(s=>s.execute());sqlite.exec("COMMIT");return results;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
const {POST}=await import(pathToFileURL(path.join(output,"route.mjs")).href);
export const {MovementSync,pollDelay}=await import(pathToFileURL(path.join(output,"movement-sync.mjs")).href);
export const transport=async(url,options)=>POST(new Request(url,options));
export const inspect=(sql,...args)=>sqlite.prepare(sql).all(...args);
export const execute=(sql,...args)=>sqlite.prepare(sql).run(...args);
export const metrics=()=>({batchCalls,lastBatchSize});
const realNow=Date.now.bind(Date);let testNow;
export function advanceTime(ms){testNow??=realNow();testNow+=ms;Date.now=()=>testNow;return testNow;}
