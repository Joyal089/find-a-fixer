import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { LoadingView, Notice } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colours, fontSize } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';
import { signInWithEmail, signUpWithEmail } from '@/services/auth';
import { toFriendlyMessage } from '@/services/errors';

const MIN_PASSWORD = 8;

export function CompanyLoginScreen() {
  const session = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.loading) return <LoadingView />;
  // Signed in with an email: go to the feed, or finish the company profile first.
  if (session.userId && session.hasEmail) {
    return <Redirect href={session.company ? '/company/feed' : '/company-profile'} />;
  }

  const isRegistering = mode === 'register';
  const canSubmit = email.includes('@') && password.length >= (isRegistering ? MIN_PASSWORD : 1);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await (isRegistering ? signUpWithEmail(email, password) : signInWithEmail(email, password));
    } catch (caught) {
      setError(toFriendlyMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.heading}>{isRegistering ? 'Become a partner' : 'Partner login'}</Text>
      <Text style={styles.body}>
        {isRegistering
          ? 'Create a login, then add your licence and insurance details. Our team checks every company before it sees jobs.'
          : 'Log in to see jobs in your trades and service areas.'}
      </Text>
      <TextField
        label="Email"
        placeholder="you@company.com.au"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        hint={isRegistering ? `At least ${MIN_PASSWORD} characters.` : undefined}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={isRegistering ? 'new-password' : 'current-password'}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Notice tone="error" message={error} /> : null}
      <Button
        label={isRegistering ? 'Create login' : 'Log in'}
        loading={busy}
        disabled={!canSubmit}
        onPress={() => void submit()}
      />
      <Button
        label={isRegistering ? 'I already have a login' : 'New here? Become a partner'}
        variant="secondary"
        disabled={busy}
        onPress={() => {
          setMode(isRegistering ? 'login' : 'register');
          setError(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colours.text, fontSize: fontSize.title, fontWeight: '800' },
  body: { color: colours.textMuted, fontSize: fontSize.body, lineHeight: 24 },
});
