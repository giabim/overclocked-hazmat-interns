import assert from "node:assert/strict";
import {call,sync,transport,setAfterBatch,inspect,advanceTime} from "./sim-harness.mjs";
const host=(await call({action:"create",name:"Breach Host",mode:"breach"})).session,guest=(await call({action:"join",name:"Guest",code:host.code})).session;
await call({action:"configure",...guest,mode:"classic"},403);await call({action:"add_bot",...host,level:3});
let state=(await call({action:"configure",...host,mode:"classic",chaos:false})).state;assert.equal(state.mapId,"classic");assert.ok(state.players.every(p=>p.y===300));
state=(await call({action:"configure",...host,mode:"breach",chaos:true})).state;assert.equal(state.mapId,"lab-a");assert.equal(state.chaos,true);const bot=state.players.find(p=>p.isBot);await call({action:"set_bot_level",...host,botId:bot.id,level:2});
let n=0,release;const gate=new Promise(r=>release=r);setAfterBatch(async stmts=>{if(stmts[0].sql.startsWith("SELECT * FROM rooms")){if(++n===2)release();await gate;}});
const start=()=>transport("http://lab.test/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start",...host})});let responses;try{responses=await Promise.all([start(),start()]);}finally{setAfterBatch(null);}
assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);state=(await sync(host)).state;assert.equal(state.roundId,1);assert.equal(state.anomalies.length,8);assert.equal(state.players.find(p=>p.isBot).level,2);
await call({action:"configure",...host,mode:"classic"},400);await call({action:"set_bot_level",...host,botId:bot.id,level:1},400);
const epoch=state.players.find(p=>p.id===host.id).posEpoch;await call({action:"lobby",...host});state=(await call({action:"start",...host})).state;assert.equal(state.roundId,2);assert.ok(state.players.every(p=>p.score===0&&p.foamCharges===5&&p.grenades===0));assert.equal(state.players.find(p=>p.id===host.id).posEpoch,epoch+1);assert.equal(state.players.find(p=>p.isBot).level,2);for(let t=0;t<180000;t+=10000){advanceTime(10000);await sync(host);}advanceTime(1);state=(await sync(host)).state;assert.equal(state.status,"results");
console.log("PASS: host-only mode/Chaos controls, map spawn reset, three bot levels, concurrent starts create exactly one round, live changes rejected, restart resets weapons/epochs and preserves bots, authoritative deadline");
