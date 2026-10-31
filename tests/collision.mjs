import assert from "node:assert/strict";
import {moduleFor} from "./render-harness.mjs";
const {LAB,mapForId,hitsWall,moveCircle,acceptMove,CELL}=await moduleFor("sim/map");const {random}=await moduleFor("sim/rng");
const seed={rng:123},floor=[];LAB.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=="#")floor.push({x:(x+.5)*CELL,y:(y+.5)*CELL});}));
for(let i=0;i<2000;i++){const from=floor[Math.floor(random(seed)*floor.length)],length=random(seed)*300,angle=random(seed)*Math.PI*2,dx=Math.cos(angle)*length,dy=Math.sin(angle)*length;
 const p=moveCircle(LAB,from.x,from.y,dx,dy);assert.equal(hitsWall(LAB,p.x,p.y),false);
 const accepted=acceptMove(LAB,from,{x:from.x+dx,y:from.y+dy},length);assert.equal(hitsWall(LAB,accepted.x,accepted.y),false);
}
const doorway=moveCircle(LAB,440,280,160,0);assert.ok(doorway.x>590);
const blocked=moveCircle(LAB,440,120,300,0);assert.ok(blocked.x<=461.001);
assert.deepEqual(moveCircle(mapForId("classic"),900,300,100,0),{x:928,y:300});
console.log("PASS: 2,000 seeded moves/proposals never tunnel or end in walls; doorways pass, walls stop, Classic bounds unchanged");
