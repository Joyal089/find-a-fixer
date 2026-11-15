import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colours, fontSize, radius, spacing, TOUCH_TARGET } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colours.onAccent : colours.text} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </Pressable>
  );
}

const CONFIRM_WINDOW_MS = 4000;

interface ConfirmButtonProps extends ButtonProps {
  /** Shown after the first tap, e.g. "Tap again to accept". */
  confirmLabel: string;
}

/**
 * A button that needs two taps, for actions that cannot be undone. Used instead of a
 * pop-up dialog so it behaves the same on Android, iOS and web.
 */
export function ConfirmButton({ label, confirmLabel, onPress, ...rest }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const handlePress = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onPress();
  };

  return <Button {...rest} label={armed ? confirmLabel : label} onPress={handlePress} />;
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: { backgroundColor: colours.accent, borderColor: colours.accent },
  secondary: { backgroundColor: 'transparent', borderColor: colours.border },
  danger: { backgroundColor: 'transparent', borderColor: colours.danger },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.45 },
  label: { fontSize: fontSize.body, fontWeight: '700', textAlign: 'center' },
});

const labelStyles = StyleSheet.create({
  primary: { color: colours.onAccent },
  secondary: { color: colours.text },
  danger: { color: colours.danger },
});
