import { addMonths } from './calendar';

export type ReturnRequestResult =
  { ok: true } | { ok: false; reason: 'before_lease_end' | 'already_requested' };

/** Allows a customer return request at or after the exclusive end of the lease. */
export function canRequestReturn(
  leaseEndDate: string,
  requestDate: string,
  alreadyRequested: boolean
): ReturnRequestResult {
  addMonths(leaseEndDate, 0);
  addMonths(requestDate, 0);
  if (alreadyRequested) return { ok: false, reason: 'already_requested' };
  if (requestDate < leaseEndDate) return { ok: false, reason: 'before_lease_end' };
  return { ok: true };
}
