// Golden drawing-command fingerprint captured from the pre-refactor renderer.
// This checks identical placement/styles for overlaps, edges, carriers and bots.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {moduleFor} from "./render-harness.mjs";
export function recordingContext(){
 const commands=[],values={},stack=[];
 const methods=new Set(["setTransform","fillRect","beginPath","moveTo","lineTo","stroke","strokeRect","setLineDash","arc","ellipse","fill","fillText","clearRect"]);
 const context=new Proxy({}, {set(_,key,value){if(values[key]!==value){values[key]=value;commands.push([key,value]);}return true;},get(_,key){
  if(key==="measureText")return text=>({width:text.length*7});
  if(key==="save")return()=>{stack.push({...values});commands.push(["save"]);};
  if(key==="restore")return()=>{const old=stack.pop();for(const k of Object.keys(values))delete values[k];Object.assign(values,old);commands.push(["restore"]);};
  if(methods.has(key))return(...args)=>commands.push([key,...args]);return values[key];
 }});return {context,commands};
}
export const fixture={time:500,dt:.016,status:"running",secondsLeft:120,input:{x:0,y:0},grabPending:false,reducedMotion:false,events:[],
 players:Array.from({length:8},(_,i)=>({id:String(i),name:i===2?"Clumsy Bot":"Intern "+i,color:["#e8fa79","#91ddfa","#f7a8c6","#bda4fa"][i%4],x:[32,160,160,160,480,480,928,928][i],y:[32,300,300,300,568,568,32,568][i],isSelf:i===0,isBot:i===2,level:1,carrying:i===3,connected:i!==7,score:i})),
 anomalies:[{id:"a",x:210,y:155,visible:true},{id:"b",x:570,y:445,visible:false}]};
if(!process.argv.includes("--fixture-only")){
 const {Canvas2DRenderer}=await moduleFor("render/canvas2d");const {context,commands}=recordingContext();
 let removed=false;const canvas={width:0,height:0,dataset:{},setAttribute(){},getContext:()=>context,remove:()=>removed=true};
 globalThis.document={createElement:()=>canvas};globalThis.window={devicePixelRatio:1};
 const renderer=new Canvas2DRenderer();renderer.mount({appendChild(){}});renderer.resize(960,600);renderer.frame(fixture);
 const hash=createHash("sha256").update(JSON.stringify(commands)).digest("hex");
 assert.equal(hash,"4b96484118895cdd8c266e0b5f1b17f09b9390b3032a464ba465c5c5cf2db2f6","Classic 2D drawing commands changed");renderer.dispose();assert.ok(removed);
 console.log("PASS: Classic 2D matches the baseline drawing-command fingerprint for eight players, labels, walls and canisters; dispose removes canvas");
}
