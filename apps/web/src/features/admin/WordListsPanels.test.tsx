import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { BlockedWord, SupplementaryWord } from '@manabi/core';
import '../../i18n';
import { ApiContext, SessionProvider } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { BlockedWordsPanel, SupplementaryWordsPanel } from './WordListsPanels';

// Component tests for the word list admin screens (#118): FR-234, FR-237.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

function fakeApi(get: Record<string, unknown>) {
  return {
    GET: jest.fn((path: string) =>
      path === '/api/v1/me'
        ? Promise.resolve({ id: 1, role: 'admin' })
        : Promise.resolve(get[path]),
    ),
    POST: jest.fn(() => Promise.resolve(undefined)),
    PATCH: jest.fn(() => Promise.resolve(undefined)),
    DELETE: jest.fn(() => Promise.resolve(undefined)),
  };
}

function show(ui: JSX.Element, api: ReturnType<typeof fakeApi>) {
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <MemoryRouter>
          <SessionProvider>{ui}</SessionProvider>
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

const SUPPLEMENTARY = '/api/v1/authoring/word-lists/supplementary-words';
const BLOCKED = '/api/v1/authoring/word-lists/blocked-words';

const word = (over: Partial<SupplementaryWord>): SupplementaryWord => ({
  id: 1,
  course: 'ja-en',
  level: 'N5',
  written: '先生',
  reading: 'せんせい',
  note: null,
  ...over,
});

describe('SupplementaryWordsPanel', () => {
  const words = [word({}), word({ id: 2, level: 'N4', written: '医者', reading: 'いしゃ' })];

  it('filters by level', async () => {
    show(<SupplementaryWordsPanel />, fakeApi({ [SUPPLEMENTARY]: { words } }));
    await screen.findByText('先生');
    expect(screen.getByText('医者')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Level', { selector: 'select' }), {
      target: { value: 'N4' },
    });
    expect(screen.queryByText('先生')).toBeNull();
    expect(screen.getByText('医者')).toBeTruthy();
  });

  it('adds, edits and removes words', async () => {
    const api = fakeApi({ [SUPPLEMENTARY]: { words } });
    show(<SupplementaryWordsPanel />, api);
    await screen.findByText('先生');

    fireEvent.change(screen.getByLabelText('Course key'), { target: { value: 'ja-en' } });
    fireEvent.change(screen.getByLabelText('Level', { selector: 'input' }), {
      target: { value: 'N5' },
    });
    fireEvent.change(screen.getByLabelText('Written form'), { target: { value: '学校' } });
    fireEvent.change(screen.getByLabelText('Reading'), { target: { value: 'がっこう' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add word' }));
    await screen.findByText('先生');
    expect(api.POST).toHaveBeenCalledWith(SUPPLEMENTARY, {
      body: { course: 'ja-en', level: 'N5', written: '学校', reading: 'がっこう' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit 先生' }));
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'teacher' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save word' }));
    await screen.findByRole('button', { name: 'Add word' });
    expect(api.PATCH).toHaveBeenCalledWith(`${SUPPLEMENTARY}/{id}`, {
      params: { path: { id: '1' } },
      body: { level: 'N5', written: '先生', reading: 'せんせい', note: 'teacher' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove 医者' }));
    await screen.findByText('医者');
    expect(api.DELETE).toHaveBeenCalledWith(`${SUPPLEMENTARY}/{id}`, {
      params: { path: { id: '2' } },
    });
  });

  it('shows an API error', async () => {
    const api = fakeApi({ [SUPPLEMENTARY]: { words } });
    api.POST.mockRejectedValueOnce(
      new ApiRequestError(409, 'conflict', 'That word is already on the list'),
    );
    show(<SupplementaryWordsPanel />, api);
    await screen.findByText('先生');
    for (const [label, value] of [
      ['Course key', 'ja-en'],
      ['Written form', '先生'],
      ['Reading', 'せんせい'],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.change(screen.getByLabelText('Level', { selector: 'input' }), {
      target: { value: 'N5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add word' }));
    expect(await screen.findByText('That word is already on the list')).toBeTruthy();
  });
});

describe('BlockedWordsPanel', () => {
  const words: BlockedWord[] = [{ id: 3, lang: 'ja', word: '馬鹿' }];

  it('lists, adds and removes blocked words', async () => {
    const api = fakeApi({ [BLOCKED]: { words } });
    show(<BlockedWordsPanel />, api);
    const row = (await screen.findByText('馬鹿')).closest('tr')!;
    expect(within(row).getByText('ja')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Language code'), { target: { value: 'ja' } });
    fireEvent.change(screen.getByLabelText('Word'), { target: { value: '阿呆' } });
    fireEvent.click(screen.getByRole('button', { name: 'Block word' }));
    await screen.findByText('馬鹿');
    expect(api.POST).toHaveBeenCalledWith(BLOCKED, { body: { lang: 'ja', word: '阿呆' } });

    fireEvent.click(screen.getByRole('button', { name: 'Unblock 馬鹿' }));
    await screen.findByText('馬鹿');
    expect(api.DELETE).toHaveBeenCalledWith(`${BLOCKED}/{id}`, { params: { path: { id: '3' } } });
  });
});
