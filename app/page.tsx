"use client";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCheck, ChevronRight, Copy, FlaskConical, HelpCircle, LogOut, Maximize2, Radio, RotateCcw, Users, X, Zap, Bot, Package, Trophy, Plus } from "lucide-react";
import {frameDelta} from "../lib/render/frame-time";
import {gameStore,structureKey} from "../lib/game-store";
import {RoundHUD,Charges,LiveScore,WeaponButtons,GrabButton} from "./game-hud";
import {PerformanceProbe,activeProbe} from "../lib/render/performance";
import { direction } from "../lib/game";
import {RendererController,preload3D,type ViewState} from "../lib/render/controller";
import {readQuality,saveQuality,type Quality} from "../lib/render/quality";
import {RenderEvents} from "../lib/render/events";
import {LabAudio} from "../lib/render/audio";
import {SnapshotBuffer} from "../lib/render/snapshots";
import type {FrameMonster,FrameView,ViewKind} from "../lib/render/types";
import { MovementSync, pollDelay } from "../lib/movement-sync";

type Session = {code:string;id:string;token:string};
import type {State} from "../lib/game-types";
type Result = {session?:Session;state?:State;error?:string};
const SESSION_KEY="overclocked-session-v1";
const MOVEMENT_KEYS=["w","a","s","d","arrowup","arrowleft","arrowdown","arrowright"];
class ApiError extends Error { constructor(message:string,public status:number) {super(message);} }
async function call(body:Record<string,unknown>):Promise<Result> {
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),6000);
  try {
    const response=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal,cache:"no-store"});
    const result=await response.json() as Result;
    if(!response.ok) throw new ApiError(result.error||"Could not connect to the lab.",response.status);
    return result;
  } finally {clearTimeout(timeout);}
}
const waitText=(count:number)=>count<2?"Invite a friend or add a bot to start.":"Crew assembled. Ready when you are.";

