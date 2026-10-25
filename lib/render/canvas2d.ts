import {WORLD} from "../game";
import {addLabel,drawLabels,type Label} from "./labels";
import type {ArenaRenderer,FrameView} from "./types";
export class Canvas2DRenderer implements ArenaRenderer{
  readonly kind="2d" as const;
  private canvas:HTMLCanvasElement|null=null;
  private context:CanvasRenderingContext2D|null=null;
  mount(stage:HTMLDivElement){
    this.canvas=document.createElement("canvas");this.canvas.dataset.renderer="2d";this.canvas.setAttribute("aria-hidden","true");
    this.context=this.canvas.getContext("2d");if(!this.context)throw new Error("Canvas 2D is unavailable.");stage.appendChild(this.canvas);
  }
  resize(width:number,height:number){
    if(!this.canvas)return;const ratio=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  }
  frame(view:FrameView){
    const c=this.context,element=this.canvas;if(!c||!element)return;
    c.setTransform(element.width/WORLD.width,0,0,element.height/WORLD.height,0,0);
      c.fillStyle="#1a211d";c.fillRect(0,0,960,600);
      c.strokeStyle="#29332b";c.lineWidth=1;
      for(let x=0;x<960;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,600);c.stroke();}
      for(let y=0;y<600;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
      c.strokeStyle="#4a5549";c.lineWidth=2;c.strokeRect(12,12,936,576);
      c.strokeStyle="#607252";c.setLineDash([5,8]);c.strokeRect(200,150,560,300);c.setLineDash([]);
      c.fillStyle="#8e9a80";c.font="12px monospace";c.textAlign="left";c.fillText("ANOMALY STORAGE",218,174);
      c.fillStyle="#53614f";c.font="bold 72px monospace";c.textAlign="center";c.fillText("01",480,335);
      c.font="12px monospace";c.fillText("LAB FLOOR / 960 × 600",480,560);
      for(const [x,y]of [[80,80],[880,80],[80,520],[880,520]]){
        c.strokeStyle="#637055";c.beginPath();c.moveTo(x-8,y);c.lineTo(x+8,y);c.moveTo(x,y-8);c.lineTo(x,y+8);c.stroke();
      }
      c.fillStyle="#405b29";c.fillRect(850,180,96,240);c.strokeStyle="#bce477";c.lineWidth=2;c.strokeRect(850,180,96,240);
      c.fillStyle="#e8fa79";c.font="bold 13px monospace";c.textAlign="center";c.fillText("DELIVER",898,277);c.fillText("+1 POINT",898,300);c.font="30px monospace";c.fillText("→",898,340);
      for(const a of view.anomalies){
        if(!a.visible)continue;
        c.save();c.shadowColor="#a5f4ef";c.shadowBlur=12;c.fillStyle="#9aeddf";c.fillRect(a.x-11,a.y-16,22,32);c.shadowBlur=0;c.fillStyle="#385c53";c.fillRect(a.x-8,a.y-20,16,5);c.fillStyle="#233c32";c.fillRect(a.x-7,a.y-5,14,10);c.restore();
      }
      const labels:Label[]=[];
      for(const p of view.players){
        const isSelf=p.isSelf;const v=p;
        c.globalAlpha=p.connected?1:.45;
        if(isSelf){c.strokeStyle=p.color;c.globalAlpha=.35;c.lineWidth=2;c.beginPath();c.arc(v.x,v.y,28,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
        c.fillStyle="#060b0880";c.beginPath();c.ellipse(v.x,v.y+20,22,8,0,0,Math.PI*2);c.fill();
        c.fillStyle=p.color;c.beginPath();c.arc(v.x,v.y,19,0,Math.PI*2);c.fill();
        if(p.carrying){c.save();c.shadowColor="#b1fff1";c.shadowBlur=8;c.fillStyle="#9aeddf";c.fillRect(v.x+12,v.y-30,14,22);c.fillStyle="#324c40";c.fillRect(v.x+14,v.y-34,10,5);c.restore();}
        if(p.isBot){c.strokeStyle="#1a211d";c.lineWidth=2;c.beginPath();c.moveTo(v.x,v.y-18);c.lineTo(v.x,v.y-25);c.stroke();c.fillStyle=p.color;c.fillRect(v.x-3,v.y-28,6,5);}
        c.fillStyle="#1a211d";c.beginPath();c.arc(v.x-6,v.y-2,2.5,0,Math.PI*2);c.arc(v.x+6,v.y-2,2.5,0,Math.PI*2);c.fill();
        const label=(p.isBot?p.name+" · BOT Lv"+p.level:p.name)+(isSelf?" · YOU":"");
        addLabel(c,labels,label,v.x,v.y,isSelf?p.color:"#eef2e5");
        c.globalAlpha=1;
      }
      drawLabels(c,labels);
  }
  dispose(){this.canvas?.remove();this.canvas=null;this.context=null;}
}
