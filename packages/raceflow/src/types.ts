export type Phase = 'lobby' | 'countdown' | 'racing' | 'finished' | 'results';
export interface RaceResult { id: string; position: number; dnf?: boolean; timeMs?: number }
export interface DirectorConfig { racers: readonly string[]; laps: number; countdownMs?: number /* default 3000 */; finishGraceMs?: number /* default 30000: how long the others get after the first finisher */; maxRaceMs?: number /* default 600000 */; finishedHoldMs?: number /* default 1500 */ }
export interface Progress { progress: number /* laps completed + fraction */; finished: boolean }
export type DirectorEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'countdown'; value: 3 | 2 | 1 | 0 }                // 0 = GO
  | { type: 'finish'; id: string; position: number; timeMs: number }
  | { type: 'dnf'; id: string }
  | { type: 'results'; results: RaceResult[] };
export interface DirectorState { phase: Phase; countdownLeftMs: number; raceTimeMs: number; lights: number /* 3,2,1 during the countdown, 0 once racing */; order: { id: string; position: number }[]; finishTimes: Record<string, number>; dnf: string[] }
export interface RaceDirector { readonly state: DirectorState; start(): DirectorEvent[]; update(dtMs: number, progress: Readonly<Record<string, Progress>>): DirectorEvent[]; abort(): DirectorEvent[]; snapshot(): string; restore(json: string): void }
