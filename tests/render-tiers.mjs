import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import path from "node:path";
import {gpuHarness} from "./render-gpu-harness.mjs";
const {browser,page,url,dir}=await gpuHarness(),results=[];const baseline=process.argv.includes("--baseline");
try{for(const tier of baseline?["high","medium","low"]:["ultra","high","medium","low","potato"]){await page.goto(url+"?quality="+tier);await page.waitForFunction(()=>window.fixture||window.failure);const value=await page.evaluate(()=>window.fixture.measure(40));results.push({tier,...value});console.log(JSON.stringify(results.at(-1)));if(!baseline){assert.ok(value.brightness>5&&value.litFraction>.05,`${tier} produced a black/empty frame`);assert.ok(value.triangles<=120000);if(tier==="medium")assert.ok(value.calls<=80,`Medium draw calls ${value.calls}`);}}await writeFile(path.join(dir,baseline?"before.json":"after.json"),JSON.stringify(results,null,2));}finally{await browser.close();}
