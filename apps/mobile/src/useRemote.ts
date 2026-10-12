import { useCallback, useEffect, useState } from 'react';
import { describeError } from './errors';

/**
 * Loads data with `fetcher` (keep it stable with useCallback) and reloads it
 * whenever the fetcher changes or `reload` / `refresh` is called.
 */
export function useRemote<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetcher().then(
      (result) => {
        if (!active) return;
        setData(result);
        setError(null);
        setRefreshing(false);
      },
      (caught: unknown) => {
        if (!active) return;
        setError(describeError(caught));
        setRefreshing(false);
      },
    );
    return () => {
      active = false;
    };
  }, [fetcher, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, []);

  return { data, error, refreshing, reload, refresh };
}
