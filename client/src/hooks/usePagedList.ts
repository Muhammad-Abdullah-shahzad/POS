/**
 * Loads a server-paged list one page at a time: `GET endpoint?page=&pageSize=&search=`.
 *
 * - A new search starts again from page 1.
 * - The current page stays on screen while the next one loads, so the table
 *   does not flash empty between pages.
 * - A response that arrives after a newer request was made is ignored, so
 *   fast typing or clicking can never show the wrong page.
 * - If deleting records leaves the current page past the end, it steps back
 *   to the last page that exists.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import type { Page } from '../types/pagination';

export const DEFAULT_PAGE_SIZE = 25;

interface Options {
  search?: string;
  pageSize?: number;
}

interface Loaded<T> {
  /** Which request this answers, to tell a current response from a stale one. */
  key: string;
  page?: Page<T>;
  error?: unknown;
}

export function usePagedList<T>(endpoint: string, { search = '', pageSize = DEFAULT_PAGE_SIZE }: Options = {}) {
  // The page belongs to the search it was chosen for; a different search means page 1.
  const [position, setPosition] = useState({ page: 1, search });
  const page = position.search === search ? position.page : 1;
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);

  const requestKey = JSON.stringify([endpoint, page, pageSize, search, reloads]);

  useEffect(() => {
    let current = true;
    api
      .get(endpoint, { params: { page, pageSize, ...(search && { search }) } })
      .then(({ data }) => {
        if (!current) return;
        const result: Page<T> = data.data;
        // Deleting the last records on the last page leaves it empty; show the new last page.
        if (result.items.length === 0 && result.total > 0 && page > result.pageCount) {
          setPosition({ page: result.pageCount, search });
          return;
        }
        setLoaded({ key: requestKey, page: result });
      })
      .catch((error: unknown) => {
        if (current) setLoaded({ key: requestKey, error });
      });
    return () => {
      current = false;
    };
    // requestKey stands for every input above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const setPage = useCallback((next: number) => setPosition({ page: next, search }), [search]);
  /** Fetch the current page again, e.g. after adding or deleting a record. */
  const reload = useCallback(() => setReloads((count) => count + 1), []);

  const shown = loaded?.page;
  return {
    items: shown?.items ?? [],
    total: shown?.total ?? 0,
    pageCount: shown?.pageCount ?? 1,
    page,
    pageSize,
    setPage,
    reload,
    /** True until the current request has answered; the previous page stays visible meanwhile. */
    loading: loaded?.key !== requestKey,
    /** Only an error from the latest request. */
    error: loaded?.key === requestKey ? loaded.error : undefined,
  };
}
