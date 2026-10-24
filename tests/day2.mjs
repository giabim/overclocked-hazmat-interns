import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {transport,inspect,execute,advanceTime,metrics} from "./handler-harness.mjs";
let seq=Date.now();let interaction=1;
const active=[];
async function call(body,status=200){const response=await transport("http://lab.test/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;}
const sync=(s,extra={})=>call({action:"sync",...s,seq:++seq,dx:0,dy:0,...extra});
async function create(name){const r=await call({action:"create",name});active.push(r.session);return r.session;}
async function join(code,name){const r=await call({action:"join",code,name});active.push(r.session);return r.session;}
async function leave(s){await call({action:"leave",...s});active.splice(active.indexOf(s),1);}
advanceTime(0);
try{
 const host=await create("Game Host"),guest=await join(host.code,"Game Guest");
 const started=await call({action:"start",...host});assert.equal(started.state.anomalies.length,2);assert.equal(started.state.roundEndsAt-started.state.serverNow,180000);
 const a=started.state.anomalies[0];execute("UPDATE players SET x=?,y=?,vx=0,vy=0 WHERE room_code=?",a.x,a.y,host.code);
 const shared=++interaction;
 await Promise.all([sync(host,{interactSeq:shared}),sync(guest,{interactSeq:shared})]);
 let state=(await sync(host)).state;const held=state.anomalies.filter(a=>a.carrierId);assert.equal(held.length,1);assert.ok([host.id,guest.id].includes(held[0].carrierId));
 const carrier=held[0].carrierId===host.id?host:guest;
 const replay=await sync(carrier,{interactSeq:shared});assert.equal(replay.state.anomalies.find(x=>x.id===a.id).carrierId,carrier.id);
 const slowed=(await sync(carrier,{dx:1})).state.players.find(p=>p.id===carrier.id);assert.equal(slowed.vx,187);
 console.log("PASS: 3-minute server deadline, two canisters, one winning grab, interaction replay protection, carrying slowdown");
 execute("UPDATE players SET x=900,y=300,vx=0,vy=0 WHERE id=?",carrier.id);advanceTime(100);
 state=(await sync(carrier)).state;assert.equal(state.players.find(p=>p.id===carrier.id).score,1);const delivered=state.anomalies.find(x=>x.id===a.id);assert.equal(delivered.carrierId,null);assert.equal(delivered.respawnAt-state.serverNow,2000);
 const score=(await sync(carrier)).state.players.find(p=>p.id===carrier.id).score;assert.equal(score,1);
 execute("UPDATE players SET x=?,y=?,vx=0,vy=0 WHERE id=?",delivered.x,delivered.y,carrier.id);
 state=(await sync(carrier,{interactSeq:++interaction})).state;assert.ok(!state.players.find(p=>p.id===carrier.id).carrying);
 advanceTime(2100);state=(await sync(carrier,{interactSeq:++interaction})).state;assert.ok(state.players.find(p=>p.id===carrier.id).carrying);
 state=(await sync(carrier,{interactSeq:++interaction})).state;assert.ok(!state.players.find(p=>p.id===carrier.id).carrying);
 console.log("PASS: delivery scores once, two-second respawn, no early regrab, explicit drop");
 // End the round after keeping both human sessions active, then freeze scores.
 for(let i=0;i<36;i++){advanceTime(5000);await sync(host);await sync(guest);}
 state=(await sync(host)).state;assert.equal(state.status,"results");const frozen=state.players.map(p=>p.score);
 state=(await sync(host,{dx:1,interactSeq:++interaction})).state;assert.deepEqual(state.players.map(p=>p.score),frozen);
 await call({action:"lobby",...guest},403);assert.equal((await call({action:"lobby",...host})).state.status,"lobby");
 await leave(guest);await leave(host);await call({action:"join",code:host.code,name:"Too Late"},404);
 console.log("PASS: deadline ends the round, scores freeze, host-only Play Again, last-human closure");
 const solo=await create("Solo Human");
 for(let i=0;i<7;i++){advanceTime(1);await call({action:"add_bot",...solo});}
 state=(await sync(solo)).state;assert.equal(state.players.length,8);assert.equal(state.players.filter(p=>p.isBot).length,7);assert.equal(state.hostId,solo.id);
 const newest=state.players.filter(p=>p.isBot).at(-1).id;
 await call({action:"add_bot",...solo},409);
 const human=await join(solo.code,"Human Replacement");state=(await sync(solo)).state;assert.equal(state.players.length,8);assert.ok(!state.players.some(p=>p.id===newest));
 await call({action:"add_bot",...human},403);await call({action:"remove_bot",...human,botId:state.players.find(p=>p.isBot).id},403);
 const bot=state.players.find(p=>p.isBot);await call({action:"remove_bot",...solo,botId:bot.id});assert.equal((await sync(solo)).state.players.length,7);
 await call({action:"add_bot",...solo});
 state=(await call({action:"start",...solo})).state;assert.equal(state.anomalies.length,3);
 const before=state.players.find(p=>p.isBot);advanceTime(500);state=(await sync(solo)).state;const after=state.players.find(p=>p.id===before.id);
 assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<=77.001);assert.ok(Math.hypot(after.vx,after.vy)<=154.001);
 const sameTime=(await sync(human)).state.players.find(p=>p.id===before.id);assert.equal(sameTime.x,after.x);assert.equal(sameTime.y,after.y);
 await leave(solo);state=(await sync(human)).state;assert.equal(state.hostId,human.id);assert.ok(!state.players.find(p=>p.id===state.hostId).isBot);
 advanceTime(500);const progress=(await sync(human)).state;assert.ok(progress.players.some(p=>p.isBot&&(p.x!==state.players.find(a=>a.id===p.id).x||p.y!==state.players.find(a=>a.id===p.id).y)));
 await leave(human);await call({action:"join",code:solo.code,name:"Closed Bots"},404);assert.equal(inspect("SELECT COUNT(*) n FROM players WHERE room_code=? AND is_bot=1",solo.code)[0].n,0);
 console.log("PASS: eight-seat bot limit, newest bot replaced, human host handoff, 500ms speed cap, no duplicate bot advancement, bots stop with last human");
 const runner=await create("Round Runner");for(let i=0;i<7;i++)await call({action:"add_bot",...runner});
 state=(await call({action:"start",...runner})).state;
 const tickStart=performance.now();let maxMs=0;
 for(let i=0;i<360;i++){advanceTime(500);const t=performance.now();const m=metrics().batchCalls;state=(await sync(runner)).state;maxMs=Math.max(maxMs,performance.now()-t);assert.equal(metrics().batchCalls-m,1);}
 assert.equal(state.status,"results");const bots=state.players.filter(p=>p.isBot);const total=bots.reduce((n,p)=>n+p.score,0);assert.ok(total>0,`bots must deliver canisters during a full round: ${JSON.stringify(bots)}`);
 const ids=bots.map(p=>p.id).sort();state=(await call({action:"lobby",...runner})).state;assert.deepEqual(state.players.filter(p=>p.isBot).map(p=>p.id).sort(),ids);
 state=(await call({action:"start",...runner})).state;assert.ok(state.players.every(p=>p.score===0));assert.ok(state.players.filter(p=>p.isBot).every(p=>p.level===1));
 console.log(`PASS: full simulated 3-minute solo round vs 7 bots (${total} bot deliveries), results, preserved bots, clean restart`);
 console.log(`In-process SQLite timing: ${Math.round(performance.now()-tickStart)}ms for 360 syncs; slowest ${maxMs.toFixed(1)}ms. Not a production latency benchmark.`);
 console.log("All Day 2 checks passed.");
}finally{
 for(const s of [...active]){try{execute("UPDATE players SET last_at=? WHERE id=?",Date.now(),s.id);await call({action:"leave",...s});}catch{}}
}
