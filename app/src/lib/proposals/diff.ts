import type { CommittedStop, DayState } from '../planner';
import { canonical } from '../trips/schema';

const key = (s: CommittedStop) => `${s.id}/${s.experienceId ?? ''}`;
const facts = (s: CommittedStop) => ({ timeIn: s.timeIn, dur: s.dur, travelMin: s.travelMin,
  travelMode: s.travelMode, timing: s.timing, returnAfter: s.returnAfter });
export interface StopDifference { kind: 'removed' | 'added' | 'changed' | 'unchanged'; before?: CommittedStop; after?: CommittedStop }
export function diffDay(before: DayState, after: DayState): StopDifference[] {
  const old = new Map(before.committed.map(s => [key(s), s]));
  const next = new Map(after.committed.map(s => [key(s), s]));
  const result: StopDifference[] = [];
  for (let i = 0; i < Math.max(before.committed.length, after.committed.length); i++) {
    const a = before.committed[i], b = after.committed[i];
    if (a && !next.has(key(a))) result.push({ kind: 'removed', before: a });
    if (b) {
      const prior = old.get(key(b));
      result.push({ kind: !prior ? 'added' : canonical(facts(prior)) === canonical(facts(b)) ? 'unchanged' : 'changed', before: prior, after: b });
    }
  }
  return result;
}
export function totalTravel(day: DayState): number {
  return day.committed.reduce((n, s) => n + s.travelMin + (s.returnAfter?.min ?? 0), 0);
}
