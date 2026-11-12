import type { User } from '@manabi/core';
import {
  ApiRequestError,
  createApiClient,
  IDEMPOTENCY_KEY_HEADER,
  isApiRequestError,
} from './index';
import type { ErrorCode } from './index';

const BASE_URL = 'http://manabi.test';

const user: User = {
  id: 1,
  username: 'hana',
  email: null,
  displayName: 'Hana',
  role: 'learner',
  mustChangePassword: false,
  timeZone: 'Asia/Tokyo',
  settings: { avatarColor: null, avatarInitial: null, dailyGoal: 20 } as User['settings'],
  disabledAt: null,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A fetch that records each request and answers with the given response. */
function mockFetch(response: () => Response) {
  const requests: Request[] = [];
  const fetch = jest.fn(async (request: Request) => {
    requests.push(request);
    return response();
  });
  return { fetch, requests };
}

/** Compile-time check that two types are the same. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertType<T extends true>(): T | undefined {
  return undefined;
}

// IF-04, IF-05
describe('successful calls', () => {
  it('resolves to the typed response body', async () => {
    const { fetch, requests } = mockFetch(() => json(200, user));
    const api = createApiClient({ baseUrl: BASE_URL, fetch });

    const me = await api.GET('/api/v1/me');

    assertType<Equal<typeof me.role, 'admin' | 'learner'>>();
    assertType<Equal<typeof me.mustChangePassword, boolean>>();
    expect(me).toEqual(user);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url).toBe(`${BASE_URL}/api/v1/me`);
  });

  it('sends a typed JSON body and fills in path parameters', async () => {
    const { fetch, requests } = mockFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch });

    const result = await api.DELETE('/api/v1/me/sessions/{id}', { params: { path: { id: '7' } } });

    assertType<Equal<typeof result, undefined>>();
    expect(result).toBeUndefined();
    expect(requests[0]?.url).toBe(`${BASE_URL}/api/v1/me/sessions/7`);
  });

  it('posts the request body as JSON', async () => {
    const auth = { user, token: 'not-a-real-token' };
    const { fetch, requests } = mockFetch(() => json(200, auth));
    const api = createApiClient({ baseUrl: BASE_URL, fetch });

    await api.POST('/api/v1/auth/login', {
      body: { identifier: 'hana', password: 'correct horse battery', clientKind: 'mobile' },
    });

    expect(requests[0]?.headers.get('Content-Type')).toBe('application/json');
    await expect(requests[0]?.json()).resolves.toEqual({
      identifier: 'hana',
      password: 'correct horse battery',
      clientKind: 'mobile',
    });
  });

  it('rejects wrong paths and bodies at compile time', () => {
    const api = createApiClient({ baseUrl: BASE_URL, fetch: async () => json(200, {}) });
    // @ts-expect-error not a route
    void api.GET('/api/v1/nope');
    // @ts-expect-error login needs a body
    void api.POST('/api/v1/auth/login');
    // @ts-expect-error password must be a string
    void api.POST('/api/v1/auth/login', { body: { identifier: 'hana', password: 1 } });
  });
});

// IF-07
describe('error responses', () => {
  it('reject with an ApiRequestError carrying the code, message and details', async () => {
    const body = {
      error: { code: 'rate_limited', message: 'Too many attempts', details: { retryAfter: 60 } },
    };
    const { fetch } = mockFetch(() => json(429, body));
    const api = createApiClient({ baseUrl: BASE_URL, fetch });

    const err = await api
      .POST('/api/v1/auth/login', { body: { identifier: 'hana', password: 'x' } })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiRequestError);
    expect(isApiRequestError(err, 'rate_limited')).toBe(true);
    expect(isApiRequestError(err, 'forbidden')).toBe(false);
    if (!isApiRequestError(err)) throw new Error('expected an ApiRequestError');
    assertType<Equal<typeof err.code, ErrorCode>>();
    expect(err).toMatchObject({
      name: 'ApiRequestError',
      status: 429,
      code: 'rate_limited',
      message: 'Too many attempts',
      details: { retryAfter: 60 },
    });
  });

  it('get the generic code for their status when the body is not the error shape', async () => {
    const { fetch } = mockFetch(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch });

    await expect(api.GET('/api/v1/me')).rejects.toMatchObject({
      status: 502,
      code: 'internal_error',
      message: 'HTTP 502',
    });
  });

  it('get the generic code for an unknown error code', async () => {
    const { fetch } = mockFetch(() => json(403, { error: { code: 'nope', message: 'x' } }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch });

    await expect(api.GET('/api/v1/me')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('isApiRequestError is false for other errors', () => {
    expect(isApiRequestError(new Error('x'))).toBe(false);
  });

  it('network failures reject with the fetch error unchanged', async () => {
    const failure = new TypeError('Failed to fetch');
    const api = createApiClient({
      baseUrl: BASE_URL,
      fetch: async () => {
        throw failure;
      },
    });

    await expect(api.GET('/api/v1/me')).rejects.toBe(failure);
  });
});

// IF-06
describe('credentials', () => {
  it('include cookies by default and send no Authorization header', async () => {
    const { fetch, requests } = mockFetch(() => json(200, user));
    await createApiClient({ baseUrl: BASE_URL, fetch }).GET('/api/v1/me');

    expect(requests[0]?.credentials).toBe('include');
    expect(requests[0]?.headers.has('Authorization')).toBe(false);
  });

  it('send a fixed bearer token', async () => {
    const { fetch, requests } = mockFetch(() => json(200, user));
    await createApiClient({ baseUrl: BASE_URL, fetch, token: 'abc' }).GET('/api/v1/me');

    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('read the bearer token on every call', async () => {
    let token: string | null = null;
    const { fetch, requests } = mockFetch(() => json(200, user));
    const api = createApiClient({ baseUrl: BASE_URL, fetch, token: async () => token });

    await api.GET('/api/v1/me');
    token = 'after-sign-in';
    await api.GET('/api/v1/me');

    expect(requests[0]?.headers.has('Authorization')).toBe(false);
    expect(requests[1]?.headers.get('Authorization')).toBe('Bearer after-sign-in');
  });
});

// FR-052
describe('idempotency keys', () => {
  const body = { identifier: 'hana', password: 'x' };

  it('are sent as the Idempotency-Key header on mutating calls', async () => {
    const { fetch, requests } = mockFetch(() => json(200, { user, token: 't' }));
    const api = createApiClient({ baseUrl: BASE_URL, fetch });

    await api.POST('/api/v1/auth/login', { body, idempotencyKey: 'key-1' });
    await api.POST('/api/v1/auth/login', {
      body,
      idempotencyKey: 'key-2',
      headers: { 'X-Extra': 'kept' },
    });

    expect(requests[0]?.headers.get(IDEMPOTENCY_KEY_HEADER)).toBe('key-1');
    expect(requests[1]?.headers.get(IDEMPOTENCY_KEY_HEADER)).toBe('key-2');
    expect(requests[1]?.headers.get('X-Extra')).toBe('kept');
  });

  it('are not sent when not given', async () => {
    const { fetch, requests } = mockFetch(() => json(200, { user, token: 't' }));
    await createApiClient({ baseUrl: BASE_URL, fetch }).POST('/api/v1/auth/login', { body });

    expect(requests[0]?.headers.has(IDEMPOTENCY_KEY_HEADER)).toBe(false);
  });
});
