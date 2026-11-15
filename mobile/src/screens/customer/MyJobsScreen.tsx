import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { Button } from '@/components/Button';
import { JobCard } from '@/components/JobCard';
import { PaginatedFlatList } from '@/components/PaginatedFlatList';
import { useSession } from '@/hooks/useSession';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { listCustomerJobs } from '@/services/jobs';

export function MyJobsScreen() {
  const { userId, signOut } = useSession();
  const fetchPage = useCallback(
    (page: number) => (userId ? listCustomerJobs(userId, page) : Promise.resolve([])),
    [userId],
  );
  const list = usePaginatedList(fetchPage);
  const { refresh } = list;

  // Statuses change while the customer is on other screens, so reload on return.
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  return (
    <PaginatedFlatList
      list={list}
      renderItem={(job) => <JobCard job={job} onPress={() => router.push(`/job/${job.id}`)} />}
      emptyTitle="No jobs yet"
      emptyMessage="Post your first job and a local company will pick it up."
      header={<Button label="Sign out" variant="secondary" onPress={() => void signOut()} />}
    />
  );
}
