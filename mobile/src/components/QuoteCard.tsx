import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colours, fontSize, spacing } from '@/constants/theme';
import { formatAud } from '@/services/logic/money';
import { formatDateTime } from '@/services/logic/time';
import type { Quote, QuoteStatus } from '@/types';

import { Card } from './Feedback';

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: 'Waiting for the customer',
  accepted: 'Accepted',
  declined: 'Declined',
};
const AWAITING_VIEWER = 'Waiting for your answer';

interface QuoteCardProps {
  quote: Quote;
  /** Accept/decline buttons, when the viewer may respond. */
  children?: ReactNode;
}

export function QuoteCard({ quote, children }: QuoteCardProps) {
  // Buttons are only passed in when it is the viewer's turn to answer.
  const statusLabel = children ? AWAITING_VIEWER : QUOTE_STATUS_LABELS[quote.status];
  return (
    <Card>
      <View style={styles.row}>
        <Text style={styles.amount}>{formatAud(quote.amount_cents)}</Text>
        <Text style={[styles.status, quote.status === 'accepted' && styles.statusAccepted]}>
          {statusLabel}
        </Text>
      </View>
      <Text style={styles.detail}>Proposed time: {formatDateTime(quote.proposed_time)}</Text>
      {quote.notes ? <Text style={styles.detail}>{quote.notes}</Text> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amount: { color: colours.text, fontSize: fontSize.title, fontWeight: '800' },
  status: { color: colours.textMuted, fontSize: fontSize.small, fontWeight: '600', flexShrink: 1 },
  statusAccepted: { color: colours.accent },
  detail: { color: colours.text, fontSize: fontSize.body, lineHeight: 22 },
});
