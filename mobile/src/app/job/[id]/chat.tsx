import { Redirect, useLocalSearchParams } from 'expo-router';

import { LoadingView } from '@/components/Feedback';
import { useSession } from '@/hooks/useSession';
import { ChatScreen } from '@/screens/shared/ChatScreen';

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, userId } = useSession();
  if (loading) return <LoadingView />;
  if (!userId) return <Redirect href="/" />;
  return <ChatScreen jobId={id} userId={userId} />;
}
