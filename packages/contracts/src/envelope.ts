/**
 * The response envelopes of PRD §19.2 and §19.3.
 *
 * `meta` is where a response tells the truth about itself: which version of the
 * source it reflects and how fresh it is (§19.5, §22.2). A projection that
 * cannot say those things is not allowed to pretend it is authoritative.
 */

export type ResponseMeta = {
  requestId: string;
  nextCursor?: string | null;
  sourceVersion?: number;
  freshness?: string;
  /** Set by projections and read models; absent means the data came straight
   *  from its owning domain. */
  derived?: boolean;
};

export type SuccessEnvelope<T> = { data: T; meta: ResponseMeta };

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    fieldErrors: { path: string; code: string; message: string }[];
    requestId: string;
    retryable: boolean;
  };
};

export function ok<T>(data: T, meta: ResponseMeta): SuccessEnvelope<T> {
  return { data, meta };
}

/** Cursor pagination shape for activity, audit, feed and search (§19.1). */
export type Page<T> = { items: T[]; nextCursor: string | null };
