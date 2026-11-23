import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import type { CourseListEntry, CoursePath } from '@manabi/core';
import '../../i18n';
import { ApiContext } from '../../state/session';
import { AppThemeProvider } from '../../theme';
import LearnPage, { stateIcons } from './LearnPage';

// Component tests for the Learn tab path screen (#25): FR-020, FR-023, NFR-31.

beforeEach(() => {
  window.matchMedia = (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});

const course = (id: number, title: string, active: boolean): CourseListEntry => ({
  id,
  key: `c${id}`,
  targetLang: 'ja',
  baseLang: 'en',
  plugin: 'ja',
  title,
  status: 'published',
  enrolled: true,
  active,
});

const lesson = (id: number, title: string, state: 'locked' | 'available' | 'completed') => ({
  id,
  key: `l${id}`,
  type: 'vocabulary' as const,
  title,
  status: 'published' as const,
  state,
});

const pathOf = (c: CourseListEntry, lessons: ReturnType<typeof lesson>[]): CoursePath => ({
  course: c,
  sections: [
    {
      id: c.id * 10,
      key: 's',
      title: `${c.title} section`,
      levelCode: 'N5',
      units: [{ id: c.id * 100, key: 'u', title: 'Unit 1', status: 'published', lessons }],
    },
  ],
});

const japanese = course(1, 'Japanese', true);
const spanish = course(2, 'Spanish', false);
const paths: Record<string, CoursePath> = {
  '1': pathOf(japanese, [
    lesson(1, 'Greetings', 'completed'),
    lesson(2, 'Numbers', 'available'),
    lesson(3, 'Family', 'locked'),
  ]),
  '2': pathOf(spanish, [lesson(4, 'Hola', 'available')]),
};

function fakeApi(courses: CourseListEntry[]) {
  return {
    GET: jest.fn((path: string, init?: { params: { path: { id: string } } }) =>
      Promise.resolve(path === '/api/v1/courses' ? { courses } : paths[init!.params.path.id]),
    ),
    POST: jest.fn(() => Promise.resolve({ ...spanish, active: true })),
  };
}

function show(api: ReturnType<typeof fakeApi>) {
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <Routes>
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/lesson/:lessonId" element={<p>lesson intro</p>} />
          </Routes>
        </MemoryRouter>
      </AppThemeProvider>
    </ApiContext.Provider>,
  );
}

describe('LearnPage', () => {
  it('renders each lesson state with a distinct icon and accessible label', async () => {
    show(fakeApi([japanese]));

    const completed = await screen.findByRole('button', {
      name: 'Greetings, Vocabulary lesson, completed',
    });
    const available = screen.getByRole('button', { name: 'Numbers, Vocabulary lesson, available' });
    const locked = screen.getByRole('button', { name: 'Family, Vocabulary lesson, locked' });

    expect(completed.textContent).toContain(stateIcons.completed);
    expect(available.textContent).toContain(stateIcons.available);
    expect(locked.textContent).toContain(stateIcons.locked);
    expect(new Set(Object.values(stateIcons)).size).toBe(3);
    expect((locked as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('heading', { name: 'Japanese section' })).toBeTruthy();
    // One enrolled course: no switcher.
    expect(screen.queryByRole('combobox', { name: 'Course' })).toBeNull();
  });

  it('opens the lesson intro when an available node is tapped', async () => {
    show(fakeApi([japanese]));
    fireEvent.click(await screen.findByRole('button', { name: /^Numbers/ }));
    expect(await screen.findByText('lesson intro')).toBeTruthy();
  });

  it('switching course makes it active and reloads the path', async () => {
    const api = fakeApi([japanese, spanish]);
    show(api);
    await screen.findByRole('button', { name: /^Greetings/ });

    fireEvent.change(screen.getByRole('combobox', { name: 'Course' }), {
      target: { value: '2' },
    });

    expect(await screen.findByRole('button', { name: /^Hola/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Greetings/ })).toBeNull();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/courses/{id}/enroll', {
      params: { path: { id: '2' } },
      body: {},
    });
    await waitFor(() =>
      expect(api.GET).toHaveBeenLastCalledWith('/api/v1/courses/{id}/path', {
        params: { path: { id: '2' } },
      }),
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Spanish');
  });

  it('says so when the learner has no course', async () => {
    show(fakeApi([]));
    expect(await screen.findByText('You are not enrolled in a course yet.')).toBeTruthy();
  });
});
