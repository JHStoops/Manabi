import { buildOpenApiDocument } from './openapi';

type Operation = {
  parameters?: { in: string; name: string; schema: Record<string, unknown> }[];
  responses: Record<string, unknown>;
};

// IF-05
describe('buildOpenApiDocument', () => {
  let document: Record<string, unknown>;
  beforeAll(async () => {
    document = await buildOpenApiDocument();
  });

  function operation(path: string, method: string): Operation {
    const paths = document.paths as Record<string, Record<string, Operation>>;
    const op = paths[path]?.[method];
    if (!op) throw new Error(`No ${method} ${path} in the document`);
    return op;
  }

  it('describes the API routes without a database', () => {
    expect(document.openapi).toBe('3.0.3');
    expect(Object.keys(document.paths as object)).toEqual(
      expect.arrayContaining(['/api/v1/healthz', '/api/v1/auth/login', '/api/v1/me']),
    );
  });

  it('is the same on every build', async () => {
    expect(JSON.stringify(await buildOpenApiDocument())).toBe(JSON.stringify(document));
  });

  it('documents a piped path parameter by what the client sends', () => {
    const id = operation('/api/v1/me/sessions/{id}', 'delete').parameters?.find(
      (p) => p.in === 'path' && p.name === 'id',
    );
    expect(id?.schema).toEqual({ type: 'string', pattern: '^[1-9][0-9]{0,15}$' });
  });

  it('keeps the error shape on error responses', () => {
    expect(operation('/api/v1/me', 'get').responses).toHaveProperty('401');
  });
});
