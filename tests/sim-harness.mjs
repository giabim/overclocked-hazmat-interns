import assert from "node:assert/strict";
export * from "./handler-harness.mjs";
import {transport,inspect,simModule,advanceTime} from "./handler-harness.mjs";
let seq=Date.now();
export async function call(body,status=200){const r=await transport("http://lab.test/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
export const sync=(session,extra={})=>call({action:"sync",...session,seq:++seq,dx:0,dy:0,...extra});
export async function fixture(mode="breach",count=8){
 advanceTime(0);const host=(await call({action:"create",name:"Simulation Host",mode})).session;
 for(let i=1;i<count;i++){advanceTime(1);await call({action:"add_bot",...host,level:(i-1)%3+1});}
 const started=(await call({action:"start",...host})).state;
 const {readWorld}=await simModule("tick");
 const room=inspect("SELECT * FROM rooms WHERE code=?",host.code)[0],players=inspect("SELECT * FROM players WHERE room_code=? ORDER BY id",host.code),anomalies=inspect("SELECT * FROM anomalies WHERE room_code=? ORDER BY id",host.code);
 return{host,started,world:readWorld(room,players,anomalies,Date.now())};
}
