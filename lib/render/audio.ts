import type {GameEvent} from "./types";
export class LabAudio{
 private context:AudioContext|null=null;private muted=false;private lastCue=new Map<string,number>();
 setMuted(value:boolean){this.muted=value;}
 unlock(){if(!this.context)try{this.context=new AudioContext();}catch{return;}void this.context.resume();}
 cue(key:string,frequency:number,duration=.1){if(this.muted||!this.context||this.context.state!=="running")return;const now=this.context.currentTime;if(now-(this.lastCue.get(key)??-10)<.07)return;this.lastCue.set(key,now);const oscillator=this.context.createOscillator(),gain=this.context.createGain();oscillator.type="sine";oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.exponentialRampToValueAtTime(frequency*1.3,now+duration);gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);oscillator.connect(gain).connect(this.context.destination);oscillator.start(now);oscillator.stop(now+duration);}
 events(events:GameEvent[]){for(const e of events)this.cue(e.type,e.type==="deliver"?660:e.type==="grab"?380:e.type==="respawn"?500:220,e.type==="deliver"?.22:.08);}
 dispose(){void this.context?.close();this.context=null;}
}
