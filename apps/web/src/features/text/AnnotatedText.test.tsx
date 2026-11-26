import { act, cleanup, render } from '@testing-library/react';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { Item, LearnerSettings, Tile, User } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import { ApiContext, SessionProvider } from '../../state/session';
import { AnnotatedText } from './AnnotatedText';

// FR-140: ruby furigana rendered or omitted per the learner's setting.

afterEach(cleanup);

const tiles: Tile[] = [
  { surface: '水', base: '水', reading: 'みず' },
  { surface: 'を', base: 'を', reading: 'を' },
  { surface: '飲む', base: '飲む', reading: 'のむ' },
];
const learned = [
  {
    id: 1,
    type: 'kanji',
    data: { character: '水', meanings: ['water'], onReadings: [], kunReadings: [], strokeCount: 4 },
    overrides: {},
  } as unknown as Item,
];

async function mount(settings: Partial<LearnerSettings>, plugin = japanese) {
  const user = { id: 1, settings: learnerSettingsSchema.parse(settings) } as User;
  const api = { GET: () => Promise.resolve(user) } as unknown as ApiClient;
  const { container } = render(
    <ApiContext.Provider value={api}>
      <SessionProvider>
        <AnnotatedText plugin={plugin} tiles={tiles} learnedItems={learned} />
      </SessionProvider>
    </ApiContext.Provider>,
  );
  // Let GET /me resolve so the learner's settings apply.
  await act(() => Promise.resolve());
  return container.querySelector('[lang="ja"]')!;
}

const rubies = (el: Element) => [...el.querySelectorAll('ruby')].map((r) => r.innerHTML);

describe('AnnotatedText', () => {
  it('always: ruby over every kanji, okurigana outside it', async () => {
    const el = await mount({ readingAnnotations: 'always' });
    expect(rubies(el)).toEqual(['水<rt>みず</rt>', '飲<rt>の</rt>']);
    expect(el.textContent).toBe('水みずを飲のむ');
  });

  it('unlearned: ruby only over kanji not yet learned', async () => {
    const el = await mount({ readingAnnotations: 'unlearned' });
    expect(rubies(el)).toEqual(['飲<rt>の</rt>']);
  });

  it('never: plain text', async () => {
    const el = await mount({ readingAnnotations: 'never' });
    expect(el.querySelector('ruby')).toBeNull();
    expect(el.textContent).toBe('水を飲む');
  });

  it('omits ruby for a plugin without reading annotations (FR-241)', async () => {
    const el = await mount(
      { readingAnnotations: 'always' },
      { ...japanese, features: { ...japanese.features, readingAnnotations: false } },
    );
    expect(el.querySelector('ruby')).toBeNull();
  });

  it('applies the large text size', async () => {
    const large = getComputedStyle(await mount({ targetTextSize: 'large' })).fontSize;
    cleanup();
    expect(large).toBe('1.25em');
    expect(getComputedStyle(await mount({})).fontSize).toBe('1em');
  });
});
