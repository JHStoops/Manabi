import { FILL_BLANK_TYPE, TYPED_ANSWER_TYPE } from '@manabi/core';
import type {
  FillBlankPayload,
  LanguagePlugin,
  TypedAnswerPayload,
  WordBankPayload,
} from '@manabi/core';

// FR-144: the word-bank form of a typed exercise. shortcut: only EX-04 and EX-05 exist yet; add
// EX-08 and EX-10 here when their types land. The bank holds the first accepted answer's tiles
// and no distractors; upgrade when authors can supply them.

/**
 * The tile form of a typed exercise, or null when it has none (a type that is not typed, a
 * fill-blank with options, or answer text with no tiles). Tiles come from the plugin's
 * `tokenize`, which returns the stored tiles as they are and falls back only when none are stored.
 */
export function toWordBankPayload(
  type: string,
  payload: unknown,
  plugin: LanguagePlugin,
): WordBankPayload | null {
  let prompt: string;
  if (type === TYPED_ANSWER_TYPE) {
    prompt = (payload as TypedAnswerPayload).prompt;
  } else if (type === FILL_BLANK_TYPE && !(payload as FillBlankPayload).options) {
    const { prompt: meaning, before, after } = payload as FillBlankPayload;
    prompt = `${meaning} ${before}＿＿${after}`;
  } else {
    return null;
  }
  const first = (payload as TypedAnswerPayload).accept[0]!;
  const tiles = plugin.tokenize(first);
  if (!tiles.length) return null;
  return {
    prompt,
    answer: { text: first.text, tiles },
    distractors: [],
    acceptedOrders: [tiles.map((_, i) => i)],
  };
}

/**
 * The text to grade for tiles placed in `order`. The right order sends the accepted text as
 * written (it keeps punctuation and spacing the tiles lack); any other order is wrong whatever
 * the join, so a plain join does.
 */
export function answerFromTiles(bank: WordBankPayload, order: number[]): string {
  const surfaces = order.map((i) => bank.answer.tiles[i]!.surface);
  const right = bank.answer.tiles.map((tile) => tile.surface);
  return surfaces.join('\u0000') === right.join('\u0000') ? bank.answer.text : surfaces.join(' ');
}
