import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type Transform = typeof jsonSchemaTransform;

const REQUEST_PARTS = ['params', 'querystring', 'headers', 'body'] as const;

/**
 * IF-05: the @fastify/swagger transform. Like fastify-type-provider-zod's, except that request
 * parts are described by what the client sends: a piped schema such as `idParamSchema`
 * (digit string, parsed to a number) is documented as its input string, not as
 * "string and integer" (which no value satisfies, so a generated client could not call it).
 * Responses keep the output side.
 */
export const openApiTransform: Transform = (input) => {
  const result = jsonSchemaTransform(input);
  const source = input.schema as Record<string, unknown> | undefined;
  if (!source || result.schema.hide) return result;
  const schema = { ...result.schema } as Record<string, unknown>;
  for (const part of REQUEST_PARTS) {
    const zodSchema = source[part];
    if (zodSchema && typeof zodSchema === 'object' && 'safeParse' in zodSchema) {
      schema[part] = zodToJsonSchema(zodSchema as ZodTypeAny, {
        target: 'openApi3',
        $refStrategy: 'none',
        pipeStrategy: 'input',
      });
    }
  }
  return { ...result, schema: schema as typeof result.schema };
};
