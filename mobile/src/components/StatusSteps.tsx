import { StyleSheet, Text, View } from 'react-native';

import { colours, fontSize, spacing } from '@/constants/theme';
import { JOB_STEPS, STATUS_LABELS, stepIndex } from '@/services/logic/jobStatus';
import type { JobStatus } from '@/types';

/** The Posted → Accepted → Scheduled → Completed tracker. */
export function StatusSteps({ status }: { status: JobStatus }) {
  const current = stepIndex(status);

  if (current < 0) {
    return <Text style={styles.cancelled}>{STATUS_LABELS[status]}</Text>;
  }

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`Status: ${STATUS_LABELS[status]}, step ${current + 1} of ${JOB_STEPS.length}`}
    >
      {JOB_STEPS.map((step, index) => {
        const reached = index <= current;
        return (
          <View key={step} style={styles.step}>
            <View style={[styles.bar, reached && styles.barReached]} />
            <Text style={[styles.label, reached && styles.labelReached]} numberOfLines={1}>
              {STATUS_LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  step: { flex: 1, gap: spacing.xs },
  bar: { height: 6, borderRadius: 3, backgroundColor: colours.border },
  barReached: { backgroundColor: colours.accent },
  label: { color: colours.textMuted, fontSize: fontSize.small },
  labelReached: { color: colours.text, fontWeight: '700' },
  cancelled: { color: colours.danger, fontSize: fontSize.body, fontWeight: '700' },
});
