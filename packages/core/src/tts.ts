import { z } from 'zod';
import { idParamSchema } from './primitives';

/**
 * IF-09, SDD section 10 (Audio generation): what the API asks a TTS engine for. `reading` is what
 * is spoken (for Japanese always the kana reading); `text` is the written form, for logs only.
 */
export interface TtsRequest {
  text: string;
  reading: string;
  /** Provider voice id, e.g. "jf_alpha". */
  voice: string;
  /** The plugin's `ttsVoice.providerLanguage`, e.g. Kokoro's lang_code "j". */
  language?: string;
  /** 1.0 when unset. */
  speed?: number;
}

/** IF-09: the only way the API reaches a TTS engine. */
export interface TtsProvider {
  /** WAV bytes from the engine; the API trims silence and encodes Opus. */
  synthesize(req: TtsRequest): Promise<Uint8Array>;
}

/** FR-131: `GET /media/audio/:ownerType/:ownerId`. */
export const audioParamsSchema = z.object({
  ownerType: z.enum(['item', 'sentence']),
  ownerId: idParamSchema,
});
