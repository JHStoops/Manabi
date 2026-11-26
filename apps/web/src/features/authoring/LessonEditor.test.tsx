import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { Item } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { ExerciseForm } from './ExerciseForm';
import { ItemPicker } from './ItemPicker';

// Component tests for the lesson editor (#43): FR-223, FR-237, FR-238.

const word = (id: number, written: string, reading: string) =>
  ({
    id,
    key: `ja:word:${written}:${reading}`,
    type: 'word',
    data: { written, reading, senses: [{ partsOfSpeech: ['n'], meanings: ['x'] }] },
    overrides: {},
  }) as unknown as Item;
const water = word(1, '水', 'みず');
const fire = word(2, '火', 'ひ');

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

function wrap(api: object, children: React.ReactNode) {
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>{children}</AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('ItemPicker', () => {
  function show(items: Item[]) {
    const api = { GET: jest.fn(() => Promise.resolve({ items: [water, fire] })) };
    const onChange = jest.fn();
    wrap(
      api,
      <ItemPicker
        courseId={7}
        items={items}
        plugin={japanese}
        sectionLevel="N5"
        onChange={onChange}
      />,
    );
    return { api, onChange };
  }

  it('searches the course items by key and adds one at the end', async () => {
    const { api, onChange } = show([water]);
    fireEvent.change(screen.getByLabelText('Find items by key'), { target: { value: 'ひ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const results = await screen.findByRole('list', { name: 'Items found' });
    expect(api.GET).toHaveBeenCalledWith('/api/v1/authoring/items', {
      params: { query: { course: '7', q: 'ひ' } },
    });
    // An item already in the lesson cannot be added twice.
    const addWater = within(results).getByRole('button', { name: `Add ${water.key}` });
    expect(addWater).toHaveProperty('disabled', true);
    fireEvent.click(within(results).getByRole('button', { name: `Add ${fire.key}` }));
    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });

  it('shows the chosen items by term and reorders or removes them', () => {
    const { onChange } = show([water, fire]);
    expect(screen.getByText(`水 (${water.key})`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Move ${fire.key} up` }));
    expect(onChange).toHaveBeenLastCalledWith([2, 1]);
    fireEvent.click(screen.getByRole('button', { name: `Remove ${water.key}` }));
    expect(onChange).toHaveBeenLastCalledWith([2]);
  });
});

describe('ExerciseForm', () => {
  const tiles = [
    { surface: '水', base: '水', reading: 'みず' },
    { surface: 'を', base: 'を', reading: 'を' },
  ];
  const write = (payload: object, blockedWords: string[] = []) => ({
    exercise: { id: 9, type: 'typed_answer', origin: 'authored', key: 'ex-9', payload },
    blockedWords,
  });

  function show(props: { exerciseId?: number; payload?: Record<string, unknown> } = {}) {
    const api = {
      POST: jest.fn((_path: string, { body }: { body: { payload: object } }) =>
        Promise.resolve(write(body.payload, ['飲む'])),
      ),
      PATCH: jest.fn((_path: string, { body }: { body: { payload: object } }) =>
        Promise.resolve(write(body.payload)),
      ),
    };
    const onSaved = jest.fn();
    wrap(
      api,
      <ExerciseForm
        lessonId={3}
        type="typed_answer"
        origin="authored"
        onSaved={onSaved}
        onCancel={() => {}}
        {...props}
      />,
    );
    return { api, onSaved };
  }

  const group = (name: string) => screen.getByRole('group', { name });

  it("builds a new exercise's payload from its type's schema and shows the blocked-word warning", async () => {
    const { api, onSaved } = show();
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'water' } });
    fireEvent.change(within(group('accept 1')).getByLabelText('text'), {
      target: { value: '水を飲む' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved, but it uses blocked words: 飲む')).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/authoring/exercises', {
      body: {
        lessonId: 3,
        type: 'typed_answer',
        origin: 'authored',
        resegment: false,
        // Tiles left empty: the server segments the answer text (FR-238).
        payload: {
          prompt: 'water',
          answerLanguage: 'target',
          accept: [{ text: '水を飲む', tiles: [] }],
        },
      },
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('keeps edited tiles, clears the tiles of changed text, and re-segments on request', async () => {
    const payload = {
      prompt: 'water',
      answerLanguage: 'target',
      accept: [{ text: '水を', tiles }],
    };
    const { api } = show({ exerciseId: 9, payload });
    const tile2 = within(group('tiles 2'));
    fireEvent.change(tile2.getByLabelText('reading'), { target: { value: 'お' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.PATCH).toHaveBeenCalledTimes(1));
    expect(api.PATCH.mock.calls[0]![1]).toEqual({
      params: { path: { id: '9' } },
      body: {
        resegment: false,
        payload: {
          ...payload,
          accept: [{ text: '水を', tiles: [tiles[0], { ...tiles[1], reading: 'お' }] }],
        },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Re-segment tiles' }));
    await waitFor(() => expect(api.PATCH).toHaveBeenCalledTimes(2));
    expect(api.PATCH.mock.calls[1]![1]).toMatchObject({ body: { resegment: true } });

    fireEvent.change(within(group('accept 1')).getByLabelText('text'), {
      target: { value: '火' },
    });
    expect(screen.queryByRole('group', { name: 'tiles 1' })).toBeNull();
  });

  it('lists the payload problems the server finds', async () => {
    const { api } = show();
    api.POST.mockRejectedValueOnce(
      new ApiRequestError(
        400,
        'validation_failed',
        'The payload is not valid for this exercise type',
        [{ location: 'body', path: ['payload', 'prompt'], message: 'Too small' }],
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The payload is not valid for this exercise type');
    expect(alert.textContent).toContain('payload.prompt: Too small');
  });
});
