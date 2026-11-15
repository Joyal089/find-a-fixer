// Darwin is UTC+9:30 all year (the NT has no daylight saving), so a fixed offset is exact.
export const DARWIN_TIME_ZONE = 'Australia/Darwin';
const DARWIN_OFFSET_MINUTES = 570;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Start times offered when proposing a visit. */
export const QUOTE_HOURS: readonly number[] = [7, 9, 11, 13, 15, 17];

const dateTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: DARWIN_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dayFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: DARWIN_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: DARWIN_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export const formatDateTime = (iso: string): string => dateTimeFormatter.format(new Date(iso));
export const formatDay = (iso: string): string => dayFormatter.format(new Date(iso));
export const formatTime = (iso: string): string => timeFormatter.format(new Date(iso));

/** Calendar date in Darwin, as YYYY-MM-DD. */
export function darwinDayKey(date: Date): string {
  return new Date(date.getTime() + DARWIN_OFFSET_MINUTES * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}

/** The instant a Darwin wall-clock time happens, as a UTC ISO string. */
export function darwinSlotToIso(dayKey: string, hour: number): string {
  const utcMidnight = Date.parse(`${dayKey}T00:00:00Z`);
  return new Date(utcMidnight + (hour * 60 - DARWIN_OFFSET_MINUTES) * MS_PER_MINUTE).toISOString();
}

export interface DayOption {
  key: string;
  label: string;
}

/** The next `count` Darwin calendar days, starting today. */
export function upcomingDays(count: number, now: Date): DayOption[] {
  return Array.from({ length: count }, (_, offset) => {
    const key = darwinDayKey(new Date(now.getTime() + offset * MS_PER_DAY));
    return { key, label: formatDay(darwinSlotToIso(key, 12)) };
  });
}

export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

/** First instant of the current Darwin calendar month (billing months are local). */
export function darwinMonthStartIso(now: Date): string {
  return darwinSlotToIso(`${darwinDayKey(now).slice(0, 7)}-01`, 0);
}

/** Parses an Australian date (DD/MM/YYYY) into YYYY-MM-DD, or null if it is not a real date. */
export function parseAuDate(input: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, day = '', month = '', year = ''] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  // Rejects impossible dates such as 31/02, which Date would roll into March.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}