export default function Home() {
  const debugOutput=useRef<HTMLOutputElement>(null);const lastUI=useRef("");const lastDebugAt=useRef(0);const performanceProbe=useRef<PerformanceProbe|null>(null);useEffect(()=>{performanceProbe.current?.commit();});
  const [gameMode,setGameMode]=useState("breach");const [countdown,setCountdown]=useState(0);const [muted,setMuted]=useState(false);const [best,setBest]=useState(0);const [hint,setHint]=useState(false);const [photo,setPhoto]=useState(false);const [flow,setFlow]=useState(false);
  const audio=useRef(new LabAudio());const monsters=useRef(new SnapshotBuffer<FrameMonster>());const fireSeq=useRef(0),throwSeq=useRef(0),aim=useRef(0),pointerAt=useRef(0),lastFrame=useRef<FrameView|null>(null),photoRef=useRef(false),flowRef=useRef(false),debugRef=useRef(false),timings=useRef<number[]>([]);
  const [mode,setMode]=useState<"create"|"join">("create");
  const [ready,setReady]=useState(false);
  const [nickname,setNickname]=useState(""); const [code,setCode]=useState("");
  const [session,setSession]=useState<Session|null>(null); const [state,setState]=useState<State|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const [connected,setConnected]=useState(false);const connectedFlag=useRef(false);const setConnection=useCallback((value:boolean)=>{if(connectedFlag.current!==value){connectedFlag.current=value;setConnected(value);}},[]);
  const [help,setHelp]=useState(false);const closeHelp=useCallback(()=>setHelp(false),[]); const [copied,setCopied]=useState(""); const [moving,setMoving]=useState(false);
  const surface=useRef<HTMLDivElement>(null); const stage=useRef<HTMLDivElement>(null);
  const stateRef=useRef<State|null>(null); const input=useRef({x:0,y:0}); const keys=useRef(new Set<string>());
  const joystick=useRef({x:0,y:0});const stickThumb=useRef<HTMLSpanElement>(null);const stickBounds=useRef<DOMRect|null>(null);const setStick=useCallback((point:{x:number;y:number})=>{if(stickThumb.current)stickThumb.current.style.transform=`translate(${point.x}px,${point.y}px)`;},[]);
  const sessionRef=useRef<Session|null>(null); const rttRef=useRef(0); const snapshotAt=useRef(0);
  const movement=useRef(new MovementSync()); const seq=useRef(Date.now()); const movingRef=useRef(false);
  const errors=useRef(0); const helpRef=useRef(false);
  const interaction=useRef(0); const kickSync=useRef<()=>void>(()=>{});
  const controller=useRef<RendererController|null>(null);const [quality,setQuality]=useState<Quality>("auto");
  const [viewState,setViewState]=useState<ViewState>({kind:"3d",loading:true,notice:"Powering up the lab…"});
  const [debugMode,setDebugMode]=useState(false);
  const renderEvents=useRef(new RenderEvents());const grabPendingRef=useRef(false);
  const [grabPending,setGrabPending]=useState(false);
  grabPendingRef.current=grabPending;
  const update=useCallback((next:State)=>{
    if(stateRef.current && next.code===stateRef.current.code && (next.serverNow<stateRef.current.serverNow||next.revision<stateRef.current.revision)) return;
    if(stateRef.current&&(stateRef.current.roundId!==next.roundId||stateRef.current.code!==next.code||stateRef.current.status!==next.status))monsters.current.reset();
    const corrections=movement.current.corrections;snapshotAt.current=performance.now();monsters.current.receive(next.monsters??[],next.serverNow,snapshotAt.current,rttRef.current);renderEvents.current.push(next,snapshotAt.current);movement.current.receive(next,sessionRef.current?.id||"",snapshotAt.current,rttRef.current);stateRef.current=next;gameStore.set(next,snapshotAt.current,rttRef.current);const ui=structureKey(next);if(ui!==lastUI.current){lastUI.current=ui;setState(next);}
    if(movement.current.corrections>corrections)performanceProbe.current?.correction();
    const own=next.players.find(p=>p.id===sessionRef.current?.id);const previous=lastFrame.current?.players.find(p=>p.isSelf);if(own&&(own.lastFireAt??0)>(previous?.lastFireAt??0))audio.current.cue("foam",180,.13);if(own&&(own.stunUntil??0)>(previous?.stunUntil??0))audio.current.cue("catch",100,.3);if(grabPendingRef.current&&own&&own.interactSeq>=interaction.current)setGrabPending(false);
  },[]);
  const reset=useCallback((message="")=>{
    sessionStorage.removeItem(SESSION_KEY);sessionRef.current=null;setSession(null);setState(null);stateRef.current=null;lastUI.current="";gameStore.set(null);movement.current.reset();monsters.current.reset();renderEvents.current.reset();setConnection(false);input.current={x:0,y:0};keys.current.clear();joystick.current={x:0,y:0};setStick({x:0,y:0});setMoving(false);movingRef.current=false;setGrabPending(false);setError("");setNotice(message);
  },[]);
  useEffect(()=>{
    try {
      setNickname(localStorage.getItem("overclocked-nickname")||"");setMuted(localStorage.getItem("overclocked-muted")==="1");setBest(Number(sessionStorage.getItem("overclocked-best")||0));
      const invite=new URLSearchParams(location.search).get("room");
      if(invite){setCode(invite.toUpperCase().slice(0,5));setMode("join");}
      const saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null") as Session|null;
      if(saved?.code&&saved.id&&saved.token){sessionRef.current=saved;setSession(saved);}
    }catch{sessionStorage.removeItem(SESSION_KEY);}
    const params=new URLSearchParams(location.search);photoRef.current=params.get("photo")==="1";setPhoto(photoRef.current);setQuality(readQuality());try{localStorage.removeItem("overclocked-view");}catch{}debugRef.current=params.get("debug")==="1";setDebugMode(debugRef.current);if(debugRef.current){performanceProbe.current=new PerformanceProbe();activeProbe.current=performanceProbe.current;}
    setReady(true);
  },[]);
  useEffect(()=>{
    if(!session)return;
    let cancelled=false;let inFlight=false;let timeout:ReturnType<typeof setTimeout>;
    async function sync(){
      if(cancelled||inFlight)return;inFlight=true;
      const current=session!;const start=performance.now();
      try {
        const d=direction(input.current.x,input.current.y);
        const nextSeq=++seq.current;const position=movement.current.recordSent(nextSeq);
        const result=await call({action:"sync",...current,seq:nextSeq,dx:d.x,dy:d.y,...position,interactSeq:interaction.current,posEpoch:movement.current.posEpoch,fireSeq:fireSeq.current,throwSeq:throwSeq.current,aim:aim.current,viewDelayMs:movement.current.viewDelayMs,rttMs:rttRef.current});
        if(cancelled)return;
        const elapsed=Math.round(performance.now()-start);rttRef.current=elapsed;if(debugRef.current){timings.current.push(elapsed);if(timings.current.length>100)timings.current.shift();if(result.state?.casLost)performanceProbe.current?.casLoss();}
        if(result.state)update(result.state);setConnection(true);if(errors.current>0)setError("");errors.current=0;
      } catch(e) {
        if(cancelled)return;
        setConnection(false);errors.current++;
        if(e instanceof ApiError && [401,404].includes(e.status)){reset(e.message);return;}
        if(errors.current>=3)setError("Connection interrupted. Reconnecting automatically…");
      }
      inFlight=false;
      if(!cancelled)timeout=setTimeout(sync,pollDelay(start,performance.now(),stateRef.current?.status==="running"));
    }
    kickSync.current=()=>{clearTimeout(timeout);if(!inFlight)void sync();};
    sync();return()=>{cancelled=true;clearTimeout(timeout);kickSync.current=()=>{};};
  },[session,update,reset]);
  const beep=useCallback((seconds:number)=>audio.current.cue("deadline",seconds===1?900:650,.12),[]);
  useEffect(()=>{audio.current.setMuted(muted);try{localStorage.setItem("overclocked-muted",muted?"1":"0");}catch{}},[muted]);
  useEffect(()=>()=>audio.current.dispose(),[]);
  useEffect(()=>{flowRef.current=flow;},[flow]);
  useEffect(()=>{if(moving){setHint(false);try{localStorage.setItem("overclocked-hint-seen","1");}catch{}}},[moving]);
  useEffect(()=>{if(state?.status!=="running")return;let seen=false;try{seen=localStorage.getItem("overclocked-hint-seen")==="1";}catch{}setHint(!seen);const t=setTimeout(()=>setHint(false),6000);return()=>clearTimeout(t);},[state?.status,state?.roundId]);
  useEffect(()=>{if(state?.status!=="results")return;const score=state.players.find(p=>p.id===sessionRef.current?.id)?.score??0;setBest(old=>{const next=Math.max(old,score);sessionStorage.setItem("overclocked-best",String(next));return next;});document.querySelector<HTMLButtonElement>(".results-panel .primary")?.focus();},[state?.status,state?.status==="results"?state.players.find(p=>p.id===sessionRef.current?.id)?.score:0]);
  const weapon=useCallback((grenade=false)=>{if(helpRef.current||stateRef.current?.mode!=="breach"||stateRef.current.status!=="running")return;audio.current.unlock();if(grenade)throwSeq.current=Math.max(Date.now(),throwSeq.current+1);else fireSeq.current=Math.max(Date.now(),fireSeq.current+1);kickSync.current();},[]);
  const grab=useCallback(()=>{
    audio.current.unlock();
    if(helpRef.current||stateRef.current?.status!=="running")return;
    const own=stateRef.current.players.find(p=>p.id===sessionRef.current?.id);
    if(own&&own.interactSeq<interaction.current)return;
    interaction.current=Math.max(Date.now(),interaction.current+1);setGrabPending(true);kickSync.current();
  },[]);
  useEffect(()=>{const timer=setInterval(()=>gameStore.tick(),100);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    const compute=()=>{
      const k=keys.current;
      input.current=direction(joystick.current.x+(Number(k.has("d")||k.has("arrowright"))-Number(k.has("a")||k.has("arrowleft"))),joystick.current.y+(Number(k.has("s")||k.has("arrowdown"))-Number(k.has("w")||k.has("arrowup"))));
    };
    const keydown=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){setHelp(false);return;}
      if(helpRef.current || !sessionRef.current || stateRef.current?.status!=="running" || /INPUT|TEXTAREA/.test((e.target as HTMLElement)?.tagName))return;
      audio.current.unlock();if(e.key.toLowerCase()==="f"||e.key.toLowerCase()==="g"){e.preventDefault();if(!e.repeat)weapon(e.key.toLowerCase()==="g");return;}
      if(e.code==="Space"){e.preventDefault();if(!e.repeat)grab();return;}
      if(MOVEMENT_KEYS.includes(e.key.toLowerCase())){e.preventDefault();keys.current.add(e.key.toLowerCase());compute();if(!movingRef.current){movingRef.current=true;setMoving(true);}}
    };
    const keyup=(e:KeyboardEvent)=>{keys.current.delete(e.key.toLowerCase());compute();};
    const release=()=>{keys.current.clear();joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});};
    window.addEventListener("keydown",keydown);window.addEventListener("keyup",keyup);window.addEventListener("blur",release);document.addEventListener("visibilitychange",release);
    return()=>{window.removeEventListener("keydown",keydown);window.removeEventListener("keyup",keyup);window.removeEventListener("blur",release);document.removeEventListener("visibilitychange",release);};
  },[]);
  useEffect(()=>{helpRef.current=help;if(help){keys.current.clear();input.current={x:0,y:0};}},[help]);
  useEffect(()=>{
    if(!session||!state||!surface.current)return;
    const host=surface.current;const renderer=new RendererController(setViewState,stats=>{if(!debugRef.current||!debugOutput.current)return;const probe=performanceProbe.current?.stats(),rtts=timings.current.slice().sort((a,b)=>a-b);debugOutput.current.textContent=`${stats.tier??""} · ${stats.calls} calls · ${stats.triangles} triangles · ${stats.pixelRatio}× DPR${stats.bloomDisabled?" · bloom guarded off":""}
${stats.tier==="unavailable"?"Graphics unavailable · render FPS not measured":`FPS median ${probe?.fpsMedian.toFixed(1)??"—"} / 5% ${probe?.fpsFloor.toFixed(1)??"—"} · frame p95 ${probe?.frameP95.toFixed(1)??"—"} ms · SD ${probe?.frameSD.toFixed(1)??"—"} ms`}
>33/>50 ms per min ${probe?.long33??0}/${probe?.long50??0} · React batches/s ${probe?.reactCommits??0} · CPU ${probe?.cpuMs.toFixed(2)??"—"} ms
RTT p50 ${rtts[Math.floor(rtts.length*.5)]??0} / p95 ${rtts[Math.floor(rtts.length*.95)]??0} ms · D ${movement.current.viewDelayMs.toFixed(0)} ms
Corrections/min ${probe?.correctionsPerMinute??0} · CAS losses/min ${probe?.casLosses??0}`;},{debug:debugRef.current});controller.current=renderer;renderer.mount(host);
    const observer=new ResizeObserver(entries=>{const box=entries[0]?.contentRect;if(box)renderer.resize(box.width,box.height);});observer.observe(host);
    let frame=0;let last=performance.now(),snapshot:State|null=null;
    const view:FrameView={time:0,dt:0,status:"lobby",secondsLeft:180,input:input.current,grabPending:false,players:[],anomalies:[],monsters:[],events:[],reducedMotion:false};
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    const draw=(time:number)=>{
      const rawMs=time-last,cpuStart=performanceProbe.current?performance.now():0;const dt=frameDelta(rawMs,document.hidden);last=time;if(dt===null){frame=requestAnimationFrame(draw);return;}
      const s=stateRef.current;if(!s)return;
      const worldNow=s.serverNow+Math.max(0,time-snapshotAt.current);
      if(performance.now()-pointerAt.current>1000&&Math.hypot(input.current.x,input.current.y)>.1)aim.current=Math.atan2(input.current.y,input.current.x);
      if(snapshot!==s){snapshot=s;view.players.length=0;for(const p of s.players)view.players.push({...p,isSelf:p.id===session.id});view.anomalies.length=0;for(const a of s.anomalies)view.anomalies.push({...a,visible:false});}
      for(const p of view.players){if(p.isSelf)movement.current.localPosition(input.current,p.carrying,dt,p);else movement.current.remotePosition(p.id,time,dt,p);}
      for(let i=0;i<view.anomalies.length;i++)view.anomalies[i].visible=!s.anomalies[i].carrierId&&s.anomalies[i].respawnAt<=worldNow;
      const events=renderEvents.current.drain(time);audio.current.events(events);
      view.mode=s.mode;view.mapId=s.mapId;view.worldNow=worldNow;view.monsters=monsters.current.positions(time,movement.current.viewDelayMs,view.monsters);view.pickups=s.pickups;view.grenades=s.grenades;view.photo=photoRef.current;view.flow=flowRef.current;view.debug=debugRef.current;view.time=time;view.dt=dt;view.status=s.status;view.secondsLeft=gameStore.seconds(time);view.input=input.current;view.grabPending=grabPendingRef.current;view.events=events;view.reducedMotion=reduced.matches;
      lastFrame.current=view;
      renderer.frame(view);performanceProbe.current?.frame(time,rawMs,performance.now()-cpuStart);frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();if(controller.current===renderer)controller.current=null;};
  },[session,!!state]);
  const chooseQuality=(q:Quality)=>{setQuality(q);saveQuality(q);controller.current?.setQuality(q);};
  useEffect(()=>{const id=setTimeout(()=>{void preload3D().catch(()=>{});},1200);return()=>clearTimeout(id);},[]);
  async function enter(e:React.FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");
    try {
      audio.current.unlock();const result=await call({action:mode,name:nickname,code,mode:gameMode});
      if(result.session&&result.state){
        sessionStorage.setItem(SESSION_KEY,JSON.stringify(result.session));localStorage.setItem("overclocked-nickname",nickname.trim());
        sessionRef.current=result.session;seq.current=Date.now();setSession(result.session);update(result.state);setConnection(true);
      }
    }catch(e){setError(e instanceof Error?e.message:"Could not enter the lab. Try again.");}finally{setBusy(false);}
  }
  async function solo(){
    if(busy)return;setBusy(true);setError("");setNotice("");audio.current.unlock();
    try{const name=nickname.trim()||`Intern${Math.floor(100+Math.random()*900)}`;setNickname(name);localStorage.setItem("overclocked-nickname",name);
      const result=await call({action:"create",name,mode:"breach"});if(!result.session||!result.state)throw Error("The lab could not open.");
      const current=result.session;sessionStorage.setItem(SESSION_KEY,JSON.stringify(current));sessionRef.current=current;seq.current=Date.now();setSession(current);update(result.state);setConnection(true);
      for(const level of [1,2,3]){const added=await call({action:"add_bot",...current,level});if(added.state)update(added.state);}
      for(const n of [3,2,1]){setCountdown(n);audio.current.cue("countdown",330+n*110);await new Promise(resolve=>setTimeout(resolve,1000));}
      const started=await call({action:"start",...current});if(started.state)update(started.state);
    }catch(e){setError(e instanceof Error?e.message:"Could not start. Use the lobby to try again.");}finally{setCountdown(0);setBusy(false);}
  }
  async function control(action:string,extra:Record<string,unknown>={}){
    if(!session||busy)return;setBusy(true);setError("");
    try {const result=await call({action,...session,...extra});if(result.state)update(result.state);if(action==="lobby"){keys.current.clear();input.current={x:0,y:0};setMoving(false);movingRef.current=false;}}
    catch(e){setError(e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}
  }
  async function leave(){
    if(!session)return;const old=session;reset("You clocked out. Join another lab whenever you're ready.");setError("");
    try {await call({action:"leave",...old});}catch{/* The server releases abandoned sessions after 30 seconds. */}
  }
  async function copy(value:string,what:string){
    try {await navigator.clipboard.writeText(value);setCopied(what);setTimeout(()=>setCopied(""),2000);}
    catch{setNotice(`Room code: ${state?.code}. You can select and copy it above.`);}
  }
  const moveStick=(e:React.PointerEvent<HTMLDivElement>)=>{
    const rect=stickBounds.current??e.currentTarget.getBoundingClientRect();const d=direction((e.clientX-rect.left-rect.width/2)/37,(e.clientY-rect.top-rect.height/2)/37);
    joystick.current=d;input.current=d;setStick({x:d.x*30,y:d.y*30});if(!movingRef.current&&Math.hypot(d.x,d.y)>.1){movingRef.current=true;setMoving(true);}
  };
  const host=!!session&&state?.hostId===session.id; const running=state?.status==="running";
  const count=state?.players.length||0;
  const finished=state?.status==="results";const breach=state?.mode==="breach";
  
  const own=state?.players.find(p=>p.id===session?.id);
  const ranked=state?[...state.players].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)):[];
  const winners=ranked.filter(p=>p.score===ranked[0]?.score);


  return <div className={`app-shell ${photo?"photo-mode":""}`}>
    <header className="topbar">
      <a className="brand" href="/" onClick={e=>{if(session){e.preventDefault();setHelp(true);}}} aria-label="Overclocked home"><span className="brand-mark"><Zap size={21} fill="currentColor"/></span><span>OVERCLOCKED<span className="brand-sub">THE HAZMAT INTERNS</span></span></a>
      <div className="top-actions"><span className="build-tag"><span/>V3 <b>/</b> CONTAINMENT BREACH</span><button className="icon-button" aria-label="How to play" onClick={()=>setHelp(true)}><HelpCircle size={20}/></button></div>
    </header>
    <main>
      {!session?<Landing {...{ready,busy,mode,setMode,error,setError,solo,enter,nickname,setNickname,code,setCode,gameMode,setGameMode,notice}}/>:state?<>
        <div className="intro-line"><span className="eyebrow">FACILITY 01 / {finished?"SHIFT RESULTS":running?"DELIVERY RUN":"CREW ASSEMBLY"}</span><button className="text-button" onClick={leave}><LogOut size={15}/> Leave lab</button></div>
        <div className="room-heading"><div><h1>{finished?"SHIFT COMPLETE.":running?"HANDLE WITH CARE.":"ASSEMBLE THE CREW."}</h1><p>{finished?"Every canister counts. See how your crew did.":running?"Grab a canister. Carry it to the green exit. Repeat.":"Invite a friend or add bots. The host starts the shift."}</p></div><div className={`connection ${connected?"":"offline"}`} role="status"><i/>{connected?"Connected":"Reconnecting"}<span>{connected?"":"…"}</span></div></div>
        {running&&<RoundHUD id={session.id} beep={beep}/>}
        {running&&breach&&<Charges id={session.id}/>}
        {error&&<p role="alert" className="error-box room-error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
        <div className="room-grid">
          <div className="play-column"><div className="stage-bar"><span><span className={`signal-dot ${running?"":"idle"}`}/>{running?"LAB FLOOR · LIVE":"LAB FLOOR · STANDBY"}</span><div className="stage-tools"><button className="text-button" aria-label={muted?"Unmute sound":"Mute sound"} onClick={()=>{audio.current.unlock();setMuted(!muted);}}>{muted?"Sound off":"Sound on"}</button><label className="quality-picker">Quality<select aria-label="Graphics quality" value={quality} onChange={e=>chooseQuality(e.target.value as Quality)}>{["auto","ultra","high","medium","low"].map(q=><option key={q} value={q}>{q[0].toUpperCase()+q.slice(1)}</option>)}</select></label><button className="icon-button" aria-label="Toggle fullscreen" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen?.();else stage.current?.requestFullscreen?.().catch(()=>setNotice("Fullscreen isn't available here. You can still play normally."));}}><Maximize2 size={15}/></button></div></div>
            <div ref={stage} className="stage" data-view={viewState.kind} data-testid="game-stage"><div ref={surface} onPointerMove={e=>{const v=lastFrame.current,p=v?.players.find(p=>p.isSelf);if(!v||!p)return;const r=e.currentTarget.getBoundingClientRect(),q=controller.current?.worldPoint((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);if(q){pointerAt.current=performance.now();aim.current=Math.atan2(q.y-p.y,q.x-p.x);}}} onContextMenu={e=>{e.preventDefault();weapon();}} onPointerDown={()=>audio.current.unlock()} className="arena-surface" role="img" aria-label={`Lab floor with ${count} interns. ${running?"Move with WASD, arrows or the joystick. Grab with Space or the Grab button.":finished?"Round complete.":"Waiting for the host to start."}`}/>{(viewState.loading||viewState.error)&&<div className="graphics-overlay" role={viewState.error?"alert":"status"}><FlaskConical size={30}/><strong>{viewState.notice}</strong>{viewState.error&&<><p>Turn on hardware acceleration, update your browser, or try Chrome, Edge, Firefox or Safari.</p><button className="primary" onClick={()=>void controller.current?.retry()}>Retry 3D graphics</button><small>Your lobby and room code still work.</small></>}</div>}{countdown>0&&<div className="countdown-overlay" role="status"><span>CONTAINMENT BREACH</span><strong>{countdown}</strong><span>SHIFT STARTING</span></div>}{hint&&running&&<div className="tutorial-hint"><span><b>01 / MOVE</b>WASD, arrows or joystick</span><span><b>02 / DELIVER</b>Space to grab · green exit to score</span><span><b>03 / CONTAIN</b>{breach?"F foam · G freeze grenade":"Race your crew · most points wins"}</span></div>}{!running&&!finished&&!countdown&&<div className="waiting-overlay"><div className="waiting-icon"><Users size={25}/></div><strong>{count<2?"The lab needs a crew.":"Everyone's clocked in."}</strong><span>{count<2?"Add a bot or share your code with a friend.":host?"Start the round when you're ready.":"Waiting for the host to start."}</span></div>}{finished&&<div className="finish-overlay"><Trophy size={34}/><strong>SHIFT COMPLETE</strong><div className="podium">{ranked.slice(0,3).map((p,i)=><div key={p.id}><b>{["🥇","🥈","🥉"][i]}</b><span style={{color:p.color}}>{p.name}</span><strong>{p.score}</strong></div>)}</div><span>{ranked[0]?.score?winners.length>1?`Shared top score: ${ranked[0].score} points.`:`${ranked[0].name} led the shift with ${ranked[0].score} points.`:"The lab survived. The canisters are still waiting."}</span><small>Session best: {best} · Full results below ↓</small></div>}{debugMode&&<><output ref={debugOutput} className="arena-debug" aria-label="Renderer diagnostics">Renderer starting…</output><button className="flow-toggle" onClick={()=>setFlow(!flow)}>{flow?"Hide":"Show"} navigation</button></>}<div className="stage-corner mono">CONTAINMENT / V3.1</div></div>
            <div className="controls-bar"><div className="keyboard-hint"><span className="keys"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><p><strong>Move your intern</strong><span>WASD / arrows · Space grab / drop · F foam · G grenade</span></p></div><span className={`movement-check ${moving?"done":""}`}>{moving?<CheckCheck size={17}/>:<Radio size={17}/>} {moving?"Movement detected":"Ready for movement"}</span></div>
            {running&&<div className="touch-controls"><div className="joystick" role="application" aria-label="Touch joystick. Drag to move your intern." onPointerDown={e=>{stickBounds.current=e.currentTarget.getBoundingClientRect();e.currentTarget.setPointerCapture(e.pointerId);moveStick(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveStick(e);}} onPointerUp={e=>{e.currentTarget.releasePointerCapture(e.pointerId);stickBounds.current=null;joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});}} onPointerCancel={()=>{joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});}}><ArrowUp className="joy-up" size={14}/><ArrowDown className="joy-down" size={14}/><ArrowLeft className="joy-left" size={14}/><ArrowRight className="joy-right" size={14}/><span className="joystick-thumb" ref={stickThumb} style={{transform:"translate(0px,0px)"}}/></div>{breach&&<WeaponButtons id={session.id} connected={connected} fire={weapon}/>}<p className="mono">DRAG TO MOVE<br/><span>Carry it to the green exit.</span></p><GrabButton id={session.id} pending={grabPending} connected={connected} grab={grab}/></div>}
            {finished&&<section className="results-panel" aria-label="Round results"><div className="results-title"><Trophy size={21}/><h2>Shift scoreboard</h2><span>ROUND {state.roundId}</span></div><ol>{ranked.map((p,i)=><li key={p.id}><span className="rank-number">{ranked.findIndex(other=>other.score===p.score)+1}</span><span className="result-dot" style={{background:p.color}}>{p.isBot?<Bot size={15}/>:p.name.slice(0,1)}</span><span className="result-name">{p.name}{p.id===session.id&&<small>YOU</small>}{p.isBot&&<small>BOT Lv{p.level}</small>}</span><strong>{p.score}<small>points</small></strong></li>)}</ol>{host?<button className="primary" disabled={busy} onClick={()=>control("lobby")}><RotateCcw size={17}/> Play Again<ArrowRight size={18}/></button>:<p className="muted">Waiting for the host to start another shift.</p>}</section>}
          </div>
          <aside className="crew-panel"><div className="code-panel"><span className="eyebrow">YOUR ROOM CODE</span><button className="code-copy" onClick={()=>copy(state.code,"code")} aria-label={`Copy room code ${state.code}`}><span>{state.code}</span>{copied==="code"?<Check size={20}/>:<Copy size={19}/>}</button><button className="secondary" onClick={()=>copy(`${location.origin}/?room=${state.code}`,"link")}>{copied==="link"?<Check size={16}/>:<Copy size={16}/>} {copied==="link"?"Invite link copied":"Copy invite link"}</button><p>Same link. Same code. Different devices.</p></div>
            <div className="crew-head"><span className="eyebrow">ON THE CLOCK</span><span className="mono">{count}<b>/8</b></span></div>
            <ul className="crew-list">{state.players.map(p=><li key={p.id}><span className="player-avatar" style={{background:p.color}}>{p.isBot?<Bot size={17}/>:p.name.slice(0,1).toUpperCase()}</span><div><strong>{p.name} {p.id===session.id&&<span className="you-tag">YOU</span>}</strong><small>{p.isBot?`Bot Lv${p.level} · ${["","Clumsy","Cautious","Containment"][p.level]} Intern`:p.id===state.hostId?"Host":p.connected?"Intern":"Reconnecting…"}</small></div>{running||finished?<LiveScore id={p.id} name={p.name}/>:host&&p.isBot?<button className="remove-bot icon-button" disabled={busy} aria-label={`Remove ${p.name}`} onClick={()=>control("remove_bot",{botId:p.id})}><X size={14}/></button>:<span className={`roster-dot ${p.connected?"":"offline"}`}/>}</li>)}{Array.from({length:Math.max(0,Math.min(4,8-count))}).map((_,i)=><li className="empty-slot" key={`empty${i}`}><span>+</span><small>Open intern position</small></li>)}</ul>
            <div className="host-actions">{state.status==="lobby"&&<div className="lobby-options"><label>SHIFT MODE<select aria-label="Lobby game mode" disabled={!host||busy} value={state.mode} onChange={e=>control("configure",{mode:e.target.value,chaos:state.chaos})}><option value="breach">Containment Breach</option><option value="classic">Classic Delivery</option></select></label>{breach&&<label className="chaos-option"><input type="checkbox" checked={state.chaos} disabled={!host||busy} onChange={e=>control("configure",{mode:state.mode,chaos:e.target.checked})}/> Chaos: foam slows teammates</label>}{host&&state.players.filter(p=>p.isBot).map(p=><label key={p.id}>{p.name}<select aria-label={`${p.name} level`} value={p.level} disabled={busy} onChange={e=>control("set_bot_level",{botId:p.id,level:Number(e.target.value)})}><option value="1">Lv1 · Clumsy</option><option value="2">Lv2 · Cautious</option><option value="3">Lv3 · Foam expert</option></select></label>)}</div>}{host&&state.status==="lobby"&&<button className="secondary add-bot" disabled={busy||count>=8||!connected} onClick={()=>control("add_bot")}><Plus size={16}/><Bot size={16}/> Add bot <span>Lv1</span></button>}{host?<button className={running?"secondary":"primary"} disabled={busy||(state.status==="lobby"&&count<2)||!connected} onClick={()=>control(running||finished?"lobby":"start")}>{running||finished?<RotateCcw size={17}/>:<Zap size={17}/>} {busy?"One moment…":finished?"Play Again":running?"Return to lobby":"Start round"}{!running&&<ArrowRight size={18}/>}</button>:<div className="host-wait"><Radio size={17}/>{finished?"Shift complete":running?"Round in progress":"Waiting for the host"}</div>}<p>{finished?"Play Again keeps your bots.":running?"Deliver to the exit. Every canister is one point.":waitText(count)}</p>{state.status==="lobby"&&<p className="bot-note">Lv1 is clumsy. Lv2 avoids specimens. Lv3 carries foam. Friends can join a full lab by taking a bot's seat.</p>}</div>
          </aside>
        </div>
        <div className="test-checklist"><span className="eyebrow">THE SHIFT RULES</span><span><Package size={15}/> Touch + grab</span><span><ArrowRight size={15}/> Carry to the green exit</span><span><Trophy size={15}/> Most points wins</span><span className="muted">3 minutes. One very questionable lab.</span></div>
      </>:<div className="restoring"><Radio size={28}/><h2>Rejoining your lab…</h2><p>Your crew should be right here.</p><button className="secondary" onClick={()=>reset()}>Return to check-in</button></div>}
    </main>
    <footer><span className="mono">OVERCLOCKED <b>©</b> FACILITY 01</span><span>3-minute rounds · Solo + multiplayer</span><button className="text-button" onClick={()=>setHelp(true)}>Field guide <ChevronRight size={14}/></button></footer>
    {help&&<HelpModal close={closeHelp}/>}
  </div>;
}

