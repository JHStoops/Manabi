import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ApiClient } from '@manabi/api-client';
import type { CourseTree, TreeLesson } from '@manabi/core';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import { CourseTreeEditor } from './CourseTreeEditor';

// Component tests for the course tree editor (#41): FR-220, FR-225.

const lesson = (id: number, title: string, position: number): TreeLesson => ({
  id,
  unitId: 10,
  key: `ja-en:n5:greetings:${title}`,
  position,
  type: 'vocabulary',
  title,
  status: 'draft',
});

function tree(lessons = [lesson(1, 'a', 0), lesson(2, 'b', 1), lesson(3, 'c', 2)]): CourseTree {
  return {
    course: {
      id: 7,
      key: 'ja-en',
      targetLang: 'ja',
      baseLang: 'en',
      plugin: 'ja',
      title: 'Japanese',
      status: 'published',
    },
    sections: [
      {
        id: 5,
        courseId: 7,
        key: 'ja-en:n5',
        position: 0,
        title: 'N5',
        levelCode: 'N5',
        units: [
          {
            id: 10,
            sectionId: 5,
            key: 'ja-en:n5:greetings',
            position: 0,
            title: 'Greetings',
            status: 'draft',
            lessons,
          },
        ],
      },
    ],
  };
}

function show() {
  const api = {
    GET: jest.fn(() => Promise.resolve(tree())),
    POST: jest.fn(),
    PATCH: jest.fn(),
    DELETE: jest.fn(),
  };
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <CourseTreeEditor courseId={7} />
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
  return api;
}

const lessonTitles = () =>
  within(screen.getByRole('list', { name: 'Lessons of Greetings' }))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('aria-label'));

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

