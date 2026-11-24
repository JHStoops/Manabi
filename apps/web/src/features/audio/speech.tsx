import { createContext, useContext, useEffect, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Exercise } from '@manabi/core';

// FR-135, NFR-23, SDD section 10 (Audio generation): one speak() helper plays the server's clip
// and otherwise speaks with a device voice for the course language.

/** Exercise type ids that need audio to be answerable (EX-07, EX-08). */
const LISTENING_TYPES: ReadonlySet<string> = new Set(['listen_choose', 'dictation']);

/** FR-135: without a voice, listening exercises are left out of a session. */
export function playableExercises<T extends Exercise>(exercises: readonly T[], canSpeak: boolean) {
  return canSpeak ? [...exercises] : exercises.filter((e) => !LISTENING_TYPES.has(e.type));
}

/** A device voice for the locale: same language subtag ("ja-JP" matches "ja" and "ja_JP"). */
export function findVoice(voices: readonly SpeechSynthesisVoice[], locale: string) {
  const language = locale.split(/[-_]/)[0]!.toLowerCase();
  return voices.find((v) => v.lang.split(/[-_]/)[0]!.toLowerCase() === language);
}

/**
 * What to say: the reading (kana for Japanese) and, when the server can provide one, a function
 * returning the clip URL. It rejects when no clip can be served.
 */
export interface Utterance {
  reading: string;
  clip?: () => Promise<string>;
  /** Playback speed; 0.75 for the slow button. */
  rate?: number;
}

export interface Speech {
  // shortcut: false whenever the device has no voice, even if the server could serve a clip;
  // once clip serving exists (#65, #66), count "clips available" too.
  /** FR-135: speaker buttons are hidden and listening exercises skipped when false. */
  canSpeak: boolean;
  speak(utterance: Utterance): Promise<void>;
}

const SpeechContext = createContext<Speech | null>(null);

// Voices load asynchronously in most browsers, so keep them as reducer state fed by the event.
function voicesReducer(_: SpeechSynthesisVoice[], voices: SpeechSynthesisVoice[]) {
  return voices;
}

/** Provides speak() and the capability flag for a course language's `ttsVoice.locale`. */
export function SpeechProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const synth: SpeechSynthesis | undefined = globalThis.speechSynthesis;
  const [voices, setVoices] = useReducer(voicesReducer, synth?.getVoices() ?? []);

  useEffect(() => {
    if (!synth) return;
    const update = () => setVoices(synth.getVoices());
    update();
    synth.addEventListener('voiceschanged', update);
    return () => synth.removeEventListener('voiceschanged', update);
  }, [synth]);

  const voice = findVoice(voices, locale);

  const speech: Speech = {
    canSpeak: voice !== undefined,
    async speak({ reading, clip, rate = 1 }) {
      if (clip) {
        try {
          const audio = new Audio(await clip());
          audio.playbackRate = rate;
          await audio.play();
          return;
        } catch {
          // NFR-23: no clip (engine stopped or failing, none stored): use the device voice.
        }
      }
      if (!voice || !synth) return;
      const utterance = new SpeechSynthesisUtterance(reading);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      synth.cancel();
      synth.speak(utterance);
    },
  };
  return <SpeechContext.Provider value={speech}>{children}</SpeechContext.Provider>;
}

export function useSpeech(): Speech {
  const speech = useContext(SpeechContext);
  if (!speech) throw new Error('useSpeech must be used inside SpeechProvider');
  return speech;
}
