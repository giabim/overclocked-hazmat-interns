import {AdditiveBlending,BoxGeometry,CapsuleGeometry,CircleGeometry,Color,CylinderGeometry,DirectionalLight,Group,HemisphereLight,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshToonMaterial,PerspectiveCamera,RingGeometry,Scene,SRGBColorSpace,Vector3,WebGLRenderer} from "three";
import {toScene} from "../coords";
import {addLabel,drawLabels,type Label} from "../labels";
import type {ArenaRenderer,FramePlayer,FrameView} from "../types";
import {fitCamera} from "./camera";
import {createLab} from "./lab";
import {Resources} from "./resources";

type Intern={root:Group;body:Mesh;visor:Mesh;antenna:Mesh;held:Group;material:MeshToonMaterial;visorMaterial:MeshBasicMaterial};
export class ThreeRenderer implements ArenaRenderer{
  readonly kind="3d" as const;
  private renderer:WebGLRenderer|null=null;
  private canvas:HTMLCanvasElement|null=null;
  private overlay:HTMLCanvasElement|null=null;
  private context:CanvasRenderingContext2D|null=null;
  private scene=new Scene();
  private camera=new PerspectiveCamera(30,1,.5,300);
  private resources=new Resources();
  private interns=new Map<string,Intern>();
  private canisters=new Map<string,Group>();
  private shadows:InstancedMesh|null=null;
  private ring:Mesh|null=null;
  private width=1;private height=1;private ratio=1;private lastDraw=-Infinity;
  private point=new Vector3();private matrix=new Matrix4();
  private capsule=this.resources.own(new CapsuleGeometry(.45,.45,4,12));
  private visorGeo=this.resources.own(new BoxGeometry(.5,.17,.16));
  private antennaGeo=this.resources.own(new BoxGeometry(.09,.25,.09));
  private bodyGeo=this.resources.own(new CylinderGeometry(.28,.28,.75,12));
  private capGeo=this.resources.own(new CylinderGeometry(.23,.23,.1,12));
  private glowGeo=this.resources.own(new CylinderGeometry(.38,.38,.85,12));
  private canisterMaterial=this.resources.own(new MeshToonMaterial({color:"#9aeddf",emissive:"#296a60",emissiveIntensity:.6}));
  private capMaterial=this.resources.own(new MeshToonMaterial({color:"#385c53"}));
  private glowMaterial=this.resources.own(new MeshBasicMaterial({color:"#9aeddf",transparent:true,opacity:.15,blending:AdditiveBlending,depthWrite:false}));
  private contextLost=(event:Event)=>{event.preventDefault();this.onFailure("The 3D graphics connection was lost. Classic 2D is ready.");};

