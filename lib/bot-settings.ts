// One simple difficulty for Day 2. Ratios are upper speed limits.
export const BOT_SETTINGS = {
  label: "Clumsy Intern",
  level: 1,
  speedRatio: 0.70,
  thinkMs: 1500,
  wobble: 0.12,
  accidentalDropEvery: 6,
  dropDelayMinMs: 600,
  dropDelayRangeMs: 900,
  stepMs: 50,
  maxCatchupMs: 500,
};
export const ROUND = {
  durationMs: 180000,
  carrySpeedRatio: 0.85,
  respawnMs: 2000,
  grabRadius: 38,
  exitX: 850,
  exitMinY: 180,
  exitMaxY: 420,
  spawnPoints: [
    {x:210,y:155},{x:380,y:155},{x:570,y:155},
    {x:210,y:445},{x:380,y:445},{x:570,y:445},
  ],
};
