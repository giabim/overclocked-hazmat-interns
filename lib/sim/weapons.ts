import {BALANCE as B} from "./balance";
import {lineOfSight,mapForId,moveCircle,type Point} from "./map";
import type {Intent,Monster,PlayerRow,World} from "./types";
export const angleDifference=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const rewindMs=(intent:Partial<Intent>,chaos=false)=>Math.min(chaos?B.chaosRewindMaxMs:B.rewindMaxMs,Math.max(0,intent.viewDelayMs??200)+Math.max(0,intent.rttMs??0)/2);
export function historicalPoint(h:{at:number;x:number;y:number}[],time:number,fallback:Point):Point{if(!h.length)return fallback;if(time<=h[0].at)return h[0];
 for(let i=1;i<h.length;i++){if(time<=h[i].at){const a=h[i-1],b=h[i],f=(time-a.at)/Math.max(1,b.at-a.at);return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}}return h[h.length-1];
}
export const historicalPosition=(monster:Monster,time:number)=>historicalPoint(monster.history,time,monster);
export function inCone(from:Point,to:Point,aim:number,range=B.foamRange+B.foamTolerance){return Math.hypot(to.x-from.x,to.y-from.y)<=range&&Math.abs(angleDifference(Math.atan2(to.y-from.y,to.x-from.x),aim))<=B.foamAngle;}
export function freeze(world:World,monster:Monster,by:string,now:number,duration:number){
 if(monster.state==="Contained")return;
 monster.frozenUntil=Math.max(monster.frozenUntil,now+duration);monster.state="Frozen";
 monster.hits=monster.hits.filter(h=>now-h.at<=B.containWindowMs);monster.hits.push({at:now,by});
 if(monster.hits.length>=B.containHits){const scorer=world.players.find(p=>p.id===by);if(scorer)scorer.score+=2;monster.state="Contained";monster.until=now+B.containRespawnMs;monster.frozenUntil=0;monster.x=monster.den.x;monster.y=monster.den.y;monster.hits=[];}
}
export function recharge(p:PlayerRow,now:number){
 if(!p.charge_at)p.charge_at=now;const ticks=Math.floor((now-p.charge_at)/B.foamRechargeMs);if(ticks>0){p.foam_charges=Math.min(B.foamMax,p.foam_charges+ticks);p.charge_at+=ticks*B.foamRechargeMs;}
}
export function fireFoam(world:World,p:PlayerRow,now:number,intent:Partial<Intent>={}){
 if(world.room.mode!=="breach"||now>=world.room.round_ends_at||p.stun_until>now||p.foam_ready_at>now||p.foam_charges<1)return false;
 const map=mapForId(world.room.map_id);const rewind=rewindMs(intent),shotTime=now-rewind;
 let aim=Number.isFinite(intent.aim)?intent.aim!:Math.atan2(p.face_y,p.face_x),best=Infinity;
 for(const m of world.monsters){if(m.state==="Contained")continue;const q=historicalPosition(m,shotTime),distance=Math.hypot(q.x-p.x,q.y-p.y),angle=Math.atan2(q.y-p.y,q.x-p.x);
  if(distance<=B.foamRange+B.foamTolerance&&Math.abs(angleDifference(angle,aim))<=B.magnetism&&distance<best&&lineOfSight(map,p,q)){best=distance;aim=angle;}
 }
 p.foam_charges--;p.foam_ready_at=now+B.foamCooldownMs;p.last_fire_at=now;p.last_fire_aim=aim;
 for(const m of world.monsters){const q=historicalPosition(m,shotTime);if(m.state!=="Contained"&&inCone(p,q,aim)&&lineOfSight(map,p,q))freeze(world,m,p.id,now,B.foamFreezeMs);}
 if(world.room.chaos)for(const target of world.players){const q=historicalPoint(world.playerHistory?.[target.id]??[],now-rewindMs(intent,true),target);if(target.id!==p.id&&inCone(p,q,aim)&&lineOfSight(map,p,q)){target.slow_until=Math.max(target.slow_until,now+1500);target.pos_epoch++;}}
 return true;
}
export function throwGrenade(world:World,p:PlayerRow,now:number,aim:number){
 if(world.room.mode!=="breach"||p.grenades<1||p.stun_until>now||now>=world.room.round_ends_at)return false;
 const target=moveCircle(mapForId(world.room.map_id),p.x,p.y,Math.cos(aim)*B.grenadeRange,Math.sin(aim)*B.grenadeRange,6);
 world.grenades.push({id:p.id+":"+p.throw_seq,ownerId:p.id,x:target.x,y:target.y,fromX:p.x,fromY:p.y,startedAt:now,explodeAt:now+B.grenadeFuseMs});p.grenades--;return true;
}
export function advanceWeapons(world:World,now:number){
 const map=mapForId(world.room.map_id);
 for(const p of world.players){recharge(p,now);for(const pickup of world.pickups)if(pickup.readyAt<=now&&p.grenades<1&&Math.hypot(p.x-pickup.x,p.y-pickup.y)<36){p.grenades=1;pickup.readyAt=now+B.pickupRespawnMs;}}
 for(const grenade of world.grenades){if(grenade.explodeAt>now)continue;
  for(const monster of world.monsters)if(monster.state!=="Contained"&&Math.hypot(grenade.x-monster.x,grenade.y-monster.y)<=B.grenadeRadius&&lineOfSight(map,grenade,monster))freeze(world,monster,grenade.ownerId,now,B.grenadeFreezeMs);
  if(world.room.chaos)for(const p of world.players)if(p.id!==grenade.ownerId&&Math.hypot(p.x-grenade.x,p.y-grenade.y)<=B.grenadeRadius&&lineOfSight(map,grenade,p)){p.slow_until=Math.max(p.slow_until,now+2000);p.pos_epoch++;}
 }world.grenades=world.grenades.filter(g=>g.explodeAt>now);
}
