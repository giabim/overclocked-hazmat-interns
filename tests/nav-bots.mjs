import assert from "node:assert/strict";
import {fixture,simModule} from "./sim-harness.mjs";
const {advance}=await simModule("tick"),{hitsWall,mapForId}=await simModule("map");
const {world}=await fixture();world.monsters=[];const start=world.room.sim_at,map=mapForId(world.room.map_id);
let stuckMax=0;const watches=new Map(world.players.filter(p=>p.is_bot).map(p=>[p.id,{x:p.x,y:p.y,since:start,score:0}]));
for(let t=500;t<=180000;t+=500){advance(world,start+t);for(const p of world.players.filter(p=>p.is_bot)){
 assert.equal(hitsWall(map,p.x,p.y),false);const watch=watches.get(p.id);
 if(Math.hypot(p.x-watch.x,p.y-watch.y)>10||p.score!==watch.score){watch.x=p.x;watch.y=p.y;watch.since=start+t;watch.score=p.score;}else stuckMax=Math.max(stuckMax,start+t-watch.since);
}}
assert.equal(world.room.status,"results");const bots=world.players.filter(p=>p.is_bot);assert.ok(bots.every(p=>p.score>0),JSON.stringify(bots.map(p=>({id:p.id,score:p.score,x:p.x,y:p.y}))));
assert.ok(stuckMax<=3000,`bot stuck ${stuckMax}ms`);console.log(`PASS: seven mixed-level bots each deliver in the maze over three minutes, no wall clipping, longest stationary interval ${stuckMax}ms, ${bots.reduce((n,p)=>n+p.score,0)} deliveries`);
