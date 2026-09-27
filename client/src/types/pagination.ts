/** One page of a list, as the server (and the desktop database) returns it. */
export interface Page<T> {
  items: T[];
  /** Matching records across all pages. */
  total: number;
  /** 1-based. */
  page: number;
  pageSize: number;
  pageCount: number;
}
