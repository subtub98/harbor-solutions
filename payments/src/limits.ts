const MIN_CENTS = 1;

/**
 * CONTROL GAP (practice 1): there is no maximum. A $1 billion wire is accepted.
 * Expected ceiling for Harbor: 100_000_000 cents ($1,000,000).
 */
export function assertTransferAmount(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS) {
    throw new Error("invalid_amount");
  }
}
