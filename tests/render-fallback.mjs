import assert from "node:assert/strict";
import {moduleFor} from "./render-harness.mjs";
const {RendererController}=await moduleFor("render/controller");
const {selectView,FrameHealth}=await moduleFor("render/select");
const {Resources}=await moduleFor("render/three/resources");
const frame={time:0,dt:.016,status:"running",players:[],anomalies:[],events:[],input:{x:0,y:0},secondsLeft:180,reducedMotion:false,grabPending:false};
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};globalThis.window={devicePixelRatio:1};
assert.equal(selectView("",null),"2d");assert.equal(selectView("","3d"),"3d");
assert.equal(selectView("?view=2d","3d"),"2d");assert.equal(selectView("?view=3d","2d"),"3d");assert.equal(selectView("?view=invalid",null),"2d");
class Fake{
 constructor(kind,fail=""){this.kind=kind;this.fail=fail;this.drawn=0;this.disposed=false;}
 mount(){if(this.fail==="mount")throw Error("WebGL unavailable");}resize(){}frame(){if(this.fail==="frame")throw Error("Draw error");this.drawn++;}dispose(){this.disposed=true;}
}
function setup(load3d,timeoutMs=100){let current;const classic=[];const controller=new RendererController(state=>current=state,()=>{},{classic:()=>{const r=new Fake("2d");classic.push(r);return r;},load3d,timeoutMs});controller.mount({},"2d");controller.resize(960,600);controller.frame(frame);return{controller,classic,state:()=>current};}
for(const load of [async()=>{throw Error("Chunk unavailable");},async()=>()=>new Fake("3d","mount"),()=>new Promise(()=>{})]){
 const t=setup(load,10);await t.controller.choose("3d");assert.equal(t.state().kind,"2d");assert.ok(t.state().notice);t.controller.frame(frame);assert.ok(t.classic[0].drawn>=2);t.controller.dispose();assert.ok(t.classic[0].disposed);
}
let failContext;const three=new Fake("3d");const success=setup(async()=>failure=>{failContext=failure;return three;});
await success.controller.choose("3d");assert.equal(success.state().kind,"3d");assert.ok(success.classic[0].disposed);
failContext("Context lost");assert.equal(success.state().kind,"2d");assert.ok(three.disposed);assert.ok(success.classic[1].drawn);success.controller.dispose();
const resizer=new Fake("3d");const resizing=setup(async()=>()=>resizer);await resizing.controller.choose("3d");resizer.resize=()=>{throw Error("Resize failure");};resizing.controller.resize(320,200);assert.equal(resizing.state().kind,"2d");resizing.controller.dispose();
// The real controller keeps the last successful 3D frame for the first two errors.
let bad=false;const intermittent=new Fake("3d");intermittent.frame=()=>{if(bad)throw Error("Bad frame");};
const e=setup(async()=>()=>intermittent);await e.controller.choose("3d");bad=true;e.controller.frame(frame);e.controller.frame(frame);assert.equal(e.state().kind,"3d");e.controller.frame(frame);assert.equal(e.state().kind,"2d");e.controller.dispose();
let resolve;const cancellation=setup(()=>new Promise(r=>resolve=r));const choosing=cancellation.controller.choose("3d");await cancellation.controller.choose("2d");let constructed=false;resolve(()=>{constructed=true;return new Fake("3d");});await choosing;assert.equal(constructed,false);assert.equal(cancellation.state().kind,"2d");cancellation.controller.dispose();
const health=new FrameHealth();let fellBack=false;for(let t=0;t<8000;t+=50)fellBack=health.observe(t)||fellBack;assert.ok(fellBack);health.reset();for(let t=0;t<10000;t+=16)assert.equal(health.observe(t),false);
const r=new Resources();let disposed=0;const resource={dispose:()=>disposed++};r.own(resource);r.own(resource);r.dispose();r.dispose();assert.equal(disposed,1);
console.log("PASS: safe default/URL/preference selection, failed import/WebGL mount/timeout, context-loss recovery, three-error fallback, cancellation, sustained-slow-frame guard, idempotent resource cleanup");
