import type { City } from '../../cities/types';
import { alternativesAt, replayFrom, replayDay, stayLoc, stopPlace } from '../planner';
import { dayPlanContext, PLAN_PRESETS, restoreDayContext } from '../plan-presets';
import { closureOverlaps, conditionActive, parseConditions, type OperationalCondition } from '../conditions/operations';
import { clone, contentHash, validateSnapshot, type PlanSnapshot } from '../trips/schema';
import { canEdit } from '../trips/snapshot';
import { totalTravel } from './diff';
import type { ItineraryProposal, ProposalOption } from './schema';

export function proposalContext(city: City, base: PlanSnapshot, dayIndex: number) {
  const draft = base.draft, stay = stayLoc(city, draft.stayHood);
  const visitedElsewhere = new Set(draft.days.flatMap((d, i) => i === dayIndex ? [] : d.committed.map(s => s.id)));
  const ctx = draft.dayContexts?.[dayIndex] ? restoreDayContext(draft.dayContexts[dayIndex]) : dayPlanContext(city, dayIndex, {
    dayCount: base.days.length, preset: PLAN_PRESETS.find(p => p.id === (draft.originPresetId ?? draft.planId)) ?? null,
    travelerPace: draft.pace, stay, arriving: draft.arriving, interests: draft.interests,
    interestWeights: draft.extracted?.themeWeights, requests: draft.extracted?.requests, visitedElsewhere,
  });
  const date = base.days[dayIndex].date;
  return { stay, pace: draft.dayPaces?.[dayIndex] ?? ctx.pace, opts: { ...ctx.opts, date, weekday: new Date(date + 'T12:00:00Z').getUTCDay() } };
}

/** Bounded single-stop replacement. Never mutates the city or accepted draft. */
export function buildProposal(city: City, base: PlanSnapshot, dayIndex: number,
  input: OperationalCondition[], now = new Date()): ItineraryProposal {
  validateSnapshot(base);
  if (!canEdit(base, city) || base.cityId !== city.id) throw Error('This saved engine or catalog is read-only.');
  if (!Number.isInteger(dayIndex) || !base.days[dayIndex]) throw Error('Choose a saved day.');
  const conditions = parseConditions(input);
  if (conditions.some(c => c.cityId !== city.id || c.timeZone !== city.timeZone || !stopPlace(city, { id: c.placeId, experienceId: c.experienceId })))
    throw Error('The closure scope does not match this catalog.');
  const active = conditions.filter(c => conditionActive(c, now));
  const day = base.days[dayIndex].state, date = base.days[dayIndex].date;
  const impacted = day.committed.flatMap((s, i) => active.some(c => closureOverlaps(c, city.id, date, stopPlace(city, s)!, s.timeIn, s.dur)) ? [i] : []);
  const expires = Math.min(+now + 30 * 60000, ...active.map(c => Date.parse(c.expiresAt)));
  const proposal: ItineraryProposal = { schemaVersion: 1, id: '', baseId: base.id, baseHash: contentHash(base), tripId: base.tripId,
    dayIndex, createdAt: now.toISOString(), expiresAt: new Date(expires).toISOString(), conditions,
    options: [], status: 'unavailable', reason: '', release: clone(base.release) };
  if (!active.length) proposal.reason = 'These records are expired, retracted or unverified. No current closure can be used to change this plan.';
  else if (!impacted.length) { proposal.status = 'unaffected'; proposal.reason = 'The saved visits do not overlap these closure windows. Keep this itinerary.'; }
  else if (impacted.length > 1) proposal.reason = 'Multiple saved stops are affected. This first preview handles one replacement at a time; no feasible single-stop alternative is offered.';
  else {
    const k = impacted[0], incumbent = day.committed[k];
    // A return attached to the replaced stop or a timed incumbent may encode a commitment.
    // Without an explicit booking contract, do not claim that changing it preserves it.
    if (incumbent.returnAfter || stopPlace(city, incumbent)?.timed) {
      proposal.reason = 'This stop has timed entry or a return journey. Review that commitment separately before replacing it; this preview cannot validate a booking change.';
    } else {
      const { stay, pace, opts } = proposalContext(city, base, dayIndex);
      const constraints = { ...opts, closures: active, allowSamePlaceExperience: true, limit: 128 };
      const visited = new Set(base.draft.days.flatMap(d => d.committed.map(s => s.id)));
      const options: ProposalOption[] = [];
      for (const candidate of alternativesAt(city, day, k, pace, visited, stay, constraints)) {
        const result = replayFrom(city, day, k, candidate, pace, stay, constraints);
        if (day.trailingWaitUntil !== undefined) result.day = { ...result.day, trailingWaitUntil: day.trailingWaitUntil, clock: Math.max(result.day.clock, day.trailingWaitUntil) };
        const checked = replayDay(city, result.day, pace, stay, constraints);
        // Preserve every unaffected stop; timed suffixes must keep their exact slot.
        if (result.flags.length || checked.flags.length || day.committed.some((s, i) => i !== k &&
          (s.id !== result.day.committed[i]?.id || s.experienceId !== result.day.committed[i]?.experienceId ||
            (!!stopPlace(city, s)?.timed && s.timeIn !== result.day.committed[i]?.timeIn)))) continue;
        if (contentHash(checked.day.committed) !== contentHash(result.day.committed)) continue;
        const replacement = result.day.committed[k];
        const option = { id: contentHash(result.day), title: replacement.name, day: clone(result.day), extraTravel: totalTravel(result.day) - totalTravel(day) };
        options.push(option);
      }
      const changeCount = (option: ProposalOption) => option.day.committed.filter((s, i) => contentHash(s) !== contentHash(day.committed[i])).length;
      options.sort((a, b) => changeCount(a) - changeCount(b) || a.extraTravel - b.extraTravel || a.id.localeCompare(b.id));
      proposal.options = options.slice(0, 3);
      proposal.status = proposal.options.length ? 'ready' : 'unavailable';
      proposal.reason = proposal.options.length ? `Replace ${incumbent.name}; preserve the other stops and review any timing changes below.` : 'No feasible single-stop replacement fits the saved day, its meal roles and timing constraints. Your itinerary is unchanged.';
    }
  }
  proposal.id = `proposal-${contentHash(proposal)}`;
  return proposal;
}
