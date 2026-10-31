import assert from "node:assert/strict";
import {fixture,simModule} from "./sim-harness.mjs";
const {fireFoam,freeze,advanceWeapons,throwGrenade,recharge,historicalPosition}=await simModule("weapons"),{monsterStep}=await simModule("monsters");
const {world}=await fixture("breach",2),p=world.players.find(p=>!p.is_bot),m=world.monsters[0],now=world.room.sim_at+100;
p.x=200;p.y=600;m.x=300;m.y=600;m.state="Patrol";m.history=[{at:now-350,x:300,y:600},{at:now,x:500,y:600}];p.charge_at=now;p.foam_charges=5;
assert.equal(fireFoam(world,p,now,{aim:0,viewDelayMs:900,rttMs:1000}),true);assert.equal(m.state,"Frozen");assert.equal(p.foam_charges,4);assert.equal(m.frozenUntil,now+2500);assert.equal(fireFoam(world,p,now+200,{aim:0}),false);assert.deepEqual(historicalPosition(m,now-175),{x:400,y:600});
const score=p.score;freeze(world,m,p.id,now+900,2500);freeze(world,m,p.id,now+1800,2500);assert.equal(m.state,"Contained");assert.equal(p.score,score+2);freeze(world,m,p.id,now+1900,2500);assert.equal(p.score,score+2);monsterStep(world,now+9800,.05);assert.notEqual(m.state,"Contained");
// Walls prevent both foam and grenade splash. Same room positions straddle wall x=480.
p.x=440;p.y=120;m.x=550;m.y=120;m.state="Patrol";m.frozenUntil=0;m.hits=[];m.history=[{at:now+11000,x:550,y:120}];p.foam_ready_at=0;p.foam_charges=5;fireFoam(world,p,now+11000,{aim:0,viewDelayMs:0});assert.notEqual(m.state,"Frozen");
p.x=200;p.y=600;m.x=300;m.y=600;m.history=[{at:now+12000,x:300,y:600}];p.grenades=1;p.throw_seq=1;assert.equal(throwGrenade(world,p,now+12000,0),true);assert.equal(p.grenades,0);const g=world.grenades[0];assert.equal(g.explodeAt,now+12600);m.x=g.x;m.y=g.y;advanceWeapons(world,now+12600);assert.equal(m.state,"Frozen");assert.equal(m.frozenUntil,now+16100);assert.equal(world.grenades.length,0);
p.foam_charges=0;p.charge_at=now;recharge(p,now+7500);assert.equal(p.foam_charges,5);
const other=world.players.find(q=>q.id!==p.id);other.x=p.x+60;other.y=p.y;world.room.chaos=0;p.foam_ready_at=0;fireFoam(world,p,now+20000,{aim:0});assert.equal(other.slow_until,0);world.room.chaos=1;p.foam_ready_at=0;const epoch=other.pos_epoch;fireFoam(world,p,now+21000,{aim:0});assert.equal(other.slow_until,now+22500);assert.equal(other.pos_epoch,epoch+1);
console.log("PASS: foam rewind capped at 350ms, cooldown/charges/recharge, wall occlusion, three-hit exactly-once containment, respawn, grenade fuse/freeze, and optional friendly slow");
