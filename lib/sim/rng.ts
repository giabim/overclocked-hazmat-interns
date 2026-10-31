export function random(state:{rng:number}){state.rng=(state.rng+0x6D2B79F5)>>>0;let t=state.rng;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
export function seedFor(text:string){let seed=2166136261;for(const c of text)seed=Math.imul(seed^c.charCodeAt(0),16777619);return seed>>>0;}
