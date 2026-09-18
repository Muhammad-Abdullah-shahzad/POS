import { QueryFilter } from 'mongoose';

/** Escape a user supplied string so it cannot act as a regular expression. */
export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a case insensitive "contains" filter across several fields.
 *
 * Returns an empty filter when there is no search term, so it can be dropped
 * straight into `Model.find(...)`.
 */
export function searchFilter<T>(term: string | undefined, fields: string[]): QueryFilter<T> {
  const trimmed = term?.trim();
  if (!trimmed) return {};

  const pattern = new RegExp(escapeRegex(trimmed), 'i');
  return { $or: fields.map((field) => ({ [field]: pattern })) } as QueryFilter<T>;
}
