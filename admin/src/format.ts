const DARWIN = 'Australia/Darwin';

const dateTime = new Intl.DateTimeFormat('en-AU', {
  timeZone: DARWIN,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

/** Current month in Darwin as YYYY-MM, the value an <input type="month"> expects. */
export function currentDarwinMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: DARWIN, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  return `${year}-${month}`;
}

export interface Period {
  /** First and last calendar day, YYYY-MM-DD (Darwin dates, inclusive). */
  from: string;
  to: string;
  /** The same period as instants, for filtering timestamps: [startIso, endIso). */
  startIso: string;
  endIso: string;
}

/** Darwin is UTC+9:30 all year, so local midnight is a fixed offset. */
export function monthPeriod(month: string): Period {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return {
    from,
    to,
    startIso: new Date(`${from}T00:00:00+09:30`).toISOString(),
    endIso: new Date(`${nextMonth}T00:00:00+09:30`).toISOString(),
  };
}

/**
 * One CSV cell. Quotes are doubled, and cells starting with = + - @ get a leading
 * apostrophe so a spreadsheet never runs a company or job name as a formula.
 */
function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
