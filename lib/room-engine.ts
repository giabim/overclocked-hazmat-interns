import {ONLINE_MS} from "./game";
import {advance,readWorld,serializeWorld} from "./sim/tick";
import type {AnomalyRow,Intent,PlayerRow,RoomRow} from "./sim/types";
export type {AnomalyRow,PlayerRow,RoomRow} from "./sim/types";
export const onlineWhere="(is_bot=1 OR MAX(last_at,input_at)>?)";
export function publicState(room:RoomRow,players:PlayerRow[],anomalies:AnomalyRow[],now:number){
 const status=room.status==="running"&&room.round_ends_at>0&&now>=room.round_ends_at?"results":room.status,world=readWorld(room,players,anomalies,now);
 return{code:room.code,hostId:room.host_id,status,serverNow:now,roundEndsAt:room.round_ends_at,roundId:room.round_id,revision:room.revision,mode:room.mode,mapId:room.map_id,chaos:!!room.chaos,
  players:players.map(p=>({x:p.x,y:p.y,positionAt:p.last_at,id:p.id,name:p.name,color:p.color,vx:status==="running"?p.vx:0,vy:status==="running"?p.vy:0,seq:p.seq,interactSeq:p.interact_seq,connected:!!p.is_bot||now-Math.max(p.last_at,p.input_at)<3000,isBot:!!p.is_bot,level:p.bot_level,score:p.score,carrying:anomalies.some(a=>a.carrier_id===p.id),posEpoch:p.pos_epoch,stunUntil:p.stun_until,immuneUntil:p.immune_until,slowUntil:p.slow_until,foamCharges:p.foam_charges,foamReadyAt:p.foam_ready_at,grenades:p.grenades,lastFireAt:p.last_fire_at,lastFireAim:p.last_fire_aim,fireSeq:p.fire_seq,throwSeq:p.throw_seq,faceX:p.face_x,faceY:p.face_y})),
  anomalies:anomalies.map(a=>({id:a.id,x:a.x,y:a.y,carrierId:a.carrier_id,respawnAt:a.respawn_at,generation:a.generation})),
  monsters:world.monsters.map(m=>({id:m.id,kind:m.kind,x:m.x,y:m.y,state:m.state,frozenUntil:m.frozenUntil,aim:m.aim,until:m.until})),pickups:world.pickups,grenades:world.grenades,
 };
}
export async function snapshot(db:D1Database,code:string,now:number){
 const r=await db.batch([db.prepare("SELECT * FROM rooms WHERE code=?").bind(code),db.prepare(`SELECT * FROM players WHERE room_code=? AND ${onlineWhere} ORDER BY is_bot,joined_at,id`).bind(code,now-ONLINE_MS),db.prepare("SELECT * FROM anomalies WHERE room_code=? ORDER BY id").bind(code)]);
 const room=r[0].results[0] as RoomRow|undefined;return room?publicState(room,r[1].results as PlayerRow[],r[2].results as AnomalyRow[],Math.max(now,room.sim_at)):null;
}
const projectedKeys=["x","y","vx","vy","seq","last_at","score","interact_seq","target_id","next_think_at","wobble_x","wobble_y","drop_at","action_kind","pos_epoch","stun_until","immune_until","slow_until","foam_charges","foam_ready_at","charge_at","grenades","fire_seq","throw_seq","last_fire_at","last_fire_aim","face_x","face_y","stuck_at","stuck_x","stuck_y"] as const;
export async function synchronize(db:D1Database,s:Intent&{code:string;id:string;hash:string},now:number){
 const cutoff=now-ONLINE_MS;
 const {code,id,hash,...input}=s;
 // Persist input BEFORE attempting the room claim. A losing simulation never
 // overwrites input_json/input_seq, so its actions survive for the next winner.
 const read=await db.batch([
  db.prepare(`UPDATE players SET input_seq=?,input_at=MAX(?,last_at),input_json=? WHERE id=? AND room_code=? AND token_hash=? AND is_bot=0 AND input_seq<? AND MAX(last_at,input_at)>? AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND expires_at>? AND status<>'closed')`).bind(s.seq,now,JSON.stringify(input),id,code,hash,s.seq,cutoff,code,now),
  db.prepare("SELECT * FROM rooms WHERE code=? AND expires_at>? AND status<>'closed'").bind(code,now),
  db.prepare("SELECT * FROM players WHERE room_code=? ORDER BY is_bot,joined_at,id").bind(code),
  db.prepare("SELECT * FROM anomalies WHERE room_code=? ORDER BY id").bind(code),
 ]);
 const room=read[1].results[0] as RoomRow|undefined,rows=read[2].results as PlayerRow[],anomalies=read[3].results as AnomalyRow[];
 const self=rows.find(p=>p.id===id&&p.token_hash===hash&&!p.is_bot&&Math.max(p.last_at,p.input_at)>cutoff);if(!room||!self)return null;
 const players=rows.filter(p=>p.is_bot||Math.max(p.last_at,p.input_at)>cutoff);
 for(const a of anomalies)if(a.carrier_id&&!players.some(p=>p.id===a.carrier_id)){const old=rows.find(p=>p.id===a.carrier_id);if(old){a.x=old.x;a.y=old.y;}a.carrier_id=null;}
 const clock=Math.max(now,room.sim_at,...players.map(p=>p.input_at));
 const readState=publicState({...room},players,anomalies,clock);
 const actionable=players.some(p=>{if(p.input_seq<=p.seq)return false;try{const i=JSON.parse(p.input_json) as Intent;return (i.interactSeq??0)>p.interact_seq||(i.fireSeq??0)>p.fire_seq||(i.throwSeq??0)>p.throw_seq||Math.hypot((i.x??p.x)-p.x,(i.y??p.y)-p.y)>.01||i.dx||i.dy||p.vx||p.vy;}catch{return false;}});
 // Idle/redundant polls do not contend for a sub-step. Fresh actions and movement
 // still drain immediately, including the first input of a round.
 if(room.world!=="{}"&&room.status==="running"&&clock<room.round_ends_at&&clock-room.sim_at<40&&!actionable&&players.some(p=>p.id===room.host_id))return{...readState,syncSkipped:true};
 const oldRevision=room.revision,oldStatus=room.status;
 const world=readWorld(room,players,anomalies,clock);advance(world,clock);
 if(!players.some(p=>p.id===room.host_id&&!p.is_bot))room.host_id=players.find(p=>!p.is_bot)!.id;
 const claim=crypto.randomUUID();
 const payload=JSON.stringify(players.map(p=>Object.fromEntries([['id',p.id],...projectedKeys.map(k=>[k,p[k]])])));
 const guard="EXISTS(SELECT 1 FROM rooms WHERE code=? AND sim_owner=?)";
 const assignments=projectedKeys.map(k=>`${k}=json_extract(j.value,'$.${k}')`).join(',');
 const write=await db.batch([
  db.prepare(`UPDATE rooms SET revision=revision+1,sim_owner=?,sim_at=?,world=?,rng=?,status=?,host_id=? WHERE code=? AND revision=? AND round_id=? AND status=? AND EXISTS(SELECT 1 FROM players WHERE id=? AND token_hash=? AND is_bot=0 AND MAX(last_at,input_at)>?)`).bind(claim,room.sim_at,serializeWorld(world),world.rng,room.status,room.host_id,code,oldRevision,room.round_id,oldStatus,id,hash,cutoff),
  db.prepare(`UPDATE players SET ${assignments} FROM json_each(?) AS j WHERE players.id=json_extract(j.value,'$.id') AND room_code=? AND ${guard}`).bind(payload,code,code,claim),
  db.prepare(`UPDATE anomalies SET x=json_extract(j.value,'$.x'),y=json_extract(j.value,'$.y'),carrier_id=json_extract(j.value,'$.carrier_id'),respawn_at=json_extract(j.value,'$.respawn_at'),generation=json_extract(j.value,'$.generation') FROM json_each(?) AS j WHERE anomalies.id=json_extract(j.value,'$.id') AND room_code=? AND ${guard}`).bind(JSON.stringify(anomalies),code,code,claim),
  db.prepare(`DELETE FROM players WHERE room_code=? AND is_bot=0 AND MAX(last_at,input_at)<=? AND ${guard}`).bind(code,cutoff,code,claim),
 ]);
 if(!write[0].meta.changes){const accepted=world.players.find(p=>p.id===id)!;return{...readState,casLost:true,players:readState.players.map(p=>p.id===id?{...p,x:accepted.x,y:accepted.y,vx:accepted.vx,vy:accepted.vy,seq:accepted.seq,positionAt:accepted.last_at}:p)};}
 room.revision=oldRevision+1;return publicState(room,players,anomalies,clock);
}
