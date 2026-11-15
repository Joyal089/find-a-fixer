import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/Feedback';
import { JobCard } from '@/components/JobCard';
import { PaginatedFlatList } from '@/components/PaginatedFlatList';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { useSession } from '@/hooks/useSession';
import { listCompanyJobs, listJobFeed } from '@/services/jobs';

/** Open jobs matching the company's trades and service areas. */
export function JobFeedScreen() {
  const { company } = useSession();
  if (company?.status !== 'approved') {
    return (
      <EmptyState
        title={company?.status === 'suspended' ? 'Account suspended' : 'Waiting for approval'}
        message={
          company?.status === 'suspended'
            ? 'Please contact the Find a Fixer team.'
            : 'The Find a Fixer team is checking your licence and insurance. Jobs will appear here once you are approved.'
        }
      >
        <Button
          label="View my company details"
          variant="secondary"
          onPress={() => router.push('/company-profile')}
        />
      </EmptyState>
    );
  }
  return <OpenJobsList />;
}

function OpenJobsList() {
  const list = usePaginatedList(listJobFeed);
  const { refresh } = list;
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  return (
    <PaginatedFlatList
      list={list}
      renderItem={(job) => <JobCard job={job} onPress={() => router.push(`/job/${job.id}`)} />}
      emptyTitle="No open jobs right now"
      emptyMessage="New jobs in your trades and areas show up here. Pull down to refresh."
    />
  );
}

/** Jobs this company has accepted, at any stage. */
export function CompanyJobsScreen() {
  const { company } = useSession();
  const companyId = company?.id;
  const fetchPage = useCallback(
    (page: number) => (companyId ? listCompanyJobs(companyId, page) : Promise.resolve([])),
    [companyId],
  );
  const list = usePaginatedList(fetchPage);
  const { refresh } = list;
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  return (
    <PaginatedFlatList
      list={list}
      renderItem={(job) => <JobCard job={job} onPress={() => router.push(`/job/${job.id}`)} />}
      emptyTitle="No jobs yet"
      emptyMessage="Jobs you accept from the feed are kept here."
    />
  );
}
