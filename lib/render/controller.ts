import {Canvas2DRenderer} from "./canvas2d";
import {FrameHealth} from "./select";
import type {ArenaRenderer,FrameView,RendererStats,ViewKind} from "./types";
export type ViewState={kind:ViewKind;loading:boolean;notice:string};
export type DebugStats=RendererStats&{fps:number;frameMs:number;kind:ViewKind};
type Factory=(failure:(message:string)=>void)=>ArenaRenderer;
type Options={classic?:()=>ArenaRenderer;load3d?:()=>Promise<Factory>;timeoutMs?:number};
export class RendererController{
  private renderer:ArenaRenderer|null=null;
  private host:HTMLDivElement|null=null;
  private width=1;private height=1;private generation=0;private disposed=false;private failures=0;
  private lastView:FrameView|null=null;private health=new FrameHealth();private debugAt=0;
  private visibility=()=>this.health.reset();
  private classic:()=>ArenaRenderer;
  private load3d:()=>Promise<Factory>;
  private state:ViewState={kind:"2d",loading:false,notice:""};
  constructor(private changed:(state:ViewState)=>void,private debug:(stats:DebugStats)=>void,private options:Options={}){
    this.classic=options.classic??(()=>new Canvas2DRenderer());
    this.load3d=options.load3d??(()=>import("./three/arena3d").then(module=>failure=>new module.ThreeRenderer(failure)));
  }
  mount(host:HTMLDivElement,view:ViewKind){
    this.host=host;this.renderer=this.classic();this.renderer.mount(host);
    document.addEventListener("visibilitychange",this.visibility);
    this.changed(this.state);if(view==="3d")void this.choose("3d");
  }
  private emit(state:ViewState){this.state=state;if(!this.disposed)this.changed(state);}
  private clean(renderer:ArenaRenderer|null){try{renderer?.dispose();}catch{/* Do not strand the working renderer during cleanup. */}}
  private classicView(notice=""){
    this.generation++;this.failures=0;this.health.reset();
    if(this.host&&this.renderer?.kind!=="2d"){
      const old=this.renderer;this.renderer=this.classic();this.renderer.mount(this.host);this.renderer.resize(this.width,this.height);
      if(this.lastView)this.renderer.frame(this.lastView);this.clean(old);
    }
    this.emit({kind:"2d",loading:false,notice});
  }
  async choose(kind:ViewKind){
    if(this.disposed||!this.host)return;
    if(kind==="2d"){this.classicView();return;}
    if(this.renderer?.kind==="3d"){this.emit({kind:"3d",loading:false,notice:""});return;}
    const generation=++this.generation;this.emit({kind:"2d",loading:true,notice:""});
    let timer:ReturnType<typeof setTimeout>|undefined;let candidate:ArenaRenderer|null=null;
    try{
      const factory=await Promise.race([this.load3d(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("3D loading timed out")),this.options.timeoutMs??8000);})]);
      if(this.disposed||generation!==this.generation)return;
      candidate=factory(message=>{if(!this.disposed&&this.renderer===candidate)this.classicView(message);});
      candidate.mount(this.host);candidate.resize(this.width,this.height);
      if(this.lastView)candidate.frame(this.lastView);
      const old=this.renderer;this.renderer=candidate;this.clean(old);this.failures=0;this.health.reset();
      this.emit({kind:"3d",loading:false,notice:""});
    }catch{
      this.clean(candidate);
      if(!this.disposed&&generation===this.generation)this.classicView("3D isn't available here. You can keep playing in Classic 2D.");
    }finally{clearTimeout(timer);}
  }
  resize(width:number,height:number){
    this.width=width;this.height=height;
    try{this.renderer?.resize(width,height);}
    catch{if(this.renderer?.kind==="3d")this.classicView("3D could not resize the lab. Classic 2D is ready.");}
  }
  frame(view:FrameView){
    if(!this.renderer||this.disposed)return;this.lastView=view;
    try{this.renderer.frame(view);this.failures=0;}
    catch{if(++this.failures>=3&&this.renderer.kind==="3d")this.classicView("3D had trouble drawing the lab. Classic 2D is ready.");}
    const tooSlow=this.health.observe(view.time);
    if(this.renderer.kind==="3d"&&!document.hidden&&tooSlow)this.classicView("Switched to Classic 2D for smoother play.");
    if(view.time-this.debugAt>=500){
      this.debugAt=view.time;const frameMs=this.health.averageMs;
      this.debug({...this.renderer.stats?.()??{calls:0,triangles:0,geometries:0,textures:0,pixelRatio:Math.min(window.devicePixelRatio||1,2)},fps:frameMs?1000/frameMs:0,frameMs,kind:this.renderer.kind});
    }
  }
  dispose(){this.disposed=true;this.generation++;document.removeEventListener("visibilitychange",this.visibility);this.clean(this.renderer);this.renderer=null;this.host=null;this.lastView=null;}
}
