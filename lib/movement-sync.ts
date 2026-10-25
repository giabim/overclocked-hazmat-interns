import { clamp, WORLD } from "./game";
import { ROUND } from "./bot-settings";

type Point = {x:number;y:number};
type Sample = Point & {serverNow:number};
type SyncedPlayer = Point & {id:string;seq:number;positionAt:number};
type MovementState = {code:string;roundId:number;status:string;serverNow:number;players:SyncedPlayer[]};
type Track = {samples:Sample[];gaps:number[];cursor:number|null;delay:number};

export const RUNNING_POLL_MS=100;
export const IDLE_POLL_MS=850;
export function pollDelay(start:number,now:number,running:boolean){
  return Math.max(0,(running?RUNNING_POLL_MS:IDLE_POLL_MS)-(now-start));
}

// Client-only state. Authoritative snapshots never advance the local player by
// their age, and remote rendering never guesses velocity beyond a snapshot.
export class MovementSync {
  private epoch="";
  private epochAt=0;
  private running=false;
  private self:Point|null=null;
  private correction={x:0,y:0,remaining:0};
  private pending=new Map<number,Point>();
  private acknowledged=-1;
  private tracks=new Map<string,Track>();
  private clockOffset:number|null=null;

  reset(){
    this.epoch="";this.self=null;this.pending.clear();this.tracks.clear();
    this.correction={x:0,y:0,remaining:0};this.acknowledged=-1;this.clockOffset=null;
  }

  receive(state:MovementState,selfId:string,receivedAt:number,rtt:number){
    const epoch=`${state.code}:${state.roundId}:${state.status}`;
    if(epoch!==this.epoch){this.reset();this.epoch=epoch;this.epochAt=state.serverNow;}
    this.running=state.status==="running";
    const offset=state.serverNow+Math.max(0,rtt)/2-receivedAt;
    this.clockOffset=this.clockOffset===null?offset:this.clockOffset+(offset-this.clockOffset)*.1;
    const active=new Set(state.players.map(p=>p.id));
    for(const id of this.tracks.keys())if(!active.has(id))this.tracks.delete(id);
    for(const player of state.players){
      if(player.id===selfId){
        if(!this.self||!this.running)this.self={x:player.x,y:player.y};
        // Compare with what we sent for this acknowledged input, not our newer
        // position at response time. RTT alone must never trigger a correction.
        const sent=this.pending.get(player.seq);
        if(sent&&player.seq>this.acknowledged){
          const x=player.x-sent.x,y=player.y-sent.y;
          if(Math.hypot(x,y)>40)this.correction={x,y,remaining:150};
        }
        this.acknowledged=Math.max(this.acknowledged,player.seq);
        for(const seq of this.pending.keys())if(seq<=player.seq)this.pending.delete(seq);
        continue;
      }
      const track=this.tracks.get(player.id)??{samples:[],gaps:[],cursor:null,delay:200};
      const serverNow=Math.max(this.epochAt,player.positionAt);
      const last=track.samples.at(-1);
      if(!last||serverNow>last.serverNow){
        if(last){track.gaps.push(serverNow-last.serverNow);if(track.gaps.length>4)track.gaps.shift();}
        track.samples.push({x:player.x,y:player.y,serverNow});
        if(track.samples.length>4){
          // A burst after a slow packet must not evict the pair currently being
          // played. Keep that bracket plus the newest samples, within four slots.
          if(track.cursor!==null&&track.samples[1].serverNow>track.cursor)track.samples.splice(2,1);
          else track.samples.shift();
        }
        // Four distinct position samples survive faster observer polls. Grow the
        // 200ms buffer when a sender/observer can only deliver slower snapshots.
        const desired=Math.max(200,Math.min(1500,Math.max(0,...track.gaps)*1.25));
        track.delay=desired>track.delay?desired:track.delay+(desired-track.delay)*.1;
      }
      this.tracks.set(player.id,track);
    }
  }

  recordSent(seq:number):Point|undefined{
    if(!this.self)return;
    const point={...this.self};this.pending.set(seq,point);
    // Bound memory even through repeated failed requests.
    if(this.pending.size>64)this.pending.delete(this.pending.keys().next().value!);
    return point;
  }

  localPosition(input:Point,carrying:boolean,dt:number):Point|null{
    if(!this.self)return null;
    if(this.running){
      const speed=WORLD.speed*(carrying?ROUND.carrySpeedRatio:1);
      let x=input.x*speed*dt,y=input.y*speed*dt;
      if(this.correction.remaining>0){
        const fraction=Math.min(1,dt*1000/this.correction.remaining);
        x+=this.correction.x*fraction;y+=this.correction.y*fraction;
        this.correction.x*=1-fraction;this.correction.y*=1-fraction;
        this.correction.remaining=Math.max(0,this.correction.remaining-dt*1000);
      }
      this.self.x=clamp(this.self.x+x,WORLD.margin,WORLD.width-WORLD.margin);
      this.self.y=clamp(this.self.y+y,WORLD.margin,WORLD.height-WORLD.margin);
    }
    return {...this.self};
  }

  remotePosition(id:string,time:number,dt:number):Point|null{
    const track=this.tracks.get(id);if(!track?.samples.length)return null;
    const samples=track.samples;
    if(!this.running)return {...samples[samples.length-1]};
    const target=Math.min(time+(this.clockOffset??0)-track.delay,samples[samples.length-1].serverNow);
    // Monotonic playback prevents clock jitter/buffer changes from rewinding.
    // Catch up gradually instead of jumping when a later snapshot arrives.
    track.cursor=track.cursor===null?target:Math.max(track.cursor,Math.min(target,track.cursor+dt*1100));
    const at=track.cursor;
    if(at<=samples[0].serverNow)return {...samples[0]};
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i];
      if(at<=b.serverNow){
        const t=(at-a.serverNow)/(b.serverNow-a.serverNow);
        return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      }
    }
    // Missing snapshots hold the last confirmed position, never extrapolate.
    return {...samples[samples.length-1]};
  }
}
