import {WORLD} from "../game";
import {ROUND,BOT_SETTINGS as BOT} from "../bot-settings";
import {BALANCE as B} from "./balance";
import {acceptMove,inExit,mapForId} from "./map";
import {random,seedFor} from "./rng";
import {botStep} from "./bots";
import {monsterStep} from "./monsters";
import {advanceWeapons,fireFoam,recharge,throwGrenade} from "./weapons";
import type {Intent,PlayerRow,RoomRow,World,WorldState} from "./types";
export function initialState(room:RoomRow,players:PlayerRow[],now:number):WorldState{
 const map=mapForId(room.map_id),count=room.mode==="breach"?Math.min(4,Math.max(1,Math.floor(players.length/2))):0;
 return{roundId:room.round_id,rng:room.rng||seedFor(room.code+room.round_id),monsters:Array.from({length:count},(_,i)=>{
  const den=map.dens[i%map.dens.length];return{id:"specimen-"+i,kind:i%2?"hound" as const:"slime" as const,x:den.x,y:den.y,state:"Den",until:now+800,frozenUntil:0,targetId:null,chaseAt:0,aim:0,den:{...den},patrol:{...map.canisters[i%map.canisters.length]},hits:[],history:[{at:now,x:den.x,y:den.y}]};
 }),pickups:room.mode==="breach"?map.pickups.map((p,i)=>({id:"grenade-"+i,...p,readyAt:0})):[],grenades:[]};
}
export function readWorld(room:RoomRow,players:PlayerRow[],anomalies:World["anomalies"],now:number):World{
 let state:WorldState;try{state=JSON.parse(room.world||"{}");}catch{state={} as WorldState;}
 if(state.roundId!==room.round_id||!Array.isArray(state.monsters)||!Array.isArray(state.pickups)||!Array.isArray(state.grenades))state=initialState(room,players,now);
 return{...state,room,players,anomalies};
}
export function serializeWorld(world:World){const {roundId,rng,monsters,pickups,grenades}=world;return JSON.stringify({roundId,rng,monsters,pickups,grenades});}
export function speedFor(p:PlayerRow,world:World,now:number){return WORLD.speed*(world.anomalies.some(a=>a.carrier_id===p.id)?ROUND.carrySpeedRatio:1)*(p.slow_until>now?B.slowRatio:1);}
function carry(world:World){for(const a of world.anomalies){const p=world.players.find(p=>p.id===a.carrier_id);if(p){a.x=p.x;a.y=p.y;}else a.carrier_id=null;}}
function deliver(world:World,now:number){
 const map=mapForId(world.room.map_id);
 for(const a of world.anomalies){const p=world.players.find(p=>p.id===a.carrier_id);if(!p||!inExit(map,p))continue;
  p.score++;a.carrier_id=null;a.respawn_at=now+ROUND.respawnMs;a.generation++;p.drop_at=0;
  const spawn=map.canisters[Math.floor(random(world)*map.canisters.length)];a.x=spawn.x;a.y=spawn.y;
 }
}
function interaction(world:World,p:PlayerRow,now:number){
 const held=world.anomalies.find(a=>a.carrier_id===p.id);
 if(held){held.x=p.x;held.y=p.y;held.carrier_id=null;p.drop_at=0;return;}
 if(p.stun_until>now)return;
 const a=world.anomalies.filter(a=>!a.carrier_id&&a.respawn_at<=now&&Math.hypot(a.x-p.x,a.y-p.y)<=ROUND.grabRadius).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||a.id.localeCompare(b.id))[0];
 if(a){a.carrier_id=p.id;a.x=p.x;a.y=p.y;p.vx*=ROUND.carrySpeedRatio;p.vy*=ROUND.carrySpeedRatio;}
}
function applyInput(world:World,p:PlayerRow,now:number){
 let input:Intent;try{input=JSON.parse(p.input_json);}catch{input={seq:p.input_seq,dx:0,dy:0,interactSeq:0};}
 const at=Math.max(p.last_at,p.input_at),running=world.room.status==="running",canAct=running&&at<world.room.round_ends_at;
 if(running){
  const seconds=Math.max(0,Math.min(at,world.room.round_ends_at)-Math.max(p.last_at,p.stun_until,world.room.round_ends_at-ROUND.durationMs))/1000,speed=speedFor(p,world,at);
  const oldEpoch=(input.posEpoch??(world.room.mode==="classic"?p.pos_epoch:0))<p.pos_epoch,blocked=p.stun_until>at;
  const target=blocked?{x:p.x,y:p.y}:oldEpoch?{x:p.x+(input.dx||0)*speed*seconds,y:p.y+(input.dy||0)*speed*seconds}:{x:input.x??p.x+p.vx*seconds,y:input.y??p.y+p.vy*seconds};
  const position=acceptMove(mapForId(world.room.map_id),p,target,blocked?0:speed*seconds*1.3+10);p.x=position.x;p.y=position.y;
  p.vx=canAct&&!blocked?(input.dx||0)*speed:0;p.vy=canAct&&!blocked?(input.dy||0)*speed:0;
  const faceLength=Math.hypot(input.dx||0,input.dy||0);if(faceLength>.05){p.face_x=input.dx/faceLength;p.face_y=input.dy/faceLength;}
 }else{p.vx=0;p.vy=0;}
 p.seq=p.input_seq;p.last_at=at;
 const interact=Math.max(0,input.interactSeq||0),fire=Math.max(0,input.fireSeq||0),throwSeq=Math.max(0,input.throwSeq||0);
 carry(world);
 if(interact>p.interact_seq){p.interact_seq=interact;if(canAct)interaction(world,p,at);}
 recharge(p,at);
 if(fire>p.fire_seq){p.fire_seq=fire;if(canAct)fireFoam(world,p,at,input);}
 if(throwSeq>p.throw_seq){p.throw_seq=throwSeq;if(canAct)throwGrenade(world,p,at,Number.isFinite(input.aim)?input.aim!:Math.atan2(p.face_y,p.face_x));}
 if(running)deliver(world,Math.min(now,world.room.round_ends_at));
}
function botInteractions(world:World,now:number){
 for(const p of world.players.filter(p=>p.is_bot).sort((a,b)=>a.id.localeCompare(b.id))){
  let held=world.anomalies.find(a=>a.carrier_id===p.id);
  if(held&&p.drop_at>0&&p.drop_at<=now){held.carrier_id=null;held.x=p.x;held.y=p.y;p.drop_at=0;continue;}
  if(!held&&p.stun_until<=now){interaction(world,p,now);held=world.anomalies.find(a=>a.carrier_id===p.id);}
  if(held&&p.drop_at===0)p.drop_at=p.bot_level===1&&random(world)<1/BOT.accidentalDropEvery?now+BOT.dropDelayMinMs+random(world)*BOT.dropDelayRangeMs:-1;
  if(!held)p.drop_at=0;
 }
}
export function advance(world:World,now:number){
 const pending=world.players.filter(p=>!p.is_bot&&p.input_seq>p.seq).sort((a,b)=>a.input_at-b.input_at||a.id.localeCompare(b.id));
 for(const p of pending)applyInput(world,p,now);
 if(world.room.status!=="running"){carry(world);return world;}
 const end=Math.min(now,world.room.round_ends_at);let at=Math.max(world.room.sim_at,end-B.maxCatchupMs);
 while(at<end){const step=Math.min(B.stepMs,end-at);at+=step;
  advanceWeapons(world,at);botStep(world,at,step/1000);carry(world);botInteractions(world,at);
  if(world.room.mode==="breach")monsterStep(world,at,step/1000);
  carry(world);deliver(world,at);
 }
 world.room.sim_at=Math.max(world.room.sim_at,end);world.room.rng=world.rng;
 if(now>=world.room.round_ends_at){world.room.status="results";for(const p of world.players){p.vx=0;p.vy=0;}}
 return world;
}
