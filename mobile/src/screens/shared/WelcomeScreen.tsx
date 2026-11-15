import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { LoadingView, Notice } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { colours, fontSize, spacing } from '@/constants/theme';
import { useSession } from '@/hooks/useSession';
import { isSupabaseConfigured } from '@/services/supabase';

export function WelcomeScreen() {
  const { loading, userId, profile, phoneVerified, error, signOut } = useSession();

  if (!isSupabaseConfigured) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Text style={styles.brand}>Find a Fixer</Text>
        <Notice message="Setup needed: copy mobile/.env.example to mobile/.env, add your Supabase URL and key, then restart Expo. See the README." />
      </Screen>
    );
  }
  if (loading) return <LoadingView />;
  if (userId && profile?.role === 'company') return <Redirect href="/company/feed" />;
  if (userId && profile?.role === 'customer' && phoneVerified) {
    return <Redirect href="/customer/jobs" />;
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Text style={styles.brand}>Find a Fixer</Text>
        <Text style={styles.tagline}>Darwin tradies, sorted.</Text>
        <Text style={styles.body}>
          Post your job for free. A vetted local company picks it up and sends you a quote.
        </Text>
      </View>

      {error ? <Notice tone="error" message={error} /> : null}
      {profile?.role === 'admin' ? (
        <>
          <Notice message="This is an admin login. Use the admin web page to approve companies and view leads." />
          <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
        </>
      ) : (
        <View style={styles.actions}>
          <Button label="Post a job" onPress={() => router.push('/verify')} />
          <Button
            label="I'm a partner company"
            variant="secondary"
            onPress={() => router.push('/company-login')}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: spacing.xl * 2, paddingBottom: spacing.xl, gap: spacing.sm },
  brand: { color: colours.accent, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colours.text, fontSize: fontSize.title, fontWeight: '700' },
  body: { color: colours.textMuted, fontSize: fontSize.large, lineHeight: 28 },
  actions: { gap: spacing.md },
});