describe('CourseTreeEditor', () => {
  it('reorders with the move buttons and by drag (FR-220)', async () => {
    const api = show();
    expect(await screen.findByRole('heading', { name: 'Japanese' })).toBeTruthy();
    expect(api.GET).toHaveBeenCalledWith('/api/v1/authoring/courses/{id}', {
      params: { path: { id: '7' } },
    });
    expect(lessonTitles()).toEqual(['a', 'b', 'c']);
    expect(screen.getByRole('button', { name: 'Move a up' })).toHaveProperty('disabled', true);

    // Keyboard alternative: the move buttons.
    api.PATCH.mockResolvedValueOnce(
      tree([lesson(2, 'b', 0), lesson(1, 'a', 1), lesson(3, 'c', 2)]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move a down' }));
    await waitFor(() => expect(lessonTitles()).toEqual(['b', 'a', 'c']));
    expect(api.PATCH).toHaveBeenLastCalledWith('/api/v1/authoring/lessons/{id}', {
      params: { path: { id: '1' } },
      body: { position: 1 },
    });
    expect(lessonTitles()).toEqual(['b', 'a', 'c']);

    // Drag c onto b (index 0).
    api.PATCH.mockResolvedValueOnce(
      tree([lesson(3, 'c', 0), lesson(2, 'b', 1), lesson(1, 'a', 2)]),
    );
    const item = (title: string) =>
      within(screen.getByRole('list', { name: 'Lessons of Greetings' })).getByRole('listitem', {
        name: title,
      });
    fireEvent.dragStart(item('c'));
    fireEvent.dragOver(item('b'));
    fireEvent.drop(item('b'));
    await waitFor(() => expect(lessonTitles()).toEqual(['c', 'b', 'a']));
    expect(api.PATCH).toHaveBeenLastCalledWith('/api/v1/authoring/lessons/{id}', {
      params: { path: { id: '3' } },
      body: { position: 0 },
    });
    expect(lessonTitles()).toEqual(['c', 'b', 'a']);

    // A lesson dropped on a unit (another kind) does not move.
    fireEvent.dragStart(item('a'));
    fireEvent.drop(screen.getByRole('listitem', { name: 'Greetings' }));
    expect(api.PATCH).toHaveBeenCalledTimes(2);
  });

  it('adds, renames, publishes and deletes rows (FR-220, FR-225)', async () => {
    const api = show();
    await screen.findByRole('heading', { name: 'Japanese' });

    api.POST.mockResolvedValueOnce(
      tree([...tree().sections[0]!.units[0]!.lessons, lesson(4, 'd', 3)]),
    );
    const add = screen.getByRole('form', { name: 'Add lesson to Greetings' });
    fireEvent.change(within(add).getByLabelText('Key'), { target: { value: 'd' } });
    fireEvent.change(within(add).getByLabelText('Title'), { target: { value: 'd' } });
    fireEvent.change(within(add).getByLabelText('Type'), { target: { value: 'grammar' } });
    fireEvent.click(within(add).getByRole('button', { name: 'Add lesson to Greetings' }));
    await screen.findByRole('listitem', { name: 'd' });
    expect(api.POST).toHaveBeenCalledWith('/api/v1/authoring/lessons', {
      body: { unitId: 10, slug: 'd', title: 'd', type: 'grammar' },
    });

    api.PATCH.mockResolvedValueOnce(tree([{ ...lesson(1, 'Hello', 0) }]));
    fireEvent.click(screen.getByRole('button', { name: 'Rename a' }));
    fireEvent.change(screen.getByDisplayValue('a'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('listitem', { name: 'Hello' });
    expect(api.PATCH).toHaveBeenLastCalledWith('/api/v1/authoring/lessons/{id}', {
      params: { path: { id: '1' } },
      body: { title: 'Hello' },
    });

    const unit = tree();
    unit.sections[0]!.units[0]!.status = 'published';
    api.PATCH.mockResolvedValueOnce(unit);
    const unitRow = screen.getByRole('listitem', { name: 'Greetings' });
    fireEvent.click(within(unitRow).getAllByRole('button', { name: 'Publish' })[0]!);
    await within(screen.getByRole('listitem', { name: 'Greetings' })).findAllByText('Published');
    expect(api.PATCH).toHaveBeenLastCalledWith('/api/v1/authoring/units/{id}', {
      params: { path: { id: '10' } },
      body: { status: 'published' },
    });

    window.confirm = jest.fn(() => false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete b' }));
    expect(api.DELETE).not.toHaveBeenCalled();
    window.confirm = jest.fn(() => true);
    api.DELETE.mockResolvedValueOnce(tree([lesson(1, 'a', 0), lesson(3, 'c', 1)]));
    fireEvent.click(screen.getByRole('button', { name: 'Delete b' }));
    expect(await screen.findByRole('listitem', { name: 'c' })).toBeTruthy();
    expect(screen.queryByRole('listitem', { name: 'b' })).toBeNull();
    expect(api.DELETE).toHaveBeenCalledWith('/api/v1/authoring/lessons/{id}', {
      params: { path: { id: '2' } },
    });
  });

  it('shows the API error when a change fails', async () => {
    const { ApiRequestError } = await import('@manabi/api-client');
    const api = show();
    await screen.findByRole('heading', { name: 'Japanese' });
    api.POST.mockRejectedValueOnce(
      ApiRequestError.fromResponse(409, {
        error: { code: 'conflict', message: 'That key is already used', details: null },
      }),
    );
    const add = screen.getByRole('form', { name: 'Add section' });
    fireEvent.change(within(add).getByLabelText('Key'), { target: { value: 'n5' } });
    fireEvent.change(within(add).getByLabelText('Title'), { target: { value: 'N5' } });
    fireEvent.change(within(add).getByLabelText('Level'), { target: { value: 'N5' } });
    fireEvent.click(within(add).getByRole('button', { name: 'Add section' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That key is already used');
    expect(api.POST).toHaveBeenCalledWith('/api/v1/authoring/courses/{id}/sections', {
      params: { path: { id: '7' } },
      body: { slug: 'n5', title: 'N5', levelCode: 'N5' },
    });
  });
});
