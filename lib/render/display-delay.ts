const median=(a:number[])=>{const s=[...a].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):0;};
export class DisplayDelay{
 value=200;private last:number|null=null;private gaps:number[]=[];
 observe(arrival:number){if(this.last!==null&&arrival>this.last){this.gaps.push(arrival-this.last);if(this.gaps.length>20)this.gaps.shift();const mid=median(this.gaps),mad=median(this.gaps.map(v=>Math.abs(v-mid))),target=Math.max(120,Math.min(400,mid*1.5+2*mad));this.value+=(target-this.value)*.2;}this.last=arrival;return this.value;}
 reset(){this.value=200;this.last=null;this.gaps.length=0;}
}
