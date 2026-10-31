export const percentile=(values:number[],p:number)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]??0;};
export type PerformanceStats={fpsMedian:number;fpsFloor:number;frameP95:number;frameSD:number;long33:number;long50:number;reactCommits:number;cpuMs:number;correctionsPerMinute:number;casLosses:number};
export class PerformanceProbe{
 private commitPending=false;private frames:number[]=[];private cpu:number[]=[];private commits:number[]=[];private long:{at:number;ms:number}[]=[];private corrections:number[]=[];private cas:number[]=[];
 frame(at:number,ms:number,cpu:number){if(ms>0&&ms<=250){this.frames.push(ms);if(this.frames.length>300)this.frames.shift();this.cpu.push(cpu);if(this.cpu.length>300)this.cpu.shift();if(ms>33)this.long.push({at,ms});}}
 commit(at=performance.now()){if(this.commitPending)return;this.commitPending=true;queueMicrotask(()=>{this.commits.push(at);this.commitPending=false;});}
 correction(at=performance.now()){this.corrections.push(at);}
 casLoss(at=performance.now()){this.cas.push(at);}
 stats(at=performance.now()):PerformanceStats{this.commits=this.commits.filter(t=>at-t<=1000);this.long=this.long.filter(t=>at-t.at<=60000);this.corrections=this.corrections.filter(t=>at-t<=60000);this.cas=this.cas.filter(t=>at-t<=60000);const mean=this.frames.reduce((a,b)=>a+b,0)/Math.max(1,this.frames.length);return{fpsMedian:this.frames.length?1000/Math.max(1,percentile(this.frames,.5)):0,fpsFloor:this.frames.length?1000/Math.max(1,percentile(this.frames,.95)):0,frameP95:percentile(this.frames,.95),frameSD:Math.sqrt(this.frames.reduce((n,v)=>n+(v-mean)**2,0)/Math.max(1,this.frames.length)),long33:this.long.length,long50:this.long.filter(v=>v.ms>50).length,reactCommits:this.commits.length,cpuMs:percentile(this.cpu,.5),correctionsPerMinute:this.corrections.length,casLosses:this.cas.length};}
}
export const activeProbe:{current:PerformanceProbe|null}={current:null};
