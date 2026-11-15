const audFormatter = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

export const MIN_QUOTE_CENTS = 100;
export const MAX_QUOTE_CENTS = 10_000_000;

export function formatAud(cents: number): string {
  return audFormatter.format(cents / 100);
}

/**
 * Turns what a tradie types ("150", "$1,250.50") into whole cents.
 * Returns null when it is not a valid amount within the allowed quote range.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (cents < MIN_QUOTE_CENTS || cents > MAX_QUOTE_CENTS) return null;
  return cents;
}
