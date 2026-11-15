import type { JobStatus } from '@/types';

/** The four steps a job moves through, in order. */
export const JOB_STEPS: readonly JobStatus[] = ['posted', 'accepted', 'scheduled', 'completed'];

export const STATUS_LABELS: Record<JobStatus, string> = {
  posted: 'Posted',
  accepted: 'Accepted',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Position in JOB_STEPS, or -1 for a cancelled job. */
export function stepIndex(status: JobStatus): number {
  return JOB_STEPS.indexOf(status);
}

export type Viewer = 'customer' | 'company';
export type JobAction =
  'accept' | 'decline' | 'send_quote' | 'respond_to_quote' | 'complete' | 'cancel' | 'chat';

interface ActionContext {
  status: JobStatus;
  viewer: Viewer;
  hasPendingQuote: boolean;
}

/**
 * Which buttons to show. The server enforces the same rules in 0003_workflow.sql;
 * this only keeps the screen from offering actions that would be refused.
 */
export function availableActions({ status, viewer, hasPendingQuote }: ActionContext): JobAction[] {
  const actions: JobAction[] = [];
  if (viewer === 'company') {
    if (status === 'posted') actions.push('accept', 'decline');
    if (status === 'accepted' && !hasPendingQuote) actions.push('send_quote');
    if (status === 'scheduled') actions.push('complete');
  } else {
    if (status === 'posted') actions.push('cancel');
    if (status === 'accepted' && hasPendingQuote) actions.push('respond_to_quote');
  }
  if (status === 'accepted' || status === 'scheduled' || status === 'completed') {
    actions.push('chat');
  }
  return actions;
}
