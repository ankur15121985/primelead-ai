/**
 * Money handling.
 *
 * Storage rule: every monetary column in the database is an INTEGER of paise
 * (₹×100) so floating-point rounding can never corrupt invoices or payments.
 *
 * The API boundary converts:
 *   - incoming user input (rupees, e.g. 1499.5)  → paise (149950) before storing
 *   - outgoing API responses (paise)             → rupees for display
 *
 * Never do arithmetic on rupees in services — convert once at the edge.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round((rupees || 0) * 100);
}

export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

/** Convert an entire row of known money keys (paise → rupees). */
export function serializeMoney(row: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...row };
  for (const k of keys) {
    if (typeof out[k] === 'number') out[k] = paiseToRupees(out[k] as number);
  }
  return out;
}
