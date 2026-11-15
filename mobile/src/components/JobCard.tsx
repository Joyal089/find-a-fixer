import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tradeLabel, urgencyLabel } from '@/constants/catalogue';
import { colours, fontSize, radius, spacing } from '@/constants/theme';
import { STATUS_LABELS } from '@/services/logic/jobStatus';
import { formatDateTime } from '@/services/logic/time';
import type { JobSummary } from '@/types';

interface JobCardProps {
  job: JobSummary;
  onPress: () => void;
}

function mediaLabel(count: number): string {
  if (count === 0) return 'No photos';
  return count === 1 ? '1 photo or video' : `${count} photos or videos`;
}

export function JobCard({ job, onPress }: JobCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${tradeLabel(job.category)} in ${job.suburb}, ${STATUS_LABELS[job.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.trade}>{tradeLabel(job.category)}</Text>
        <Text style={styles.status}>{STATUS_LABELS[job.status]}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {job.title}
      </Text>
      <Text style={styles.meta}>
        {job.suburb} · {urgencyLabel(job.urgency)} · {mediaLabel(job.mediaCount)}
      </Text>
      <Text style={styles.meta}>Posted {formatDateTime(job.created_at)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colours.surface,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: { backgroundColor: colours.surfaceRaised },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trade: { color: colours.accent, fontSize: fontSize.small, fontWeight: '700' },
  status: { color: colours.textMuted, fontSize: fontSize.small, fontWeight: '600' },
  title: { color: colours.text, fontSize: fontSize.large, fontWeight: '700' },
  meta: { color: colours.textMuted, fontSize: fontSize.small },
});
