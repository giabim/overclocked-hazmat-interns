import { env } from "cloudflare:workers";
import { clamp, COLORS, direction, normalizeName, ONLINE_MS, WORLD } from "../../../lib/game";
import { ROUND } from "../../../lib/bot-settings";
import { onlineWhere, snapshot, synchronize, type RoomRow, type PlayerRow } from "../../../lib/room-engine";
export const dynamic="force-dynamic";
class GameError extends Error{constructor(message:string,public status=400){super(message);}}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0"}});
async function digest(value:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,"0")).join("");}
const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode=()=>[...crypto.getRandomValues(new Uint8Array(5))].map(n=>alphabet[n%alphabet.length]).join("");
const newToken=()=>crypto.randomUUID()+crypto.randomUUID();
export async function POST(request:Request){
 try{
  const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new GameError("Please open the game directly to connect.",403);
  if(Number(request.headers.get("content-length")||0)>4096)throw new GameError("Request too large.",413);
  const body=await request.json() as Record<string,unknown>;
  const db=env.DB;if(!db)throw new GameError("The lab is temporarily unavailable. Try again.",503);
  const now=Date.now();const cutoff=now-ONLINE_MS;const action=String(body.action||"");
  if(action==="create"){
   const name=normalizeName(body.name);if(!name)throw new GameError("Enter a nickname to clock in.");
   for(let attempt=0;attempt<5;attempt++){
    const code=newCode(),id=crypto.randomUUID(),token=newToken();
    try{
     await db.batch([
      db.prepare("INSERT INTO rooms(code,host_id,status,created_at,expires_at) VALUES (?,?,'lobby',?,?)").bind(code,id,now,now+21600000),
      db.prepare("INSERT INTO players(id,room_code,token_hash,name,color,x,y,last_at,joined_at) VALUES(?,?,?,?,?,160,300,?,?)").bind(id,code,await digest(token),name,COLORS[0],now,now),
     ]);
     return reply({session:{code,id,token},state:await snapshot(db,code,now)});
    }catch(error){if(String(error).includes("UNIQUE")&&attempt<4)continue;throw error;}
   }
  }
  const code=String(body.code||"").trim().toUpperCase();
  if(!/^[A-Z2-9]{5}$/.test(code))throw new GameError("Use the five-character code from your host.");
  if(action==="join"){
   const name=normalizeName(body.name);if(!name)throw new GameError("Enter a nickname to clock in.");
   const room=await db.prepare("SELECT * FROM rooms WHERE code=? AND expires_at>? AND status<>'closed'").bind(code,now).first<RoomRow>();
   if(!room)throw new GameError("Lab not found. Check the code with your host.",404);
   const rows=await db.prepare(`SELECT * FROM players WHERE room_code=? AND ${onlineWhere} ORDER BY is_bot,joined_at,id`).bind(code,cutoff).all<PlayerRow>();
   if(!rows.results.some(p=>!p.is_bot)){
    await db.batch([db.prepare("UPDATE rooms SET status='closed' WHERE code=? AND NOT EXISTS(SELECT 1 FROM players WHERE room_code=? AND is_bot=0 AND last_at>?)").bind(code,code,cutoff),db.prepare("DELETE FROM players WHERE room_code=? AND is_bot=1 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='closed')").bind(code,code)]);
    throw new GameError("This lab has closed. Create a new room.",404);
   }
   const replaced=rows.results.filter(p=>p.is_bot).sort((a,b)=>b.joined_at-a.joined_at||b.id.localeCompare(a.id))[0];
   const slot=COLORS.findIndex(c=>!rows.results.some(p=>p.color===c));
   const color=slot>=0?COLORS[slot]:replaced?.color||COLORS[0];
   const id=crypto.randomUUID(),token=newToken();
   const newest="SELECT id FROM players WHERE room_code=? AND is_bot=1 ORDER BY joined_at DESC,id DESC LIMIT 1";
   const full=`(SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})>=8`;
   const results=await db.batch([
    db.prepare(`UPDATE anomalies SET carrier_id=NULL WHERE room_code=? AND carrier_id=(${newest}) AND ${full}`).bind(code,code,code,cutoff),
    db.prepare(`DELETE FROM players WHERE id=(${newest}) AND ${full}`).bind(code,code,cutoff),
    db.prepare(`INSERT INTO players(id,room_code,token_hash,name,color,x,y,last_at,joined_at) SELECT ?,?,?,?,?,160,300,?,? WHERE (SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})<8 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND expires_at>? AND status<>'closed') AND EXISTS(SELECT 1 FROM players WHERE room_code=? AND is_bot=0 AND last_at>?)`).bind(id,code,await digest(token),name,color,now,now,code,cutoff,code,now,code,cutoff),
   ]);
   if(!results[2].meta.changes)throw new GameError("This lab is full. Ask your host to open another room.",409);
   await db.prepare(`INSERT OR IGNORE INTO anomalies(id,room_code,x,y) SELECT ?,?,570,155 WHERE EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='running') AND (SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})>=6`).bind(`${code}:2`,code,code,code,cutoff).run();
   return reply({session:{code,id,token},state:await snapshot(db,code,now)});
  }
  const id=String(body.id||""),token=String(body.token||"");
  if(!token||token.length>200||!id||id.length>100)throw new GameError("Your session has ended. Join again.",401);
  const hash=await digest(token);
  if(action==="sync"){
   const seq=typeof body.seq==="number"&&Number.isSafeInteger(body.seq)?body.seq:-1;
   const interactSeq=typeof body.interactSeq==="number"&&Number.isSafeInteger(body.interactSeq)?body.interactSeq:0;
   const d=direction(body.dx,body.dy);
   const hasPosition=body.x!==undefined||body.y!==undefined;
   if(hasPosition&&(typeof body.x!=="number"||typeof body.y!=="number"||!Number.isFinite(body.x)||!Number.isFinite(body.y)))throw new GameError("Invalid movement position.");
   const position=hasPosition?{x:clamp(body.x as number,WORLD.margin,WORLD.width-WORLD.margin),y:clamp(body.y as number,WORLD.margin,WORLD.height-WORLD.margin)}:{};
   const state=await synchronize(db,{code,id,hash,seq,dx:d.x,dy:d.y,interactSeq,...position},now);
   if(!state)throw new GameError("You were disconnected. Join the lab again.",401);
   return reply({state});
  }
  const result=await db.batch([
   db.prepare("SELECT * FROM rooms WHERE code=? AND expires_at>? AND status<>'closed'").bind(code,now),
   db.prepare("SELECT * FROM players WHERE id=? AND room_code=? AND token_hash=? AND is_bot=0 AND last_at>?").bind(id,code,hash,cutoff),
   db.prepare(`SELECT * FROM players WHERE room_code=? AND ${onlineWhere} ORDER BY is_bot,joined_at,id`).bind(code,cutoff),
  ]);
  const room=result[0].results[0] as RoomRow|undefined;const player=result[1].results[0] as PlayerRow|undefined;const participants=result[2].results as PlayerRow[];
  if(!room||!player)throw new GameError("Your session has ended. Join the lab again.",401);
  const humanHost=participants.find(p=>p.id===room.host_id&&!p.is_bot)||participants.find(p=>!p.is_bot);
  if(action==="leave"){
   await db.batch([
    db.prepare("UPDATE anomalies SET x=?,y=?,carrier_id=NULL WHERE room_code=? AND carrier_id=?").bind(player.x,player.y,code,id),
    db.prepare("DELETE FROM players WHERE id=? AND token_hash=?").bind(id,hash),
    db.prepare("UPDATE rooms SET host_id=COALESCE((SELECT id FROM players WHERE room_code=? AND is_bot=0 AND last_at>? ORDER BY joined_at,id LIMIT 1),host_id),status=CASE WHEN EXISTS(SELECT 1 FROM players WHERE room_code=? AND is_bot=0 AND last_at>?) THEN status ELSE 'closed' END WHERE code=?").bind(code,cutoff,code,cutoff,code),
    db.prepare("DELETE FROM players WHERE room_code=? AND is_bot=1 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='closed')").bind(code,code),
   ]);return reply({ok:true});
  }
  if(!["start","lobby","add_bot","remove_bot"].includes(action))throw new GameError("Unknown lab action.");
  if(humanHost?.id!==id)throw new GameError("Only the host can manage the round and bots.",403);
  await db.prepare("UPDATE rooms SET host_id=? WHERE code=?").bind(id,code).run();
  if(action==="add_bot"){
   if(room.status!=="lobby")throw new GameError("Add bots in the lobby before starting.");
   if(participants.length>=8)throw new GameError("The lab is full. Eight interns is the limit.",409);
   const botId=crypto.randomUUID();const slot=COLORS.findIndex(c=>!participants.some(p=>p.color===c));
   const added=await db.prepare(`INSERT INTO players(id,room_code,token_hash,name,color,x,y,last_at,joined_at,is_bot,bot_level)
    SELECT ?,?,'',?,?,?,300,?,?,1,1 WHERE (SELECT COUNT(*) FROM players WHERE room_code=? AND ${onlineWhere})<8 AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='lobby' AND host_id=?)`).bind(botId,code,`Bot ${botId.slice(0,3).toUpperCase()}`,COLORS[Math.max(0,slot)],200+participants.length*40,now,now,code,cutoff,code,id).run();
   if(!added.meta.changes)throw new GameError("The lab is full. Eight interns is the limit.",409);
  }else if(action==="remove_bot"){
   if(room.status!=="lobby")throw new GameError("Remove bots in the lobby before starting.");
   await db.prepare("DELETE FROM players WHERE id=? AND room_code=? AND is_bot=1").bind(String(body.botId||""),code).run();
  }else if(action==="start"){
   if(room.status!=="lobby")throw new GameError("Return to the lobby before starting another round.");
   if(participants.length<2)throw new GameError("Invite a friend or add a bot before starting.");
   const count=participants.length>=6?3:2;
   const batch=[
    db.prepare("UPDATE rooms SET status='running',round_ends_at=?,round_id=round_id+1,sim_at=?,sim_ms=0,sim_owner='',revision=revision+1 WHERE code=? AND status='lobby' AND host_id=?").bind(now+ROUND.durationMs,now,code,id),
    db.prepare("DELETE FROM anomalies WHERE room_code=?").bind(code),
    db.prepare("UPDATE players SET score=0,vx=0,vy=0,drop_at=0,target_id=NULL,next_think_at=0,action_kind=0,x=160+40*(SELECT COUNT(*) FROM players earlier WHERE earlier.room_code=players.room_code AND (earlier.joined_at<players.joined_at OR (earlier.joined_at=players.joined_at AND earlier.id<players.id))),y=300 WHERE room_code=?").bind(code),
   ];
   for(let i=0;i<count;i++){const p=ROUND.spawnPoints[i===0?0:i===1?4:2];batch.push(db.prepare("INSERT INTO anomalies(id,room_code,x,y) VALUES(?,?,?,?)").bind(`${code}:${i}`,code,p.x,p.y));}
   await db.batch(batch);
  }else{
   await db.batch([
    db.prepare("UPDATE rooms SET status='lobby',round_ends_at=0,sim_ms=0,sim_owner='',revision=revision+1 WHERE code=?").bind(code),
    db.prepare("UPDATE players SET vx=0,vy=0,drop_at=0,target_id=NULL,next_think_at=0,action_kind=0 WHERE room_code=?").bind(code),
    db.prepare("DELETE FROM anomalies WHERE room_code=?").bind(code),
   ]);
  }
  return reply({state:await snapshot(db,code,now)});
 }catch(error){
  if(error instanceof GameError)return reply({error:error.message},error.status);
  if(error instanceof SyntaxError)return reply({error:"Invalid request."},400);
  console.error("Room request failed",error instanceof Error?error.message:"Unknown error");
  return reply({error:"The lab connection hiccupped. Try again in a moment."},503);
 }
}
