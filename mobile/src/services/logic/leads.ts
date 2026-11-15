export interface LeadUsage {
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
}

/** Lead usage for the dashboard. The server enforces the limit when a job is accepted. */
export function leadUsage(used: number, limit: number): LeadUsage {
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, atLimit: remaining === 0 };
}
