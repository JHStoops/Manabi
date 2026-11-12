import { z } from 'zod';

/**
 * Cursor pagination for list endpoints (SDD section 8). The cursor is opaque to clients: the API
 * encodes its position as base64url text and decodes it on the next request.
 */
export const cursorSchema = z
  .string()
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/, 'Expected an opaque base64url cursor');
export type Cursor = z.infer<typeof cursorSchema>;

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Query parameters accepted by every list endpoint. `limit` arrives as a query string. */
export const paginationQuerySchema = z.object({
  cursor: cursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** One page of a list response; `nextCursor` is null on the last page. */
export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: cursorSchema.nullable(),
  });
}
export type Page<T> = { items: T[]; nextCursor: Cursor | null };
