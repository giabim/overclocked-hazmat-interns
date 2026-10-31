import {BoxGeometry,CanvasTexture,Group,InstancedMesh,Matrix4,Mesh,MeshStandardMaterial,PlaneGeometry,RepeatWrapping,SRGBColorSpace} from "three";
import {LAB,CELL,ROOM_COLORS,ROOM_NAMES} from "../../sim/map";
import {toScene} from "../coords";
import type {Resources} from "./resources";
export function createLab(resources:Resources,breach=false){
 const group=new Group(),map=breach?LAB:null,w=map?.width??960,h=map?.height??600;
 const canvas=document.createElement("canvas");canvas.width=breach?1920:1024;canvas.height=breach?1200:640;
 const c=canvas.getContext("2d");if(!c)throw Error("The lab texture could not load.");c.scale(canvas.width/w,canvas.height/h);c.fillStyle="#303c3c";c.fillRect(0,0,w,h);
 if(breach){for(let y=0;y<3;y++)for(let x=0;x<3;x++){c.fillStyle=ROOM_COLORS[y*3+x];c.fillRect(x*640,y*400,640,400);c.fillStyle="#ffffff35";c.font="bold 22px monospace";c.fillText(ROOM_NAMES[y*3+x].toUpperCase(),x*640+95,y*400+85);}
  for(const p of LAB.exits){c.fillStyle="#829f44";c.fillRect(p.x-40,p.y-40,80,80);c.fillStyle="#efffa6";c.font="bold 16px monospace";c.fillText("EXIT →",p.x-30,p.y+7);}
 }else{c.fillStyle="#36432f";c.fillRect(200,150,560,300);c.strokeStyle="#8b9b70";c.setLineDash([6,8]);c.strokeRect(200,150,560,300);c.setLineDash([]);c.fillStyle="#7e8b6b";c.font="bold 72px monospace";c.textAlign="center";c.fillText("01",480,335);c.font="12px monospace";c.fillText("ANOMALY STORAGE",310,174);c.fillStyle="#718f3d";c.fillRect(850,180,96,240);c.fillStyle="#e8fa79";c.font="bold 14px monospace";c.fillText("DELIVER",898,277);c.fillText("+1 POINT",898,300);}
 c.strokeStyle="#0b171c75";c.lineWidth=2;for(let x=0;x<w;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
 // Deterministic painted wear; no downloaded or restricted assets.
 for(let i=0;i<850;i++){const x=(i*7919)%w,y=(i*3571)%h;c.fillStyle=i%2?"#fff00008":"#00000018";c.fillRect(x,y,2+i%9,1);}
 const texture=resources.own(new CanvasTexture(canvas));texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;
 const bumpCanvas=document.createElement("canvas");bumpCanvas.width=bumpCanvas.height=128;const bc=bumpCanvas.getContext("2d")!;bc.fillStyle="#aaa";bc.fillRect(0,0,128,128);bc.strokeStyle="#444";bc.lineWidth=3;bc.strokeRect(0,0,128,128);for(let i=0;i<150;i++){bc.fillStyle=i%2?"#bbb":"#999";bc.fillRect(i*47%128,i*61%128,2,2);}
 const bump=resources.own(new CanvasTexture(bumpCanvas));bump.wrapS=bump.wrapT=RepeatWrapping;bump.repeat.set(w/40,h/40);
 const floorMat=resources.own(new MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:.025,roughness:.72,metalness:.18}));
 const floor=new Mesh(resources.own(new PlaneGeometry(w/40,h/40)),floorMat),center=toScene(w/2,h/2);floor.rotation.x=-Math.PI/2;floor.position.set(center.x,0,center.z);floor.receiveShadow=true;group.add(floor);
 const geo=resources.own(new BoxGeometry(1,1,1)),wallMat=resources.own(new MeshStandardMaterial({color:"#7e9391",roughness:.65,metalness:.3})),fadeMat=resources.own(new MeshStandardMaterial({color:"#7e9391",roughness:.65,metalness:.3,transparent:true,opacity:.18,depthWrite:false}));
 const cells:{x:number;z:number}[]=[],matrix=new Matrix4();
 if(breach){const frames:{x:number;z:number}[]=[];LAB.rows.forEach((r,y)=>[...r].forEach((v,x)=>{const p=toScene((x+.5)*CELL,(y+.5)*CELL);if(v==="#")cells.push(p);else if(v==="+")for(const dx of [-.95,.95])frames.push({x:p.x+dx,z:p.z});}));
  const doorframes=new InstancedMesh(geo,resources.own(new MeshStandardMaterial({color:"#d2dca3",emissive:"#626a36",emissiveIntensity:.35,roughness:.4,metalness:.6})),Math.max(1,frames.length));frames.forEach((p,i)=>{matrix.makeScale(.1,1.3,.15);matrix.setPosition(p.x,.65,p.z);doorframes.setMatrixAt(i,matrix);});doorframes.count=frames.length;doorframes.castShadow=true;group.add(doorframes);
 }
 else for(const [x,z,sx,sz] of [[0,-7.2,23.4,.15],[0,7.2,23.4,.15],[-11.7,0,.15,14.4],[11.7,0,.15,14.4]]){const wall=new Mesh(geo,wallMat);wall.position.set(x,.3,z);wall.scale.set(sx,.6,sz);wall.castShadow=true;wall.receiveShadow=true;group.add(wall);}
 const stripeCanvas=document.createElement("canvas");stripeCanvas.width=64;stripeCanvas.height=16;const sc=stripeCanvas.getContext("2d")!;sc.fillStyle="#d9d174";sc.fillRect(0,0,64,16);sc.fillStyle="#263b39";for(let x=-16;x<80;x+=24){sc.beginPath();sc.moveTo(x,16);sc.lineTo(x+16,0);sc.lineTo(x+28,0);sc.lineTo(x+12,16);sc.fill();}const stripeTexture=resources.own(new CanvasTexture(stripeCanvas));stripeTexture.colorSpace=SRGBColorSpace;
 const stripes=new InstancedMesh(geo,resources.own(new MeshStandardMaterial({map:stripeTexture,roughness:.65,metalness:.2})),Math.max(1,cells.length));stripes.frustumCulled=false;group.add(stripes);
 const walls=new InstancedMesh(geo,wallMat,Math.max(1,cells.length)),faded=new InstancedMesh(geo,fadeMat,Math.max(1,cells.length));walls.castShadow=true;walls.receiveShadow=true;walls.frustumCulled=faded.frustumCulled=false;group.add(walls,faded);
 function updateWalls(px:number,pz:number){let a=0,b=0,k=0;for(const p of cells){const hide=p.z>pz+.4&&p.z<pz+14&&Math.abs(p.x-px)<1.7;matrix.makeScale(1.99,2,1.99);matrix.setPosition(p.x,1,p.z);(hide?faded:walls).setMatrixAt(hide?b++:a++,matrix);matrix.makeScale(hide?0:2.005,.16,2.005);matrix.setPosition(p.x,.32,p.z);stripes.setMatrixAt(k++,matrix);}stripes.count=k;stripes.instanceMatrix.needsUpdate=true;walls.count=a;faded.count=b;walls.instanceMatrix.needsUpdate=faded.instanceMatrix.needsUpdate=true;}
 updateWalls(-100,-100);
 if(breach){const props=new InstancedMesh(geo,resources.own(new MeshStandardMaterial({color:"#5a706b",roughness:.45,metalness:.65})),18);let i=0;for(let ry=0;ry<3;ry++)for(let rx=0;rx<3;rx++){for(const p of [{x:rx*640+100,y:ry*400+100},{x:rx*640+500,y:ry*400+280}]){const cx=Math.floor(p.x/80),cy=Math.floor(p.y/80);if(LAB.rows[cy]?.[cx]!=="#")continue;const q=toScene(p.x,p.y);matrix.makeScale(.8,.65,.7);matrix.setPosition(q.x,2.35,q.z);props.setMatrixAt(i++,matrix);}}props.count=i;props.castShadow=true;group.add(props);}
 return{group,updateWalls,floorMat,bump,dispose:()=>{walls.dispose();faded.dispose();group.traverse(o=>{if(o instanceof InstancedMesh&&o!==walls&&o!==faded)o.dispose();});}};
}
