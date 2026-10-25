import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {gzipSync} from "node:zlib";
const manifest=JSON.parse(await readFile("dist/client/.vite/manifest.json","utf8"));
const entry=Object.entries(manifest).find(([key])=>key.endsWith("lib/render/three/arena3d.ts"));
assert.ok(entry,"3D has a separate dynamic entry");assert.ok(entry[1].isDynamicEntry);
const visited=new Set();let bytes=0;
async function include(key){if(visited.has(key))return;visited.add(key);const chunk=manifest[key];assert.ok(chunk,`missing ${key}`);bytes+=gzipSync(await readFile("dist/client/"+chunk.file)).length;for(const imported of chunk.imports??[])await include(imported);}
await include(entry[0]);
assert.ok(bytes<=200*1024,`3D chunk/dependencies exceed 200 KiB gzip: ${bytes}`);
console.log(`PASS: 3D is a dynamic entry; ${bytes.toLocaleString()} gzip bytes including its static chunk dependencies (budget 204,800 bytes)`);
