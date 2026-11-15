import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { LoadingView, Notice } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colours, fontSize } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';
import { requestPhoneCode, verifyPhoneCode } from '@/services/auth';
import { toFriendlyMessage } from '@/services/errors';
import { maskPhone, normaliseAuMobile } from '@/services/logic/phone';

const CODE_LENGTH = 6;

/** Step 1: mobile number. Step 2: the six-digit code sent by SMS. No password, no sign-up form. */
export function VerifyPhoneScreen() {
  const session = useSession();
  const [phoneInput, setPhoneInput] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.loading) return <LoadingView />;
  if (session.userId && session.phoneVerified && session.profile?.role === 'customer') {
    return <Redirect href="/customer/post" />;
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(toFriendlyMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      setSentTo(await requestPhoneCode(phoneInput));
      setCode('');
    });

  const confirmCode = () =>
    run(async () => {
      if (!sentTo) return;
      await verifyPhoneCode(sentTo, code);
      router.replace('/customer/post');
    });

  if (!sentTo) {
    return (
      <Screen>
        <Text style={styles.heading}>What&apos;s your mobile number?</Text>
        <Text style={styles.body}>
          We&apos;ll text you a code to confirm it&apos;s really you. Your number stays hidden from
          companies until you accept a quote.
        </Text>
        <TextField
          label="Mobile number"
          placeholder="0412 345 678"
          keyboardType="phone-pad"
          autoComplete="tel"
          value={phoneInput}
          onChangeText={setPhoneInput}
        />
        {error ? <Notice tone="error" message={error} /> : null}
        <Button
          label="Text me a code"
          loading={busy}
          disabled={!normaliseAuMobile(phoneInput)}
          onPress={() => void sendCode()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.heading}>Enter your code</Text>
      <Text style={styles.body}>We sent a 6-digit code to {maskPhone(sentTo)}.</Text>
      <TextField
        label="Code"
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        value={code}
        onChangeText={setCode}
      />
      {error ? <Notice tone="error" message={error} /> : null}
      <Button
        label="Confirm"
        loading={busy}
        disabled={code.trim().length !== CODE_LENGTH}
        onPress={() => void confirmCode()}
      />
      <Button
        label="Use a different number"
        variant="secondary"
        disabled={busy}
        onPress={() => setSentTo(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colours.text, fontSize: fontSize.title, fontWeight: '800' },
  body: { color: colours.textMuted, fontSize: fontSize.body, lineHeight: 24 },
});
