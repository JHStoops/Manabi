import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../../i18n';
import { AppThemeProvider } from '../../theme';
import { SpeakerButton } from './SpeakerButton';
import { SpeechProvider, findVoice, playableExercises } from './speech';

const jaVoice = { lang: 'ja-JP', name: 'Kyoko' } as SpeechSynthesisVoice;
const enVoice = { lang: 'en-US', name: 'Alex' } as SpeechSynthesisVoice;

let synth: { getVoices: jest.Mock; speak: jest.Mock; cancel: jest.Mock } & Partial<EventTarget>;
let play: jest.Mock;

beforeEach(() => {
  synth = {
    getVoices: jest.fn(() => [enVoice, jaVoice]),
    speak: jest.fn(),
    cancel: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  play = jest.fn().mockResolvedValue(undefined);
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
  Object.assign(globalThis, {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: function (this: { text: string }, text: string) {
      this.text = text;
    },
    Audio: function (this: { src: string; play: jest.Mock }, src: string) {
      this.src = src;
      this.play = play;
    },
  });
});

function renderButton(clip?: () => Promise<string>) {
  render(
    <AppThemeProvider>
      <SpeechProvider locale="ja-JP">
        <SpeakerButton what="word" reading="たべる" clip={clip} />
      </SpeechProvider>
    </AppThemeProvider>,
  );
}

describe('SpeakerButton', () => {
  it('plays the server clip when one is returned', async () => {
    renderButton(() => Promise.resolve('/media/clip.opus'));
    fireEvent.click(screen.getByRole('button', { name: 'Play word' }));
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('falls back to the device voice, speaking the reading, when the clip request fails', async () => {
    renderButton(() => Promise.reject(new Error('503')));
    fireEvent.click(screen.getByRole('button', { name: 'Play word' }));
    await waitFor(() => expect(synth.speak).toHaveBeenCalled());
    const spoken = synth.speak.mock.calls[0]![0];
    expect(spoken).toMatchObject({ text: 'たべる', voice: jaVoice, lang: 'ja-JP' });
  });

  it('uses the device voice when there is no clip source (before #65)', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Play word' }));
    await waitFor(() => expect(synth.speak).toHaveBeenCalled());
  });

  it('hides the button when the device has no voice for the language', () => {
    synth.getVoices.mockReturnValue([enVoice]);
    renderButton();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides the button when speechSynthesis does not exist', () => {
    Object.assign(globalThis, { speechSynthesis: undefined });
    renderButton();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('findVoice', () => {
  it('matches on the language subtag', () => {
    expect(findVoice([enVoice, { lang: 'ja_JP' } as SpeechSynthesisVoice], 'ja-JP')?.lang).toBe(
      'ja_JP',
    );
    expect(findVoice([enVoice], 'ja-JP')).toBeUndefined();
  });
});

describe('playableExercises', () => {
  const exercises = [
    { type: 'choice', payload: {} },
    { type: 'listen_choose', payload: {} },
    { type: 'dictation', payload: {} },
  ];

  it('filters listening exercises out when no voice exists', () => {
    expect(playableExercises(exercises, false).map((e) => e.type)).toEqual(['choice']);
  });

  it('keeps every exercise when a voice exists', () => {
    expect(playableExercises(exercises, true)).toHaveLength(3);
  });
});
