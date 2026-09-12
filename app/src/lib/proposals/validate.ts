import type { City } from '../../cities/types';
import { clone, contentHash, type PlanSnapshot } from '../trips/schema';
import { acceptSnapshot, draftHash } from '../trips/snapshot';
import { MAX_VERSIONS, parseLocal, saveLocal, STORAGE_KEY, type StoragePort } from '../trips/local-store';
import { buildProposal } from './build';
import type { ItineraryProposal } from './schema';

/** Validate the frozen choice; never substitute a newly computed schedule. */
export function acceptProposalSnapshot(city: City, base: PlanSnapshot, proposal: ItineraryProposal, optionId: string, now = new Date()): PlanSnapshot {
  if (proposal.schemaVersion !== 1 || proposal.baseId !== base.id || proposal.baseHash !== contentHash(base)) throw Error('This preview is stale. Create a new preview.');
  if (+now < Date.parse(proposal.createdAt) || +now >= Date.parse(proposal.expiresAt)) throw Error('This preview has expired. Create a new preview.');
  const rebuilt = buildProposal(city, base, proposal.dayIndex, proposal.conditions, new Date(proposal.createdAt));
  if (contentHash(rebuilt) !== contentHash(proposal)) throw Error('This preview has changed. Create a new preview.');
  const option = proposal.options.find(o => o.id === optionId);
  if (proposal.status !== 'ready' || !option) throw Error('Choose an available alternative.');
  const draft = clone(base.draft);
  draft.days[proposal.dayIndex] = clone(option.day);
  draft.edited = true;
  // Simulated closures must remain visibly demonstrative after save/reload/export.
  draft.demo = base.demo || proposal.conditions.some(c => c.status === 'simulated');
  if (draft.dayNarrations) delete draft.dayNarrations[proposal.dayIndex];
  const snapshot = acceptSnapshot(city, draft, base, now, draft.demo);
  snapshot.days = snapshot.days.map((d, i) => i === proposal.dayIndex ? d : clone(base.days[i]));
  return snapshot;
}

/** Durable before success. Call within the browser's shared local-store lock. */
export function persistProposal(storage: StoragePort, city: City, proposal: ItineraryProposal, optionId: string, now = new Date()) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) throw Error('The saved plan is no longer on this device. Reload before continuing.');
  const data = parseLocal(raw);
  const base = data.snapshots.find(s => s.id === proposal.baseId);
  if (!base || data.snapshots.filter(s => s.tripId === proposal.tripId).at(-1)?.id !== base.id)
    throw Error('A newer version was saved or this version was removed. Reload and create a new preview.');
  if (data.snapshots.length >= MAX_VERSIONS) throw Error('Twenty versions are saved. Export and remove an older version first.');
  const snapshot = acceptProposalSnapshot(city, base, proposal, optionId, now);
  // Follow the accepted alternative in the working itinerary when it still
  // matches this base. Preserve genuinely separate, unaccepted working edits.
  const matchingDraft = data.drafts[city.id] && draftHash(data.drafts[city.id]) === base.inputsHash;
  const next = { ...data, drafts: matchingDraft ? { ...data.drafts, [city.id]: clone(snapshot.draft) } : data.drafts,
    snapshots: [...data.snapshots, snapshot] };
  saveLocal(storage, next);
  return { data: next, snapshot };
}
