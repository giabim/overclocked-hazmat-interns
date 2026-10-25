import assert from "node:assert/strict";
import {transport,execute,advanceTime,metrics,MovementSync,pollDelay} from "./handler-harness.mjs";

let seq=Date.now(),interactSeq=100;
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<.001,`${message}: ${actual} vs ${expected}`);
async function call(body,status=200){
  const response=await transport("http://lab.test/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
}
const sync=(session,extra={})=>call({action:"sync",...session,seq:++seq,dx:0,dy:0,...extra});
const own=(state,session)=>state.players.find(p=>p.id===session.id);
advanceTime(0);
const host=(await call({action:"create",name:"Throttled Host"})).session;
const guest=(await call({action:"join",code:host.code,name:"Observer"})).session;
try{
  await call({action:"start",...host});
  execute("UPDATE players SET x=160,y=300,last_at=?,vx=0,vy=0 WHERE id=?",Date.now(),host.id);
  for(let i=1;i<=4;i++){
    advanceTime(500);const before=metrics().batchCalls;
    const state=(await sync(host,{x:160+i*110,y:300,dx:1})).state;
    near(own(state,host).x,160+i*110,"500ms movement is fully accepted");
    assert.equal(metrics().batchCalls-before,1);
  }
  advanceTime(200);const snapshot=(await sync(guest)).state;
  near(own(snapshot,host).x,600,"observer receives accepted position without server extrapolation");
  assert.equal(own(snapshot,host).positionAt,snapshot.serverNow-200);
  advanceTime(100);
  const before=own(snapshot,host),target={x:900,y:500};
  const limited=own((await sync(host,target)).state,host);
  const allowance=220*.3*1.3+10,distance=Math.hypot(target.x-before.x,target.y-before.y);
  near(limited.x,before.x+(target.x-before.x)*allowance/distance,"rejected movement clamps x along the intended vector");
  near(limited.y,before.y+(target.y-before.y)*allowance/distance,"rejected movement clamps y along the intended vector");
  const stale=(await call({action:"sync",...host,seq:1,x:32,y:32,dx:-1})).state;
  near(own(stale,host).x,limited.x,"stale sequence cannot change position");
  await call({action:"sync",...host,seq:++seq,x:"600",y:300},400);
  await call({action:"sync",...host,seq:++seq,x:600},400);
  await call({action:"sync",...host,seq:++seq,x:null,y:300},400);
  console.log("PASS: four 500ms updates retain full movement, snapshots do not coast, vector speed limit, one-batch sync, stale/invalid positions");

  let state=(await sync(host)).state;const canister=state.anomalies[0];
  execute("UPDATE players SET x=160,y=300,last_at=?,vx=0,vy=0 WHERE id=?",Date.now(),host.id);
  execute("UPDATE anomalies SET carrier_id=NULL WHERE room_code=?",host.code);
  execute("UPDATE anomalies SET x=270,y=300,respawn_at=0 WHERE id=?",canister.id);
  advanceTime(500);state=(await sync(host,{x:270,y:300,interactSeq:++interactSeq})).state;
  assert.equal(state.anomalies.find(a=>a.id===canister.id).carrierId,host.id,"grab checks newly accepted position");
  advanceTime(500);state=(await sync(host,{x:363.5,y:300,dx:1})).state;
  near(own(state,host).x,363.5,"carrying retains 15% slowdown over slow requests");
  advanceTime(100);state=(await sync(host,{x:900,y:500})).state;
  near(Math.hypot(own(state,host).x-363.5,own(state,host).y-300),187*.1*1.3+10,"carry speed also bounds rejected moves");
  execute("UPDATE players SET x=780,y=300,last_at=?,vx=0,vy=0 WHERE id=?",Date.now(),host.id);
  advanceTime(500);state=(await sync(host,{x:873.5,y:300})).state;
  assert.equal(own(state,host).score,1,"delivery checks newly accepted position");
  assert.equal(state.anomalies.find(a=>a.id===canister.id).carrierId,null);
  assert.equal(own((await sync(host,{x:873.5,y:300})).state,host).score,1);
  advanceTime(500);state=(await sync(host,{x:1e308,y:300})).state;
  near(own(state,host).x,928,"untrusted extreme coordinates clamp safely to wall");
  await call({action:"lobby",...host});
  const lobby=(await sync(host,{x:32,y:32})).state;near(own(lobby,host).x,928,"lobby positions remain frozen");
  advanceTime(5000);state=(await call({action:"start",...host})).state;
  const spawn=own(state,host);
  state=(await sync(host,{x:900,y:300})).state;
  near(own(state,host).x-spawn.x,10,"lobby idle time does not grant movement credit");
  execute("UPDATE rooms SET status='results' WHERE code=?",host.code);
  const frozen=own(state,host);state=(await sync(host,{x:900,y:500})).state;
  near(own(state,host).x,frozen.x,"results positions remain frozen");
  console.log("PASS: predicted-position grab/delivery, carrying acceptance and clamp, one-time score, walls, lobby/results freeze, no pre-round movement credit");
}finally{
  await call({action:"leave",...guest});await call({action:"leave",...host});
}

const player=(id,x,seq=0,positionAt=0)=>({id,x,y:300,seq,positionAt});
const state=(serverNow,players,roundId=1,status="running")=>({code:"TEST2",roundId,status,serverNow,players});
const local=new MovementSync();local.receive(state(0,[player("self",100)]),"self",0,0);
near(local.localPosition({x:1,y:0},false,.1).x,122,"local input starts immediately");
local.recordSent(1);for(let i=0;i<4;i++)local.localPosition({x:1,y:0},false,.1);
local.receive(state(300,[player("self",122,1,300)]),"self",500,400);
for(let i=0;i<10;i++)near(local.localPosition({x:0,y:0},false,.05).x,210,"delayed accepted input never pulls back or slides after release");
local.recordSent(2);local.receive(state(600,[player("self",170,2,600)]),"self",800,400);
near(local.localPosition({x:0,y:0},false,.05).x,210,"40px correction threshold is strict");
local.recordSent(3);local.receive(state(900,[player("self",150,3,900)]),"self",1100,400);
near(local.localPosition({x:0,y:0},false,.05).x,190,"rejected move eases first third");
near(local.localPosition({x:0,y:0},false,.05).x,170,"rejected move eases second third");
near(local.localPosition({x:0,y:0},false,.05).x,150,"correction finishes at 150ms");
local.receive(state(1000,[player("self",400)],2),"self",1200,400);
near(local.localPosition({x:0,y:0},false,.05).x,400,"new rounds reset prediction history");
console.log("PASS: instant local start/stop, 400ms stale acknowledgements do not rubber-band, >40px correction eases over 150ms, round reset");

// Slow-connection arrivals, a sudden reversal, and an observer polling faster
// than the sender. Check frame-to-frame motion, bounds, and final outage hold.
for(const cadence of [[100],[400],[500],[100,400,500,100,800,100,100,100,100,500]]){
  const gap=cadence[0];
  const timeline=new MovementSync();let next=0,lastX=null,maxStep=0,stale=null,index=0;
  timeline.receive(state(0,[player("self",100),player("remote",200)]),"self",gap/2,gap);
  for(let time=gap/2;time<=5000;time+=10){
    if(time>=next+gap/2){
      const x=200+220*(next<=1500?next/1000:Math.max(0,3000-next)/1000);
      stale=player("remote",x,0,next);
      timeline.receive(state(next,[player("self",100,0,next),stale]),"self",time,gap);
      next+=cadence[index++%cadence.length];
    }else if(stale){
      // Repeated observations must not flush the remote sender's four samples.
      timeline.receive(state(time-gap/2,[player("self",100,0,time-gap/2),stale]),"self",time,gap);
    }
    const current=timeline.remotePosition("remote",time,.01);
    assert.ok(current.x>=200-.001&&current.x<=530+.001,"remote interpolation cannot overshoot a turn");
    if(lastX!==null)maxStep=Math.max(maxStep,Math.abs(current.x-lastX));lastX=current.x;
  }
  assert.ok(maxStep<=2.421,`${cadence}ms updates: interpolation jumped ${maxStep}px in 10ms`);
  const held=timeline.remotePosition("remote",10000,5);
  near(held.x,stale.x,"outage holds last authoritative sample without extrapolation");
}
assert.equal(pollDelay(1000,1030,true),70);
assert.equal(pollDelay(1000,1100,true),0);
assert.equal(pollDelay(1000,1500,true),0);
assert.equal(pollDelay(1000,1200,false),650);
console.log("PASS: remote interpolation at 100/400/500ms and variable 100–800ms, smooth direction changes, no extrapolation, distinct history survives observer polls, start-to-start poll cadence");
console.log("All movement checks passed. Slow 4G browser/physical-phone acceptance remains a separate check.");
