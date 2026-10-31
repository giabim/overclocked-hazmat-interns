import {spawnSync} from "node:child_process";
const checks=["map-validate","collision","sim-tick","sim-input","sim-concurrency","sim-fire-race","sim-controls","nav-bots","sim-weapons","sim-monsters","movement","day2","multiplayer","render-2d","render-events","render-coords","render-fallback","render-scene","render-breach"];
for(const name of checks){const result=spawnSync(process.execPath,[`tests/${name}.mjs`,...(name==="multiplayer"?["--in-process"]:[])],{stdio:"inherit"});if(result.status!==0)process.exit(result.status??1);}
console.log(`All ${checks.length} v3 and regression suites passed. Run render-bundle.mjs after a deployment build.`);
