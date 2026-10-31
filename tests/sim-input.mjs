import assert from "node:assert/strict";
import {fixture,simModule} from "./sim-harness.mjs";
const {advance}=await simModule("tick"),{hitsWall,mapForId}=await simModule("map");
const {world}=await fixture("breach",2),p=world.players.find(p=>!p.is_bot),start=world.room.sim_at;world.players=[p];world.monsters=[];p.x=280;p.y=520;p.pos_epoch=2;p.stun_until=start+1000;
function input(at,data){p.input_seq=p.seq+1;p.input_at=at;p.input_json=JSON.stringify({seq:p.input_seq,dx:1,dy:0,interactSeq:0,posEpoch:p.pos_epoch,...data});advance(world,at);}
input(start+500,{x:1500,y:600,posEpoch:1});assert.equal(p.x,280);assert.equal(p.y,520);
input(start+1100,{x:1500,y:600,posEpoch:1});assert.ok(p.x>280&&p.x<=303,`Only the 100ms after stun contributes movement: ${p.x}`);assert.equal(p.y,520);
const map=mapForId(world.room.map_id);p.x=440;p.y=120;p.stun_until=0;p.last_at=start+1100;input(start+1600,{x:620,y:120,dx:1});assert.ok(p.x<=461);assert.equal(hitsWall(map,p.x,p.y),false);
p.x=200;p.y=600;p.last_at=start+1600;const a=world.anomalies[0];a.x=210;a.y=600;a.respawn_at=0;a.carrier_id=null;input(start+1650,{x:210,y:600,interactSeq:17});assert.equal(a.carrier_id,p.id);const score=p.score;input(start+1700,{x:210,y:600,interactSeq:17});assert.equal(a.carrier_id,p.id);assert.equal(p.score,score);
console.log("PASS: stale position epochs cannot teleport through a catch, stun time grants no movement credit, server wall sweep blocks teleport, and action sequence replay does not drop a held canister");
