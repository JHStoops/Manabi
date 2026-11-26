import type { LibraryItem } from '@manabi/core';
import { grammarDataSchema } from '@manabi/lang-ja';
import type { GrammarData } from '@manabi/lang-ja';

// shortcut: the grammar data shape comes from the Japanese plugin's schema; move it behind the
// LanguagePlugin interface when a second language has grammar points.
export function grammarOf(item: LibraryItem): GrammarData {
  const parsed = grammarDataSchema.safeParse(item.data);
  return parsed.success
    ? parsed.data
    : { pattern: item.key, themes: [], formation: [], detection: [] };
}

/** Product Spec section 7: the stage names. */
export const stageName = (
  stage: number,
): 'learning' | 'familiar' | 'strong' | 'mastered' | 'retired' =>
  stage <= 3
    ? 'learning'
    : stage <= 5
      ? 'familiar'
      : stage === 6
        ? 'strong'
        : stage === 7
          ? 'mastered'
          : 'retired';
