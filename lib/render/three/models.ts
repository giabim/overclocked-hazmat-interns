import {BoxGeometry,BufferGeometry,CapsuleGeometry,Float32BufferAttribute,SphereGeometry} from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
function part(g:BufferGeometry,x:number,y:number,z:number,shade=1){g.translate(x,y,z);const c=new Float32Array(g.getAttribute("position").count*3).fill(shade);g.setAttribute("color",new Float32BufferAttribute(c,3));return g;}
function merge(parts:BufferGeometry[]){const geometry=mergeGeometries(parts)!;for(const p of parts)p.dispose();geometry.computeBoundingBox();return geometry;}
export function hazmatGeometry(){return merge([part(new CapsuleGeometry(.4,.45,4,12),0,.65,0),part(new SphereGeometry(.43,12,8),0,1.16,0),part(new BoxGeometry(.3,.24,.48),-.23,.12,.14,.15),part(new BoxGeometry(.3,.24,.48),.23,.12,.14,.15),part(new BoxGeometry(.77,.12,.7),0,.55,0,.18),part(new BoxGeometry(.32,.65,.3),0,.88,-.44,.5)]);}
export function houndGeometry(){const body=new SphereGeometry(.43,12,8);body.scale(.85,.7,1.7);const pieces=[part(body,0,.48,0)];for(const x of [-.3,.3])for(const z of [-.4,.4])pieces.push(part(new BoxGeometry(.13,.36,.16),x,.18,z));pieces.push(part(new BoxGeometry(.12,.12,.65),0,.62,-.84));return merge(pieces);}
export function eyeGeometry(){return merge([part(new SphereGeometry(.07,8,6),-.18,.63,.43),part(new SphereGeometry(.07,8,6),.18,.63,.43)]);}
export const turnToward=(current:number,target:number,dt:number)=>current+Math.max(-12*dt,Math.min(12*dt,Math.atan2(Math.sin(target-current),Math.cos(target-current))));
