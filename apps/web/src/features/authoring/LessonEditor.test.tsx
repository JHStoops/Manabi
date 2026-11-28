import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiRequestError } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import type { Item } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { ExerciseForm } from './ExerciseForm';
import { ItemPicker } from './ItemPicker';
import LessonEditorPage from './LessonEditorPage';

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

  function show(
    props: {
      exerciseId?: number;
      payload?: Record<string, unknown>;
      origin?: 'authored' | 'pinned';
      original?: Record<string, unknown>;
    } = {},
  ) {
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

  it("shows a report-accepted answer's marker as a checkbox that drops it (#251)", async () => {
    const payload = {
      prompt: 'water',
      answerLanguage: 'base',
      accept: [
        { text: 'water', tiles: [] },
        { text: 'H2O', tiles: [], source: 'report' },
      ],
    };
    const { api } = show({ exerciseId: 9, payload });
    const first = within(group('accept 1')).getByRole('checkbox', { name: 'source: report' });
    const second = within(group('accept 2')).getByRole('checkbox', { name: 'source: report' });
    expect((first as HTMLInputElement).checked).toBe(false);
    expect((second as HTMLInputElement).checked).toBe(true);
    // No free-text field for it.
    expect(screen.queryByRole('textbox', { name: 'source' })).toBeNull();

    fireEvent.click(second);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.PATCH).toHaveBeenCalledTimes(1));
    expect(api.PATCH.mock.calls[0]![1]).toMatchObject({
      body: { payload: { accept: [{ text: 'water' }, { text: 'H2O', tiles: [] }] } },
    });
    const sent = (api.PATCH.mock.calls[0]![1] as { body: { payload: { accept: object[] } } }).body
      .payload.accept[1];
    expect(sent).not.toHaveProperty('source');
  });

  it('sends the generated payload a new pin is made from, unedited (#254)', async () => {
    const original = {
      prompt: 'water',
      answerLanguage: 'base',
      accept: [{ text: 'water', tiles: [] }],
    };
    const { api } = show({ origin: 'pinned', payload: original, original });
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'Meaning of 水?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.POST).toHaveBeenCalledTimes(1));
    expect(api.POST.mock.calls[0]![1]).toMatchObject({
      body: { origin: 'pinned', payload: { prompt: 'Meaning of 水?' }, original },
    });
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

describe('LessonEditorPage', () => {
  const lesson = {
    id: 3,
    unitId: 1,
    key: 'l',
    position: 0,
    type: 'vocabulary',
    title: 'Lesson',
    status: 'draft',
    courseId: 7,
    plugin: 'ja',
    sectionLevel: 'N5',
  };
  const pin = (id: number, detached: boolean) => ({
    id,
    type: 'typed_answer',
    origin: 'pinned',
    key: `ex-${id}`,
    detached,
    payload: { prompt: `Meaning of 水 ${id}`, answerLanguage: 'base', accept: [] },
  });

  function page(api: object) {
    render(
      <ApiContext.Provider value={api as unknown as ApiClient}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={['/authoring/lessons/3']}>
            <Routes>
              <Route path="/authoring/lessons/:lessonId" element={<LessonEditorPage />} />
            </Routes>
          </MemoryRouter>
        </AppThemeProvider>
      </ApiContext.Provider>,
    );
  }

  // #259: a pin whose original the generators no longer make.
  it('marks a detached pin only, and re-ties it', async () => {
    const api = {
      GET: jest
        .fn()
        .mockResolvedValueOnce({ lesson, items: [], exercises: [pin(8, false), pin(9, true)] })
        .mockResolvedValue({ lesson, items: [], exercises: [pin(8, false), pin(9, false)] }),
      POST: jest.fn(() => Promise.resolve({ exercise: pin(9, false) })),
    };
    page(api);
    const list = (await screen.findByRole('heading', { name: 'Exercises' })).parentElement!;
    const items = within(list).getAllByRole('listitem');
    expect(items[0]!.textContent).not.toContain('Detached');
    expect(items[1]!.textContent).toContain('Detached:');
    fireEvent.click(within(items[1]!).getByRole('button', { name: 'Re-tie Meaning of 水 9' }));
    await waitFor(() => expect(within(list).queryByText('Detached:')).toBeNull());
    expect(api.POST).toHaveBeenCalledWith('/api/v1/authoring/exercises/{id}/retie', {
      params: { path: { id: '9' } },
      body: {},
    });
    expect(api.GET).toHaveBeenCalledTimes(2);
    // Focus stays in the section and the re-tie is announced.
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Re-tied Meaning of 水 9.'),
    );
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Exercises' }));
  });

  it('shows why a re-tie failed', async () => {
    const api = {
      GET: jest.fn(() => Promise.resolve({ lesson, items: [], exercises: [pin(9, true)] })),
      POST: jest.fn(() => Promise.reject(new Error('boom'))),
    };
    page(api);
    fireEvent.click(await screen.findByRole('button', { name: 'Re-tie Meaning of 水 9' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Detached:')).toBeTruthy();
  });

  it('keeps the blocked-word warning shown after the first save of a new exercise', async () => {
    const editor = {
      lesson: {
        id: 3,
        unitId: 1,
        key: 'l',
        position: 0,
        type: 'grammar',
        title: 'Lesson',
        status: 'draft',
        courseId: 7,
        plugin: 'ja',
        sectionLevel: 'N5',
      },
      items: [],
      exercises: [],
    };
    const api = {
      GET: jest.fn(() => Promise.resolve(editor)),
      POST: jest.fn((_path: string, { body }: { body: { type: string; payload: object } }) =>
        Promise.resolve({
          exercise: {
            id: 9,
            type: body.type,
            origin: 'authored',
            key: 'ex-9',
            payload: body.payload,
          },
          blockedWords: ['飲む'],
        }),
      ),
    };
    render(
      <ApiContext.Provider value={api as unknown as ApiClient}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={['/authoring/lessons/3']}>
            <Routes>
              <Route path="/authoring/lessons/:lessonId" element={<LessonEditorPage />} />
            </Routes>
          </MemoryRouter>
        </AppThemeProvider>
      </ApiContext.Provider>,
    );
    fireEvent.change(await screen.findByLabelText('Type'), { target: { value: 'typed_answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Write exercise' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved, but it uses blocked words: 飲む')).toBeTruthy();
    await waitFor(() => expect(api.GET).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Saved, but it uses blocked words: 飲む')).toBeTruthy();
  });
});
