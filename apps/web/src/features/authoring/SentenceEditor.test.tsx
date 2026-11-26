import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ApiClient } from '@manabi/api-client';
import type { AuthoringSentence, Tile } from '@manabi/core';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { mergeTiles, SentenceEditor, splitTile } from './SentenceEditor';

// Component tests for the sentence editor (#62): FR-059, FR-238, DR-11.

const tokens: Tile[] = [
  { surface: 'これ', base: 'これ', reading: 'これ' },
  { surface: 'は', base: 'は', reading: 'は' },
  { surface: '猫', base: '猫', reading: 'ねこ', itemId: 9 },
  { surface: 'です', base: 'です', reading: 'です' },
];

const part = (sourceId: string) => ({
  sourceId,
  owner: 'arihato',
  url: `https://tatoeba.org/en/sentences/show/${sourceId}`,
  licence: 'CC BY 2.0 FR',
  datasetVersion: '2026-10-01',
});

function cat(
  patch: Partial<AuthoringSentence['sentence']> = {},
  challenging = true,
): AuthoringSentence {
  return {
    challenging,
    blockedWords: ['猫'],
    sentence: {
      id: 5,
      courseId: 7,
      text: 'これは猫です。',
      tokens,
      translation: 'This is a cat.',
      source: 'tatoeba',
      sourceId: '757782',
      attribution: { sentence: part('757782'), translation: part('1') },
      reviewStatus: 'unreviewed',
      grammar: ['ja:grammar:wa-desu'],
      vocabLevelCode: 'kana',
      grammarLevelCode: 'N5',
      challengeOverride: null,
      edited: false,
      translationEdited: false,
      tokensEdited: false,
      archivedAt: null,
      ...patch,
    },
  };
}

