import {BALANCE as B} from "./balance";
import {CELL,lineOfSight,mapForId,moveCircle} from "./map";
import {fieldFor,nextStep,pathDistance} from "./nav";
import {random} from "./rng";
import type {Monster,World} from "./types";
export function monsterStep(world:World,now:number,dt:number){
 const map=mapForId(world.room.map_id);
 for(const m of world.monsters){
  if(m.state==="Contained"){if(now<m.until)continue;m.state="Patrol";m.hits=[];m.x=m.den.x;m.y=m.den.y;}
  if(m.frozenUntil>now){m.state="Frozen";record(m,now);continue;}else if(m.state==="Frozen")m.state="Patrol";
  if(m.state==="Den"&&now<m.until){record(m,now);continue;}else if(m.state==="Den")m.state="Patrol";
  const human=world.players.filter(p=>!p.is_bot&&p.immune_until<=now).filter(p=>m.kind==="slime"?pathDistance(fieldFor(map,p),m)<=6*CELL:Math.hypot(p.x-m.x,p.y-m.y)<=5*CELL&&lineOfSight(map,m,p)).sort((a,b)=>{
   const ac=world.anomalies.some(c=>c.carrier_id===a.id)?-1:0,bc=world.anomalies.some(c=>c.carrier_id===b.id)?-1:0;
   return ac-bc||Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y)||a.id.localeCompare(b.id);
  })[0];
  if(m.state==="WindUp"){if(now>=m.until){m.state="Dash";m.until=now+B.houndDashMs;}}
  else if(m.state==="Dash"){if(now>=m.until){m.state="Tired";m.until=now+B.houndTiredMs;}}
  else if(m.state==="Tired"){if(now>=m.until)m.state="Patrol";}
  else if(human){if(m.state!=="Chase"){m.state="Chase";m.chaseAt=now;}m.targetId=human.id;
   if(now-m.chaseAt>(m.kind==="hound"?3000:8000)){m.state="Patrol";m.targetId=null;m.patrol={...m.den};m.chaseAt=now;}
   else if(m.kind==="hound"&&Math.hypot(human.x-m.x,human.y-m.y)<240&&lineOfSight(map,m,human)){m.state="WindUp";m.aim=Math.atan2(human.y-m.y,human.x-m.x);m.until=now+B.houndWindupMs;}
  }else if(m.state==="Chase"){m.state="Patrol";m.targetId=null;}
  let target=world.players.find(p=>p.id===m.targetId),speed=m.kind==="slime"?B.slimeSpeed:B.houndSpeed,dx=0,dy=0;
  if(m.state==="Dash"){dx=Math.cos(m.aim)*speed*2*dt;dy=Math.sin(m.aim)*speed*2*dt;}
  else if(m.state!=="WindUp"){
   if(m.state==="Tired")speed*=.4;
   if(!target||m.state!=="Chase"){
    if(Math.hypot(m.x-m.patrol.x,m.y-m.patrol.y)<24)m.patrol={...map.canisters[Math.floor(random(world)*map.canisters.length)]};
    target=undefined;
   }
   const destination=target??m.patrol,waypoint=nextStep(fieldFor(map,destination),m,destination),distance=Math.max(1,Math.hypot(waypoint.x-m.x,waypoint.y-m.y)),fraction=Math.min(1,speed*dt/distance);dx=(waypoint.x-m.x)*fraction;dy=(waypoint.y-m.y)*fraction;
  }
  const next=moveCircle(map,m.x,m.y,dx,dy,m.kind==="slime"?24:22);m.x=next.x;m.y=next.y;
  if(m.state==="Patrol"||m.state==="Chase"||m.state==="Dash")for(const p of world.players){
   if(p.immune_until>now||Math.hypot(p.x-m.x,p.y-m.y)>(m.kind==="slime"?39:37))continue;
   for(const a of world.anomalies)if(a.carrier_id===p.id){a.x=p.x;a.y=p.y;a.carrier_id=null;}
   p.stun_until=now+B.stunMs;p.immune_until=now+B.stunMs+B.immuneMs;p.pos_epoch++;p.vx=0;p.vy=0;
   m.state="Tired";m.until=now+2000;m.targetId=null;m.patrol={...m.den};break;
  }record(m,now);
 }
}
function record(m:Monster,now:number){m.history.push({at:now,x:m.x,y:m.y});if(m.history.length>B.historySamples)m.history.shift();}
