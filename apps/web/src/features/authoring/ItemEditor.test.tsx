import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { AuthoringItem, EditorExercise } from '@manabi/core';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { ItemEditor } from './ItemEditor';

// Component tests for the item editor (#42, #241): FR-221, FR-229, DR-06, DR-09.

const data = {
  character: '水',
  meanings: ['water'],
  onReadings: ['スイ'],
  kunReadings: ['みず'],
  strokeCount: 4,
  components: ['水'],
};

function water(overrides: Record<string, unknown> = {}): AuthoringItem {
  return {
    id: 3,
    key: 'ja:kanji:水',
    type: 'kanji',
    levelCode: 'N5',
    source: 'kanjidic2',
    datasetVersion: '2026-11-12',
    data,
    overrides,
    effective: { ...data, ...overrides },
    fields: [
      { name: 'character', kind: 'text', optional: false },
      { name: 'meanings', kind: 'textList', optional: false },
      { name: 'onReadings', kind: 'textList', optional: false },
      { name: 'kunReadings', kind: 'textList', optional: false },
      { name: 'strokeCount', kind: 'number', optional: false },
      { name: 'components', kind: 'textList', optional: true },
    ],
    related: [],
  };
}

async function open(item: AuthoringItem, exercises: EditorExercise[] = []) {
  const api = {
    GET: jest.fn((path: string) =>
      Promise.resolve(
        path === '/api/v1/authoring/items/{id}/exercises'
          ? { exercises }
          : path === '/api/v1/authoring/items'
            ? {
                items: [
                  {
                    id: 3,
                    key: item.key,
                    type: 'kanji',
                    levelCode: 'N5',
                    source: 'kanjidic2',
                    overridden: Object.keys(item.overrides).length > 0,
                  },
                ],
              }
            : item,
      ),
    ),
    PATCH: jest.fn(),
    POST: jest.fn(),
    DELETE: jest.fn(),
  };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <ItemEditor courseId={7} />
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  fireEvent.change(screen.getByLabelText('Key contains'), { target: { value: '水' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find' }));
  fireEvent.click(await screen.findByRole('button', { name: /ja:kanji:水/ }));
  await screen.findByRole('heading', { name: 'ja:kanji:水' });
  expect(api.GET).toHaveBeenCalledWith('/api/v1/authoring/items', {
    params: { query: { course: '7', q: '水' } },
  });
  return api;
}

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

describe('ItemEditor', () => {
  it('pre-fills imported values and saves only the edited fields as overrides', async () => {
    const api = await open(water());
    const meanings = screen.getByLabelText(/^meanings/);
    expect(meanings).toHaveProperty('value', 'water');

    api.PATCH.mockResolvedValueOnce(water({ meanings: ['water', 'aqua'] }));
    fireEvent.change(meanings, { target: { value: 'water\naqua\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Overridden. Imported value: water');
    expect(api.PATCH).toHaveBeenCalledWith('/api/v1/authoring/items/{id}', {
      params: { path: { id: '3' } },
      body: { overrides: { meanings: ['water', 'aqua'] } },
    });
    expect(screen.getByLabelText(/^meanings/)).toHaveProperty('value', 'water\naqua');
  });

  it('clears an override, bringing back the imported value', async () => {
    const api = await open(water({ meanings: ['water', 'aqua'], strokeCount: 5 }));

    api.PATCH.mockResolvedValueOnce(water({ strokeCount: 5 }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear override of meanings' }));

    await waitFor(() =>
      expect(screen.getByLabelText(/^meanings/)).toHaveProperty('value', 'water'),
    );
    expect(api.PATCH).toHaveBeenCalledWith('/api/v1/authoring/items/{id}', {
      params: { path: { id: '3' } },
      body: { overrides: { strokeCount: 5 } },
    });
    expect(screen.queryByRole('button', { name: 'Clear override of meanings' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear override of strokeCount' })).toBeTruthy();
  });

  it('shows the schema problems the API reports by field (DR-06)', async () => {
    const api = await open(water());
    api.PATCH.mockRejectedValueOnce(
      new ApiRequestError(400, 'validation_failed', 'The item data fails its language schema', [
        { location: 'body', path: ['overrides', 'strokeCount'], message: 'Too small' },
      ]),
    );
    fireEvent.change(screen.getByLabelText('strokeCount'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Too small')).toBeTruthy();
    expect(screen.getByLabelText('strokeCount').getAttribute('aria-invalid')).toBe('true');
    expect(api.PATCH).toHaveBeenCalledWith('/api/v1/authoring/items/{id}', {
      params: { path: { id: '3' } },
      body: { overrides: { strokeCount: 0 } },
    });
  });

  it('creates a grammar point and saves its level and related points (FR-222)', async () => {
    const point: AuthoringItem = {
      id: 8,
      key: 'ja:grammar:mashou',
      type: 'grammar',
      levelCode: 'N5',
      source: null,
      datasetVersion: null,
      data: { pattern: '〜ましょう' },
      overrides: {},
      effective: { pattern: '〜ましょう' },
      fields: [
        { name: 'pattern', kind: 'text', optional: false },
        { name: 'meaning', kind: 'text', optional: true },
        { name: 'explanation', kind: 'longText', optional: true },
      ],
      related: [],
    };
    const api = {
      GET: jest.fn().mockResolvedValue({ exercises: [] }),
      POST: jest.fn().mockResolvedValue(point),
      PATCH: jest.fn(),
    };
    render(
      <ApiContext.Provider value={api as unknown as ApiClient}>
        <AppThemeProvider>
          <ItemEditor courseId={7} />
        </AppThemeProvider>
      </ApiContext.Provider>,
    );
    fireEvent.change(screen.getByLabelText('Grammar point key'), { target: { value: point.key } });
    fireEvent.change(screen.getByLabelText('Grammar point level'), { target: { value: 'N5' } });
    fireEvent.change(screen.getByLabelText('Pattern'), { target: { value: '〜ましょう' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create grammar point' }));
    await screen.findByRole('heading', { name: point.key });
    expect(api.POST).toHaveBeenCalledWith('/api/v1/authoring/items', {
      body: {
        course: 7,
        type: 'grammar',
        key: point.key,
        level: 'N5',
        data: { pattern: '〜ましょう' },
      },
    });

    api.PATCH.mockResolvedValueOnce({
      ...point,
      levelCode: 'N4',
      related: ['ja:grammar:te-kudasai'],
    });
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'N4' } });
    fireEvent.change(screen.getByLabelText(/^Related item keys/), {
      target: { value: 'ja:grammar:te-kudasai\n' },
    });
    fireEvent.change(screen.getByLabelText(/^meaning/), { target: { value: "let's ~" } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith('/api/v1/authoring/items/{id}', {
        params: { path: { id: '8' } },
        body: {
          overrides: { meaning: "let's ~" },
          level: 'N4',
          related: ['ja:grammar:te-kudasai'],
        },
      }),
    );
  });

  describe('item-level exercises (#241)', () => {
    const accept = (texts: string[]) => texts.map((text) => ({ text, tiles: [] }));
    const pinned = (id: number, texts: string[]): EditorExercise => ({
      id,
      type: 'typed_answer',
      origin: 'pinned',
      detached: false,
      key: null,
      payload: { prompt: `Meaning of 水 ${id}`, answerLanguage: 'base', accept: accept(texts) },
    });
    const list = () => screen.getByRole('region', { name: /^Item-level exercises/ });

    it('lists the item-level exercises, or says there are none', async () => {
      const api = await open(water(), [pinned(11, ['water', 'aqua']), pinned(12, ['water'])]);
      expect(api.GET).toHaveBeenCalledWith('/api/v1/authoring/items/{id}/exercises', {
        params: { path: { id: '3' } },
      });
      const items = await within(list()).findAllByRole('listitem');
      expect(items.map((li) => li.textContent)).toEqual([
        expect.stringContaining('typed_answer (pinned) Meaning of 水 11'),
        expect.stringContaining('typed_answer (pinned) Meaning of 水 12'),
      ]);
    });

    it('says when the item has none', async () => {
      await open(water());
      expect(await within(list()).findByText('No item-level exercises.')).toBeTruthy();
    });

    it('edits an item-level exercise through the exercise form', async () => {
      const api = await open(water(), [pinned(11, ['water', 'aqua'])]);
      fireEvent.click(
        await screen.findByRole('button', { name: 'Edit typed_answer 11: Meaning of 水 11' }),
      );
      const form = screen.getByRole('form', { name: 'typed_answer exercise' });
      fireEvent.change(within(form).getByLabelText('prompt'), { target: { value: 'Meaning?' } });
      api.PATCH.mockResolvedValueOnce({
        exercise: { ...pinned(11, ['water', 'aqua']), payload: { prompt: 'Meaning?' } },
        blockedWords: [],
      });
      fireEvent.click(within(form).getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(api.PATCH).toHaveBeenCalledWith('/api/v1/authoring/exercises/{id}', {
          params: { path: { id: '11' } },
          body: {
            resegment: false,
            payload: {
              prompt: 'Meaning?',
              answerLanguage: 'base',
              accept: accept(['water', 'aqua']),
            },
          },
        }),
      );
      // The list is read again after the save.
      await waitFor(() =>
        expect(
          api.GET.mock.calls.filter(([path]) => path === '/api/v1/authoring/items/{id}/exercises'),
        ).toHaveLength(2),
      );
    });

    it('removes an item-level exercise after confirming', async () => {
      const api = await open(water(), [pinned(11, ['water', 'aqua']), pinned(12, ['water'])]);
      const confirm = jest.spyOn(window, 'confirm');
      const remove = await screen.findByRole('button', {
        name: 'Remove typed_answer 11: Meaning of 水 11',
      });

      confirm.mockReturnValueOnce(false);
      fireEvent.click(remove);
      expect(api.DELETE).not.toHaveBeenCalled();

      confirm.mockReturnValueOnce(true);
      api.DELETE.mockResolvedValueOnce({ exercises: [pinned(12, ['water'])] });
      fireEvent.click(remove);
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Edit typed_answer 11: Meaning of 水 11' }),
        ).toBeNull(),
      );
      expect(api.DELETE).toHaveBeenCalledWith(
        '/api/v1/authoring/items/{id}/exercises/{exerciseId}',
        { params: { path: { id: '3', exerciseId: '11' } } },
      );
      expect(
        screen.getByRole('button', { name: 'Edit typed_answer 12: Meaning of 水 12' }),
      ).toBeTruthy();
      // Focus stays in the section and the removal is announced.
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Item-level exercises of ja:kanji:水' }),
      );
      expect(screen.getByRole('status').textContent).toBe(
        'Removed typed_answer 11: Meaning of 水 11.',
      );
      confirm.mockRestore();
    });

    // #259: a pin whose original the generators no longer make.
    it('marks a detached pin only, and re-ties it', async () => {
      const detached = { ...pinned(12, ['water']), detached: true };
      const api = await open(water(), [pinned(11, ['water', 'aqua']), detached]);
      const items = await within(list()).findAllByRole('listitem');
      expect(items[0]!.textContent).not.toContain('Detached');
      expect(items[1]!.textContent).toContain(
        'Detached: the generators no longer make the exercise this pin was made from',
      );
      expect(within(items[0]!).queryByRole('button', { name: /^Re-tie/ })).toBeNull();

      api.POST.mockResolvedValueOnce({ exercise: pinned(12, ['water']) });
      api.GET.mockImplementation(() =>
        Promise.resolve({ exercises: [pinned(11, ['water', 'aqua']), pinned(12, ['water'])] }),
      );
      fireEvent.click(
        within(items[1]!).getByRole('button', { name: 'Re-tie typed_answer 12: Meaning of 水 12' }),
      );
      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toBe(
          'Re-tied typed_answer 12: Meaning of 水 12.',
        ),
      );
      expect(api.POST).toHaveBeenCalledWith('/api/v1/authoring/exercises/{id}/retie', {
        params: { path: { id: '12' } },
        body: {},
      });
      expect(within(list()).queryByText(/Detached/)).toBeNull();
    });

    it('shows why a re-tie failed', async () => {
      const api = await open(water(), [{ ...pinned(12, ['water']), detached: true }]);
      api.POST.mockRejectedValueOnce(new Error('boom'));
      fireEvent.click(
        await screen.findByRole('button', { name: 'Re-tie typed_answer 12: Meaning of 水 12' }),
      );
      expect(await within(list()).findByRole('alert')).toBeTruthy();
    });
  });
});