const HelpModal=memo(function HelpModal({close}:{close:()=>void}){return <div className="modal-backdrop" onClick={()=>close()}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()}><button autoFocus className="icon-button modal-close" onClick={()=>close()} aria-label="Close field guide"><X size={20}/></button><span className="eyebrow">FIELD GUIDE / V3</span><h2 id="help-title">Your first shift.</h2><ol><li><strong>Pick a nickname.</strong> Create a lab or join with a five-character code.</li><li><strong>Assemble a crew.</strong> Invite friends or let the host add bots at three levels. Up to eight humans and bots share a lab.</li><li><strong>Start the shift.</strong> You need at least two participants. One human and one bot is enough.</li><li><strong>Grab and deliver.</strong> Use WASD, arrows, or the joystick. Touch a canister, then press Space or Grab. Carry it into the green exit for one point. Grab becomes Drop while carrying.</li></ol><p>Containment Breach adds nine rooms and escaped slimes and spark hounds. They flash a warning before lunging. Face a specimen and press F (or right-click) to freeze it. Foam recharges. Collect blue G pickups and press G to throw a freeze grenade. Three freezes within 12 seconds contain a specimen for +2 points. Catches drop your canister and briefly stun you. Chaos mode optionally slows teammates with foam.</p><p>Carrying slows you by 15%. The round lasts three minutes; the last ten seconds flash red. The highest score wins. The host can Play Again with the same bots. Human hosts pass the role to another human when leaving.</p><button className="primary" onClick={()=>close()}>Got it. Clock me in.<ArrowRight size={18}/></button></section></div>;});

