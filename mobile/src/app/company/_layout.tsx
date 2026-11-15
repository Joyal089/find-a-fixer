import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { LoadingView } from '@/components/Feedback';
import { tabScreenOptions } from '@/components/tabOptions';
import { useSession } from '@/hooks/useSession';

export default function CompanyLayout() {
  const { loading, userId, company } = useSession();
  if (loading) return <LoadingView />;
  if (!userId) return <Redirect href="/company-login" />;
  if (!company) return <Redirect href="/company-profile" />;

  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="feed" options={{ title: 'Job feed' }} />
      <Tabs.Screen name="jobs" options={{ title: 'My jobs' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
    </Tabs>
  );
}
