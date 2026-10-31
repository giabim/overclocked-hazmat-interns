"use client";
import {useEffect,useSyncExternalStore} from "react";
import {gameStore} from "./game-store";
import type {State} from "./game-types";
import {activeProbe} from "./render/performance";
export function useGameSlice<T extends string|number|boolean>(selector:(s:State|null)=>T,server:T){const value=useSyncExternalStore(gameStore.subscribe,()=>selector(gameStore.get()),()=>server);useEffect(()=>{activeProbe.current?.commit();});return value;}
export const useSeconds=()=>useGameSlice(()=>gameStore.seconds(performance.now()),180);
