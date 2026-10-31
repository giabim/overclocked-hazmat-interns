import {CELL,isWall,lineOfSight,type GameMap,type Point} from "./map";
export type Field={cost:Float64Array;map:GameMap;avoid:boolean};
const neighbors=[[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[1,1,Math.SQRT2]];
export function flowField(map:GameMap,targets:Point[],danger:Point[]=[]):Field{
 const w=map.width/CELL,h=map.height/CELL,cost=new Float64Array(w*h).fill(Infinity),open:number[]=[];
 for(const t of targets){const x=Math.floor(t.x/CELL),y=Math.floor(t.y/CELL),i=y*w+x;if(!isWall(map,x,y)){cost[i]=0;open.push(i);}}
 while(open.length){let best=0;for(let k=1;k<open.length;k++)if(cost[open[k]]<cost[open[best]])best=k;const i=open.splice(best,1)[0],x=i%w,y=Math.floor(i/w);
  for(const [dx,dy,weight] of neighbors){const nx=x+dx,ny=y+dy;if(isWall(map,nx,ny)||(dx&&dy&&(isWall(map,x+dx,y)||isWall(map,x,y+dy))))continue;
   const n=ny*w+nx,extra=danger.some(p=>Math.hypot((nx+.5)*CELL-p.x,(ny+.5)*CELL-p.y)<2*CELL)?6:0,value=cost[i]+weight+extra;
   if(value<cost[n]){if(cost[n]===Infinity)open.push(n);cost[n]=value;}
  }
 }return{cost,map,avoid:danger.length>0};
}
export function nextStep(field:Field,p:Point,target:Point):Point{
 const {map,cost}=field;if((!field.avoid||Math.hypot(p.x-target.x,p.y-target.y)<CELL)&&lineOfSight(map,p,target,21))return target;
 const w=map.width/CELL,x=Math.floor(p.x/CELL),y=Math.floor(p.y/CELL);let best=cost[y*w+x],result={x:(x+.5)*CELL,y:(y+.5)*CELL};
 for(const [dx,dy] of neighbors){const nx=x+dx,ny=y+dy;if(isWall(map,nx,ny)||(dx&&dy&&(isWall(map,x+dx,y)||isWall(map,x,y+dy))))continue;
  if(cost[ny*w+nx]<best){best=cost[ny*w+nx];result={x:(nx+.5)*CELL,y:(ny+.5)*CELL};}
 }
 // Skip a waypoint only when the whole circle can see it.
 if(lineOfSight(map,p,result,21))return result;
 return{x:(x+.5)*CELL,y:(y+.5)*CELL};
}
export const pathDistance=(field:Field,p:Point)=>field.cost[Math.floor(p.y/CELL)*(field.map.width/CELL)+Math.floor(p.x/CELL)]*CELL;
const cache=new Map<string,Field>();
export function fieldFor(map:GameMap,target:Point,danger:Point[]=[]){
 const key=map.id+':'+Math.floor(target.x/CELL)+','+Math.floor(target.y/CELL)+':'+danger.map(p=>Math.floor(p.x/CELL)+','+Math.floor(p.y/CELL)).join(';');
 let field=cache.get(key);if(!field){field=flowField(map,[target],danger);cache.set(key,field);if(cache.size>128)cache.delete(cache.keys().next().value!);}return field;
}
