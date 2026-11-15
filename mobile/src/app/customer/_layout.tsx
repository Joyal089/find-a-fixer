import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { LoadingView } from '@/components/Feedback';
import { tabScreenOptions } from '@/components/tabOptions';
import { useSession } from '@/hooks/useSession';

export default function CustomerLayout() {
  const { loading, userId, phoneVerified, profile } = useSession();
  if (loading) return <LoadingView />;
  if (profile?.role === 'company') return <Redirect href="/company/feed" />;
  if (!userId || !phoneVerified) return <Redirect href="/verify" />;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="jobs" options={{ title: 'My jobs' }} />
      <Tabs.Screen name="post" options={{ title: 'Post a job' }} />
    </Tabs>
  );
}
