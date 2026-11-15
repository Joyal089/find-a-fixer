import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colours, fontSize, radius, spacing } from '@/constants/theme';
import type { Option } from '@/types';

interface ChipGroupProps<T extends string> {
  label: string;
  options: readonly Option<T>[];
  /** Selected values. Single-choice groups hold zero or one. */
  selected: readonly T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
}

/** Tap-to-choose pills: quicker than typing and works the same on every platform. */
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  multiple = false,
}: ChipGroupProps<T>) {
  const chosen = new Set(selected);

  const toggle = (value: T) => {
    if (!multiple) {
      onChange([value]);
      return;
    }
    onChange(chosen.has(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((option) => {
          const active = chosen.has(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityLabel={option.label}
              accessibilityState={{ checked: active }}
              onPress={() => toggle(option.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  label: { color: colours.text, fontSize: fontSize.small, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.surface,
  },
  chipActive: { backgroundColor: colours.accent, borderColor: colours.accent },
  chipLabel: { color: colours.text, fontSize: fontSize.body },
  chipLabelActive: { color: colours.onAccent, fontWeight: '700' },
});
