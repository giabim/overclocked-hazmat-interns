import {WORLD} from "../game";
import {ROUND,BOT_SETTINGS as BOT} from "../bot-settings";
import {BALANCE as B} from "./balance";
import {mapForId,moveCircle} from "./map";
import {fieldFor,nextStep,pathDistance} from "./nav";
import {random} from "./rng";
import {fireFoam} from "./weapons";
import type {World} from "./types";
export function botStep(world:World,now:number,dt:number){
 const map=mapForId(world.room.map_id);
 for(const p of world.players.filter(p=>p.is_bot).sort((a,b)=>a.id.localeCompare(b.id))){
  if(p.stun_until>now){p.vx=0;p.vy=0;p.last_at=now;continue;}
  const held=world.anomalies.find(a=>a.carrier_id===p.id);
  if(now>=p.next_think_at){
   const candidates=world.anomalies.filter(a=>a.respawn_at<=now&&(map.id==="classic"||!a.carrier_id));
   candidates.sort((a,b)=>map.id==="classic"?Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y):pathDistance(fieldFor(map,a),p)-pathDistance(fieldFor(map,b),p));
   p.target_id=candidates[0]?.id??null;p.next_think_at=now+(p.bot_level===1?BOT.thinkMs:500);p.wobble_x=(random(world)*2-1)*(p.bot_level===1?BOT.wobble:0);p.wobble_y=(random(world)*2-1)*(p.bot_level===1?BOT.wobble:0);
  }
  const target=held?map.exits[0]:world.anomalies.find(a=>a.id===p.target_id&&a.respawn_at<=now&&(map.id==="classic"||!a.carrier_id));
  if(!target){p.vx=0;p.vy=0;p.last_at=now;continue;}
  let tx=target.x+p.wobble_x*50,ty=target.y+p.wobble_y*50;
  if(map.id!=="classic"){
   const waypoint=nextStep(fieldFor(map,target,p.bot_level>=2?world.monsters.filter(m=>m.state!=="Frozen"&&m.state!=="Contained"):[]),p,target);tx=waypoint.x;ty=waypoint.y;
  }
  const speed=WORLD.speed*([0,.7,.85,1][p.bot_level]??.7)*(held?ROUND.carrySpeedRatio:1)*(p.slow_until>now?B.slowRatio:1);
  const length=map.id==="classic"?Math.max(1,Math.abs(tx-p.x)+Math.abs(ty-p.y)):Math.max(1,Math.hypot(tx-p.x,ty-p.y)),fraction=Math.min(1,speed*dt/length);
  const old={x:p.x,y:p.y},next=moveCircle(map,p.x,p.y,(tx-p.x)*fraction,(ty-p.y)*fraction);p.x=next.x;p.y=next.y;p.vx=(p.x-old.x)/Math.max(.001,dt);p.vy=(p.y-old.y)/Math.max(.001,dt);p.last_at=now;
  if(Math.hypot(p.vx,p.vy)>.1){const n=Math.hypot(p.vx,p.vy);p.face_x=p.vx/n;p.face_y=p.vy/n;}
  if(!p.stuck_at){p.stuck_at=now;p.stuck_x=p.x;p.stuck_y=p.y;}else if(now-p.stuck_at>=1500){if(Math.hypot(p.x-p.stuck_x,p.y-p.stuck_y)<10){p.next_think_at=0;p.target_id=null;}p.stuck_at=now;p.stuck_x=p.x;p.stuck_y=p.y;}
  if(p.bot_level>=3&&p.foam_charges>=2&&world.room.mode==="breach"){
   const monster=world.monsters.filter(m=>m.state!=="Contained"&&Math.hypot(p.x-m.x,p.y-m.y)<=100).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
   if(monster)fireFoam(world,p,now,{aim:Math.atan2(monster.y-p.y,monster.x-p.x),viewDelayMs:0});
  }
 }
}
