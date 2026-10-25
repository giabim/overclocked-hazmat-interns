// CPU geometry checks; this does not claim GPU or phone performance validation.
import assert from "node:assert/strict";
import {moduleFor} from "./render-harness.mjs";
const {ThreeRenderer}=await moduleFor("render/three/arena3d");
const renderer=new ThreeRenderer(()=>{});
const geometry=renderer.capsule;geometry.computeBoundingBox();
assert.ok(Math.abs(geometry.boundingBox.min.y+.675)<1e-6);assert.ok(Math.abs(geometry.boundingBox.max.y-.675)<1e-6);
assert.ok(geometry.boundingBox.max.x<=.451);assert.ok(geometry.index.count/3<1000);
for(let i=0;i<8;i++){
 const intern=renderer.makeIntern({id:String(i),color:"#e8fa79",isBot:i>0});
 assert.equal(intern.root.children.length,4);assert.equal(intern.antenna.visible,i>0);assert.equal(intern.held.position.y,1.4);
}
assert.equal(renderer.interns.size,8);renderer.dispose();renderer.dispose();assert.equal(renderer.interns.size,0);
console.log(`PASS: ${geometry.index.count/3} triangles per capsule, intended footprint/height, eight CPU models, carrier/bot markers, repeated scene cleanup (GPU verification separate)`);