type LandingProps={ready:boolean;busy:boolean;mode:"create"|"join";setMode:(v:"create"|"join")=>void;error:string;setError:(v:string)=>void;solo:()=>Promise<void>;enter:(e:React.FormEvent)=>Promise<void>;nickname:string;setNickname:(v:string)=>void;code:string;setCode:(v:string)=>void;gameMode:string;setGameMode:(v:string)=>void;notice:string};
const Landing=memo(function Landing({ready,busy,mode,setMode,error,setError,solo,enter,nickname,setNickname,code,setCode,gameMode,setGameMode,notice}:LandingProps){return <>
        <div className="intro-line"><span className="eyebrow">FACILITY 01 / INTERN ONBOARDING</span><span className="mono muted desktop-only">NO EXPERIENCE REQUIRED. PROBABLY.</span></div>
        <section className="entry-grid">
          <div className="hero">
            <div className="hero-kicker"><span className="mini-line"/> MULTIPLAYER LAB SIMULATION</div>
            <h1>CLOCK IN.<br/><span>BRING THE<br className="desktop-only"/> CREW.</span></h1>
            <p className="hero-description">A very questionable lab. A very good crew.<br/>Dodge escaped specimens. Freeze the chaos.<br/>Grab glowing canisters. Race them to the exit.<br/>Most points in three minutes wins.</p>
            <div className="hero-pills"><span><Users size={15}/> Solo + friends</span><span><Radio size={15}/> Shared lab</span><span><Check size={15}/> Phone + laptop</span></div>
            <div className="lab-preview" aria-hidden="true"><div className="preview-label mono">TRAINING FLOOR <span>01</span></div><div className="preview-grid"><span className="preview-dot dot-one">K</span><span className="preview-dot dot-two">M</span><span className="preview-dot dot-three">D</span><div className="preview-target">ASSEMBLE HERE</div><span className="preview-coordinate mono">X 480 / Y 300</span></div><div className="preview-bottom mono"><span><i/> CREW SIGNAL DETECTED</span><span>AWAITING ARRIVAL ↗</span></div></div>
          </div>
          <div className="entry-card"><div className="card-head"><FlaskConical size={22}/><span className="mono">INTERN CHECK-IN</span><span className="card-number">01</span></div>
            <div className="tabs" role="tablist" aria-label="Enter a lab"><button role="tab" disabled={!ready} aria-selected={mode==="create"} className={mode==="create"?"active":""} onClick={()=>{setMode("create");setError("");}}>Create a lab</button><button role="tab" disabled={!ready} aria-selected={mode==="join"} className={mode==="join"?"active":""} onClick={()=>{setMode("join");setError("");}}>Join a lab</button></div>
            <button className="primary solo-now" disabled={!ready||busy} onClick={solo}>{busy?"Powering up the lab…":"Play solo now"}<Zap size={20}/></button><p className="solo-note">Instant Breach run · 3 bots · no setup</p>
            <form onSubmit={enter}>
              <h2>{mode==="create"?"Your shift starts here.":"The crew is waiting."}</h2><p className="card-description">{mode==="create"?"Open a room. Share the code. Assemble your crew.":"Get the five-character room code from your host."}</p>
              {mode==="create"&&<label className="mode-control">GAME MODE<select aria-label="Game mode" value={gameMode} onChange={e=>setGameMode(e.target.value)}><option value="breach">Containment Breach · maze + specimens</option><option value="classic">Classic Delivery · open arena</option></select></label>}
              <label htmlFor="nickname">YOUR NICKNAME <span>18 characters max</span></label><input id="nickname" disabled={!ready} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="e.g. Khiem" maxLength={18} required autoComplete="nickname"/>
              {mode==="join"&&<><label htmlFor="room-code">ROOM CODE</label><input id="room-code" className="code-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,5))} placeholder="ABCDE" minLength={5} maxLength={5} required autoComplete="off" autoCapitalize="characters" spellCheck={false}/></>}
              {error&&<p role="alert" className="error-box">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
              <button className="primary" type="submit" disabled={!ready||busy||!nickname.trim()||(mode==="join"&&code.length!==5)}>{busy?"Connecting…":mode==="create"?"Create my lab":"Join the crew"}<ArrowRight size={20}/></button>
              <p className="privacy-note">No game account. No download. Just a nickname.</p>
            </form>
            <div className="day-note"><span className="note-icon"><Zap size={17}/></span><div><strong>Contain the chaos.</strong><p>F sprays foam. G throws a freeze grenade. Three freezes contain a specimen for +2 points.</p></div></div>
          </div>
        </section>
        <section className="steps" aria-label="Getting started"><div><span>01</span><p><strong>Clock in</strong>Pick a nickname. Create or join a lab.</p></div><div><span>02</span><p><strong>Assemble the crew</strong>Share your room code with a friend.</p></div><div><span>03</span><p><strong>Make the delivery</strong>Carry canisters to the green exit. Earn points.</p></div></section>
      </>;});
