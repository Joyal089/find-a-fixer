/**
 * Normalises an Australian mobile number to E.164 (+614XXXXXXXX), which is what the
 * SMS provider needs. Returns null if it is not an Australian mobile.
 */
export function normaliseAuMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const national = digits.replace(/^\+?61/, '').replace(/^0/, '');
  return /^4\d{8}$/.test(national) ? `+61${national}` : null;
}

/** Shows only the last three digits, for confirmation messages. */
export function maskPhone(e164: string): string {
  return `•••• ••• ${e164.slice(-3)}`;
}
