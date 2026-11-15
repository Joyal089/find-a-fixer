import { useCallback, useEffect, useRef, useState } from 'react';

import { PAGE_SIZE } from '@/constants/catalogue';
import { toFriendlyMessage } from '@/services/errors';

export interface PaginatedList<T> {
  items: T[];
  /** First load, before anything is on screen. */
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => void;
}

/**
 * Loads a list one page at a time. `fetchPage` must be stable (wrap it in useCallback);
 * the list reloads from the first page whenever it changes.
 */
export function usePaginatedList<T extends { id: string }>(
  fetchPage: (page: number) => Promise<T[]>,
): PaginatedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<'loading' | 'refreshing' | 'more' | 'idle'>('loading');
  const [error, setError] = useState<string | null>(null);
  const nextPage = useRef(0);
  const hasMore = useRef(true);
  // Guards against an old request finishing after a newer one and overwriting it.
  const latestRequest = useRef(0);

  /** Fetches a page and applies it. State is only touched once the request settles. */
  const load = useCallback(
    (mode: 'replace' | 'append') => {
      const request = (latestRequest.current += 1);
      const page = mode === 'append' ? nextPage.current : 0;
      return fetchPage(page)
        .then(
          (rows) => {
            if (request !== latestRequest.current) return;
            hasMore.current = rows.length === PAGE_SIZE;
            nextPage.current = page + 1;
            setItems((current) => {
              if (mode === 'replace') return rows;
              // Skip rows already shown (the list can shift between page requests). O(n).
              const seen = new Set(current.map((item) => item.id));
              return [...current, ...rows.filter((row) => !seen.has(row.id))];
            });
            setError(null);
          },
          (caught: unknown) => {
            if (request === latestRequest.current) setError(toFriendlyMessage(caught));
          },
        )
        .finally(() => {
          if (request === latestRequest.current) setStatus('idle');
        });
    },
    [fetchPage],
  );

  useEffect(() => {
    void load('replace');
  }, [load]);

  const refresh = useCallback(() => {
    setStatus((current) => (current === 'loading' ? current : 'refreshing'));
    void load('replace');
  }, [load]);

  const loadMore = useCallback(() => {
    if (status !== 'idle' || !hasMore.current) return;
    setStatus('more');
    void load('append');
  }, [load, status]);

  return {
    items,
    loading: status === 'loading',
    refreshing: status === 'refreshing',
    loadingMore: status === 'more',
    error,
    refresh,
    loadMore,
  };
}
