import type { Quote } from '@/types';

import { throwIfError } from './errors';
import { supabase } from './supabase';

// A job has a handful of quotes at most (one open at a time), so this list is capped
// rather than paginated.
const MAX_QUOTES_SHOWN = 20;

export async function listQuotes(jobId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(MAX_QUOTES_SHOWN);
  throwIfError(error);
  return (data ?? []) as Quote[];
}

export async function sendQuote(input: {
  jobId: string;
  amountCents: number;
  notes: string;
  proposedTimeIso: string;
}): Promise<void> {
  const { error } = await supabase.rpc('send_quote', {
    p_job_id: input.jobId,
    p_amount_cents: input.amountCents,
    p_notes: input.notes,
    p_proposed_time: input.proposedTimeIso,
  });
  throwIfError(error);
}

export async function respondToQuote(quoteId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_to_quote', {
    p_quote_id: quoteId,
    p_accept: accept,
  });
  throwIfError(error);
}