  constructor(private onFailure:(message:string)=>void){}
  mount(stage:HTMLDivElement){
    this.canvas=document.createElement("canvas");this.canvas.dataset.renderer="3d";this.canvas.setAttribute("aria-hidden","true");
    const antialias=(window.devicePixelRatio||1)<2;
    const context=this.canvas.getContext("webgl2",{antialias,powerPreference:"high-performance"});
    if(!context)throw new Error("WebGL 2 is unavailable.");
    this.renderer=new WebGLRenderer({canvas:this.canvas,context,antialias,powerPreference:"high-performance"});
    this.renderer.outputColorSpace=SRGBColorSpace;
    this.ratio=Math.min(window.devicePixelRatio||1,matchMedia("(pointer: coarse)").matches?1.5:2);this.renderer.setPixelRatio(this.ratio);
    this.scene.background=new Color("#10170f");this.scene.add(new HemisphereLight("#dfe9d0","#1a211d",.9));
    const key=new DirectionalLight("#fff3d1",1.2);key.position.set(-6,12,8);this.scene.add(key,this.camera,createLab(this.resources));
    const shadowGeo=this.resources.own(new CircleGeometry(1,20));shadowGeo.rotateX(-Math.PI/2);
    this.shadows=new InstancedMesh(shadowGeo,this.resources.own(new MeshBasicMaterial({color:"#020906",transparent:true,opacity:.45,depthWrite:false})),11);
    this.shadows.frustumCulled=false;this.shadows.count=0;this.scene.add(this.shadows);
    const ringGeo=this.resources.own(new RingGeometry(.62,.72,32));ringGeo.rotateX(-Math.PI/2);
    this.ring=new Mesh(ringGeo,this.resources.own(new MeshBasicMaterial({color:"#e8fa79",transparent:true,opacity:.65,depthWrite:false})));this.ring.visible=false;this.scene.add(this.ring);
    this.overlay=document.createElement("canvas");this.overlay.className="arena-labels";this.overlay.setAttribute("aria-hidden","true");this.context=this.overlay.getContext("2d");
    if(!this.context)throw new Error("The name labels could not load.");
    this.canvas.addEventListener("webglcontextlost",this.contextLost);
    stage.appendChild(this.canvas);stage.appendChild(this.overlay);
  }
  resize(width:number,height:number){
    width=Math.max(1,width);height=Math.max(1,height);
    if(!this.renderer||!this.overlay)return;
    if(width===this.width&&height===this.height)return;
    this.width=width;this.height=height;this.renderer.setSize(width,height,false);
    this.overlay.width=Math.round(width*this.ratio);this.overlay.height=Math.round(height*this.ratio);
    fitCamera(this.camera,width/height);this.lastDraw=-Infinity;
  }
  private makeCanister(){
    const group=new Group(),body=new Mesh(this.bodyGeo,this.canisterMaterial),cap=new Mesh(this.capGeo,this.capMaterial),glow=new Mesh(this.glowGeo,this.glowMaterial);
    body.position.y=.4;cap.position.y=.82;glow.position.y=.4;group.add(body,cap,glow);return group;
  }
  private makeIntern(p:FramePlayer){
    const root=new Group(),material=this.resources.own(new MeshToonMaterial({color:p.color})),visorMaterial=this.resources.own(new MeshBasicMaterial({color:"#1b302a"}));
    const body=new Mesh(this.capsule,material);body.position.y=.675;
    const visor=new Mesh(this.visorGeo,visorMaterial);visor.position.set(0,1,.41);
    const antenna=new Mesh(this.antennaGeo,material);antenna.position.y=1.48;antenna.visible=p.isBot;
    const held=this.makeCanister();held.position.y=1.4;root.add(body,visor,antenna,held);this.scene.add(root);
    const intern={root,body,visor,antenna,held,material,visorMaterial};this.interns.set(p.id,intern);return intern;
  }
  frame(view:FrameView){
    if(!this.renderer||!this.context||!this.overlay||!this.shadows||!this.ring)return;
    if(this.renderer.getContext().isContextLost())throw new Error("The WebGL context was lost.");
    if(view.status!=="running"&&view.time-this.lastDraw<1000/30)return;
    this.lastDraw=view.time;
    const c=this.context;c.setTransform(this.ratio,0,0,this.ratio,0,0);c.clearRect(0,0,this.width,this.height);
    const active=new Set(view.players.map(p=>p.id));
    for(const [id,intern] of this.interns)if(!active.has(id)){this.scene.remove(intern.root);this.resources.release(intern.material);this.resources.release(intern.visorMaterial);this.interns.delete(id);}
    const labels:Label[]=[];let shadowCount=0;this.ring.visible=false;
    const shadow=(x:number,z:number,size:number)=>{this.matrix.makeScale(size,1,size);this.matrix.setPosition(x,.025,z);this.shadows!.setMatrixAt(shadowCount++,this.matrix);};
    for(const p of view.players){
      const intern=this.interns.get(p.id)??this.makeIntern(p),position=toScene(p.x,p.y);
      intern.root.position.set(position.x,0,position.z);intern.held.visible=p.carrying;
      for(const material of [intern.material,intern.visorMaterial]){
        const transparent=!p.connected;if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}material.opacity=p.connected?1:.45;
      }
      shadow(position.x,position.z,.6);
      if(p.isSelf){this.ring.position.set(position.x,.03,position.z);this.ring.visible=true;}
      this.point.set(position.x,1.6,position.z).project(this.camera);
      const x=(this.point.x+1)*this.width/2,y=(1-this.point.y)*this.height/2;
      addLabel(c,labels,(p.isBot?`${p.name} · BOT Lv${p.level}`:p.name)+(p.isSelf?" · YOU":""),x,y+21,p.isSelf?p.color:"#eef2e5",this.width,this.height);
    }
    const anomalies=new Set(view.anomalies.map(a=>a.id));
    for(const [id,mesh] of this.canisters)if(!anomalies.has(id)){this.scene.remove(mesh);this.canisters.delete(id);}
    for(const a of view.anomalies){
      let mesh=this.canisters.get(a.id);if(!mesh){mesh=this.makeCanister();this.canisters.set(a.id,mesh);this.scene.add(mesh);}
      mesh.visible=a.visible;if(!a.visible)continue;const position=toScene(a.x,a.y);mesh.position.set(position.x,0,position.z);shadow(position.x,position.z,.38);
    }
    this.shadows.count=shadowCount;this.shadows.instanceMatrix.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);drawLabels(c,labels);
  }
  stats(){const r=this.renderer;return {calls:r?.info.render.calls??0,triangles:r?.info.render.triangles??0,geometries:r?.info.memory.geometries??0,textures:r?.info.memory.textures??0,pixelRatio:this.ratio};}
  dispose(){
    this.canvas?.removeEventListener("webglcontextlost",this.contextLost);
    this.shadows?.dispose();this.resources.dispose();this.renderer?.dispose();this.renderer?.forceContextLoss();
    this.canvas?.remove();this.overlay?.remove();this.scene.clear();this.interns.clear();this.canisters.clear();this.renderer=null;this.context=null;this.canvas=null;this.overlay=null;this.shadows=null;this.ring=null;
  }
}
