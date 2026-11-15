import { randomUUID } from 'expo-crypto';

import { PAGE_SIZE } from '@/constants/catalogue';
import type {
  Company,
  Job,
  JobContact,
  JobStatus,
  JobSummary,
  MediaItem,
  MediaType,
  NewJobInput,
} from '@/types';

import { throwIfError } from './errors';
import { JOB_MEDIA_BUCKET, signUrls, uploadMedia } from './media';
import { supabase } from './supabase';

type JobRowWithCount = Job & { job_media: { count: number }[] };

const toSummary = ({ job_media, ...job }: JobRowWithCount): JobSummary => ({
  ...job,
  mediaCount: job_media[0]?.count ?? 0,
});

const pageRange = (page: number): [number, number] => [
  page * PAGE_SIZE,
  page * PAGE_SIZE + PAGE_SIZE - 1,
];

const SUMMARY_COLUMNS = '*, job_media(count)';

/**
 * Open jobs for the signed-in company. Trade and area filtering happens in the database
 * (row-level security + jobs_feed_idx), so the app never downloads jobs it may not see.
 */
export async function listJobFeed(page: number): Promise<JobSummary[]> {
  const [from, to] = pageRange(page);
  const { data, error } = await supabase
    .from('jobs')
    .select(SUMMARY_COLUMNS)
    .eq('status', 'posted' satisfies JobStatus)
    .order('created_at', { ascending: false })
    .range(from, to);
  throwIfError(error);
  return ((data ?? []) as JobRowWithCount[]).map(toSummary);
}

export async function listCustomerJobs(customerId: string, page: number): Promise<JobSummary[]> {
  const [from, to] = pageRange(page);
  const { data, error } = await supabase
    .from('jobs')
    .select(SUMMARY_COLUMNS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .range(from, to);
  throwIfError(error);
  return ((data ?? []) as JobRowWithCount[]).map(toSummary);
}

export async function listCompanyJobs(companyId: string, page: number): Promise<JobSummary[]> {
  const [from, to] = pageRange(page);
  const { data, error } = await supabase
    .from('jobs')
    .select(SUMMARY_COLUMNS)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(from, to);
  throwIfError(error);
  return ((data ?? []) as JobRowWithCount[]).map(toSummary);
}

export async function getJob(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId).maybeSingle();
  throwIfError(error);
  return data as Job | null;
}

/** Address and phone. Null until the viewer is allowed to see them. */
export async function getJobContact(jobId: string): Promise<JobContact | null> {
  const { data, error } = await supabase
    .from('job_private')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();
  throwIfError(error);
  return data as JobContact | null;
}

export async function getJobCompany(companyId: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .maybeSingle();
  throwIfError(error);
  return data as Company | null;
}

export async function getJobMedia(jobId: string): Promise<MediaItem[]> {
  const { data, error } = await supabase
    .from('job_media')
    .select('id, storage_path, media_type')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  throwIfError(error);
  const rows = (data ?? []) as { id: string; storage_path: string; media_type: MediaType }[];
  const urls = await signUrls(
    JOB_MEDIA_BUCKET,
    rows.map((row) => row.storage_path),
  );
  return rows.flatMap((row) => {
    const url = urls.get(row.storage_path);
    return url ? [{ id: row.id, type: row.media_type, url }] : [];
  });
}

/**
 * Uploads the media, then creates the job in one server call. `onProgress` reports how
 * many files have finished so the screen can show "Uploading 2 of 3".
 */
export async function postJob(
  customerId: string,
  input: NewJobInput,
  onProgress: (done: number, total: number) => void,
): Promise<string> {
  const jobId = randomUUID();
  const folder = `${customerId}/${jobId}`;
  const uploaded: { path: string; type: MediaType }[] = [];
  for (const item of input.media) {
    uploaded.push(await uploadMedia(JOB_MEDIA_BUCKET, folder, item));
    onProgress(uploaded.length, input.media.length);
  }

  const { error } = await supabase.rpc('post_job', {
    p_id: jobId,
    p_category: input.category,
    p_title: input.title,
    p_description: input.description,
    p_suburb: input.suburb,
    p_address: input.address,
    p_urgency: input.urgency,
    p_media: uploaded,
  });
  throwIfError(error);
  return jobId;
}

async function callJobFunction(name: string, jobId: string): Promise<void> {
  const { error } = await supabase.rpc(name, { p_job_id: jobId });
  throwIfError(error);
}

/** Takes the job for the signed-in company. The lead is logged later, when the customer accepts the quote. */
export const acceptJob = (jobId: string): Promise<void> => callJobFunction('accept_job', jobId);
export const declineJob = (jobId: string): Promise<void> => callJobFunction('decline_job', jobId);
export const completeJob = (jobId: string): Promise<void> => callJobFunction('complete_job', jobId);
export const cancelJob = (jobId: string): Promise<void> => callJobFunction('cancel_job', jobId);
