import { useCallback, useEffect, useState } from 'react';

import { subscribeToJob } from '@/services/chat';
import { toFriendlyMessage } from '@/services/errors';
import { getJob, getJobCompany, getJobContact, getJobMedia } from '@/services/jobs';
import { listQuotes } from '@/services/quotes';
import type { Company, Job, JobContact, MediaItem, Quote } from '@/types';

interface JobDetail {
  job: Job | null;
  quotes: Quote[];
  media: MediaItem[];
  /** Address and phone; null while the viewer is not allowed to see them. */
  contact: JobContact | null;
  company: Company | null;
}

const EMPTY: JobDetail = { job: null, quotes: [], media: [], contact: null, company: null };

async function loadJobDetail(jobId: string): Promise<JobDetail> {
  const job = await getJob(jobId);
  if (!job) return EMPTY;
  const [quotes, media, contact, company] = await Promise.all([
    listQuotes(jobId),
    getJobMedia(jobId),
    getJobContact(jobId),
    job.company_id ? getJobCompany(job.company_id) : Promise.resolve(null),
  ]);
  return { job, quotes, media, contact, company };
}

type Outcome = { detail: JobDetail; error: null } | { detail: null; error: string };

/** Never rejects: failures come back as a message. */
const fetchOutcome = (jobId: string): Promise<Outcome> =>
  loadJobDetail(jobId).then(
    (detail) => ({ detail, error: null }),
    (caught: unknown) => ({ detail: null, error: toFriendlyMessage(caught) }),
  );

/** Everything the job screen shows, kept live while the screen is open. */
export function useJobDetail(jobId: string) {
  const [detail, setDetail] = useState<JobDetail>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((outcome: Outcome) => {
    if (outcome.detail) setDetail(outcome.detail);
    setError(outcome.error);
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    apply(await fetchOutcome(jobId));
  }, [jobId, apply]);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      void fetchOutcome(jobId).then((outcome) => {
        if (active) apply(outcome);
      });
    refresh();
    const unsubscribe = subscribeToJob(jobId, refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [jobId, apply]);

  return { ...detail, loading, error, reload };
}
