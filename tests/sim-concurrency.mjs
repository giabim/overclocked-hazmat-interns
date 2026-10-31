import assert from "node:assert/strict";
import {call,sync,inspect,execute,advanceTime,setAfterBatch} from "./sim-harness.mjs";
const host=(await call({action:"create",name:"CAS Host"})).session,guest=(await call({action:"join",code:host.code,name:"CAS Guest"})).session;
await call({action:"start",...host});
const anomalies=inspect("SELECT * FROM anomalies WHERE room_code=? ORDER BY id",host.code);
for(const [i,p] of [host,guest].entries())execute("UPDATE players SET x=?,y=?,vx=0,vy=0 WHERE id=?",anomalies[i].x,anomalies[i].y,p.id);
async function race(a,b){let n=0,release;const gate=new Promise(r=>release=r);setAfterBatch(async statements=>{if(statements[0].sql.startsWith("UPDATE players SET input_seq=")){n++;if(n===2)release();await gate;}});try{await Promise.all([a(),b()]);}finally{setAfterBatch(null);}}
await race(()=>sync(host,{interactSeq:100}),()=>sync(guest,{interactSeq:100}));
await sync(host);let state=(await sync(guest)).state;assert.equal(state.anomalies.filter(a=>a.carrierId).length,2,"a losing request's grab remains durable");
execute("UPDATE players SET x=800,y=300,vx=0,vy=0 WHERE room_code=?",host.code);advanceTime(500);
await race(()=>sync(host,{x:890,y:300}),()=>sync(guest,{x:890,y:300}));await sync(host);state=(await sync(guest)).state;
assert.ok(state.players.every(p=>p.score===1));await sync(host);assert.ok((await sync(guest)).state.players.every(p=>p.score===1));
console.log("PASS: forced concurrent read/CAS races preserve losing grabs and score each delivery exactly once");
