'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Overview } from '@calorie-donate/api';
import { api, errorMessage } from '@/lib/api';

/** Overview for pages that only need today's date and the profile. */
export function useOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setError(null);
    try {
      setOverview(await api.overview());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);
  return { overview, error, reload };
}
