// The single entry point of @manabi/core: domain types, shared Zod schemas, the exercise type
// registry and the LanguagePlugin interface.

// Re-exported so language plugins, which depend only on @manabi/core, build their item schemas
// with the same Zod instance.
export { z } from 'zod';
export * from './account';
export * from './admin';
export * from './auth';
export * from './authoring';
export * from './blockedWords';
export * from './apiError';
export * from './content';
export * from './coursePath';
export * from './contentPack';
export * from './exerciseRegistry';
export * from './exercises/choice';
export * from './exercises/conjugate';
export * from './exercises/draw_memory';
export * from './exercises/fill_blank';
export * from './exercises/match_pairs';
export * from './exercises/reading_in_context';
export * from './exercises/reorder';
export * from './exercises/stroke_trace';
export * from './exercises/typed_answer';
export * from './exercises/word_bank';
export * from './http';
export * from './itemEditor';
export * from './languagePlugin';
export * from './leaderboard';
export * from './library';
export * from './lessonEditor';
export * from './lessonSession';
export * from './pagination';
export * from './primitives';
export * from './progress';
export * from './review';
export * from './srs';
export * from './streak';
export * from './wordLists';
export * from './tts';
export * from './sentence';
export * from './sentenceEditor';
export * from './social';
export * from './settings';
export * from './xp';
