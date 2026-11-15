export interface LeadCounts {
  /** Charged leads logged this month. */
  leads: number;
  /** Accepted jobs still waiting on a quote decision. */
  waiting: number;
}

export interface LeadUsage extends LeadCounts {
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
}

/**
 * Usage against the monthly limit for the dashboard. `used` is this month's charged leads
 * plus accepted jobs still waiting on a quote. The server enforces the limit in accept_job.
 */
export function leadUsage({ leads, waiting }: LeadCounts, limit: number): LeadUsage {
  const used = leads + waiting;
  const remaining = Math.max(0, limit - used);
  return { leads, waiting, used, limit, remaining, atLimit: remaining === 0 };
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** One-line summary, e.g. "3 leads · 1 waiting on a quote · 16 left of 20". */
export function leadUsageSummary(usage: LeadUsage): string {
  return [
    plural(usage.leads, 'lead', 'leads'),
    `${usage.waiting} waiting on a quote`,
    `${usage.remaining} left of ${usage.limit}`,
  ].join(' · ');
}
