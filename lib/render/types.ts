export type ViewKind="2d"|"3d";
export type FramePlayer={
  id:string;name:string;color:string;x:number;y:number;
  isSelf:boolean;isBot:boolean;level:number;carrying:boolean;connected:boolean;score:number;
};
export type FrameAnomaly={id:string;x:number;y:number;visible:boolean;kind?:string};
export type GameEvent=
  |{type:"grab";playerId:string}
  |{type:"drop";playerId:string;x:number;y:number}
  |{type:"deliver";playerId:string}
  |{type:"respawn";anomalyId:string};
export type FrameView={
  time:number;dt:number;status:string;secondsLeft:number;input:{x:number;y:number};
  grabPending:boolean;players:FramePlayer[];anomalies:FrameAnomaly[];events:GameEvent[];reducedMotion:boolean;
};
export type RendererStats={calls:number;triangles:number;geometries:number;textures:number;pixelRatio:number};
export interface ArenaRenderer{
  readonly kind:ViewKind;
  mount(stage:HTMLDivElement):void;
  resize(cssWidth:number,cssHeight:number):void;
  frame(view:FrameView):void;
  dispose():void;
  stats?():RendererStats;
}
