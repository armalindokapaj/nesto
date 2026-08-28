// Phase 4 — offset pagination for the lists that only ever grow.
//
// Offset rather than cursor deliberately: cursor pagination is the more correct
// answer at real scale, but it is a different query shape per list and a UI
// pattern (infinite scroll / opaque tokens) that does not fit these table-heavy
// pages. At the row counts this system will actually reach — thousands, not
// tens of millions — skip/take with a page number is simpler to reason about
// and drops into the existing Table components unchanged. Revisit for a
// specific list only if it is ever measured slow at the offsets really reached.
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PageParams = { page: number; pageSize: number; skip: number; take: number; pageKey: string };

/**
 * Tolerant by design: a hand-edited `?page=0`, `?page=-4` or `?pageSize=99999` clamps rather than erroring.
 *
 * `prefix` exists for the pages that show two independent lists (HSE inductions
 * and toolbox talks share one route). Without it both pagers read the same
 * `?page`, so paging one list silently pages the other — the second list jumps
 * to page 3 and looks empty. With `parsePageParams(sp, "talk")` the second
 * reads `?talkPage` instead, and `pageKey` carries that name through to the
 * <Pagination> control so the links it builds match the param the page reads.
 */
export function parsePageParams(searchParams?: Record<string, string | undefined>, prefix?: string): PageParams {
  const pageKey = prefix ? `${prefix}Page` : "page";
  const sizeKey = prefix ? `${prefix}PageSize` : "pageSize";
  const page = Math.max(1, Math.floor(Number(searchParams?.[pageKey])) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(searchParams?.[sizeKey])) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, pageKey };
}

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  pageKey: string;
};

/** Wraps a findMany/count pair into the shape the Pagination component reads. */
export function toPaginatedResult<T>(items: T[], total: number, params: PageParams): PaginatedResult<T> {
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageKey: params.pageKey,
    // At least 1 so an empty list reads "Page 1 of 1" rather than "of 0".
    pageCount: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
