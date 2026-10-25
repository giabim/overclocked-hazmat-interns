import {BoxGeometry,CanvasTexture,Group,Mesh,MeshBasicMaterial,MeshToonMaterial,PlaneGeometry,SRGBColorSpace} from "three";
import type {Resources} from "./resources";

export function createLab(resources:Resources){
  const group=new Group();
  const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=640;
  const c=canvas.getContext("2d");if(!c)throw new Error("The lab texture could not load.");
  c.scale(1024/960,640/600);c.fillStyle="#1a211d";c.fillRect(0,0,960,600);
  c.strokeStyle="#344037";c.lineWidth=1;
  for(let x=0;x<=960;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,600);c.stroke();}
  for(let y=0;y<=600;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
  c.strokeStyle="#66795b";c.lineWidth=2;c.strokeRect(12,12,936,576);
  c.setLineDash([5,8]);c.strokeRect(200,150,560,300);c.setLineDash([]);
  c.font="12px monospace";c.fillStyle="#8e9a80";c.fillText("ANOMALY STORAGE",218,174);
  c.font="bold 72px monospace";c.fillStyle="#53614f";c.textAlign="center";c.fillText("01",480,335);
  c.fillStyle="#405b29";c.fillRect(850,180,96,240);c.strokeStyle="#bce477";c.strokeRect(850,180,96,240);
  c.fillStyle="#e8fa79";c.font="bold 13px monospace";c.fillText("DELIVER",898,277);c.fillText("+1 POINT",898,300);c.font="30px monospace";c.fillText("→",898,340);
  for(const [x,y] of [[80,80],[880,80],[80,520],[880,520]]){c.strokeStyle="#637055";c.beginPath();c.moveTo(x-8,y);c.lineTo(x+8,y);c.moveTo(x,y-8);c.lineTo(x,y+8);c.stroke();}
  const texture=resources.own(new CanvasTexture(canvas));texture.colorSpace=SRGBColorSpace;
  const floor=new Mesh(resources.own(new PlaneGeometry(24,15)),resources.own(new MeshBasicMaterial({map:texture})));floor.rotation.x=-Math.PI/2;group.add(floor);
  const wallGeo=resources.own(new BoxGeometry(1,1,1));
  const wallMat=resources.own(new MeshToonMaterial({color:"#61724f"}));
  for(const [x,y,z,w,h,d] of [[0,.25,-7.2,23.4,.5,.15],[0,.125,7.2,23.4,.25,.15],[-11.7,.25,0,.15,.5,14.4],[11.7,.25,0,.15,.5,14.4]]){
    const wall=new Mesh(wallGeo,wallMat);wall.position.set(x,y,z);wall.scale.set(w,h,d);group.add(wall);
  }
  return group;
}
