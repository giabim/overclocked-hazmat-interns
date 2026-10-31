// A foreground 10–20 FPS frame retains all movement time. Hidden-tab gaps do not.
export const frameDelta=(elapsedMs:number,hidden=false)=>hidden||elapsedMs>250?null:Math.max(0,Math.min(.1,elapsedMs/1000));
