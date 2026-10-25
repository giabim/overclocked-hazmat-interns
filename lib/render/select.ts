import type {ViewKind} from "./types";
export const VIEW_KEY="overclocked-view";
export function selectView(search:string,saved:string|null):ViewKind{
  const override=new URLSearchParams(search).get("view");
  if(override==="2d"||override==="3d")return override;
  return saved==="3d"?"3d":"2d"; // Gate 1: keep Classic as the default until a phone passes.
}
export function readViewPreference(){
  let saved:string|null=null;try{saved=localStorage.getItem(VIEW_KEY);}catch{/* Play normally when storage is blocked. */}
  return selectView(location.search,saved);
}
export function saveViewPreference(view:ViewKind){try{localStorage.setItem(VIEW_KEY,view);}catch{/* Optional preference only. */}}

// Foundation safety net. Full High/Medium/Low quality tiers are a later phase.
export class FrameHealth{
  private samples=new Float64Array(120);private index=0;private count=0;private total=0;
  private last:number|null=null;private warmUntil=0;private slowSince:number|null=null;
  reset(){this.last=null;this.count=0;this.total=0;this.index=0;this.slowSince=null;}
  get averageMs(){return this.count?this.total/this.count:0;}
  observe(time:number){
    if(this.last===null){this.last=time;this.warmUntil=time+2000;return false;}
    const elapsed=Math.max(1,Math.min(1000,time-this.last));this.last=time;
    if(time<this.warmUntil)return false;
    if(this.count===120)this.total-=this.samples[this.index];else this.count++;
    this.samples[this.index]=elapsed;this.total+=elapsed;this.index=(this.index+1)%120;
    if(this.averageMs>40){this.slowSince??=time;return time-this.slowSince>=5000;}
    this.slowSince=null;return false;
  }
}
