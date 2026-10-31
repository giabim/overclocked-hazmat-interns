import {env} from "cloudflare:workers";
import {clamp,COLORS,direction,normalizeName,ONLINE_MS} from "../../../lib/game";
import {ROUND} from "../../../lib/bot-settings";
import {mapForId} from "../../../lib/sim/map";
import {seedFor} from "../../../lib/sim/rng";
import {onlineWhere,snapshot,synchronize,type RoomRow,type PlayerRow} from "../../../lib/room-engine";
export const dynamic="force-dynamic";
class GameError extends Error{constructor(message:string,public status=400){super(message);}}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0"}});
async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,"0")).join("");}
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode=()=>[...crypto.getRandomValues(new Uint8Array(5))].map(n=>alphabet[n%alphabet.length]).join("");
const newToken=()=>crypto.randomUUID()+crypto.randomUUID();
const number=(value:unknown,fallback=0)=>typeof value==="number"&&Number.isFinite(value)?value:fallback;
const counter=(value:unknown,fallback=0)=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?value:fallback;
export async function POST(request:Request){
 try{
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new GameError("Please open the game directly to connect.",403);
  if(Number(request.headers.get("content-length")||0)>4096)throw new GameError("Request too large.",413);
  const body=await request.json() as Record<string,unknown>,db=env.DB;if(!db)throw new GameError("The lab is temporarily unavailable. Try again.",503);
  const now=Date.now(),cutoff=now-ONLINE_MS,action=String(body.action||"");
  if(action==="create"){
   const name=normalizeName(body.name);if(!name)throw new GameError("Enter a nickname to clock in.");
   const mode=body.mode==="breach"?"breach":"classic",mapId=mode==="breach"?"lab-a":"classic",spawn=mapForId(mapId).spawns[0];
   for(let attempt=0;attempt<5;attempt++){
    const code=newCode(),id=crypto.randomUUID(),token=newToken();
    try{
     await db.batch([
      db.prepare("INSERT INTO rooms(code,host_id,status,created_at,expires_at,mode,map_id,rng) VALUES(?,?,'lobby',?,?,?,?,?)").bind(code,id,now,now+21600000,mode,mapId,seedFor(code)),
      db.prepare("INSERT INTO players(id,room_code,token_hash,name,color,x,y,last_at,joined_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,code,await digest(token),name,COLORS[0],spawn.x,spawn.y,now,now),
     ]);return reply({session:{code,id,token},state:await snapshot(db,code,now)});
    }catch(e){if(String(e).includes("UNIQUE")&&attempt<4)continue;throw e;}
   }
  }
  const code=String(body.code||"").trim().toUpperCase();if(!/^[A-Z2-9]{5}$/.test(code))throw new GameError("Use the five-character code from your host.");
  if(action==="join"){
   const name=normalizeName(body.name);if(!name)throw new GameError("Enter a nickname to clock in.");
   const room=await db.prepare("SELECT * FROM rooms WHERE code=? AND expires_at>? AND status<>'closed'").bind(code,now).first<RoomRow>();
   if(!room)throw new GameError("Lab not found. Check the code with your host.",404);
   const rows=await db.prepare(`SELECT * FROM players WHERE room_code=? AND ${onlineWhere} ORDER BY is_bot,joined_at,id`).bind(code,cutoff).all<PlayerRow>();
   if(!rows.results.some(p=>!p.is_bot)){
    await db.batch([db.prepare("UPDATE rooms SET status='closed',revision=revision+1 WHERE code=? AND NOT EXISTS(SELECT 1 FROM players WHERE room_code=? AND is_bot=0 AND MAX(last_at,input_at)>?)").bind(code,code,cutoff),db.prepare("DELETE FROM players WHERE room_code=? AND is_bot=1 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='closed')").bind(code,code)]);throw new GameError("This lab has closed. Create a new room.",404);
   }
   const id=crypto.randomUUID(),token=newToken(),map=mapForId(room.map_id),spawn=map.spawns[Math.min(rows.results.length,7)];
   const newest="SELECT id FROM players WHERE room_code=? AND is_bot=1 ORDER BY joined_at DESC,id DESC LIMIT 1",full=`(SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})>=8`;
   const inserted=await db.batch([
    db.prepare(`UPDATE anomalies SET carrier_id=NULL WHERE room_code=? AND carrier_id=(${newest}) AND ${full}`).bind(code,code,code,cutoff),
    db.prepare(`DELETE FROM players WHERE id=(${newest}) AND ${full}`).bind(code,code,cutoff),
    db.prepare(`INSERT INTO players(id,room_code,token_hash,name,color,x,y,last_at,joined_at)
      SELECT ?,?,?,?,COALESCE((SELECT c.value FROM json_each(?) c WHERE NOT EXISTS(SELECT 1 FROM players WHERE room_code=? AND color=c.value AND ${onlineWhere}) LIMIT 1),?),?,?,?,?
      WHERE (SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})<8 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND expires_at>? AND status<>'closed') AND EXISTS(SELECT 1 FROM players WHERE room_code=? AND is_bot=0 AND MAX(last_at,input_at)>?)`).bind(id,code,await digest(token),name,JSON.stringify(COLORS),code,cutoff,COLORS[0],spawn.x,spawn.y,now,now,code,cutoff,code,now,code,cutoff),
    db.prepare(`INSERT OR IGNORE INTO anomalies(id,room_code,x,y) SELECT ?,?,570,155 WHERE EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='running' AND mode='classic') AND (SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})>=6`).bind(`${code}:2`,code,code,code,cutoff),
    db.prepare("UPDATE rooms SET revision=revision+1 WHERE code=? AND EXISTS(SELECT 1 FROM players WHERE id=?)").bind(code,id),
   ]);
   if(!inserted[2].meta.changes)throw new GameError("This lab is full. Ask your host to open another room.",409);
   return reply({session:{code,id,token},state:await snapshot(db,code,now)});
  }
  const id=String(body.id||""),token=String(body.token||"");if(!token||token.length>200||!id||id.length>100)throw new GameError("Your session has ended. Join again.",401);
  const hash=await digest(token);
  if(action==="sync"){
   const d=direction(body.dx,body.dy),hasPosition=body.x!==undefined||body.y!==undefined;
   if(hasPosition&&(typeof body.x!=="number"||typeof body.y!=="number"||!Number.isFinite(body.x)||!Number.isFinite(body.y)))throw new GameError("Invalid movement position.");
   const position=hasPosition?{x:clamp(body.x as number,-1000000,1000000),y:clamp(body.y as number,-1000000,1000000)}:{};
   const state=await synchronize(db,{code,id,hash,seq:counter(body.seq,-1),dx:d.x,dy:d.y,interactSeq:counter(body.interactSeq),fireSeq:counter(body.fireSeq),throwSeq:counter(body.throwSeq),...(body.posEpoch===undefined?{}:{posEpoch:counter(body.posEpoch)}),aim:number(body.aim,Math.atan2(d.y,d.x)),viewDelayMs:clamp(number(body.viewDelayMs,200),0,1500),rttMs:clamp(number(body.rttMs),0,2000),...position},now);
   if(!state)throw new GameError("You were disconnected. Join the lab again.",401);return reply({state});
  }
  const read=await db.batch([
   db.prepare("SELECT * FROM rooms WHERE code=? AND expires_at>? AND status<>'closed'").bind(code,now),
   db.prepare("SELECT * FROM players WHERE id=? AND room_code=? AND token_hash=? AND is_bot=0 AND MAX(last_at,input_at)>?").bind(id,code,hash,cutoff),
   db.prepare(`SELECT * FROM players WHERE room_code=? AND ${onlineWhere} ORDER BY is_bot,joined_at,id`).bind(code,cutoff),
  ]);
  const room=read[0].results[0] as RoomRow|undefined,player=read[1].results[0] as PlayerRow|undefined,participants=read[2].results as PlayerRow[];
  if(!room||!player)throw new GameError("Your session has ended. Join again.",401);
  const humanHost=participants.find(p=>p.id===room.host_id&&!p.is_bot)||participants.find(p=>!p.is_bot);
  if(action==="leave"){
   await db.batch([
    db.prepare("UPDATE anomalies SET x=?,y=?,carrier_id=NULL WHERE room_code=? AND carrier_id=?").bind(player.x,player.y,code,id),
    db.prepare("DELETE FROM players WHERE id=? AND token_hash=?").bind(id,hash),
    db.prepare("UPDATE rooms SET revision=revision+1,host_id=COALESCE((SELECT id FROM players WHERE room_code=? AND is_bot=0 AND MAX(last_at,input_at)>? ORDER BY joined_at,id LIMIT 1),host_id),status=CASE WHEN EXISTS(SELECT 1 FROM players WHERE room_code=? AND is_bot=0 AND MAX(last_at,input_at)>?) THEN status ELSE 'closed' END WHERE code=?").bind(code,cutoff,code,cutoff,code),
    db.prepare("DELETE FROM players WHERE room_code=? AND is_bot=1 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='closed')").bind(code,code),
   ]);return reply({ok:true});
  }
  if(!["start","lobby","add_bot","remove_bot","configure","set_bot_level"].includes(action))throw new GameError("Unknown lab action.");
  if(humanHost?.id!==id)throw new GameError("Only the host can manage the round and bots.",403);
  if(action!=="lobby"&&room.status!=="lobby")throw new GameError("Return to the lobby to change the crew or mode.");
  const map=mapForId(room.map_id);
  if(action==="configure"){
   const mode=body.mode==="breach"?"breach":"classic",mapId=mode==="breach"?"lab-a":"classic";
   const spawns=participants.map((p,i)=>({id:p.id,...mapForId(mapId).spawns[Math.min(i,7)]}));
   await db.batch([
    db.prepare("UPDATE rooms SET mode=?,map_id=?,chaos=?,world='{}',revision=revision+1,host_id=? WHERE code=? AND status='lobby'").bind(mode,mapId,body.chaos===true?1:0,id,code),
    db.prepare("UPDATE players SET x=json_extract(j.value,'$.x'),y=json_extract(j.value,'$.y'),vx=0,vy=0 FROM json_each(?) j WHERE players.id=json_extract(j.value,'$.id') AND room_code=? AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='lobby')").bind(JSON.stringify(spawns),code,code),
   ]);
  }else if(action==="set_bot_level"){
   const level=counter(body.level);if(level<1||level>3)throw new GameError("Choose bot level 1, 2, or 3.");
   await db.batch([db.prepare("UPDATE players SET bot_level=? WHERE id=? AND room_code=? AND is_bot=1 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='lobby')").bind(level,String(body.botId||""),code,code),db.prepare("UPDATE rooms SET revision=revision+1,host_id=? WHERE code=?").bind(id,code)]);
  }else if(action==="add_bot"){
   if(participants.length>=8)throw new GameError("The lab is full. Eight interns is the limit.",409);
   const botId=crypto.randomUUID(),spawn=map.spawns[Math.min(participants.length,7)],level=clamp(counter(body.level,1),1,3);
   const added=await db.batch([
    db.prepare(`INSERT INTO players(id,room_code,token_hash,name,color,x,y,last_at,joined_at,is_bot,bot_level)
      SELECT ?,?,'',?,COALESCE((SELECT c.value FROM json_each(?) c WHERE NOT EXISTS(SELECT 1 FROM players WHERE room_code=? AND color=c.value AND ${onlineWhere}) LIMIT 1),?),?,?,?,?,1,?
      WHERE (SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})<8 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='lobby')`).bind(botId,code,`Bot ${botId.slice(0,3).toUpperCase()}`,JSON.stringify(COLORS),code,cutoff,COLORS[0],spawn.x,spawn.y,now,now,level,code,cutoff,code),
    db.prepare("UPDATE rooms SET revision=revision+1,host_id=? WHERE code=?").bind(id,code),
   ]);if(!added[0].meta.changes)throw new GameError("The lab is full. Eight interns is the limit.",409);
  }else if(action==="remove_bot"){
   await db.batch([db.prepare("DELETE FROM players WHERE id=? AND room_code=? AND is_bot=1 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='lobby')").bind(String(body.botId||""),code,code),db.prepare("UPDATE rooms SET revision=revision+1,host_id=? WHERE code=?").bind(id,code)]);
  }else if(action==="start"){
   if(participants.length<2)throw new GameError("Invite a friend or add a bot before starting.");
   const count=room.mode==="breach"?map.canisters.length:participants.length>=6?3:2;
   const positions=[...participants].sort((a,b)=>a.joined_at-b.joined_at||a.id.localeCompare(b.id)).map((p,i)=>({id:p.id,...map.spawns[Math.min(i,7)]}));
   const claim=crypto.randomUUID(),guard="EXISTS(SELECT 1 FROM rooms WHERE code=? AND sim_owner=?)";
   const batch=[
    db.prepare("UPDATE rooms SET status='running',round_ends_at=?,round_id=round_id+1,sim_at=?,sim_ms=0,sim_owner=?,world='{}',rng=?,revision=revision+1,host_id=? WHERE code=? AND status='lobby'").bind(now+ROUND.durationMs,now,claim,seedFor(code+now),id,code),
    db.prepare(`DELETE FROM anomalies WHERE room_code=? AND ${guard}`).bind(code,code,claim),
    db.prepare(`UPDATE players SET score=0,vx=0,vy=0,drop_at=0,target_id=NULL,next_think_at=0,action_kind=0,stun_until=0,immune_until=0,slow_until=0,foam_charges=5,charge_at=?,grenades=0,foam_ready_at=0,last_fire_at=0,pos_epoch=pos_epoch+1,input_seq=seq,input_json='{}',stuck_at=0,x=json_extract(j.value,'$.x'),y=json_extract(j.value,'$.y') FROM json_each(?) j WHERE players.id=json_extract(j.value,'$.id') AND room_code=? AND ${guard}`).bind(now,JSON.stringify(positions),code,code,claim),
   ];
   for(let i=0;i<count;i++){const p=map.canisters[room.mode==="breach"?i:i===0?0:i===1?4:2];batch.push(db.prepare(`INSERT INTO anomalies(id,room_code,x,y) SELECT ?,?,?,? WHERE ${guard}`).bind(`${code}:${i}`,code,p.x,p.y,code,claim));}
   const started=await db.batch(batch);if(!started[0].meta.changes)throw new GameError("The round already started.",409);
  }else{
   await db.batch([db.prepare("UPDATE rooms SET status='lobby',round_ends_at=0,sim_ms=0,sim_owner='',world='{}',revision=revision+1,host_id=? WHERE code=?").bind(id,code),db.prepare("UPDATE players SET vx=0,vy=0,drop_at=0,target_id=NULL,next_think_at=0,action_kind=0,input_json='{}',input_seq=seq WHERE room_code=?").bind(code),db.prepare("DELETE FROM anomalies WHERE room_code=?").bind(code)]);
  }
  return reply({state:await snapshot(db,code,now)});
 }catch(e){
  if(e instanceof GameError)return reply({error:e.message},e.status);if(e instanceof SyntaxError)return reply({error:"Invalid request."},400);
  console.error("Room request failed",e instanceof Error?e.message:"Unknown error");return reply({error:"The lab connection hiccupped. Try again in a moment."},503);
 }
}
