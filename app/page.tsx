"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCheck, ChevronRight, Copy, FlaskConical, HelpCircle, LogOut, Maximize2, Radio, RotateCcw, Users, X, Zap, Bot, Package, Trophy, Plus } from "lucide-react";
import { direction } from "../lib/game";
import {RendererController,type DebugStats,type ViewState} from "../lib/render/controller";
import {readViewPreference,saveViewPreference} from "../lib/render/select";
import {RenderEvents} from "../lib/render/events";
import {LabAudio} from "../lib/render/audio";
import {SnapshotBuffer} from "../lib/render/snapshots";
import type {FrameMonster,FrameView,ViewKind} from "../lib/render/types";
import { MovementSync, pollDelay } from "../lib/movement-sync";

type Session = {code:string;id:string;token:string};
type Player = {posEpoch:number;stunUntil:number;immuneUntil:number;slowUntil:number;foamCharges:number;foamReadyAt:number;grenades:number;fireSeq:number;throwSeq:number;lastFireAt:number;lastFireAim:number;faceX:number;faceY:number;id:string;name:string;color:string;x:number;y:number;positionAt:number;vx:number;vy:number;seq:number;connected:boolean;isBot:boolean;level:number;score:number;carrying:boolean;interactSeq:number};
type Anomaly={id:string;x:number;y:number;carrierId:string|null;respawnAt:number;generation:number};
type State = {mode:string;mapId:string;chaos:boolean;monsters:FrameMonster[];pickups:NonNullable<FrameView["pickups"]>;grenades:NonNullable<FrameView["grenades"]>;code:string;hostId:string;status:string;serverNow:number;players:Player[];anomalies:Anomaly[];roundEndsAt:number;roundId:number;revision:number};
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
  const [gameMode,setGameMode]=useState("breach");const [countdown,setCountdown]=useState(0);const [muted,setMuted]=useState(false);const [best,setBest]=useState(0);const [hint,setHint]=useState(false);const [photo,setPhoto]=useState(false);const [flow,setFlow]=useState(false);
  const audio=useRef(new LabAudio());const monsters=useRef(new SnapshotBuffer<FrameMonster>());const fireSeq=useRef(0),throwSeq=useRef(0),aim=useRef(0),pointerAt=useRef(0),lastFrame=useRef<FrameView|null>(null),photoRef=useRef(false),flowRef=useRef(false),debugRef=useRef(false),timings=useRef<number[]>([]);
  const [mode,setMode]=useState<"create"|"join">("create");
  const [ready,setReady]=useState(false);
  const [nickname,setNickname]=useState(""); const [code,setCode]=useState("");
  const [session,setSession]=useState<Session|null>(null); const [state,setState]=useState<State|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const [connected,setConnected]=useState(false); const [latency,setLatency]=useState(0);
  const [help,setHelp]=useState(false); const [copied,setCopied]=useState(""); const [moving,setMoving]=useState(false);
  const surface=useRef<HTMLDivElement>(null); const stage=useRef<HTMLDivElement>(null);
  const stateRef=useRef<State|null>(null); const input=useRef({x:0,y:0}); const keys=useRef(new Set<string>());
  const joystick=useRef({x:0,y:0}); const [stick,setStick]=useState({x:0,y:0});
  const sessionRef=useRef<Session|null>(null); const rttRef=useRef(0); const snapshotAt=useRef(0);
  const movement=useRef(new MovementSync()); const seq=useRef(Date.now()); const movingRef=useRef(false);
  const errors=useRef(0); const helpRef=useRef(false);
  const interaction=useRef(0); const kickSync=useRef<()=>void>(()=>{});
  const controller=useRef<RendererController|null>(null);const desiredView=useRef<ViewKind>("2d");
  const [viewState,setViewState]=useState<ViewState>({kind:"2d",loading:false,notice:""});
  const [debugMode,setDebugMode]=useState(false);const [debugStats,setDebugStats]=useState<DebugStats|null>(null);
  const renderEvents=useRef(new RenderEvents());const grabPendingRef=useRef(false);
  const [grabPending,setGrabPending]=useState(false); const [remaining,setRemaining]=useState(180);
  grabPendingRef.current=grabPending;
  const update=useCallback((next:State)=>{
    if(stateRef.current && next.code===stateRef.current.code && (next.serverNow<stateRef.current.serverNow||next.revision<stateRef.current.revision)) return;
    snapshotAt.current=performance.now();monsters.current.receive(next.monsters??[],next.serverNow,snapshotAt.current,rttRef.current);renderEvents.current.push(next,snapshotAt.current);movement.current.receive(next,sessionRef.current?.id||"",snapshotAt.current,rttRef.current);stateRef.current=next;setState(next);
    const own=next.players.find(p=>p.id===sessionRef.current?.id);const previous=lastFrame.current?.players.find(p=>p.isSelf);if(own&&(own.lastFireAt??0)>(previous?.lastFireAt??0))audio.current.cue("foam",180,.13);if(own&&(own.stunUntil??0)>(previous?.stunUntil??0))audio.current.cue("catch",100,.3);if(own&&own.interactSeq>=interaction.current)setGrabPending(false);
  },[]);
  const reset=useCallback((message="")=>{
    sessionStorage.removeItem(SESSION_KEY);sessionRef.current=null;setSession(null);setState(null);stateRef.current=null;movement.current.reset();monsters.current.reset();renderEvents.current.reset();setConnected(false);input.current={x:0,y:0};keys.current.clear();joystick.current={x:0,y:0};setStick({x:0,y:0});setMoving(false);movingRef.current=false;setGrabPending(false);setError("");setNotice(message);
  },[]);
  useEffect(()=>{
    try {
      setNickname(localStorage.getItem("overclocked-nickname")||"");setMuted(localStorage.getItem("overclocked-muted")==="1");setBest(Number(sessionStorage.getItem("overclocked-best")||0));
      const invite=new URLSearchParams(location.search).get("room");
      if(invite){setCode(invite.toUpperCase().slice(0,5));setMode("join");}
      const saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null") as Session|null;
      if(saved?.code&&saved.id&&saved.token){sessionRef.current=saved;setSession(saved);}
    }catch{sessionStorage.removeItem(SESSION_KEY);}
    const params=new URLSearchParams(location.search);photoRef.current=params.get("photo")==="1";setPhoto(photoRef.current);desiredView.current=photoRef.current?"3d":readViewPreference();debugRef.current=params.get("debug")==="1";setDebugMode(debugRef.current);
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
        const elapsed=Math.round(performance.now()-start);rttRef.current=elapsed;timings.current.push(elapsed);if(timings.current.length>100)timings.current.shift();setLatency(elapsed);
        if(result.state)update(result.state);setConnected(true);if(errors.current>0)setError("");errors.current=0;
      } catch(e) {
        if(cancelled)return;
        setConnected(false);errors.current++;
        if(e instanceof ApiError && [401,404].includes(e.status)){reset(e.message);return;}
        if(errors.current>=3)setError("Connection interrupted. Reconnecting automatically…");
      }
      inFlight=false;
      if(!cancelled)timeout=setTimeout(sync,pollDelay(start,performance.now(),stateRef.current?.status==="running"));
    }
    kickSync.current=()=>{clearTimeout(timeout);if(!inFlight)void sync();};
    sync();return()=>{cancelled=true;clearTimeout(timeout);kickSync.current=()=>{};};
  },[session,update,reset]);
  useEffect(()=>{if(remaining>0&&remaining<=10)audio.current.cue("deadline",remaining===1?900:650,.12);},[remaining]);
  useEffect(()=>{audio.current.setMuted(muted);try{localStorage.setItem("overclocked-muted",muted?"1":"0");}catch{}},[muted]);
  useEffect(()=>()=>audio.current.dispose(),[]);
  useEffect(()=>{flowRef.current=flow;},[flow]);
  useEffect(()=>{if(moving){setHint(false);try{localStorage.setItem("overclocked-hint-seen","1");}catch{}}},[moving]);
  useEffect(()=>{if(state?.status!=="running")return;let seen=false;try{seen=localStorage.getItem("overclocked-hint-seen")==="1";}catch{}setHint(!seen);const t=setTimeout(()=>setHint(false),6000);return()=>clearTimeout(t);},[state?.status,state?.roundId]);
  useEffect(()=>{if(state?.status!=="results")return;const score=state.players.find(p=>p.id===sessionRef.current?.id)?.score??0;setBest(old=>{const next=Math.max(old,score);sessionStorage.setItem("overclocked-best",String(next));return next;});document.querySelector<HTMLButtonElement>(".results-panel .primary")?.focus();},[state?.status]);
  const weapon=useCallback((grenade=false)=>{if(helpRef.current||stateRef.current?.mode!=="breach"||stateRef.current.status!=="running")return;audio.current.unlock();if(grenade)throwSeq.current=Math.max(Date.now(),throwSeq.current+1);else fireSeq.current=Math.max(Date.now(),fireSeq.current+1);kickSync.current();},[]);
  const grab=useCallback(()=>{
    audio.current.unlock();
    if(helpRef.current||stateRef.current?.status!=="running")return;
    const own=stateRef.current.players.find(p=>p.id===sessionRef.current?.id);
    if(own&&own.interactSeq<interaction.current)return;
    interaction.current=Math.max(Date.now(),interaction.current+1);setGrabPending(true);kickSync.current();
  },[]);
  useEffect(()=>{
    const updateClock=()=>{const current=stateRef.current;if(current?.status==="running")setRemaining(Math.max(0,Math.ceil((current.roundEndsAt-current.serverNow-(performance.now()-snapshotAt.current)-rttRef.current/2)/1000)));};
    updateClock();const timer=setInterval(updateClock,100);return()=>clearInterval(timer);
  },[]);
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
      if(MOVEMENT_KEYS.includes(e.key.toLowerCase())){e.preventDefault();keys.current.add(e.key.toLowerCase());compute();movingRef.current=true;setMoving(true);}
    };
    const keyup=(e:KeyboardEvent)=>{keys.current.delete(e.key.toLowerCase());compute();};
    const release=()=>{keys.current.clear();joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});};
    window.addEventListener("keydown",keydown);window.addEventListener("keyup",keyup);window.addEventListener("blur",release);document.addEventListener("visibilitychange",release);
    return()=>{window.removeEventListener("keydown",keydown);window.removeEventListener("keyup",keyup);window.removeEventListener("blur",release);document.removeEventListener("visibilitychange",release);};
  },[]);
  useEffect(()=>{helpRef.current=help;if(help){keys.current.clear();input.current={x:0,y:0};}},[help]);
  useEffect(()=>{
    if(!session||!state||!surface.current)return;
    const host=surface.current;const renderer=new RendererController(setViewState,setDebugStats);controller.current=renderer;renderer.mount(host,desiredView.current);
    let frame=0;let last=performance.now();
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    const draw=(time:number)=>{
      const dt=Math.min((time-last)/1000,.05);last=time;
      const s=stateRef.current;if(!s)return;
      renderer.resize(host.clientWidth,host.clientHeight);
      const worldNow=s.serverNow+Math.max(0,time-snapshotAt.current);
      if(performance.now()-pointerAt.current>1000&&Math.hypot(input.current.x,input.current.y)>.1)aim.current=Math.atan2(input.current.y,input.current.x);
      const players=s.players.map(p=>{
        const isSelf=p.id===session.id;
        const position=(isSelf?movement.current.localPosition(input.current,p.carrying,dt):movement.current.remotePosition(p.id,time,dt))??{x:p.x,y:p.y};
        if(isSelf&&s.status==="running"&&!movingRef.current&&Math.hypot(input.current.x,input.current.y)>.1){movingRef.current=true;setMoving(true);}
        return {...p,...position,isSelf};
      });
      const events=renderEvents.current.drain(time);audio.current.events(events);
      const view:FrameView={mode:s.mode,mapId:s.mapId,worldNow,monsters:monsters.current.positions(time,movement.current.viewDelayMs),pickups:s.pickups,grenades:s.grenades,photo:photoRef.current,flow:flowRef.current,debug:debugRef.current,time,dt,status:s.status,secondsLeft:Math.max(0,Math.ceil((s.roundEndsAt-worldNow-rttRef.current/2)/1000)),input:input.current,grabPending:grabPendingRef.current,players,
        anomalies:s.anomalies.map(a=>({...a,visible:!a.carrierId&&a.respawnAt<=worldNow})),events,reducedMotion:reduced.matches};
      lastFrame.current=view;
      renderer.frame(view);frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);renderer.dispose();if(controller.current===renderer)controller.current=null;};
  },[session,!!state]);
  const chooseView=(kind:ViewKind)=>{desiredView.current=kind;saveViewPreference(kind);void controller.current?.choose(kind);};
  async function enter(e:React.FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");
    try {
      audio.current.unlock();const result=await call({action:mode,name:nickname,code,mode:gameMode});
      if(result.session&&result.state){
        sessionStorage.setItem(SESSION_KEY,JSON.stringify(result.session));localStorage.setItem("overclocked-nickname",nickname.trim());
        sessionRef.current=result.session;seq.current=Date.now();setSession(result.session);update(result.state);setConnected(true);
      }
    }catch(e){setError(e instanceof Error?e.message:"Could not enter the lab. Try again.");}finally{setBusy(false);}
  }
  async function solo(){
    if(busy)return;setBusy(true);setError("");setNotice("");audio.current.unlock();
    try{const name=nickname.trim()||`Intern${Math.floor(100+Math.random()*900)}`;setNickname(name);localStorage.setItem("overclocked-nickname",name);
      const result=await call({action:"create",name,mode:"breach"});if(!result.session||!result.state)throw Error("The lab could not open.");
      const current=result.session;sessionStorage.setItem(SESSION_KEY,JSON.stringify(current));sessionRef.current=current;seq.current=Date.now();setSession(current);update(result.state);setConnected(true);
      if(new URLSearchParams(location.search).get("view")!=="2d"){desiredView.current="3d";void controller.current?.choose("3d");}
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
    const rect=e.currentTarget.getBoundingClientRect();const d=direction((e.clientX-rect.left-rect.width/2)/37,(e.clientY-rect.top-rect.height/2)/37);
    joystick.current=d;input.current=d;setStick({x:d.x*30,y:d.y*30});if(Math.hypot(d.x,d.y)>.1){movingRef.current=true;setMoving(true);}
  };
  const host=!!session&&state?.hostId===session.id; const running=state?.status==="running";
  const count=state?.players.length||0;
  const finished=state?.status==="results";const breach=state?.mode==="breach";
  const sortedTimings=[...timings.current].sort((a,b)=>a-b),percentile=(n:number)=>sortedTimings[Math.min(sortedTimings.length-1,Math.floor(sortedTimings.length*n))]??0;
  const own=state?.players.find(p=>p.id===session?.id);
  const ranked=state?[...state.players].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)):[];
  const winners=ranked.filter(p=>p.score===ranked[0]?.score);
  const clock=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;

  return <div className={`app-shell ${photo?"photo-mode":""}`}>
    <header className="topbar">
      <a className="brand" href="/" onClick={e=>{if(session){e.preventDefault();setHelp(true);}}} aria-label="Overclocked home"><span className="brand-mark"><Zap size={21} fill="currentColor"/></span><span>OVERCLOCKED<span className="brand-sub">THE HAZMAT INTERNS</span></span></a>
      <div className="top-actions"><span className="build-tag"><span/>V3 <b>/</b> CONTAINMENT BREACH</span><button className="icon-button" aria-label="How to play" onClick={()=>setHelp(true)}><HelpCircle size={20}/></button></div>
    </header>
    <main>
      {!session?<>
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
      </>:state?<>
        <div className="intro-line"><span className="eyebrow">FACILITY 01 / {finished?"SHIFT RESULTS":running?"DELIVERY RUN":"CREW ASSEMBLY"}</span><button className="text-button" onClick={leave}><LogOut size={15}/> Leave lab</button></div>
        <div className="room-heading"><div><h1>{finished?"SHIFT COMPLETE.":running?"HANDLE WITH CARE.":"ASSEMBLE THE CREW."}</h1><p>{finished?"Every canister counts. See how your crew did.":running?"Grab a canister. Carry it to the green exit. Repeat.":"Invite a friend or add bots. The host starts the shift."}</p></div><div className={`connection ${connected?"":"offline"}`} role="status"><i/>{connected?"Connected":"Reconnecting"}<span>{connected?`${latency} ms`:"…"}</span></div></div>
        {running&&<div className="round-hud"><div className={`round-clock ${remaining<=10?"urgent":""}`} role="timer" aria-label="Time remaining"><span>TIME LEFT</span><strong>{clock}</strong></div><div className="your-score"><span>YOUR POINTS</span><strong>{own?.score||0}</strong></div><div className="carry-status"><Package size={19}/><span>{own?.carrying?"Carrying · 15% slower":"Find a glowing canister"}<small>{own?.carrying?"Walk into the green exit to score.":"Touch a canister, then press Space or Grab."}</small></span></div></div>}
        {running&&breach&&<div className="weapon-hud"><span>FOAM <b>{"●".repeat(own?.foamCharges??0)}{"○".repeat(5-(own?.foamCharges??0))}</b> <kbd>F</kbd></span><span>FREEZE GRENADE <b>{own?.grenades?"READY":"Find a blue G pickup"}</b> <kbd>G</kbd></span><span>{own&&own.stunUntil>state.serverNow?"STUNNED · recover in 1s":own&&own.immuneUntil>state.serverNow?"IMMUNE":own&&own.slowUntil>state.serverNow?"FOAMED · slowed":"3 freezes = containment +2"}</span></div>}
        {error&&<p role="alert" className="error-box room-error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
        <div className="room-grid">
          <div className="play-column"><div className="stage-bar"><span><span className={`signal-dot ${running?"":"idle"}`}/>{running?"LAB FLOOR · LIVE":"LAB FLOOR · STANDBY"}</span><div className="stage-tools"><button className="text-button" aria-label={muted?"Unmute sound":"Mute sound"} onClick={()=>{audio.current.unlock();setMuted(!muted);}}>{muted?"Sound off":"Sound on"}</button><div className="view-picker" role="group" aria-label="Arena view"><button aria-pressed={viewState.kind==="2d"} onClick={()=>chooseView("2d")}>Classic 2D</button><button aria-pressed={viewState.kind==="3d"} onClick={()=>chooseView("3d")} disabled={viewState.loading}>{viewState.loading?"Powering up the lab…":"3D"}</button></div><button className="icon-button" aria-label="Toggle fullscreen" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen?.();else stage.current?.requestFullscreen?.().catch(()=>setNotice("Fullscreen isn't available here. You can still play normally."));}}><Maximize2 size={15}/></button></div></div>
            <div ref={stage} className="stage" data-view={viewState.kind} data-testid="game-stage"><div ref={surface} onPointerMove={e=>{const v=lastFrame.current,p=v?.players.find(p=>p.isSelf);if(!v||!p)return;const r=e.currentTarget.getBoundingClientRect(),q=controller.current?.worldPoint((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);if(q){pointerAt.current=performance.now();aim.current=Math.atan2(q.y-p.y,q.x-p.x);}}} onContextMenu={e=>{e.preventDefault();weapon();}} onPointerDown={()=>audio.current.unlock()} className="arena-surface" role="img" aria-label={`Lab floor with ${count} interns. ${running?"Move with WASD, arrows or the joystick. Grab with Space or the Grab button.":finished?"Round complete.":"Waiting for the host to start."}`}/>{countdown>0&&<div className="countdown-overlay" role="status"><span>CONTAINMENT BREACH</span><strong>{countdown}</strong><span>SHIFT STARTING</span></div>}{hint&&running&&<div className="tutorial-hint"><span><b>01 / MOVE</b>WASD, arrows or joystick</span><span><b>02 / DELIVER</b>Space to grab · green exit to score</span><span><b>03 / CONTAIN</b>{breach?"F foam · G freeze grenade":"Race your crew · most points wins"}</span></div>}{!running&&!finished&&!countdown&&<div className="waiting-overlay"><div className="waiting-icon"><Users size={25}/></div><strong>{count<2?"The lab needs a crew.":"Everyone's clocked in."}</strong><span>{count<2?"Add a bot or share your code with a friend.":host?"Start the round when you're ready.":"Waiting for the host to start."}</span></div>}{finished&&<div className="finish-overlay"><Trophy size={34}/><strong>SHIFT COMPLETE</strong><div className="podium">{ranked.slice(0,3).map((p,i)=><div key={p.id}><b>{["🥇","🥈","🥉"][i]}</b><span style={{color:p.color}}>{p.name}</span><strong>{p.score}</strong></div>)}</div><span>{ranked[0]?.score?winners.length>1?`Shared top score: ${ranked[0].score} points.`:`${ranked[0].name} led the shift with ${ranked[0].score} points.`:"The lab survived. The canisters are still waiting."}</span><small>Session best: {best} · Full results below ↓</small></div>}{debugMode&&<output className="arena-debug" aria-label="Renderer diagnostics">{debugStats?`${debugStats.kind.toUpperCase()} ${debugStats.tier??""} · ${debugStats.fps?debugStats.fps.toFixed(0)+" FPS":"warming up"} · ${debugStats.frameMs.toFixed(1)} ms\n${debugStats.calls} calls · ${debugStats.triangles.toLocaleString()} triangles\n${debugStats.geometries} geometries · ${debugStats.textures} textures · ${debugStats.pixelRatio.toFixed(1)}× DPR\nSync p50 ${percentile(.5)} / p95 ${percentile(.95)} ms · corrections ${movement.current.corrections}\n${state.monsters?.map(m=>m.id+":"+m.state).join(" ")??""}`:"Renderer starting…"}{breach&&<button onClick={()=>setFlow(!flow)}>{flow?"Hide":"Show"} flow field (2D)</button>}</output>}<div className="stage-corner mono">CONTAINMENT / V3</div></div>
            {viewState.notice&&<div className="render-notice" role="status"><span>{viewState.notice}</span><button onClick={()=>chooseView("3d")}>Try 3D again</button></div>}
            <div className="controls-bar"><div className="keyboard-hint"><span className="keys"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><p><strong>Move your intern</strong><span>WASD / arrows · Space grab / drop · F foam · G grenade</span></p></div><span className={`movement-check ${moving?"done":""}`}>{moving?<CheckCheck size={17}/>:<Radio size={17}/>} {moving?"Movement detected":"Ready for movement"}</span></div>
            {running&&<div className="touch-controls"><div className="joystick" role="application" aria-label="Touch joystick. Drag to move your intern." onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);moveStick(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveStick(e);}} onPointerUp={e=>{e.currentTarget.releasePointerCapture(e.pointerId);joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});}} onPointerCancel={()=>{joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});}}><ArrowUp className="joy-up" size={14}/><ArrowDown className="joy-down" size={14}/><ArrowLeft className="joy-left" size={14}/><ArrowRight className="joy-right" size={14}/><span className="joystick-thumb" style={{transform:`translate(${stick.x}px,${stick.y}px)`}}/></div>{breach&&<div className="mobile-weapons"><button disabled={!connected||!own?.foamCharges} onClick={()=>weapon()}><b>FOAM</b><small>F · {own?.foamCharges??0}/5</small></button><button disabled={!connected||!own?.grenades} onClick={()=>weapon(true)}><b>FREEZE</b><small>G · {own?.grenades??0}</small></button></div>}<p className="mono">DRAG TO MOVE<br/><span>Carry it to the green exit.</span></p><button className={`grab-button ${own?.carrying?"carrying":""}`} disabled={grabPending||!connected||remaining===0} onClick={grab} aria-label={own?.carrying?"Drop canister":"Grab canister"}><Package size={24}/><strong>{grabPending?"…":own?.carrying?"DROP":"GRAB"}</strong><span>SPACE</span></button></div>}
            {finished&&<section className="results-panel" aria-label="Round results"><div className="results-title"><Trophy size={21}/><h2>Shift scoreboard</h2><span>ROUND {state.roundId}</span></div><ol>{ranked.map((p,i)=><li key={p.id}><span className="rank-number">{ranked.findIndex(other=>other.score===p.score)+1}</span><span className="result-dot" style={{background:p.color}}>{p.isBot?<Bot size={15}/>:p.name.slice(0,1)}</span><span className="result-name">{p.name}{p.id===session.id&&<small>YOU</small>}{p.isBot&&<small>BOT Lv{p.level}</small>}</span><strong>{p.score}<small>points</small></strong></li>)}</ol>{host?<button className="primary" disabled={busy} onClick={()=>control("lobby")}><RotateCcw size={17}/> Play Again<ArrowRight size={18}/></button>:<p className="muted">Waiting for the host to start another shift.</p>}</section>}
          </div>
          <aside className="crew-panel"><div className="code-panel"><span className="eyebrow">YOUR ROOM CODE</span><button className="code-copy" onClick={()=>copy(state.code,"code")} aria-label={`Copy room code ${state.code}`}><span>{state.code}</span>{copied==="code"?<Check size={20}/>:<Copy size={19}/>}</button><button className="secondary" onClick={()=>copy(`${location.origin}/?room=${state.code}`,"link")}>{copied==="link"?<Check size={16}/>:<Copy size={16}/>} {copied==="link"?"Invite link copied":"Copy invite link"}</button><p>Same link. Same code. Different devices.</p></div>
            <div className="crew-head"><span className="eyebrow">ON THE CLOCK</span><span className="mono">{count}<b>/8</b></span></div>
            <ul className="crew-list">{state.players.map(p=><li key={p.id}><span className="player-avatar" style={{background:p.color}}>{p.isBot?<Bot size={17}/>:p.name.slice(0,1).toUpperCase()}</span><div><strong>{p.name} {p.id===session.id&&<span className="you-tag">YOU</span>}</strong><small>{p.isBot?`Bot Lv${p.level} · ${["","Clumsy","Cautious","Containment"][p.level]} Intern`:p.id===state.hostId?"Host":p.connected?"Intern":"Reconnecting…"}</small></div>{running||finished?<span className="live-score" aria-label={`${p.name}: ${p.score} points`}>{p.score}</span>:host&&p.isBot?<button className="remove-bot icon-button" disabled={busy} aria-label={`Remove ${p.name}`} onClick={()=>control("remove_bot",{botId:p.id})}><X size={14}/></button>:<span className={`roster-dot ${p.connected?"":"offline"}`}/>}</li>)}{Array.from({length:Math.max(0,Math.min(4,8-count))}).map((_,i)=><li className="empty-slot" key={`empty${i}`}><span>+</span><small>Open intern position</small></li>)}</ul>
            <div className="host-actions">{state.status==="lobby"&&<div className="lobby-options"><label>SHIFT MODE<select aria-label="Lobby game mode" disabled={!host||busy} value={state.mode} onChange={e=>control("configure",{mode:e.target.value,chaos:state.chaos})}><option value="breach">Containment Breach</option><option value="classic">Classic Delivery</option></select></label>{breach&&<label className="chaos-option"><input type="checkbox" checked={state.chaos} disabled={!host||busy} onChange={e=>control("configure",{mode:state.mode,chaos:e.target.checked})}/> Chaos: foam slows teammates</label>}{host&&state.players.filter(p=>p.isBot).map(p=><label key={p.id}>{p.name}<select aria-label={`${p.name} level`} value={p.level} disabled={busy} onChange={e=>control("set_bot_level",{botId:p.id,level:Number(e.target.value)})}><option value="1">Lv1 · Clumsy</option><option value="2">Lv2 · Cautious</option><option value="3">Lv3 · Foam expert</option></select></label>)}</div>}{host&&state.status==="lobby"&&<button className="secondary add-bot" disabled={busy||count>=8||!connected} onClick={()=>control("add_bot")}><Plus size={16}/><Bot size={16}/> Add bot <span>Lv1</span></button>}{host?<button className={running?"secondary":"primary"} disabled={busy||(state.status==="lobby"&&count<2)||!connected} onClick={()=>control(running||finished?"lobby":"start")}>{running||finished?<RotateCcw size={17}/>:<Zap size={17}/>} {busy?"One moment…":finished?"Play Again":running?"Return to lobby":"Start round"}{!running&&<ArrowRight size={18}/>}</button>:<div className="host-wait"><Radio size={17}/>{finished?"Shift complete":running?"Round in progress":"Waiting for the host"}</div>}<p>{finished?"Play Again keeps your bots.":running?"Deliver to the exit. Every canister is one point.":waitText(count)}</p>{state.status==="lobby"&&<p className="bot-note">Lv1 is clumsy. Lv2 avoids specimens. Lv3 carries foam. Friends can join a full lab by taking a bot's seat.</p>}</div>
          </aside>
        </div>
        <div className="test-checklist"><span className="eyebrow">THE SHIFT RULES</span><span><Package size={15}/> Touch + grab</span><span><ArrowRight size={15}/> Carry to the green exit</span><span><Trophy size={15}/> Most points wins</span><span className="muted">3 minutes. One very questionable lab.</span></div>
      </>:<div className="restoring"><Radio size={28}/><h2>Rejoining your lab…</h2><p>Your crew should be right here.</p><button className="secondary" onClick={()=>reset()}>Return to check-in</button></div>}
    </main>
    <footer><span className="mono">OVERCLOCKED <b>©</b> FACILITY 01</span><span>3-minute rounds · Solo + multiplayer</span><button className="text-button" onClick={()=>setHelp(true)}>Field guide <ChevronRight size={14}/></button></footer>
    {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()}><button autoFocus className="icon-button modal-close" onClick={()=>setHelp(false)} aria-label="Close field guide"><X size={20}/></button><span className="eyebrow">FIELD GUIDE / V3</span><h2 id="help-title">Your first shift.</h2><ol><li><strong>Pick a nickname.</strong> Create a lab or join with a five-character code.</li><li><strong>Assemble a crew.</strong> Invite friends or let the host add bots at three levels. Up to eight humans and bots share a lab.</li><li><strong>Start the shift.</strong> You need at least two participants. One human and one bot is enough.</li><li><strong>Grab and deliver.</strong> Use WASD, arrows, or the joystick. Touch a canister, then press Space or Grab. Carry it into the green exit for one point. Grab becomes Drop while carrying.</li></ol><p>Containment Breach adds nine rooms and escaped slimes and spark hounds. They flash a warning before lunging. Face a specimen and press F (or right-click) to freeze it. Foam recharges. Collect blue G pickups and press G to throw a freeze grenade. Three freezes within 12 seconds contain a specimen for +2 points. Catches drop your canister and briefly stun you. Chaos mode optionally slows teammates with foam.</p><p>Carrying slows you by 15%. The round lasts three minutes; the last ten seconds flash red. The highest score wins. The host can Play Again with the same bots. Human hosts pass the role to another human when leaving.</p><button className="primary" onClick={()=>setHelp(false)}>Got it. Clock me in.<ArrowRight size={18}/></button></section></div>}
  </div>;
}
