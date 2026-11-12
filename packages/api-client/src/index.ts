import createClient from 'openapi-fetch';
import type { FetchResponse, MaybeOptionalInit } from 'openapi-fetch';
import type {
  HttpMethod,
  MediaType,
  PathsWithMethod,
  RequiredKeysOf,
} from 'openapi-typescript-helpers';
import { apiErrorSchema, errorCodeForStatus } from '@manabi/core';
import type { ErrorCode } from '@manabi/core';
import type { paths } from './generated/schema';

export type { paths } from './generated/schema';
export type { ErrorCode } from '@manabi/core';

/**
 * Typed client for the Manabi REST API (IF-04, IF-05), for the web app and later a mobile app.
 * Paths, parameters, bodies and responses come from the generated `paths` types
 * (src/generated/schema.ts, `npm run generate:client`). It only uses `fetch`, `Request` and
 * `Headers`, so it runs in browsers and React Native as well as Node.
 */

/** Header that makes a progress-awarding write safe to retry (FR-052, SDD section 8). */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/** A session token, or a function returning the current one (it changes on sign-in and out). */
export type TokenSource =
  string | (() => string | null | undefined | Promise<string | null | undefined>);

export interface ApiClientOptions {
  /** Origin the API is served from, without /api/v1. Default '' (same origin as the page). */
  baseUrl?: string;
  /**
   * IF-06, for non-browser clients (signed in with clientKind 'mobile'): sent as
   * `Authorization: Bearer <token>`. Browsers leave it unset and use the session cookie.
   */
  token?: TokenSource;
  /** A `fetch` to use instead of the global one (tests, React Native polyfills). */
  fetch?: (input: Request) => Promise<Response>;
}

/**
 * An API error response (IF-07), parsed from the shared `{ error: { code, message, details } }`
 * shape. Responses that are not in that shape (a proxy's 502 page, say) get the generic code for
 * their status, as the API itself does for framework errors.
 */
export class ApiRequestError extends Error {
  override name = 'ApiRequestError';

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  static fromResponse(status: number, body: unknown): ApiRequestError {
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      return new ApiRequestError(status, code, message, details);
    }
    return new ApiRequestError(status, errorCodeForStatus(status), `HTTP ${status}`);
  }
}

/** True when `err` is an API error, optionally with the given code. */
export function isApiRequestError(err: unknown, code?: ErrorCode): err is ApiRequestError {
  return err instanceof ApiRequestError && (code === undefined || err.code === code);
}

/** Options every mutating call accepts on top of its typed params and body. */
export interface MutationOptions {
  /**
   * Sent as the Idempotency-Key header (FR-052). Generate one per user action and reuse it when
   * retrying that action, so the server applies it once.
   */
  idempotencyKey?: string;
}

// Mirrors openapi-fetch's (unexported) InitParam: the init argument is optional exactly when
// the route has no required params or body.
type InitParam<Init> = RequiredKeysOf<Init> extends never ? [Init?] : [Init];

/** The success body of a call; 204 responses resolve to undefined. */
type Data<Operation, Init> =
  Exclude<
    FetchResponse<Extract<Operation, Record<string, unknown>>, Init, MediaType>['data'],
    undefined
  > extends infer D
    ? [D] extends [never]
      ? undefined
      : D
    : never;

type Method<M extends HttpMethod, Extra> = <
  Path extends PathsWithMethod<paths, M>,
  Init extends MaybeOptionalInit<paths[Path], M>,
>(
  path: Path,
  ...init: InitParam<Init & Extra>
) => Promise<Data<paths[Path][M], Init>>;

/**
 * Each method takes a path from the OpenAPI document (with /api/v1) and resolves to the typed
 * success body, or rejects with an `ApiRequestError` for an error response. Network failures
 * reject with the `fetch` error unchanged.
 */
export interface ApiClient {
  GET: Method<'get', object>;
  POST: Method<'post', MutationOptions>;
  PUT: Method<'put', MutationOptions>;
  PATCH: Method<'patch', MutationOptions>;
  DELETE: Method<'delete', MutationOptions>;
}

async function currentToken(source: TokenSource | undefined): Promise<string | null | undefined> {
  return typeof source === 'function' ? source() : source;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    // The web app's session cookie rides along (IF-06).
    credentials: 'include',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  client.use({
    async onRequest({ request }) {
      const token = await currentToken(options.token);
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  });

  type Untyped = (
    path: string,
    init?: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: unknown; response: Response }>;

  const method = (call: Untyped) =>
    async function (path: string, init?: Record<string, unknown> & MutationOptions) {
      const { idempotencyKey, ...rest } = init ?? {};
      if (idempotencyKey !== undefined) {
        rest.headers = { ...(rest.headers as object), [IDEMPOTENCY_KEY_HEADER]: idempotencyKey };
      }
      const { data, error, response } = await call(path, rest);
      if (!response.ok) throw ApiRequestError.fromResponse(response.status, error);
      return data;
    };

  return {
    GET: method(client.GET as Untyped),
    POST: method(client.POST as Untyped),
    PUT: method(client.PUT as Untyped),
    PATCH: method(client.PATCH as Untyped),
    DELETE: method(client.DELETE as Untyped),
  } as ApiClient;
}
