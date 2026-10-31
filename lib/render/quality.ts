import {percentile} from "./performance";
export type Tier="ultra"|"high"|"medium"|"low"|"potato";
export type Quality="auto"|Exclude<Tier,"potato">;
export const TIERS:Tier[]=["potato","low","medium","high","ultra"];
export const validQuality=(v:unknown):v is Quality=>["auto","ultra","high","medium","low"].includes(String(v));
export function readQuality(search=location.search):Quality{const p=new URLSearchParams(search);if(p.get("photo")==="1")return"ultra";const requested=p.get("quality");if(validQuality(requested))return requested;try{const saved=localStorage.getItem("overclocked-quality");if(validQuality(saved))return saved;}catch{}return"auto";}
export const saveQuality=(v:Quality)=>{try{localStorage.setItem("overclocked-quality",v);}catch{}};
export const pixelRatio=(tier:Tier,dpr:number,touch:boolean)=>tier==="potato"?.75:Math.min(dpr,tier==="ultra"?2:tier==="low"?1:tier==="medium"&&touch?1.25:1.5);
export class QualityControl{
 tier:Tier="medium";choice:Quality="auto";private samples:number[]=[];private windowAt=0;private slow=0;private fastAt=0;private upgraded=false;
 set(choice:Quality){this.choice=choice;this.tier=choice==="auto"?"medium":choice;this.reset();return this.tier;}
 reset(){this.samples.length=0;this.windowAt=0;this.slow=0;this.fastAt=0;}
 observe(at:number,ms:number){if(this.choice!=="auto"||ms<=0||ms>250)return null;this.samples.push(ms);this.windowAt||=at;if(at-this.windowAt<2000)return null;const p95=percentile(this.samples,.95);this.samples.length=0;this.windowAt=at;if(p95>25){this.fastAt=0;if(++this.slow>=2){this.slow=0;const i=TIERS.indexOf(this.tier);if(i>0)return this.tier=TIERS[i-1];}}else{this.slow=0;if(p95<12){this.fastAt||=at;if(!this.upgraded&&at-this.fastAt>=10000&&TIERS.indexOf(this.tier)<2){this.upgraded=true;return this.tier=TIERS[TIERS.indexOf(this.tier)+1];}}else this.fastAt=0;}return null;}
}
