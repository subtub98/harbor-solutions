const MIN_CENTS = 1;
const MAX_CENTS = 100_000_000;

export function assertTransferAmount(amountCents: number): void {
  if (
    !Number.isInteger(amountCents) ||
    amountCents < MIN_CENTS ||
    amountCents > MAX_CENTS
  ) {
    throw new Error("invalid_amount");
  }
}
