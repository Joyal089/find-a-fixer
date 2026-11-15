import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colours, fontSize, radius, spacing, TOUCH_TARGET } from '@/constants/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function TextField({ label, hint, multiline, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colours.textMuted}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, style]}
        {...inputProps}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { color: colours.text, fontSize: fontSize.small, fontWeight: '600' },
  input: {
    minHeight: TOUCH_TARGET,
    backgroundColor: colours.surface,
    borderColor: colours.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colours.text,
    fontSize: fontSize.body,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.md },
  hint: { color: colours.textMuted, fontSize: fontSize.small },
});
