import {clamp} from "../game";
export const CELL=80,RADIUS=19;
export type Point={x:number;y:number};
export type GameMap={id:string;width:number;height:number;rows:string[];spawns:Point[];canisters:Point[];dens:Point[];pickups:Point[];exits:Point[]};
export const LAB_ROWS=[
"########################",
"#C....#.......C.#....M.#",
"#.##..#..##..##.#..##..#",
"#.....+....G....+......#",
"#..C..#...#..#..#..C...#",
"###+#####+##+#######+###",
"#PPP..#....C....#......E",
"#PPP..+..##..##.+......E",
"#PPP..#.........#......E",
"###+#####+##+#######+###",
"#.....#...#..#..#...G..#",
"#..C..+....G....+..##..#",
"#.##..#..##..##.#....C.#",
"#M....#....C....#......#",
"########################"];
export function parseMap(rows:string[],id="lab-a"):GameMap{
 if(!rows.length||rows.some(r=>r.length!==rows[0].length||/[^#.PCEMG+]/.test(r)))throw Error("Invalid map rows");
 const result:GameMap={id,width:rows[0].length*CELL,height:rows.length*CELL,rows,spawns:[],canisters:[],dens:[],pickups:[],exits:[]};
 const keys={P:"spawns",C:"canisters",M:"dens",G:"pickups",E:"exits"} as const;
 rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c in keys)result[keys[c as keyof typeof keys]].push({x:(x+.5)*CELL,y:(y+.5)*CELL});}));return result;
}
export const CLASSIC:GameMap={id:"classic",width:960,height:600,rows:[],spawns:Array.from({length:8},(_,i)=>({x:160+40*i,y:300})),canisters:[{x:210,y:155},{x:380,y:155},{x:570,y:155},{x:210,y:445},{x:380,y:445},{x:570,y:445}],dens:[],pickups:[],exits:[{x:905,y:300}]};
export const LAB=parseMap(LAB_ROWS);
export const mapForId=(id?:string)=>id==="lab-a"?LAB:CLASSIC;
export const ROOM_NAMES=["Cold Storage","Reactor Lab","Specimen Den","Intern Lockers","Sorting Hall","Exit Airlock","Slime Pit","Server Room","Loading Bay"];
export const ROOM_COLORS=["#24404c","#4b3827","#3b294b","#4b4429","#313c3d","#294836","#294232","#263b4d","#4b3b29"];
export function isWall(map:GameMap,cx:number,cy:number){return cx<0||cy<0||cx>=map.width/CELL||cy>=map.height/CELL||map.rows[cy]?.[cx]==="#";}
export function hitsWall(map:GameMap,x:number,y:number,r=RADIUS){
 if(map.id==="classic")return x<32||x>928||y<32||y>568;
 if(r<=0)return isWall(map,Math.floor(x/CELL),Math.floor(y/CELL));
 for(let cy=Math.floor((y-r)/CELL);cy<=Math.floor((y+r)/CELL);cy++)for(let cx=Math.floor((x-r)/CELL);cx<=Math.floor((x+r)/CELL);cx++){
  if(!isWall(map,cx,cy))continue;const nx=clamp(x,cx*CELL,(cx+1)*CELL),ny=clamp(y,cy*CELL,(cy+1)*CELL);if((x-nx)**2+(y-ny)**2<r*r-.00001)return true;
 }return false;
}
export function moveCircle(map:GameMap,x:number,y:number,dx:number,dy:number,r=RADIUS):Point{
 if(map.id==="classic")return{x:clamp(x+dx,32,928),y:clamp(y+dy,32,568)};
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));
 for(let i=0;i<steps;i++){if(!hitsWall(map,x+dx/steps,y,r))x+=dx/steps;if(!hitsWall(map,x,y+dy/steps,r))y+=dy/steps;}return{x,y};
}
export function lineOfSight(map:GameMap,a:Point,b:Point,r=0){
 const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/10));
 for(let i=0;i<=steps;i++)if(hitsWall(map,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,r))return false;return true;
}
export function acceptMove(map:GameMap,old:Point,target:Point,allowance:number):Point{
 target={x:clamp(target.x,map.id==="classic"?32:RADIUS,map.width-(map.id==="classic"?32:RADIUS)),y:clamp(target.y,map.id==="classic"?32:RADIUS,map.height-(map.id==="classic"?32:RADIUS))};
 const distance=Math.hypot(target.x-old.x,target.y-old.y),fraction=Math.min(1,allowance/Math.max(.000001,distance));
 target={x:old.x+(target.x-old.x)*fraction,y:old.y+(target.y-old.y)*fraction};
 if(map.id==="classic")return target;
 if(!hitsWall(map,target.x,target.y)){
  if(lineOfSight(map,old,target,RADIUS))return target;
  for(const corner of [{x:target.x,y:old.y},{x:old.x,y:target.y}])if(lineOfSight(map,old,corner,RADIUS)&&lineOfSight(map,corner,target,RADIUS))return target;
 }
 return moveCircle(map,old.x,old.y,target.x-old.x,target.y-old.y);
}
export function inExit(map:GameMap,p:Point){return map.id==="classic"?p.x>=850&&p.y>=180&&p.y<=420:map.exits.some(e=>Math.abs(p.x-e.x)<=CELL/2&&Math.abs(p.y-e.y)<=CELL/2);}
export const roomNameAt=(p:Point)=>ROOM_NAMES[Math.min(2,Math.floor(p.y/400))*3+Math.min(2,Math.floor(p.x/640))];
