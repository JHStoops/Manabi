// The single entry point of @manabi/core: domain types, shared Zod schemas, the exercise type
// registry and the LanguagePlugin interface.

// Re-exported so language plugins, which depend only on @manabi/core, build their item schemas
// with the same Zod instance.
export { z } from 'zod';
export * from './account';
export * from './apiError';
export * from './content';
export * from './exerciseRegistry';
export * from './http';
export * from './languagePlugin';
export * from './pagination';
export * from './primitives';
export * from './progress';
export * from './sentence';
export * from './settings';
