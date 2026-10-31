import type {ArenaRenderer,FrameView,RendererStats} from "./types";
import {readQuality,type Quality} from "./quality";
export type ViewState={kind:"3d";loading:boolean;notice:string;error?:boolean;reconnecting?:boolean};
export type DebugStats=RendererStats&{fps:number;frameMs:number;kind:"3d"};
type Factory=(failure:(message:string)=>void)=>ArenaRenderer;
type Options={load3d?:()=>Promise<Factory>;timeoutMs?:number;recoveryMs?:number;debug?:boolean};
let preload:Promise<typeof import("./three/arena3d")>|null=null;
export function preload3D(){return preload??=import("./three/arena3d").catch(e=>{preload=null;throw e;});}
export class RendererController{
 private renderer:ArenaRenderer|null=null;private host:HTMLDivElement|null=null;private width=1;private height=1;private generation=0;private disposed=false;private drawFailures=0;private recoveryFailures=0;private recovering=false;private timer:ReturnType<typeof setTimeout>|undefined;private lastView:FrameView|null=null;private debugAt=0;private quality:Quality="auto";
 constructor(private changed:(s:ViewState)=>void,private debug:(s:DebugStats)=>void,private options:Options={}){}
 mount(host:HTMLDivElement){this.host=host;this.quality=readQuality();void this.load(false);}
 private emit(s:Omit<ViewState,"kind">){if(!this.disposed)this.changed({kind:"3d",...s});}
 private clean(r:ArenaRenderer|null){try{r?.dispose();}catch{}}
 private fail(){this.recovering=false;clearTimeout(this.timer);this.clean(this.renderer);this.renderer=null;this.emit({loading:false,error:true,notice:"This game needs 3D graphics (WebGL 2)"});}
 private issue(message:string){if(this.disposed)return;if(message==="context-restored"){if(this.recovering){clearTimeout(this.timer);void this.load(true);}return;}if(this.recovering)return;this.recovering=true;this.emit({loading:true,reconnecting:true,notice:"Reconnecting graphics…"});this.timer=setTimeout(()=>void this.load(true),this.options.recoveryMs??3000);}
 private async load(recovery:boolean){
  if(this.disposed||!this.host)return;clearTimeout(this.timer);const generation=++this.generation;this.recovering=recovery;this.emit({loading:true,reconnecting:recovery,notice:recovery?"Reconnecting graphics…":"Powering up the lab…"});let candidate:ArenaRenderer|null=null,timer:ReturnType<typeof setTimeout>|undefined;
  try{const factory=await Promise.race([this.options.load3d?.()??preload3D().then(m=>(failure:(message:string)=>void)=>new m.ThreeRenderer(failure)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("3D load timed out")),this.options.timeoutMs??8000);})]);if(this.disposed||generation!==this.generation)return;candidate=factory(message=>{if(this.renderer===candidate)this.issue(message);});candidate.mount(this.host);candidate.resize(this.width,this.height);candidate.setQuality?.(this.quality);if(this.lastView)candidate.frame(this.lastView);const old=this.renderer;this.renderer=candidate;this.clean(old);this.recovering=false;this.drawFailures=0;this.recoveryFailures=0;this.emit({loading:false,notice:""});}
  catch{this.clean(candidate);if(this.disposed||generation!==this.generation)return;if(recovery&&++this.recoveryFailures<2){this.emit({loading:true,reconnecting:true,notice:"Reconnecting graphics…"});this.timer=setTimeout(()=>void this.load(true),this.options.recoveryMs??3000);}else this.fail();}finally{clearTimeout(timer);}
 }
 retry(){this.recoveryFailures=0;return this.load(false);}
 setQuality(q:Quality){this.quality=q;this.renderer?.setQuality?.(q);}
 resize(w:number,h:number){this.width=Math.max(1,w);this.height=Math.max(1,h);try{this.renderer?.resize(this.width,this.height);}catch{this.issue("resize");}}
 frame(view:FrameView){this.lastView=view;if(this.renderer&&!this.recovering)try{this.renderer.frame(view);this.drawFailures=0;}catch{if(++this.drawFailures>=3)this.issue("draw");}if(this.options.debug&&view.time-this.debugAt>=500){this.debugAt=view.time;this.debug({...this.renderer?.stats?.()??{calls:0,triangles:0,geometries:0,textures:0,pixelRatio:1,tier:"unavailable"},kind:"3d",frameMs:view.dt*1000,fps:view.dt?1/view.dt:0});}}
 worldPoint(x:number,y:number){return this.renderer?.worldPoint?.(x,y)??null;}
 dispose(){this.disposed=true;this.generation++;clearTimeout(this.timer);this.clean(this.renderer);this.renderer=null;this.host=null;this.lastView=null;}
}
