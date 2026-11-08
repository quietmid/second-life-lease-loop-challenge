export type ReceiptValidation =
  { ok: true } | { ok: false; reason: 'before_lease' | 'invalid_usage' | 'usage_below_record' };

/** Checks receipt date and odometer/counter against the lease and known item history. */
export function validateReceipt(
  signedDate: string,
  receivedDate: string,
  knownUsage: number,
  reportedUsage: number
): ReceiptValidation {
  if (receivedDate < signedDate) return { ok: false, reason: 'before_lease' };
  if (
    !Number.isSafeInteger(knownUsage) ||
    knownUsage < 0 ||
    !Number.isSafeInteger(reportedUsage) ||
    reportedUsage < 0
  ) {
    return { ok: false, reason: 'invalid_usage' };
  }
  if (reportedUsage < knownUsage) return { ok: false, reason: 'usage_below_record' };
  return { ok: true };
}
