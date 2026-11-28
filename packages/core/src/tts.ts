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

/**
 * FR-132, SDD section 11 (Uploads): the audio types an author may upload. Each upload is checked
 * against its leading bytes as well and transcoded to Opus, so the bytes sent are never stored.
 */
export const AUDIO_UPLOAD_TYPES = [
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/flac',
] as const;

/** FR-132: the largest upload accepted, in bytes. */
export const AUDIO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** FR-132: the longest recording accepted, in seconds; clips are a word or one sentence. */
export const AUDIO_UPLOAD_MAX_SECONDS = 30;

/** `/authoring/audio/:ownerType/:ownerId`. */
export const authoringAudioParamsSchema = audioParamsSchema;

/** FR-132: whether an item or sentence has an uploaded recording, and whether it is current. */
export const authoringAudioStatusSchema = z.object({
  /** An author's recording is stored. */
  uploaded: z.boolean(),
  /**
   * The recording was made for an older reading, so the generated clip plays instead; upload a
   * new one or remove it. False when nothing is uploaded.
   */
  stale: z.boolean(),
});
export type AuthoringAudioStatus = z.infer<typeof authoringAudioStatusSchema>;
