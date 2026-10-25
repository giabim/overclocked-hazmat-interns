import type {GameEvent} from "./types";
type EventSnapshot={
  code:string;roundId:number;status:string;serverNow:number;
  players:{id:string;x:number;y:number;carrying:boolean;score:number}[];
  anomalies:{id:string;carrierId:string|null;respawnAt:number;generation:number}[];
};
export function diffSnapshots(previous:EventSnapshot|null,next:EventSnapshot):GameEvent[]{
  if(!previous||previous.code!==next.code||previous.roundId!==next.roundId||previous.status!=="running"||next.status!=="running"||next.serverNow<=previous.serverNow||next.serverNow-previous.serverNow>1000)return [];
  const events:GameEvent[]=[];
  for(const p of next.players){
    const old=previous.players.find(a=>a.id===p.id);if(!old)continue;
    if(p.score>old.score)events.push({type:"deliver",playerId:p.id});
    else if(old.carrying&&!p.carrying)events.push({type:"drop",playerId:p.id,x:p.x,y:p.y});
    if(!old.carrying&&p.carrying)events.push({type:"grab",playerId:p.id});
  }
  for(const a of next.anomalies){
    const old=previous.anomalies.find(b=>b.id===a.id);
    if(old&&old.respawnAt>previous.serverNow&&!a.carrierId&&a.respawnAt<=next.serverNow&&a.generation===old.generation)events.push({type:"respawn",anomalyId:a.id});
  }
  return events;
}
export class RenderEvents{
  private previous:EventSnapshot|null=null;
  private pending:{event:GameEvent;at:number}[]=[];
  push(next:EventSnapshot,receivedAt:number){
    if(this.previous&&next.serverNow<this.previous.serverNow)return;
    if(this.previous&&(this.previous.code!==next.code||this.previous.roundId!==next.roundId||this.previous.status!==next.status))this.pending=[];
    this.pending.push(...diffSnapshots(this.previous,next).map(event=>({event,at:receivedAt})));
    this.previous=next;
  }
  drain(now:number){const events=this.pending.filter(item=>now-item.at<=1000).map(item=>item.event);this.pending=[];return events;}
  reset(){this.previous=null;this.pending=[];}
}
