import assert from "node:assert/strict";
import {fixture,simModule} from "./sim-harness.mjs";
const {advance}=await simModule("tick");const {world}=await fixture();world.rng=1234;
const a=structuredClone(world),b=structuredClone(world),start=world.room.sim_at;
for(let t=500;t<=10000;t+=500){advance(a,start+t);advance(b,start+t);}
assert.deepEqual(a,b);console.log("PASS: deterministic fixed-step replay for mixed-level bots, specimens, pickups and scoring with a fixed seed");
