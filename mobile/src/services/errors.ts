// Turns server error codes (raised in 0003_workflow.sql) and network failures into
// plain messages. Unknown errors get a generic message so internals never reach the screen.

const MESSAGES: ReadonlyMap<string, string> = new Map([
  ['NOT_AUTHENTICATED', 'Please sign in again.'],
  ['PHONE_NOT_VERIFIED', 'Please verify your mobile number before posting a job.'],
  ['ONLY_CUSTOMERS', 'Partner accounts cannot post jobs. Use a customer login instead.'],
  ['INVALID_CATEGORY', 'Please choose a category.'],
  ['INVALID_SUBURB', 'Please choose a suburb.'],
  ['INVALID_INPUT', 'Some details are missing or too long. Please check the form.'],
  ['INVALID_MEDIA', 'One of the photos or videos could not be attached. Remove it and try again.'],
  ['INVALID_TIME', 'Please choose a time in the future.'],
  ['RATE_LIMITED', 'You have posted a lot of jobs in a short time. Please try again later.'],
  ['DUPLICATE', 'This has already been submitted.'],
  ['JOB_NOT_FOUND', 'This job is no longer available.'],
  ['JOB_TAKEN', 'Another company has already taken this job.'],
  [
    'JOB_NOT_CANCELLABLE',
    'A company has already accepted this job, so it can no longer be cancelled here.',
  ],
  ['JOB_NOT_QUOTABLE', 'This job is not open for quotes.'],
  ['JOB_NOT_COMPLETABLE', 'Only a scheduled job can be marked as completed.'],
  ['COMPANY_NOT_APPROVED', 'Your company is waiting for approval from the Find a Fixer team.'],
  ['COMPANY_EXISTS', 'This login already has a company profile.'],
  ['INSURANCE_EXPIRED', 'The insurance expiry date must be today or later.'],
  ['LEAD_LIMIT_REACHED', 'You have reached your lead limit for this month.'],
  ['QUOTE_PENDING', 'You already have a quote waiting for the customer.'],
  ['QUOTE_NOT_FOUND', 'This quote is no longer available.'],
  ['QUOTE_NOT_OPEN', 'This quote has already been answered.'],
  ['FILE_TOO_LARGE', 'That file is too large. Videos must be under 50 MB and 30 seconds.'],
  ['UNSUPPORTED_FILE', 'Only photos (JPG, PNG, WebP) and short videos (MP4, MOV) can be attached.'],
  ['EMAIL_CONFIRMATION_REQUIRED', 'Check your email to confirm your account, then log in.'],
]);

const GENERIC = 'Something went wrong. Please try again.';
const OFFLINE = 'No connection. Check your internet and try again.';

/** Thrown by services with one of the codes above. */
export class AppError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AppError';
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '';
}

export function toFriendlyMessage(error: unknown): string {
  const raw = messageOf(error);
  const known = MESSAGES.get(raw);
  if (known) return known;
  if (/network request failed|failed to fetch|fetch failed/i.test(raw)) return OFFLINE;
  if (/invalid login credentials/i.test(raw)) return 'Wrong email or password.';
  if (/already registered/i.test(raw)) return 'That email already has an account. Log in instead.';
  if (/token has expired or is invalid|invalid otp/i.test(raw)) {
    return 'That code is wrong or has expired. Request a new one.';
  }
  if (/rate limit|security purposes/i.test(raw)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (/password should be/i.test(raw))
    return 'Please choose a longer password (at least 8 characters).';
  return GENERIC;
}

/** Supabase calls return `{ error }` rather than throwing; this makes them throw. */
export function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}
