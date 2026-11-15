import { PAGE_SIZE } from '@/constants/catalogue';
import type { Message, PickedMedia } from '@/types';

import { throwIfError } from './errors';
import { CHAT_MEDIA_BUCKET, uploadMedia } from './media';
import { supabase } from './supabase';

export const CHAT_PAGE_SIZE = PAGE_SIZE * 2;

/** Newest first. Pass the oldest loaded timestamp as `before` to page back in time. */
export async function listMessages(jobId: string, before?: string): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  throwIfError(error);
  return (data ?? []) as Message[];
}

async function insertMessage(row: {
  job_id: string;
  sender_id: string;
  body?: string;
  media_path?: string;
}): Promise<Message> {
  const { data, error } = await supabase.from('messages').insert(row).select('*').single();
  throwIfError(error);
  return data as Message;
}

export function sendTextMessage(jobId: string, senderId: string, body: string): Promise<Message> {
  return insertMessage({ job_id: jobId, sender_id: senderId, body: body.trim() });
}

export async function sendPhotoMessage(
  jobId: string,
  senderId: string,
  photo: PickedMedia,
): Promise<Message> {
  const { path } = await uploadMedia(CHAT_MEDIA_BUCKET, `${jobId}/${senderId}`, photo);
  return insertMessage({ job_id: jobId, sender_id: senderId, media_path: path });
}

/** Live new messages for one job. Returns a function that stops listening. */
export function subscribeToMessages(
  jobId: string,
  onMessage: (message: Message) => void,
): () => void {
  const channel = supabase
    .channel(`chat:${jobId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
      (payload) => onMessage(payload.new as Message),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Fires when the job or its quotes change, so both sides see updates without refreshing. */
export function subscribeToJob(jobId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`job:${jobId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quotes', filter: `job_id=eq.${jobId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
