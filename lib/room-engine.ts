import { ONLINE_MS, WORLD } from "./game";
import { BOT_SETTINGS as BOT, ROUND } from "./bot-settings";
export type RoomRow={code:string;host_id:string;status:string;created_at:number;expires_at:number;round_ends_at:number;round_id:number;sim_at:number;revision:number};
export type PlayerRow={id:string;room_code:string;token_hash:string;name:string;color:string;x:number;y:number;vx:number;vy:number;seq:number;last_at:number;joined_at:number;is_bot:number;bot_level:number;score:number;interact_seq:number};
export type AnomalyRow={id:string;room_code:string;x:number;y:number;carrier_id:string|null;respawn_at:number;generation:number};
export const onlineWhere="(is_bot=1 OR last_at>?)";
export function publicState(room:RoomRow,players:PlayerRow[],anomalies:AnomalyRow[],now:number){
  const status=room.status==="running"&&room.round_ends_at>0&&now>=room.round_ends_at?"results":room.status;
  return {code:room.code,hostId:room.host_id,status,serverNow:now,roundEndsAt:room.round_ends_at,roundId:room.round_id,revision:room.revision,
    players:players.map(p=>({x:p.x,y:p.y,positionAt:p.last_at,id:p.id,name:p.name,color:p.color,vx:status==="running"?p.vx:0,vy:status==="running"?p.vy:0,seq:p.seq,interactSeq:p.interact_seq,connected:!!p.is_bot||now-p.last_at<3000,isBot:!!p.is_bot,level:1,score:p.score,carrying:anomalies.some(a=>a.carrier_id===p.id)})),
    anomalies:anomalies.map(a=>({id:a.id,x:a.x,y:a.y,carrierId:a.carrier_id,respawnAt:a.respawn_at,generation:a.generation})),
  };
}
export async function snapshot(db:D1Database,code:string,now:number){
  const result=await db.batch([
    db.prepare("SELECT * FROM rooms WHERE code=?").bind(code),
    db.prepare(`SELECT * FROM players WHERE room_code=? AND ${onlineWhere} ORDER BY is_bot,joined_at,id`).bind(code,now-ONLINE_MS),
    db.prepare("SELECT * FROM anomalies WHERE room_code=? ORDER BY id").bind(code),
  ]);
  const room=result[0].results[0] as RoomRow|undefined;
  return room?publicState(room,result[1].results as PlayerRow[],result[2].results as AnomalyRow[],now):null;
}

