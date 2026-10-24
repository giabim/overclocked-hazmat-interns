// Integration checks against a running local or public Day 1 build.
// Usage: node tests/multiplayer.mjs http://127.0.0.1:4173
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
const inProcess=process.argv.includes("--in-process");
const origin=inProcess?"http://lab.test":process.argv[2];
if(!origin)throw new Error("Pass the running game's origin or --in-process.");
const transport=inProcess?(await import("./handler-harness.mjs")).transport:fetch;
let sequence=Date.now();
const sessions=[];
async function request(body,expected=200){
  const response=await transport(new URL("/api/room",origin),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
}
const sync=(s,dx=0,dy=0)=>request({action:"sync",...s,seq:++sequence,dx,dy});
try {
  const created=await request({action:"create",name:"Test Host"});
  const host=created.session;sessions.push(host);
  assert.equal(created.state.status,"lobby");assert.equal(created.state.players.length,1);
  assert.match(host.code,/^[A-Z2-9]{5}$/);
  assert.ok(!JSON.stringify(created.state).includes(host.token));
  await request({action:"start",...host},400);
  await request({action:"join",code:"wrong",name:"Lost Intern"},404);
  await request({action:"create",name:"   "},400);
  const joined=await request({action:"join",code:host.code.toLowerCase(),name:"Second Intern"});
  const second=joined.session;sessions.push(second);
  assert.equal(joined.state.players.length,2);
  await request({action:"start",...second},403);
  await request({action:"sync",...host,token:"invalid",seq:++sequence},401);
  console.log("PASS: room codes, nickname validation, shared roster, host-only start and session isolation");
  const running=await request({action:"start",...host});assert.equal(running.state.status,"running");
  const start=running.state.players.find(p=>p.id===host.id);
  await sync(host,1,0);await delay(180);const moved=await sync(host,1,0);
  const own=moved.state.players.find(p=>p.id===host.id);assert.ok(own.x>start.x+20);assert.equal(own.y,start.y);
  const observed=(await sync(second)).state.players.find(p=>p.id===host.id);assert.ok(observed.x>=own.x);
  const diagonal=await sync(host,99,99);const diag=diagonal.state.players.find(p=>p.id===host.id);assert.ok(Math.abs(Math.hypot(diag.vx,diag.vy)-220)<.01);
  console.log("PASS: movement is server-computed, visible to another client, and diagonal speed is bounded");
  const pending=await Promise.all(Array.from({length:8},(_,i)=>transport(new URL("/api/room",origin),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"join",code:host.code,name:`Concurrent ${i}`})}).then(async response=>({status:response.status,body:await response.json()}))));
  assert.equal(pending.filter(r=>r.status===200).length,6);assert.equal(pending.filter(r=>r.status===409).length,2);
  for(const r of pending)if(r.status===200)sessions.push(r.body.session);
  const full=await sync(host);assert.equal(full.state.players.length,8);
  console.log("PASS: late joins work, concurrent joins cannot exceed eight players, full-room errors are clear");
  let latest;
  for(let tick=0;tick<31;tick++){
    latest=await Promise.all(sessions.map((s,i)=>sync(s,i===0?1:i===1?-1:0,0)));
    await delay(115);
  }
  const finalHost=latest[0].state.players.find(p=>p.id===host.id);const finalSecond=latest[0].state.players.find(p=>p.id===second.id);
  assert.ok(finalHost.x<=928&&finalHost.x>=900,`host x ${finalHost.x}`);assert.ok(finalSecond.x>=32&&finalSecond.x<100,`second x ${finalSecond.x}`);
  const stale=await request({action:"sync",...host,seq:1,dx:-1,dy:0});assert.ok(stale.state.players.find(p=>p.id===host.id).vx>=0);
  console.log("PASS: eight simultaneous clients remain in sync, movement stays within walls, stale inputs are ignored");
  await request({action:"lobby",...host});const paused=await sync(second);assert.equal(paused.state.status,"lobby");
  assert.ok(paused.state.players.every(p=>p.vx===0&&p.vy===0));
  await request({action:"leave",...host});sessions.shift();
  const reassigned=await sync(second);assert.equal(reassigned.state.hostId,second.id);assert.equal(reassigned.state.players.length,7);
  assert.equal((await request({action:"start",...second})).state.status,"running");
  console.log("PASS: return to lobby, leave cleanup, host handoff and restart");
  console.log("All multiplayer integration checks passed.");
}finally{
  await Promise.allSettled(sessions.map(s=>request({action:"leave",...s})));
}
