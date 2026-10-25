import assert from "node:assert/strict";
import {PerspectiveCamera,Vector3} from "three";
import {moduleFor} from "./render-harness.mjs";
const {toScene,toWorld,UNIT_PX}=await moduleFor("render/coords");
const {fitCamera,fitPoints}=await moduleFor("render/three/camera");
assert.equal(UNIT_PX,40);assert.deepEqual(toScene(480,300),{x:0,z:0});
assert.deepEqual(toScene(0,0),{x:-12,z:-7.5});assert.deepEqual(toScene(960,600),{x:12,z:7.5});
assert.deepEqual(toScene(850,180),{x:9.25,z:-3});assert.deepEqual(toScene(946,420),{x:11.65,z:3});
for(const [x,y] of [[32,32],[928,568],[480,300],[211.8,155.9]])assert.deepEqual(toWorld(...Object.values(toScene(x,y))),{x,y});
for(const aspect of [.1,.56,1,1.4,1.6,2.2,4]){
 const camera=new PerspectiveCamera();fitCamera(camera,aspect);
 for(const point of fitPoints){const p=point.clone().project(camera);assert.ok(Math.abs(p.x)<=1.000001&&Math.abs(p.y)<=1.000001&&p.z>=-1&&p.z<=1,`${aspect}: ${p.toArray()}`);}
 for(const [x,y] of [[480,300],[32,32],[928,568]]){
  const position=toScene(x,y),up=toScene(x,y-10),right=toScene(x+10,y);
  const before=new Vector3(position.x,0,position.z).project(camera);
  assert.ok(new Vector3(up.x,0,up.z).project(camera).y>before.y,"W / dy=-1 moves up on screen");
  assert.ok(new Vector3(right.x,0,right.z).project(camera).x>before.x,"D / dx=1 moves right on screen");
 }
 assert.equal(camera.position.x,0,"camera yaw remains fixed");
}
console.log("PASS: world/scene conversion, corners/exit/round trips, whole-arena fit including carried canisters, W/D mapping at seven aspect ratios");
