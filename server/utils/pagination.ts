/**
 * Paged lists.
 *
 * A list that can grow without limit (products, orders, customers) is sent a
 * page at a time, so neither the database, the network nor the browser ever
 * handles the whole collection at once.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** One page of a list, with what the client needs to draw page controls. */
export interface Page<T> {
  items: T[];
  /** Matching records across all pages. */
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
  pageCount: number;
}

/** The records to skip and take for a 1-based page. */
export const pageWindow = (page: number, pageSize: number) => ({ skip: (page - 1) * pageSize, limit: pageSize });

export const pageOf = <T>(items: T[], total: number, page: number, pageSize: number): Page<T> => ({
  items,
  total,
  page,
  pageSize,
  pageCount: Math.max(1, Math.ceil(total / pageSize)),
});
