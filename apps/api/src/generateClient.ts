import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';
import type { OpenAPI3 } from 'openapi-typescript';
import * as prettier from 'prettier';
import { buildOpenApiDocument } from './openapi';

/**
 * `npm run generate:client` (IF-05, SDD section 8): boots the app in-process, writes its OpenAPI
 * document into packages/api-client and generates the client's types from it. The output is
 * committed; CI regenerates it and fails when it differs, so a route change without
 * regenerating is caught. Lives in apps/api because packages never depend on apps.
 */
const clientDir = resolve(__dirname, '../../../packages/api-client');
const documentFile = resolve(clientDir, 'openapi.json');
const typesFile = resolve(clientDir, 'src/generated/schema.ts');

const HEADER = `/**
 * GENERATED FILE: do not edit. Run \`npm run generate:client\` after changing an API route.
 * Types for every /api/v1 route, from packages/api-client/openapi.json (openapi-typescript).
 */

`;

/**
 * A 204 response has no body, but routes declare it as `z.null()` (Fastify needs a response
 * schema), which the document renders as a JSON null. The client types drop that content, so
 * a 204 call resolves to undefined, which is what fetch gives.
 */
function withoutNoContentBodies(document: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(document);
  const pathItems = (copy.paths ?? {}) as Record<string, Record<string, unknown>>;
  for (const pathItem of Object.values(pathItems)) {
    for (const operation of Object.values(pathItem)) {
      const responses = (operation as { responses?: Record<string, { content?: unknown }> })
        .responses;
      if (responses?.['204']) delete responses['204'].content;
    }
  }
  return copy;
}

async function writeFormatted(file: string, text: string): Promise<void> {
  const options = await prettier.resolveConfig(file);
  const formatted = await prettier.format(text, { ...options, filepath: file });
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, formatted);
  console.log(`Wrote ${relative(process.cwd(), file)}`);
}

async function main(): Promise<void> {
  const document = await buildOpenApiDocument();
  await writeFormatted(documentFile, JSON.stringify(document));

  // Paths keep registration order, which is fixed in code, so the output is deterministic.
  const ast = await openapiTS(withoutNoContentBodies(document) as unknown as OpenAPI3);
  await writeFormatted(typesFile, HEADER + astToString(ast));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
