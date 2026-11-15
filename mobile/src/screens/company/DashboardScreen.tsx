import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Notice, SectionTitle } from '@/components/Feedback';
import { PaginatedFlatList } from '@/components/PaginatedFlatList';
import { colours, fontSize, spacing } from '@/constants/theme';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { useSession } from '@/hooks/useSession';
import { countLeadsThisMonth, listLeads } from '@/services/company';
import { toFriendlyMessage } from '@/services/errors';
import { leadUsage } from '@/services/logic/leads';
import { formatDateTime } from '@/services/logic/time';
import type { LeadSummary } from '@/types';

function LeadRow({ lead }: { lead: LeadSummary }) {
  return (
    <Card>
      <Text style={styles.leadTitle}>{lead.jobTitle}</Text>
      <Text style={styles.muted}>
        {lead.jobSuburb} · {formatDateTime(lead.created_at)}
        {lead.counted ? '' : ' · Not charged'}
      </Text>
    </Card>
  );
}

/** Leads received, the monthly limit, and billing. */
export function DashboardScreen() {
  const { company, signOut } = useSession();
  const companyId = company?.id;
  const [usedThisMonth, setUsedThisMonth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    (page: number) => (companyId ? listLeads(companyId, page) : Promise.resolve([])),
    [companyId],
  );
  const list = usePaginatedList(fetchPage);
  const { refresh } = list;

  useFocusEffect(
    useCallback(() => {
      refresh();
      if (!companyId) return;
      countLeadsThisMonth(companyId)
        .then((count) => {
          setUsedThisMonth(count);
          setError(null);
        })
        .catch((caught: unknown) => setError(toFriendlyMessage(caught)));
    }, [companyId, refresh]),
  );

  const usage = leadUsage(usedThisMonth ?? 0, company?.monthly_lead_limit ?? 0);

  const header = (
    <View style={styles.header}>
      <Card>
        <SectionTitle>Leads this month</SectionTitle>
        <Text style={styles.bigNumber}>
          {usedThisMonth === null ? '–' : usage.used}
          <Text style={styles.muted}> of {usage.limit}</Text>
        </Text>
        <Text style={usage.atLimit ? styles.warning : styles.muted}>
          {usage.atLimit
            ? 'Monthly limit reached. Contact us to raise it.'
            : `${usage.remaining} left before your monthly limit.`}
        </Text>
      </Card>
      <Card>
        <SectionTitle>Billing</SectionTitle>
        <Text style={styles.body}>Plan: pay per lead</Text>
        <Text style={styles.muted}>
          A lead is logged when you accept a job. Invoices come from the Find a Fixer team.
        </Text>
      </Card>
      {error ? <Notice tone="error" message={error} /> : null}
      <Button
        label="Company details"
        variant="secondary"
        onPress={() => router.push('/company-profile')}
      />
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      <SectionTitle>Leads received</SectionTitle>
    </View>
  );

  return (
    <PaginatedFlatList
      list={list}
      header={header}
      renderItem={(lead) => <LeadRow lead={lead} />}
      emptyTitle="No leads yet"
      emptyMessage="Every job you accept is listed here."
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  bigNumber: { color: colours.text, fontSize: 44, fontWeight: '900' },
  body: { color: colours.text, fontSize: fontSize.body },
  muted: { color: colours.textMuted, fontSize: fontSize.small, fontWeight: '400', lineHeight: 20 },
  warning: { color: colours.accent, fontSize: fontSize.small, fontWeight: '700' },
  leadTitle: { color: colours.text, fontSize: fontSize.body, fontWeight: '700' },
});
