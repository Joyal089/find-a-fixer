import { Redirect, useLocalSearchParams } from 'expo-router';

import { LoadingView } from '@/components/Feedback';
import { useSession } from '@/hooks/useSession';
import { SendQuoteScreen } from '@/screens/shared/SendQuoteScreen';

export default function QuoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, company } = useSession();
  if (loading) return <LoadingView />;
  if (!company) return <Redirect href="/" />;
  return <SendQuoteScreen jobId={id} />;
}
