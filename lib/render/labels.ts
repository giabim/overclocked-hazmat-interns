import {clamp} from "../game";
export type Label={text:string;x:number;y:number;width:number;color:string;px:number;py:number};
export function addLabel(c:CanvasRenderingContext2D,labels:Label[],text:string,x:number,y:number,color:string,width=960,height=Infinity){
  c.font="bold 12px monospace";
  const labelWidth=Math.min(c.measureText(text).width+20,width-16);
  const labelX=clamp(x-labelWidth/2,8,width-8-labelWidth);
  let labelY=y<58?y+33:y-50;
  for(let attempt=0;attempt<8;attempt++){
    if(!labels.some(l=>labelX<l.x+l.width+4&&labelX+labelWidth+4>l.x&&labelY<l.y+27&&labelY+27>l.y))break;
    labelY=labelY>40?labelY-28:y+33+attempt*28;
  }
  labels.push({text,x:labelX,y:Math.min(labelY,height-26),width:labelWidth,color,px:x,py:y});
}
export function drawLabels(c:CanvasRenderingContext2D,labels:Label[]){
  c.font="bold 12px monospace";
  for(const label of labels){
    c.strokeStyle="#657457";c.lineWidth=1;c.beginPath();c.moveTo(label.px,label.py-21);c.lineTo(label.x+label.width/2,label.y+23);c.stroke();
    c.fillStyle="#111811f2";c.fillRect(label.x,label.y,label.width,23);c.fillStyle=label.color;c.textAlign="center";c.fillText(label.text,label.x+label.width/2,label.y+16);
  }
}
