import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colours, fontSize, radius, spacing } from '@/constants/theme';

/** Full-area spinner for a first load. */
export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.centred} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colours.accent} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

interface NoticeProps {
  message: string;
  tone?: 'error' | 'info';
}

/** Inline banner for errors and short explanations. */
export function Notice({ message, tone = 'info' }: NoticeProps) {
  return (
    <View
      style={[styles.notice, tone === 'error' && styles.noticeError]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
    >
      <Text style={[styles.noticeText, tone === 'error' && styles.noticeTextError]}>{message}</Text>
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  message: string;
  children?: ReactNode;
}

export function EmptyState({ title, message, children }: EmptyStateProps) {
  return (
    <View style={styles.centred}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={[styles.muted, styles.emptyMessage]}>{message}</Text>
      {children}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const styles = StyleSheet.create({
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colours.background,
  },
  muted: { color: colours.textMuted, fontSize: fontSize.body },
  notice: {
    backgroundColor: colours.surface,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeError: { borderColor: colours.danger },
  noticeText: { color: colours.text, fontSize: fontSize.body, lineHeight: 22 },
  noticeTextError: { color: colours.danger },
  emptyTitle: { color: colours.text, fontSize: fontSize.large, fontWeight: '700' },
  emptyMessage: { textAlign: 'center', lineHeight: 22 },
  card: {
    backgroundColor: colours.surface,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colours.textMuted,
    fontSize: fontSize.small,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
