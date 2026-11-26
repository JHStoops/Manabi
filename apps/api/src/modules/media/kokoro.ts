import type { TtsProvider } from '@manabi/core';

/** NFR-08: a clip takes 0.2-0.4 s at 4 vCPU; a slower engine is treated as down (NFR-23). */
export const TTS_TIMEOUT_MS = 5000;

/**
 * IF-09, docs/spikes/tts.md: the Kokoro-FastAPI adapter. Sends only the reading (FR-136), never
 * the written form; `baseUrl` is the tts service on the internal network.
 */
export function kokoroProvider(baseUrl: string): TtsProvider {
  return {
    async synthesize({ reading, voice, language, speed }) {
      const response = await fetch(new URL('/v1/audio/speech', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'kokoro',
          input: reading,
          voice,
          lang_code: language,
          response_format: 'wav',
          speed: speed ?? 1,
        }),
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Kokoro answered ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
