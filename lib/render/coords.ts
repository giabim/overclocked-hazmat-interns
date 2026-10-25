import {WORLD} from "../game";
export const UNIT_PX=40;
export const toScene=(x:number,y:number)=>({x:(x-WORLD.width/2)/UNIT_PX,z:(y-WORLD.height/2)/UNIT_PX});
export const toWorld=(x:number,z:number)=>({x:x*UNIT_PX+WORLD.width/2,y:z*UNIT_PX+WORLD.height/2});
