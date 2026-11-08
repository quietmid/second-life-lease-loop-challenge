/** Calculates monthly net rent in cents, rounding the fractional cent once. */
export function monthlyNetRentCents(financedCents: number, monthlyFactor: number): number {
  if (!Number.isSafeInteger(financedCents) || financedCents < 0) {
    throw new RangeError(`financedCents must be a non-negative whole number, got ${financedCents}`);
  }
  if (!Number.isFinite(monthlyFactor) || monthlyFactor <= 0) {
    throw new RangeError(`monthlyFactor must be a positive finite number, got ${monthlyFactor}`);
  }

  // The data pack's factor is fractional; round the resulting cent amount once.
  return Math.round(financedCents * monthlyFactor);
}
