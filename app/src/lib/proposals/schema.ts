import type { DayState } from '../planner';
import type { OperationalCondition } from '../conditions/operations';
import type { PlanSnapshot } from '../trips/schema';

export interface ProposalOption {
  id: string;
  title: string;
  day: DayState;
  extraTravel: number;
}
export interface ItineraryProposal {
  schemaVersion: 1;
  id: string;
  baseId: string;
  baseHash: string;
  tripId: string;
  dayIndex: number;
  createdAt: string;
  expiresAt: string;
  conditions: OperationalCondition[];
  options: ProposalOption[];
  status: 'ready' | 'unavailable' | 'unaffected';
  reason: string;
  release: PlanSnapshot['release'];
}