// Everything in this function is executed in one D1 batch. The SQL state machine
// claims elapsed time once per room; clients never advance bots or award points.
export async function synchronize(db:D1Database,s:{code:string;id:string;hash:string;seq:number;dx:number;dy:number;interactSeq:number;x?:number;y?:number},now:number){
  const requestId=crypto.randomUUID();const cutoff=now-ONLINE_MS;
  const statements:D1PreparedStatement[]=[];
  const q=(sql:string,...args:(string|number|null)[])=>statements.push(db.prepare(sql).bind(...args));
  const auth="EXISTS(SELECT 1 FROM players auth JOIN rooms ar ON ar.code=auth.room_code WHERE auth.id=? AND auth.room_code=? AND auth.token_hash=? AND auth.is_bot=0 AND auth.last_at>? AND ar.expires_at>? AND ar.status<>'closed')";
  const authArgs=[s.id,s.code,s.hash,cutoff,now] as const;
  const carrying="EXISTS(SELECT 1 FROM anomalies a WHERE a.carrier_id=players.id)";
  const speed=`${WORLD.speed}*CASE WHEN ${carrying} THEN ${ROUND.carrySpeedRatio} ELSE 1 END`;
  // Validate the client's predicted position against elapsed server time, before
  // grabs/deliveries. Materialize the old position so x/y share the same origin.
  // Older clients without x/y can still send direction-only movement.
  q(`WITH origin AS MATERIALIZED (
      SELECT players.id,x,y,vx,vy,rooms.status,
        CASE WHEN rooms.status='running' THEN MAX(0,MIN(?,rooms.round_ends_at)-MAX(last_at,rooms.round_ends_at-${ROUND.durationMs}))/1000.0 ELSE 0 END AS elapsed,
        ${speed} AS speed
      FROM players JOIN rooms ON rooms.code=players.room_code WHERE players.id=? AND players.room_code=?),
    target AS MATERIALIZED (SELECT *,COALESCE(?,x+vx*elapsed) AS tx,COALESCE(?,y+vy*elapsed) AS ty,speed*elapsed*1.3+10 AS allowance FROM origin),
    accepted AS MATERIALIZED (SELECT id,
      MAX(32,MIN(928,x+CASE WHEN status='running' THEN (tx-x)*MIN(1,allowance/MAX(0.000001,sqrt((tx-x)*(tx-x)+(ty-y)*(ty-y)))) ELSE 0 END)) AS x,
      MAX(32,MIN(568,y+CASE WHEN status='running' THEN (ty-y)*MIN(1,allowance/MAX(0.000001,sqrt((tx-x)*(tx-x)+(ty-y)*(ty-y)))) ELSE 0 END)) AS y FROM target)
    UPDATE players SET
    x=(SELECT x FROM accepted WHERE id=players.id),y=(SELECT y FROM accepted WHERE id=players.id),
    vx=CASE WHEN (SELECT status='running' AND round_ends_at>? FROM rooms WHERE code=?) THEN ?*(${speed}) ELSE 0 END,
    vy=CASE WHEN (SELECT status='running' AND round_ends_at>? FROM rooms WHERE code=?) THEN ?*(${speed}) ELSE 0 END,
    action_kind=CASE WHEN interact_seq<? AND (SELECT status='running' AND round_ends_at>? FROM rooms WHERE code=?) THEN CASE WHEN ${carrying} THEN 2 ELSE 1 END ELSE 0 END,
    interact_seq=MAX(interact_seq,?),last_at=?,seq=?
    WHERE id=? AND room_code=? AND is_bot=0 AND token_hash=? AND last_at>? AND last_at<=? AND seq<? AND ${auth}`,
    now,s.id,s.code,s.x??null,s.y??null,now,s.code,s.dx,now,s.code,s.dy,s.interactSeq,now,s.code,s.interactSeq,now,s.seq,s.id,s.code,s.hash,cutoff,now,s.seq,...authArgs);
  // Carry coordinates are persisted before an expired human is removed.
  q(`UPDATE anomalies SET x=COALESCE((SELECT x FROM players WHERE id=carrier_id),x),y=COALESCE((SELECT y FROM players WHERE id=carrier_id),y),carrier_id=NULL
    WHERE room_code=? AND carrier_id IN(SELECT id FROM players WHERE room_code=? AND is_bot=0 AND last_at<=?) AND ${auth}`,s.code,s.code,cutoff,...authArgs);
  q(`DELETE FROM players WHERE room_code=? AND is_bot=0 AND last_at<=? AND ${auth}`,s.code,cutoff,...authArgs);
  q(`UPDATE rooms SET host_id=(SELECT id FROM players WHERE room_code=? AND is_bot=0 AND last_at>? ORDER BY joined_at,id LIMIT 1)
    WHERE code=? AND NOT EXISTS(SELECT 1 FROM players WHERE id=rooms.host_id AND is_bot=0 AND last_at>?) AND ${auth}`,s.code,cutoff,s.code,cutoff,...authArgs);
  // Compare-and-set: effective time never moves backwards, and every subsequent
  // bot statement is guarded by this batch's unique claim token.
  q(`UPDATE rooms SET sim_ms=MIN(${BOT.maxCatchupMs},MAX(0,MIN(?,round_ends_at)-sim_at)),sim_at=MIN(?,round_ends_at),sim_owner=?,revision=revision+1
    WHERE code=? AND status='running' AND sim_at<MIN(?,round_ends_at) AND ${auth}`,now,now,requestId,s.code,now,...authArgs);
  const claimed="EXISTS(SELECT 1 FROM rooms r WHERE r.code=players.room_code AND r.sim_owner=? AND r.status='running')";
  q(`WITH candidates AS (
      SELECT b.id AS bot_id,a.id AS anomaly_id,
        ROW_NUMBER() OVER(PARTITION BY b.id ORDER BY (a.x-b.x)*(a.x-b.x)+(a.y-b.y)*(a.y-b.y),a.id) AS preference
      FROM players b JOIN anomalies a ON a.room_code=b.room_code WHERE b.room_code=? AND b.is_bot=1 AND a.respawn_at<=?)
    UPDATE players SET target_id=(SELECT anomaly_id FROM candidates c WHERE c.bot_id=players.id AND c.preference=1),
    next_think_at=?+${BOT.thinkMs},wobble_x=(ABS(random()%201)-100)/100.0*${BOT.wobble},wobble_y=(ABS(random()%201)-100)/100.0*${BOT.wobble}
    WHERE room_code=? AND is_bot=1 AND next_think_at<=? AND ${claimed}`,s.code,now,now,s.code,now,requestId);
  // Up to ten 50ms steps. L1-normalized steering stays below the Lv1 speed cap
  // in every direction; the intentionally clumsy bot can be slower diagonally.
  q(`WITH RECURSIVE
    targets AS (SELECT p.id,p.x,p.y,
      CASE WHEN EXISTS(SELECT 1 FROM anomalies c WHERE c.carrier_id=p.id) THEN 905 ELSE COALESCE((SELECT a.x FROM anomalies a WHERE a.id=p.target_id AND a.respawn_at<=?),p.x) END+p.wobble_x*50 AS tx,
      CASE WHEN EXISTS(SELECT 1 FROM anomalies c WHERE c.carrier_id=p.id) THEN 300 ELSE COALESCE((SELECT a.y FROM anomalies a WHERE a.id=p.target_id AND a.respawn_at<=?),p.y) END+p.wobble_y*50 AS ty,
      ${WORLD.speed*BOT.speedRatio}*CASE WHEN EXISTS(SELECT 1 FROM anomalies c WHERE c.carrier_id=p.id) THEN ${ROUND.carrySpeedRatio} ELSE 1 END AS speed,r.sim_ms
      FROM players p JOIN rooms r ON r.code=p.room_code WHERE p.room_code=? AND p.is_bot=1 AND r.sim_owner=? AND r.status='running'),
    path(id,x,y,tx,ty,speed,remaining,n) AS (
      SELECT id,x,y,tx,ty,speed,sim_ms,0 FROM targets
      UNION ALL SELECT id,MAX(32,MIN(928,x+(tx-x)*MIN(1,speed*MIN(${BOT.stepMs},remaining)/1000.0/MAX(1,ABS(tx-x)+ABS(ty-y))))),
        MAX(32,MIN(568,y+(ty-y)*MIN(1,speed*MIN(${BOT.stepMs},remaining)/1000.0/MAX(1,ABS(tx-x)+ABS(ty-y))))),tx,ty,speed,MAX(0,remaining-${BOT.stepMs}),n+1 FROM path WHERE remaining>0 AND n<10),
    final AS (SELECT id,x,y FROM path WHERE remaining=0)
    UPDATE players SET vx=COALESCE(((SELECT x FROM final f WHERE f.id=players.id)-x)*1000.0/MAX(1,(SELECT sim_ms FROM rooms WHERE code=players.room_code)),0),
      vy=COALESCE(((SELECT y FROM final f WHERE f.id=players.id)-y)*1000.0/MAX(1,(SELECT sim_ms FROM rooms WHERE code=players.room_code)),0),
      x=(SELECT x FROM final f WHERE f.id=players.id),y=(SELECT y FROM final f WHERE f.id=players.id),last_at=?
      WHERE id IN(SELECT id FROM final)`,now,now,s.code,requestId,now);
  // A carrier owns one canister. Coordinates are copied for targeting/rendering.
  q(`UPDATE anomalies SET x=(SELECT p.x FROM players p WHERE p.id=carrier_id),y=(SELECT p.y FROM players p WHERE p.id=carrier_id)
    WHERE room_code=? AND carrier_id IS NOT NULL AND EXISTS(SELECT 1 FROM players WHERE id=carrier_id) AND ${auth}`,s.code,...authArgs);
  q(`UPDATE anomalies SET carrier_id=NULL WHERE room_code=? AND carrier_id=? AND EXISTS(SELECT 1 FROM players WHERE id=? AND action_kind=2) AND ${auth}`,s.code,s.id,s.id,...authArgs);
  q(`UPDATE anomalies SET carrier_id=? WHERE id=(SELECT a.id FROM anomalies a JOIN players p ON p.id=?
      JOIN rooms r ON r.code=a.room_code WHERE a.room_code=? AND a.carrier_id IS NULL AND a.respawn_at<=? AND p.action_kind=1 AND r.status='running' AND r.round_ends_at>?
      AND (a.x-p.x)*(a.x-p.x)+(a.y-p.y)*(a.y-p.y)<=${ROUND.grabRadius**2}
      AND NOT EXISTS(SELECT 1 FROM anomalies held WHERE held.carrier_id=p.id)
      ORDER BY (a.x-p.x)*(a.x-p.x)+(a.y-p.y)*(a.y-p.y),a.id LIMIT 1) AND carrier_id IS NULL AND ${auth}`,s.id,s.id,s.code,now,now,...authArgs);
  q(`WITH choices AS (
      SELECT p.id AS bot_id,a.id AS anomaly_id,(p.x-a.x)*(p.x-a.x)+(p.y-a.y)*(p.y-a.y) AS d2,
      ROW_NUMBER() OVER(PARTITION BY p.id ORDER BY (p.x-a.x)*(p.x-a.x)+(p.y-a.y)*(p.y-a.y),a.id) AS preference
      FROM players p JOIN anomalies a ON a.room_code=p.room_code JOIN rooms r ON r.code=p.room_code
      WHERE p.room_code=? AND p.is_bot=1 AND a.carrier_id IS NULL AND a.respawn_at<=? AND r.sim_owner=? AND r.status='running' AND r.round_ends_at>?
      AND (p.x-a.x)*(p.x-a.x)+(p.y-a.y)*(p.y-a.y)<=${ROUND.grabRadius**2}
      AND NOT EXISTS(SELECT 1 FROM anomalies held WHERE held.carrier_id=p.id)),
    winners AS(SELECT bot_id,anomaly_id,ROW_NUMBER() OVER(PARTITION BY anomaly_id ORDER BY d2,bot_id) AS race FROM choices WHERE preference=1)
    UPDATE anomalies SET carrier_id=(SELECT bot_id FROM winners w WHERE w.anomaly_id=anomalies.id AND w.race=1)
    WHERE id IN(SELECT anomaly_id FROM winners WHERE race=1) AND carrier_id IS NULL`,s.code,now,requestId,now);
  q(`UPDATE players SET vx=vx*${ROUND.carrySpeedRatio},vy=vy*${ROUND.carrySpeedRatio}
    WHERE room_code=? AND EXISTS(SELECT 1 FROM anomalies WHERE carrier_id=players.id)
    AND ((id=? AND action_kind=1) OR (is_bot=1 AND drop_at=0)) AND ${auth}`,s.code,s.id,...authArgs);
  q(`UPDATE players SET drop_at=CASE WHEN ABS(random()%${BOT.accidentalDropEvery})=0 THEN ?+${BOT.dropDelayMinMs}+ABS(random()%${BOT.dropDelayRangeMs}) ELSE -1 END
    WHERE room_code=? AND is_bot=1 AND drop_at=0 AND EXISTS(SELECT 1 FROM anomalies WHERE carrier_id=players.id) AND ${claimed}`,now,s.code,requestId);
  q(`UPDATE anomalies SET carrier_id=NULL WHERE room_code=? AND carrier_id IN(SELECT id FROM players WHERE is_bot=1 AND room_code=? AND drop_at>0 AND drop_at<=?) AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND sim_owner=?)`,s.code,s.code,now,s.code,requestId);
  // Score before releasing the canister, within the same transaction. A second
  // request sees no carrier and cannot award the same delivery again.
  q(`UPDATE players SET score=score+(SELECT COUNT(*) FROM anomalies a WHERE a.carrier_id=players.id AND a.room_code=players.room_code)
    WHERE room_code=? AND x>=${ROUND.exitX} AND y BETWEEN ${ROUND.exitMinY} AND ${ROUND.exitMaxY}
    AND EXISTS(SELECT 1 FROM anomalies a WHERE a.carrier_id=players.id)
    AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='running') AND ${auth}`,s.code,s.code,...authArgs);
  q(`UPDATE anomalies SET carrier_id=NULL,respawn_at=?+${ROUND.respawnMs},generation=generation+1,
    x=CASE ABS(random()%3) WHEN 0 THEN 210 WHEN 1 THEN 380 ELSE 570 END,y=CASE ABS(random()%2) WHEN 0 THEN 155 ELSE 445 END
    WHERE room_code=? AND carrier_id IN(SELECT id FROM players WHERE room_code=? AND x>=${ROUND.exitX} AND y BETWEEN ${ROUND.exitMinY} AND ${ROUND.exitMaxY})
    AND EXISTS(SELECT 1 FROM rooms WHERE code=? AND status='running') AND ${auth}`,now,s.code,s.code,s.code,...authArgs);
  q(`UPDATE players SET drop_at=0 WHERE room_code=? AND is_bot=1 AND NOT EXISTS(SELECT 1 FROM anomalies WHERE carrier_id=players.id) AND ${claimed}`,s.code,requestId);
  q(`UPDATE rooms SET status='results',revision=revision+1 WHERE code=? AND status='running' AND round_ends_at<=? AND ${auth}`,s.code,now,...authArgs);
  q(`UPDATE players SET action_kind=0 WHERE id=? AND room_code=? AND token_hash=?`,s.id,s.code,s.hash);
  q("SELECT * FROM rooms WHERE code=? AND expires_at> ? AND status<>'closed'",s.code,now);
  q(`SELECT * FROM players WHERE room_code=? AND ${onlineWhere} ORDER BY is_bot,joined_at,id`,s.code,cutoff);
  q("SELECT * FROM anomalies WHERE room_code=? ORDER BY id",s.code);
  q("SELECT id FROM players WHERE id=? AND room_code=? AND token_hash=? AND is_bot=0 AND last_at>?",s.id,s.code,s.hash,cutoff);
  const results=await db.batch(statements);
  const n=results.length;const room=results[n-4].results[0] as RoomRow|undefined;
  if(!room||!results[n-1].results.length)return null;
  return publicState(room,results[n-3].results as PlayerRow[],results[n-2].results as AnomalyRow[],now);
}
