import { Redirect, useLocalSearchParams } from 'expo-router';

import { LoadingView } from '@/components/Feedback';
import { useSession } from '@/hooks/useSession';
import { JobDetailScreen } from '@/screens/shared/JobDetailScreen';

export default function JobRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, userId } = useSession();
  if (loading) return <LoadingView />;
  if (!userId) return <Redirect href="/" />;
  return <JobDetailScreen jobId={id} />;
}
