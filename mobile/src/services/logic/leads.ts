export interface LeadUsage {
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
}

/**
 * Usage against the monthly limit for the dashboard. `used` is this month's charged leads
 * plus accepted jobs still waiting on a quote. The server enforces the limit in accept_job.
 */
export function leadUsage(used: number, limit: number): LeadUsage {
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, atLimit: remaining === 0 };
}
