"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCheck, ChevronRight, Copy, FlaskConical, HelpCircle, LogOut, Maximize2, Radio, RotateCcw, Users, X, Zap, Bot, Package, Trophy, Plus } from "lucide-react";
import { clamp, direction, WORLD } from "../lib/game";
import { MovementSync, pollDelay } from "../lib/movement-sync";

type Session = {code:string;id:string;token:string};
type Player = {id:string;name:string;color:string;x:number;y:number;positionAt:number;vx:number;vy:number;seq:number;connected:boolean;isBot:boolean;level:number;score:number;carrying:boolean;interactSeq:number};
type Anomaly={id:string;x:number;y:number;carrierId:string|null;respawnAt:number;generation:number};
type State = {code:string;hostId:string;status:string;serverNow:number;players:Player[];anomalies:Anomaly[];roundEndsAt:number;roundId:number;revision:number};
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
  const [mode,setMode]=useState<"create"|"join">("create");
  const [ready,setReady]=useState(false);
  const [nickname,setNickname]=useState(""); const [code,setCode]=useState("");
  const [session,setSession]=useState<Session|null>(null); const [state,setState]=useState<State|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const [connected,setConnected]=useState(false); const [latency,setLatency]=useState(0);
  const [help,setHelp]=useState(false); const [copied,setCopied]=useState(""); const [moving,setMoving]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null); const stage=useRef<HTMLDivElement>(null);
  const stateRef=useRef<State|null>(null); const input=useRef({x:0,y:0}); const keys=useRef(new Set<string>());
  const joystick=useRef({x:0,y:0}); const [stick,setStick]=useState({x:0,y:0});
  const sessionRef=useRef<Session|null>(null); const rttRef=useRef(0); const snapshotAt=useRef(0);
  const movement=useRef(new MovementSync()); const seq=useRef(Date.now()); const movingRef=useRef(false);
  const errors=useRef(0); const helpRef=useRef(false);
  const interaction=useRef(0); const kickSync=useRef<()=>void>(()=>{});
  const [grabPending,setGrabPending]=useState(false); const [remaining,setRemaining]=useState(180);
  const update=useCallback((next:State)=>{
    if(stateRef.current && next.code===stateRef.current.code && next.serverNow<stateRef.current.serverNow) return;
    snapshotAt.current=performance.now();movement.current.receive(next,sessionRef.current?.id||"",snapshotAt.current,rttRef.current);stateRef.current=next;setState(next);
    const own=next.players.find(p=>p.id===sessionRef.current?.id);if(own&&own.interactSeq>=interaction.current)setGrabPending(false);
  },[]);
  const reset=useCallback((message="")=>{
    sessionStorage.removeItem(SESSION_KEY);sessionRef.current=null;setSession(null);setState(null);stateRef.current=null;movement.current.reset();setConnected(false);input.current={x:0,y:0};keys.current.clear();joystick.current={x:0,y:0};setStick({x:0,y:0});setMoving(false);movingRef.current=false;setGrabPending(false);setError("");setNotice(message);
  },[]);
  useEffect(()=>{
    try {
      setNickname(localStorage.getItem("overclocked-nickname")||"");
      const invite=new URLSearchParams(location.search).get("room");
      if(invite){setCode(invite.toUpperCase().slice(0,5));setMode("join");}
      const saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null") as Session|null;
      if(saved?.code&&saved.id&&saved.token){sessionRef.current=saved;setSession(saved);}
    }catch{sessionStorage.removeItem(SESSION_KEY);}
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
        const result=await call({action:"sync",...current,seq:nextSeq,dx:d.x,dy:d.y,...position,interactSeq:interaction.current});
        if(cancelled)return;
        const elapsed=Math.round(performance.now()-start);rttRef.current=elapsed;setLatency(elapsed);
        if(result.state)update(result.state);setConnected(true);errors.current=0;setError("");
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
  const grab=useCallback(()=>{
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
    if(!session || !state || !canvas.current)return;
    const element=canvas.current;const context=element.getContext("2d");if(!context)return;
    let frame=0;let last=performance.now();
    const draw=(time:number)=>{
      const dt=Math.min((time-last)/1000,.05);last=time;
      const s=stateRef.current;if(!s)return;
      const width=element.clientWidth;const height=element.clientHeight;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      if(element.width!==Math.round(width*ratio)||element.height!==Math.round(height*ratio)){element.width=Math.round(width*ratio);element.height=Math.round(height*ratio);}
      const c=context; c.setTransform(element.width/WORLD.width,0,0,element.height/WORLD.height,0,0);
      c.fillStyle="#1a211d";c.fillRect(0,0,960,600);
      c.strokeStyle="#29332b";c.lineWidth=1;
      for(let x=0;x<960;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,600);c.stroke();}
      for(let y=0;y<600;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
      c.strokeStyle="#4a5549";c.lineWidth=2;c.strokeRect(12,12,936,576);
      c.strokeStyle="#607252";c.setLineDash([5,8]);c.strokeRect(200,150,560,300);c.setLineDash([]);
      c.fillStyle="#8e9a80";c.font="12px monospace";c.textAlign="left";c.fillText("ANOMALY STORAGE",218,174);
      c.fillStyle="#53614f";c.font="bold 72px monospace";c.textAlign="center";c.fillText("01",480,335);
      c.font="12px monospace";c.fillText("LAB FLOOR / 960 × 600",480,560);
      for(const [x,y]of [[80,80],[880,80],[80,520],[880,520]]){
        c.strokeStyle="#637055";c.beginPath();c.moveTo(x-8,y);c.lineTo(x+8,y);c.moveTo(x,y-8);c.lineTo(x,y+8);c.stroke();
      }
      c.fillStyle="#405b29";c.fillRect(850,180,96,240);c.strokeStyle="#bce477";c.lineWidth=2;c.strokeRect(850,180,96,240);
      c.fillStyle="#e8fa79";c.font="bold 13px monospace";c.textAlign="center";c.fillText("DELIVER",898,277);c.fillText("+1 POINT",898,300);c.font="30px monospace";c.fillText("→",898,340);
      const worldNow=s.serverNow+Math.max(0,time-snapshotAt.current);
      for(const a of s.anomalies||[]){
        if(a.carrierId||a.respawnAt>worldNow)continue;
        c.save();c.shadowColor="#a5f4ef";c.shadowBlur=12;c.fillStyle="#9aeddf";c.fillRect(a.x-11,a.y-16,22,32);c.shadowBlur=0;c.fillStyle="#385c53";c.fillRect(a.x-8,a.y-20,16,5);c.fillStyle="#233c32";c.fillRect(a.x-7,a.y-5,14,10);c.restore();
      }
      const labels:{text:string;x:number;y:number;width:number;color:string;px:number;py:number}[]=[];
      for(const p of s.players){
        const isSelf=p.id===session.id;const running=s.status==="running";
        const v=(isSelf?movement.current.localPosition(input.current,p.carrying,dt):movement.current.remotePosition(p.id,time,dt))??{x:p.x,y:p.y};
        if(isSelf&&running&&!movingRef.current&&Math.hypot(input.current.x,input.current.y)>.1){movingRef.current=true;setMoving(true);}
        c.globalAlpha=p.connected?1:.45;
        if(isSelf){c.strokeStyle=p.color;c.globalAlpha=.35;c.lineWidth=2;c.beginPath();c.arc(v.x,v.y,28,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
        c.fillStyle="#060b0880";c.beginPath();c.ellipse(v.x,v.y+20,22,8,0,0,Math.PI*2);c.fill();
        c.fillStyle=p.color;c.beginPath();c.arc(v.x,v.y,19,0,Math.PI*2);c.fill();
        if(p.carrying){c.save();c.shadowColor="#b1fff1";c.shadowBlur=8;c.fillStyle="#9aeddf";c.fillRect(v.x+12,v.y-30,14,22);c.fillStyle="#324c40";c.fillRect(v.x+14,v.y-34,10,5);c.restore();}
        if(p.isBot){c.strokeStyle="#1a211d";c.lineWidth=2;c.beginPath();c.moveTo(v.x,v.y-18);c.lineTo(v.x,v.y-25);c.stroke();c.fillStyle=p.color;c.fillRect(v.x-3,v.y-28,6,5);}
        c.fillStyle="#1a211d";c.beginPath();c.arc(v.x-6,v.y-2,2.5,0,Math.PI*2);c.arc(v.x+6,v.y-2,2.5,0,Math.PI*2);c.fill();
        const label=(p.isBot?p.name+" · BOT Lv1":p.name)+(isSelf?" · YOU":"");c.font="bold 12px monospace";
        const labelWidth=c.measureText(label).width+20;
        const labelX=clamp(v.x-labelWidth/2,8,952-labelWidth);
        let labelY=v.y<58?v.y+33:v.y-50;
        for(let attempt=0;attempt<8;attempt++){
          if(!labels.some(l=>labelX<l.x+l.width+4&&labelX+labelWidth+4>l.x&&labelY<l.y+27&&labelY+27>l.y))break;
          labelY=labelY>40?labelY-28:v.y+33+attempt*28;
        }
        labels.push({text:label,x:labelX,y:labelY,width:labelWidth,color:isSelf?p.color:"#eef2e5",px:v.x,py:v.y});
        c.globalAlpha=1;
      }
      for(const label of labels){
        c.strokeStyle="#657457";c.lineWidth=1;c.beginPath();c.moveTo(label.px,label.py-21);c.lineTo(label.x+label.width/2,label.y+23);c.stroke();
        c.fillStyle="#111811f2";c.fillRect(label.x,label.y,label.width,23);c.fillStyle=label.color;c.textAlign="center";c.fillText(label.text,label.x+label.width/2,label.y+16);
      }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);
  },[session,!!state]);
  async function enter(e:React.FormEvent){
    e.preventDefault();if(busy)return;setBusy(true);setError("");setNotice("");
    try {
      const result=await call({action:mode,name:nickname,code});
      if(result.session&&result.state){
        sessionStorage.setItem(SESSION_KEY,JSON.stringify(result.session));localStorage.setItem("overclocked-nickname",nickname.trim());
        sessionRef.current=result.session;seq.current=Date.now();setSession(result.session);update(result.state);setConnected(true);
      }
    }catch(e){setError(e instanceof Error?e.message:"Could not enter the lab. Try again.");}finally{setBusy(false);}
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
  const finished=state?.status==="results";
  const own=state?.players.find(p=>p.id===session?.id);
  const ranked=state?[...state.players].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)):[];
  const winners=ranked.filter(p=>p.score===ranked[0]?.score);
  const clock=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}`;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" onClick={e=>{if(session){e.preventDefault();setHelp(true);}}} aria-label="Overclocked home"><span className="brand-mark"><Zap size={21} fill="currentColor"/></span><span>OVERCLOCKED<span className="brand-sub">THE HAZMAT INTERNS</span></span></a>
      <div className="top-actions"><span className="build-tag"><span/>DAY 02 <b>/</b> DELIVERY RUN</span><button className="icon-button" aria-label="How to play" onClick={()=>setHelp(true)}><HelpCircle size={20}/></button></div>
    </header>
    <main>
      {!session?<>
        <div className="intro-line"><span className="eyebrow">FACILITY 01 / INTERN ONBOARDING</span><span className="mono muted desktop-only">NO EXPERIENCE REQUIRED. PROBABLY.</span></div>
        <section className="entry-grid">
          <div className="hero">
            <div className="hero-kicker"><span className="mini-line"/> MULTIPLAYER LAB SIMULATION</div>
            <h1>CLOCK IN.<br/><span>BRING THE<br className="desktop-only"/> CREW.</span></h1>
            <p className="hero-description">A very questionable lab. A very good crew.<br/>Grab glowing canisters. Race them to the exit.<br/>Most deliveries in three minutes wins.</p>
            <div className="hero-pills"><span><Users size={15}/> Solo + friends</span><span><Radio size={15}/> Shared lab</span><span><Check size={15}/> Phone + laptop</span></div>
            <div className="lab-preview" aria-hidden="true"><div className="preview-label mono">TRAINING FLOOR <span>01</span></div><div className="preview-grid"><span className="preview-dot dot-one">K</span><span className="preview-dot dot-two">M</span><span className="preview-dot dot-three">D</span><div className="preview-target">ASSEMBLE HERE</div><span className="preview-coordinate mono">X 480 / Y 300</span></div><div className="preview-bottom mono"><span><i/> CREW SIGNAL DETECTED</span><span>AWAITING ARRIVAL ↗</span></div></div>
          </div>
          <div className="entry-card"><div className="card-head"><FlaskConical size={22}/><span className="mono">INTERN CHECK-IN</span><span className="card-number">01</span></div>
            <div className="tabs" role="tablist" aria-label="Enter a lab"><button role="tab" disabled={!ready} aria-selected={mode==="create"} className={mode==="create"?"active":""} onClick={()=>{setMode("create");setError("");}}>Create a lab</button><button role="tab" disabled={!ready} aria-selected={mode==="join"} className={mode==="join"?"active":""} onClick={()=>{setMode("join");setError("");}}>Join a lab</button></div>
            <form onSubmit={enter}>
              <h2>{mode==="create"?"Your shift starts here.":"The crew is waiting."}</h2><p className="card-description">{mode==="create"?"Open a room. Share the code. Assemble your crew.":"Get the five-character room code from your host."}</p>
              <label htmlFor="nickname">YOUR NICKNAME <span>18 characters max</span></label><input id="nickname" disabled={!ready} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="e.g. Khiem" maxLength={18} required autoComplete="nickname"/>
              {mode==="join"&&<><label htmlFor="room-code">ROOM CODE</label><input id="room-code" className="code-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,5))} placeholder="ABCDE" minLength={5} maxLength={5} required autoComplete="off" autoCapitalize="characters" spellCheck={false}/></>}
              {error&&<p role="alert" className="error-box">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
              <button className="primary" type="submit" disabled={!ready||busy||!nickname.trim()||(mode==="join"&&code.length!==5)}>{busy?"Connecting…":mode==="create"?"Create my lab":"Join the crew"}<ArrowRight size={20}/></button>
              <p className="privacy-note">No game account. No download. Just a nickname.</p>
            </form>
            <div className="day-note"><span className="note-icon"><Zap size={17}/></span><div><strong>Flying solo? Hire a bot.</strong><p>Add a Clumsy Intern in the lobby. Same lab, same rules. A little less coordination.</p></div></div>
          </div>
        </section>
        <section className="steps" aria-label="Getting started"><div><span>01</span><p><strong>Clock in</strong>Pick a nickname. Create or join a lab.</p></div><div><span>02</span><p><strong>Assemble the crew</strong>Share your room code with a friend.</p></div><div><span>03</span><p><strong>Make the delivery</strong>Carry canisters to the green exit. Earn points.</p></div></section>
      </>:state?<>
        <div className="intro-line"><span className="eyebrow">FACILITY 01 / {finished?"SHIFT RESULTS":running?"DELIVERY RUN":"CREW ASSEMBLY"}</span><button className="text-button" onClick={leave}><LogOut size={15}/> Leave lab</button></div>
        <div className="room-heading"><div><h1>{finished?"SHIFT COMPLETE.":running?"HANDLE WITH CARE.":"ASSEMBLE THE CREW."}</h1><p>{finished?"Every canister counts. See how your crew did.":running?"Grab a canister. Carry it to the green exit. Repeat.":"Invite a friend or add bots. The host starts the shift."}</p></div><div className={`connection ${connected?"":"offline"}`} role="status"><i/>{connected?"Connected":"Reconnecting"}<span>{connected?`${latency} ms`:"…"}</span></div></div>
        {running&&<div className="round-hud"><div className={`round-clock ${remaining<=10?"urgent":""}`} role="timer" aria-label="Time remaining"><span>TIME LEFT</span><strong>{clock}</strong></div><div className="your-score"><span>YOUR DELIVERIES</span><strong>{own?.score||0}</strong></div><div className="carry-status"><Package size={19}/><span>{own?.carrying?"Carrying · 15% slower":"Find a glowing canister"}<small>{own?.carrying?"Walk into the green exit to score.":"Touch a canister, then press Space or Grab."}</small></span></div></div>}
        {error&&<p role="alert" className="error-box room-error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}
        <div className="room-grid">
          <div className="play-column"><div className="stage-bar"><span><span className={`signal-dot ${running?"":"idle"}`}/>{running?"LAB FLOOR · LIVE":"LAB FLOOR · STANDBY"}</span><button className="icon-button" aria-label="Toggle fullscreen" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen?.();else stage.current?.requestFullscreen?.().catch(()=>setNotice("Fullscreen isn't available here. You can still play normally."));}}><Maximize2 size={15}/></button></div>
            <div ref={stage} className="stage" data-testid="game-stage"><canvas ref={canvas} aria-label={`Lab floor with ${count} interns. ${running?"Move with WASD, arrows or the joystick. Grab with Space or the Grab button.":finished?"Round complete.":"Waiting for the host to start."}`}/>{!running&&!finished&&<div className="waiting-overlay"><div className="waiting-icon"><Users size={25}/></div><strong>{count<2?"The lab needs a crew.":"Everyone's clocked in."}</strong><span>{count<2?"Add a bot or share your code with a friend.":host?"Start the round when you're ready.":"Waiting for the host to start."}</span></div>}{finished&&<div className="finish-overlay"><Trophy size={34}/><strong>SHIFT COMPLETE</strong><span>{ranked[0]?.score?winners.length>1?`Shared top score: ${ranked[0].score} deliveries.`:`${ranked[0].name} led the shift with ${ranked[0].score} deliveries.`:"The lab survived. The canisters are still waiting."}</span><small>Full results below ↓</small></div>}<div className="stage-corner mono">DELIVERY RUN 0.2</div></div>
            <div className="controls-bar"><div className="keyboard-hint"><span className="keys"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><p><strong>Move your intern</strong><span>WASD / arrows to move · Space to grab / drop</span></p></div><span className={`movement-check ${moving?"done":""}`}>{moving?<CheckCheck size={17}/>:<Radio size={17}/>} {moving?"Movement detected":"Ready for movement"}</span></div>
            {running&&<div className="touch-controls"><div className="joystick" role="application" aria-label="Touch joystick. Drag to move your intern." onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);moveStick(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))moveStick(e);}} onPointerUp={e=>{e.currentTarget.releasePointerCapture(e.pointerId);joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});}} onPointerCancel={()=>{joystick.current={x:0,y:0};input.current={x:0,y:0};setStick({x:0,y:0});}}><ArrowUp className="joy-up" size={14}/><ArrowDown className="joy-down" size={14}/><ArrowLeft className="joy-left" size={14}/><ArrowRight className="joy-right" size={14}/><span className="joystick-thumb" style={{transform:`translate(${stick.x}px,${stick.y}px)`}}/></div><p className="mono">DRAG TO MOVE<br/><span>Carry it to the green exit.</span></p><button className={`grab-button ${own?.carrying?"carrying":""}`} disabled={grabPending||!connected||remaining===0} onClick={grab} aria-label={own?.carrying?"Drop canister":"Grab canister"}><Package size={24}/><strong>{grabPending?"…":own?.carrying?"DROP":"GRAB"}</strong><span>SPACE</span></button></div>}
            {finished&&<section className="results-panel" aria-label="Round results"><div className="results-title"><Trophy size={21}/><h2>Shift scoreboard</h2><span>ROUND {state.roundId}</span></div><ol>{ranked.map((p,i)=><li key={p.id}><span className="rank-number">{ranked.findIndex(other=>other.score===p.score)+1}</span><span className="result-dot" style={{background:p.color}}>{p.isBot?<Bot size={15}/>:p.name.slice(0,1)}</span><span className="result-name">{p.name}{p.id===session.id&&<small>YOU</small>}{p.isBot&&<small>BOT Lv1</small>}</span><strong>{p.score}<small>deliveries</small></strong></li>)}</ol>{host?<button className="primary" disabled={busy} onClick={()=>control("lobby")}><RotateCcw size={17}/> Play Again<ArrowRight size={18}/></button>:<p className="muted">Waiting for the host to start another shift.</p>}</section>}
          </div>
          <aside className="crew-panel"><div className="code-panel"><span className="eyebrow">YOUR ROOM CODE</span><button className="code-copy" onClick={()=>copy(state.code,"code")} aria-label={`Copy room code ${state.code}`}><span>{state.code}</span>{copied==="code"?<Check size={20}/>:<Copy size={19}/>}</button><button className="secondary" onClick={()=>copy(`${location.origin}/?room=${state.code}`,"link")}>{copied==="link"?<Check size={16}/>:<Copy size={16}/>} {copied==="link"?"Invite link copied":"Copy invite link"}</button><p>Same link. Same code. Different devices.</p></div>
            <div className="crew-head"><span className="eyebrow">ON THE CLOCK</span><span className="mono">{count}<b>/8</b></span></div>
            <ul className="crew-list">{state.players.map(p=><li key={p.id}><span className="player-avatar" style={{background:p.color}}>{p.isBot?<Bot size={17}/>:p.name.slice(0,1).toUpperCase()}</span><div><strong>{p.name} {p.id===session.id&&<span className="you-tag">YOU</span>}</strong><small>{p.isBot?"Bot Lv1 · Clumsy Intern":p.id===state.hostId?"Host":p.connected?"Intern":"Reconnecting…"}</small></div>{running||finished?<span className="live-score" aria-label={`${p.name}: ${p.score} points`}>{p.score}</span>:host&&p.isBot?<button className="remove-bot icon-button" disabled={busy} aria-label={`Remove ${p.name}`} onClick={()=>control("remove_bot",{botId:p.id})}><X size={14}/></button>:<span className={`roster-dot ${p.connected?"":"offline"}`}/>}</li>)}{Array.from({length:Math.max(0,Math.min(4,8-count))}).map((_,i)=><li className="empty-slot" key={`empty${i}`}><span>+</span><small>Open intern position</small></li>)}</ul>
            <div className="host-actions">{host&&state.status==="lobby"&&<button className="secondary add-bot" disabled={busy||count>=8||!connected} onClick={()=>control("add_bot")}><Plus size={16}/><Bot size={16}/> Add bot <span>Lv1</span></button>}{host?<button className={running?"secondary":"primary"} disabled={busy||(state.status==="lobby"&&count<2)||!connected} onClick={()=>control(running||finished?"lobby":"start")}>{running||finished?<RotateCcw size={17}/>:<Zap size={17}/>} {busy?"One moment…":finished?"Play Again":running?"Return to lobby":"Start round"}{!running&&<ArrowRight size={18}/>}</button>:<div className="host-wait"><Radio size={17}/>{finished?"Shift complete":running?"Round in progress":"Waiting for the host"}</div>}<p>{finished?"Play Again keeps your bots.":running?"Deliver to the exit. Every canister is one point.":waitText(count)}</p>{state.status==="lobby"&&<p className="bot-note">Bots use one simple difficulty. Friends can join a full lab by taking a bot's seat.</p>}</div>
          </aside>
        </div>
        <div className="test-checklist"><span className="eyebrow">THE SHIFT RULES</span><span><Package size={15}/> Touch + grab</span><span><ArrowRight size={15}/> Carry to the green exit</span><span><Trophy size={15}/> Most deliveries wins</span><span className="muted">3 minutes. One very questionable lab.</span></div>
      </>:<div className="restoring"><Radio size={28}/><h2>Rejoining your lab…</h2><p>Your crew should be right here.</p><button className="secondary" onClick={()=>reset()}>Return to check-in</button></div>}
    </main>
    <footer><span className="mono">OVERCLOCKED <b>©</b> FACILITY 01</span><span>3-minute rounds · Solo + multiplayer</span><button className="text-button" onClick={()=>setHelp(true)}>Field guide <ChevronRight size={14}/></button></footer>
    {help&&<div className="modal-backdrop" onClick={()=>setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e=>e.stopPropagation()}><button autoFocus className="icon-button modal-close" onClick={()=>setHelp(false)} aria-label="Close field guide"><X size={20}/></button><span className="eyebrow">FIELD GUIDE / DAY 02</span><h2 id="help-title">Your first shift.</h2><ol><li><strong>Pick a nickname.</strong> Create a lab or join with a five-character code.</li><li><strong>Assemble a crew.</strong> Invite friends or let the host add Lv1 bots. Up to eight humans and bots share a lab.</li><li><strong>Start the shift.</strong> You need at least two participants. One human and one bot is enough.</li><li><strong>Grab and deliver.</strong> Use WASD, arrows, or the joystick. Touch a canister, then press Space or Grab. Carry it into the green exit for one point. Grab becomes Drop while carrying.</li></ol><p>Carrying slows you by 15%. The round lasts three minutes; the last ten seconds flash red. The highest score wins. The host can Play Again with the same bots. Human hosts pass the role to another human when leaving.</p><button className="primary" onClick={()=>setHelp(false)}>Got it. Clock me in.<ArrowRight size={18}/></button></section></div>}
  </div>;
}
