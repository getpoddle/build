import { QueryCache, QueryClient } from '@tanstack/react-query';

const queryCache = new QueryCache();
export const queryClient = new QueryClient({
  queryCache,
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if (import.meta.env.DEV) {
  const starts = new Map<string, number>();
  const lastUpdates = new Map<string, number>();
  queryCache.subscribe(event => {
    const query = event.query;
    const hash = query.queryHash;
    if (query.state.fetchStatus === 'fetching' && !starts.has(hash)) {
      starts.set(hash, performance.now());
    } else if (query.state.fetchStatus === 'idle' && starts.has(hash)) {
      const startedAt = starts.get(hash)!;
      starts.delete(hash);
      const updatedAt = query.state.dataUpdatedAt;
      const outcome = updatedAt !== lastUpdates.get(hash) ? 'loaded' : 'failed';
      if (updatedAt) lastUpdates.set(hash, updatedAt);
      console.debug(`[query] ${outcome} ${hash} ${Math.round(performance.now() - startedAt)}ms`);
    }
  });
}
