// Explicitly requested isolated software-WebGL regression harness; no user session.
import {createRequire} from "node:module";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
const require=createRequire(import.meta.url),{chromium}=require("playwright");
const {build}=require(createRequire(require.resolve("vite")).resolve("esbuild"));
export async function gpuHarness(){
 const dir=path.resolve(".sites-runtime/gpu-test");await mkdir(dir,{recursive:true});
 const source=`import {ThreeRenderer} from ${JSON.stringify(path.resolve("lib/render/three/arena3d.ts"))};
 const stage=document.querySelector('#stage'),renderer=new ThreeRenderer(message=>{window.failure=message});renderer.mount(stage);renderer.resize(1012,632);if(new URLSearchParams(location.search).get("quality")==="potato")renderer.setTier("potato");
 const view={time:1000,dt:.016,worldNow:1000,status:'running',mode:'breach',secondsLeft:150,input:{x:0,y:0},events:[],reducedMotion:false,players:Array.from({length:8},(_,i)=>({id:String(i),name:'Intern '+i,x:840+(i%4)*75,y:600+Math.floor(i/4)*85,color:['#e8fa79','#91ddfa','#f7a8c6','#bda4fa'][i%4],isSelf:!i,isBot:!!i,level:1,connected:true,carrying:i===1,score:0})),anomalies:Array.from({length:8},(_,i)=>({id:'a'+i,x:840+(i%4)*75,y:720+Math.floor(i/4)*75,visible:true})),monsters:Array.from({length:4},(_,i)=>({id:'m'+i,kind:i%2?'hound':'slime',x:1000+i*40,y:650,state:i===1?'WindUp':i===2?'Frozen':'Patrol',aim:0,frozenUntil:0,until:0})),pickups:[],grenades:[]};
 window.fixture={renderer,view,async measure(count=90){const cpu=[],frames=[];let last=performance.now();for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-last);last=now;view.time=now;view.worldNow=now;view.players[0].x=840+Math.sin(now*.001)*30;const start=performance.now();renderer.frame(view);cpu.push(performance.now()-start);}renderer.frame(view);const canvas=stage.querySelector('canvas'),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const c=copy.getContext('2d');c.drawImage(canvas,0,0);const pixels=c.getImageData(0,0,copy.width,copy.height).data;let brightness=0,lit=0;for(let i=0;i<pixels.length;i+=4){const value=(pixels[i]+pixels[i+1]+pixels[i+2])/3;brightness+=value;if(value>10)lit++;}const q=(a,p)=>a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];return{...renderer.stats(),brightness:brightness/(pixels.length/4),litFraction:lit/(pixels.length/4),cpuMedian:q(cpu,.5),cpuMax:Math.max(...cpu),frameP95:q(frames,.95),fpsFloor:1000/q(frames,.95)};}};`;
 await writeFile(path.join(dir,"fixture.ts"),source);const out=await build({entryPoints:[path.join(dir,"fixture.ts")],bundle:true,write:false,format:"iife",platform:"browser",target:"es2022",logLevel:"silent"});
 await writeFile(path.join(dir,"test.html"),`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#18211e}#stage{width:1012px;height:632px;position:relative}canvas{position:absolute;left:0;top:0}</style></head><body><div id="stage"></div><script>${out.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`);
 const browser=await chromium.launch({headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:2});
 return{browser,page,url:pathToFileURL(path.join(dir,"test.html")).href,dir};
}
