import {PerspectiveCamera,Vector3} from "three";
const pitch=Math.PI/3;
// Also include a carried canister, which is taller than a player's head.
export const fitPoints:Vector3[]=[];
for(const y of [0,2.4])for(const [x,z] of [[-13,-8.5],[13,-8.5],[13,8.5],[-13,8.5]])fitPoints.push(new Vector3(x,y,z));
const projected=new Vector3();
export function fitCamera(camera:PerspectiveCamera,aspect:number){
  camera.fov=30;camera.aspect=Math.max(.01,aspect);camera.near=.5;camera.far=10000;camera.updateProjectionMatrix();
  const place=(distance:number)=>{camera.position.set(0,Math.sin(pitch)*distance,Math.cos(pitch)*distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();};
  const fits=(distance:number)=>{place(distance);return fitPoints.every(point=>{projected.copy(point).project(camera);return Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1&&projected.z>=-1&&projected.z<=1;});};
  let lo=5,hi=120;
  while(!fits(hi)&&hi<5000)hi*=2;
  for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid;}
  place(hi);camera.far=Math.max(300,hi*2);camera.updateProjectionMatrix();
}