async function open(sentence = cat()) {
  const api = {
    GET: jest.fn((path: string) =>
      Promise.resolve(
        path === '/api/v1/authoring/sentences'
          ? {
              sentences: [
                {
                  id: 5,
                  text: sentence.sentence.text,
                  translation: sentence.sentence.translation,
                  reviewStatus: 'unreviewed',
                  grammarLevelCode: 'N5',
                  challenging: true,
                },
              ],
            }
          : sentence,
      ),
    ),
    POST: jest.fn(),
    PATCH: jest.fn(),
  };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <SentenceEditor courseId={7} />
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  fireEvent.change(screen.getByLabelText('Detected grammar point'), {
    target: { value: 'ja:grammar:wa-desu' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find sentences' }));
  expect(await screen.findByText(/This is a cat\. · Unreviewed · challenge/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'これは猫です。' }));
  await screen.findByRole('heading', { name: 'これは猫です。' });
  expect(api.GET).toHaveBeenCalledWith('/api/v1/authoring/sentences', {
    params: { query: { course: '7', grammar: 'ja:grammar:wa-desu' } },
  });
  return api;
}

const patchBody = (api: Awaited<ReturnType<typeof open>>) =>
  (api.PATCH.mock.calls[0] as [string, { body: Record<string, unknown> }])[1].body;

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

describe('tile operations', () => {
  it('splits a kana tile with its reading and a kanji tile leaving the reading to the author', () => {
    expect(splitTile(tokens, 0, 1).slice(0, 2)).toEqual([
      { surface: 'こ', base: 'こ', reading: 'こ' },
      { surface: 'れ', base: 'れ', reading: 'れ' },
    ]);
    const kanji = [{ surface: '学校', base: '学校', reading: 'がっこう', itemId: 3 }];
    expect(splitTile(kanji, 0, 1)).toEqual([
      { surface: '学', base: '学', reading: 'がっこう' },
      { surface: '校', base: '校', reading: '校' },
    ]);
  });

  it('merges a tile with the next, keeping the second base form and any pattern mark', () => {
    const tiles = [
      { surface: '食べ', base: '食べる', reading: 'たべ' },
      { surface: 'ます', base: 'ます', reading: 'ます', pattern: true as const },
    ];
    expect(mergeTiles(tiles, 0)).toEqual([
      { surface: '食べます', base: '食べます', reading: 'たべます', pattern: true },
    ]);
  });
});

describe('SentenceEditor', () => {
  it('shows levels, challenge status, attribution and blocked words', async () => {
    await open();
    expect(screen.getByText(/Detected grammar points: ja:grammar:wa-desu/)).toBeTruthy();
    expect(screen.getByText(/Grammar level: N5\. Vocabulary level: kana\./)).toBeTruthy();
    expect(screen.getByRole('option', { name: 'From the levels (now: yes)' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Sentence: tatoeba #757782 by arihato/ })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Uses blocked words: 猫');
  });

  it('splits and merges tiles, sets a reading, marks the pattern and saves the tiles (FR-238)', async () => {
    const api = await open();
    api.PATCH.mockResolvedValueOnce(cat({ tokensEdited: true }));

    fireEvent.click(screen.getByRole('button', { name: 'Merge tile 1 (これ) with the next' }));
    const merged = screen.getByRole('listitem', { name: 'Tile 1: これは' });
    expect(within(merged).getByLabelText('Base form of tile 1 (これは)')).toHaveProperty(
      'value',
      'これは',
    );
    fireEvent.change(screen.getByLabelText('Split tile 1 (これは)'), { target: { value: '2' } });
    expect(screen.getByRole('listitem', { name: 'Tile 2: は' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Reading of tile 3 (猫)'), {
      target: { value: 'ネコ' },
    });
    fireEvent.click(screen.getByLabelText('Tile 4 (です) is part of the pattern'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'これは猫です。' })).toBeTruthy();
    expect(api.PATCH).toHaveBeenCalledWith('/api/v1/authoring/sentences/{id}', {
      params: { path: { id: '5' } },
      body: expect.objectContaining({
        challengeOverride: null,
        reviewStatus: 'unreviewed',
        tiles: [
          { surface: 'これ', base: 'これ', reading: 'これ' },
          { surface: 'は', base: 'は', reading: 'は' },
          { surface: '猫', base: '猫', reading: 'ネコ', itemId: 9 },
          { surface: 'です', base: 'です', reading: 'です', pattern: true },
        ],
      }),
    });
  });

  it('overrides the challenge status and goes back to the derived one (FR-059)', async () => {
    const api = await open();
    api.PATCH.mockResolvedValueOnce(cat({ challengeOverride: false }, false));
    fireEvent.change(screen.getByLabelText('Challenge sentence'), { target: { value: 'false' } });
    fireEvent.change(screen.getByLabelText('Review status'), { target: { value: 'reviewed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('option', { name: 'From the levels' });
    expect(patchBody(api)).toMatchObject({ challengeOverride: false, reviewStatus: 'reviewed' });

    api.PATCH.mockResolvedValueOnce(cat());
    fireEvent.change(screen.getByLabelText('Challenge sentence'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('option', { name: 'From the levels (now: yes)' });
    expect((api.PATCH.mock.calls[1] as [string, { body: object }])[1].body).toMatchObject({
      challengeOverride: null,
    });
  });

  it('re-segments the edited text after confirmation, without sending tiles', async () => {
    const api = await open();
    const confirm = jest
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'それは猫です。' } });
    fireEvent.click(screen.getByRole('button', { name: 'Re-segment' }));
    expect(api.PATCH).not.toHaveBeenCalled();

    api.PATCH.mockResolvedValueOnce(cat({ text: 'それは猫です。', edited: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-segment' }));
    await screen.findByRole('heading', { name: 'それは猫です。' });
    expect(patchBody(api)).toEqual({
      text: 'それは猫です。',
      translation: 'This is a cat.',
      reviewStatus: 'unreviewed',
      challengeOverride: null,
      resegment: true,
    });
    expect(screen.getByRole('link', { name: /Sentence: .* \(edited\)/ })).toBeTruthy();
    confirm.mockRestore();
  });
});
