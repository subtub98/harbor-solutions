const MIN_CENTS = 1;

export function assertTransferAmount(amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents < MIN_CENTS) {
    throw new Error("invalid_amount");
  }
}
