import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, ConfirmButton } from '@/components/Button';
import { Card, EmptyState, LoadingView, Notice, SectionTitle } from '@/components/Feedback';
import { MediaStrip } from '@/components/MediaStrip';
import { QuoteCard } from '@/components/QuoteCard';
import { Screen } from '@/components/Screen';
import { StatusSteps } from '@/components/StatusSteps';
import { tradeLabel, urgencyLabel } from '@/constants/catalogue';
import { colours, fontSize, spacing } from '@/constants/theme';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useSession } from '@/hooks/useSession';
import { toFriendlyMessage } from '@/services/errors';
import { acceptJob, cancelJob, completeJob, declineJob } from '@/services/jobs';
import { availableActions, type Viewer } from '@/services/logic/jobStatus';
import { formatDateTime } from '@/services/logic/time';
import { respondToQuote } from '@/services/quotes';
import type { Company, Job, JobContact } from '@/types';

function ContactCard({ contact, viewer }: { contact: JobContact | null; viewer: Viewer }) {
  return (
    <Card>
      <SectionTitle>Address and contact</SectionTitle>
      {contact ? (
        <>
          <Text style={styles.body}>{contact.address}</Text>
          {viewer === 'company' ? <Text style={styles.body}>{contact.contact_phone}</Text> : null}
        </>
      ) : (
        <Text style={styles.muted}>
          The street address and phone number are shared once the customer accepts your quote.
        </Text>
      )}
    </Card>
  );
}

function CompanyCard({ company }: { company: Company }) {
  return (
    <Card>
      <SectionTitle>Your fixer</SectionTitle>
      <Text style={styles.companyName}>{company.name}</Text>
      <Text style={styles.muted}>
        Verified partner · Licence {company.licence_number} · Insured with{' '}
        {company.insurance_provider}
      </Text>
    </Card>
  );
}

function JobHeader({ job }: { job: Job }) {
  return (
    <View style={styles.header}>
      <Text style={styles.trade}>{tradeLabel(job.category)}</Text>
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.muted}>
        {job.suburb} · {urgencyLabel(job.urgency)} · Posted {formatDateTime(job.created_at)}
      </Text>
      {job.scheduled_at ? (
        <Text style={styles.scheduled}>Booked for {formatDateTime(job.scheduled_at)}</Text>
      ) : null}
    </View>
  );
}

export function JobDetailScreen({ jobId }: { jobId: string }) {
  const { profile } = useSession();
  const { job, quotes, media, contact, company, loading, error, reload } = useJobDetail(jobId);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (!job) {
    return (
      <EmptyState
        title="Job not available"
        message={error ?? 'This job has been taken by another company or no longer exists.'}
      >
        <Button label="Go back" variant="secondary" onPress={() => router.back()} />
      </EmptyState>
    );
  }

  const viewer: Viewer = profile?.role === 'company' ? 'company' : 'customer';
  const pendingQuote = quotes.find((quote) => quote.status === 'pending');
  const actions = new Set(
    availableActions({ status: job.status, viewer, hasPendingQuote: Boolean(pendingQuote) }),
  );

  /** Runs one server action, then reloads. `after` handles navigation on success. */
  const run = async (name: string, action: () => Promise<void>, after?: () => void) => {
    setBusyAction(name);
    setActionError(null);
    try {
      await action();
      if (after) after();
      else await reload();
    } catch (caught) {
      setActionError(toFriendlyMessage(caught));
      await reload();
    } finally {
      setBusyAction(null);
    }
  };

  const busy = busyAction !== null;

  return (
    <Screen>
      <JobHeader job={job} />
      <StatusSteps status={job.status} />
      <Text style={styles.body}>{job.description}</Text>
      <MediaStrip items={media} />

      {viewer === 'customer' && company ? <CompanyCard company={company} /> : null}
      {viewer === 'company' || contact ? <ContactCard contact={contact} viewer={viewer} /> : null}

      {viewer === 'customer' && job.status === 'posted' ? (
        <Notice message="Your job is live. Local companies in this trade can see it now, and you'll get a quote here once one takes it." />
      ) : null}
      {viewer === 'customer' && job.status === 'accepted' && !pendingQuote ? (
        <Notice message="A company has taken your job and is preparing a quote. You can message them now." />
      ) : null}

      {quotes.length > 0 ? <SectionTitle>Quotes</SectionTitle> : null}
      {quotes.map((quote) => (
        <QuoteCard key={quote.id} quote={quote}>
          {quote.id === pendingQuote?.id && actions.has('respond_to_quote') ? (
            <View style={styles.quoteActions}>
              <Button
                label="Accept quote"
                loading={busyAction === 'accept_quote'}
                disabled={busy}
                onPress={() => void run('accept_quote', () => respondToQuote(quote.id, true))}
              />
              <Button
                label="Decline"
                variant="secondary"
                loading={busyAction === 'decline_quote'}
                disabled={busy}
                onPress={() => void run('decline_quote', () => respondToQuote(quote.id, false))}
              />
            </View>
          ) : null}
        </QuoteCard>
      ))}

      {actionError ? <Notice tone="error" message={actionError} /> : null}
      {error ? <Notice tone="error" message={error} /> : null}

      {actions.has('accept') ? (
        <ConfirmButton
          label="Accept job"
          confirmLabel="Tap again to confirm. You’re only charged if the customer accepts your quote."
          loading={busyAction === 'accept'}
          disabled={busy}
          onPress={() => void run('accept', () => acceptJob(job.id))}
        />
      ) : null}
      {actions.has('decline') ? (
        <Button
          label="Not for us"
          variant="secondary"
          loading={busyAction === 'decline'}
          disabled={busy}
          onPress={() =>
            void run(
              'decline',
              () => declineJob(job.id),
              () => router.back(),
            )
          }
        />
      ) : null}
      {actions.has('send_quote') ? (
        <Button
          label={quotes.length > 0 ? 'Send a new quote' : 'Send quote'}
          disabled={busy}
          onPress={() => router.push(`/job/${job.id}/quote`)}
        />
      ) : null}
      {actions.has('complete') ? (
        <ConfirmButton
          label="Mark as completed"
          confirmLabel="Tap again to confirm the job is done"
          loading={busyAction === 'complete'}
          disabled={busy}
          onPress={() => void run('complete', () => completeJob(job.id))}
        />
      ) : null}
      {actions.has('chat') ? (
        <Button
          label={viewer === 'company' ? 'Message customer' : 'Message company'}
          variant={actions.size > 1 ? 'secondary' : 'primary'}
          disabled={busy}
          onPress={() => router.push(`/job/${job.id}/chat`)}
        />
      ) : null}
      {actions.has('cancel') ? (
        <ConfirmButton
          label="Cancel job"
          confirmLabel="Tap again to cancel this job"
          variant="danger"
          loading={busyAction === 'cancel'}
          disabled={busy}
          onPress={() => void run('cancel', () => cancelJob(job.id))}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  trade: { color: colours.accent, fontSize: fontSize.small, fontWeight: '700' },
  title: { color: colours.text, fontSize: fontSize.title, fontWeight: '800' },
  scheduled: { color: colours.accent, fontSize: fontSize.body, fontWeight: '700' },
  body: { color: colours.text, fontSize: fontSize.body, lineHeight: 24 },
  muted: { color: colours.textMuted, fontSize: fontSize.small, lineHeight: 20 },
  companyName: { color: colours.text, fontSize: fontSize.large, fontWeight: '700' },
  quoteActions: { gap: spacing.sm, paddingTop: spacing.sm },
});
