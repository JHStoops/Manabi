import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { CourseListEntry, CoursePath, User, UserStats } from '@manabi/core';
import '../../i18n';
import { ApiContext, SessionProvider, useSettings } from '../../state/session';
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
      units: [
        {
          id: c.id * 100,
          key: 'u',
          title: 'Unit 1',
          status: 'published',
          testOutAvailable: false,
          lessons,
        },
      ],
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

const stats: UserStats = {
  dailyGoal: 30,
  todayXp: 15,
  currentStreak: 4,
  longestStreak: 9,
  freezes: 1,
  pendingFreezeSpend: null,
};

function fakeApi(courses: CourseListEntry[], userStats = stats) {
  return {
    GET: jest.fn((path: string, init?: { params: { path: { id: string } } }) =>
      Promise.resolve(
        path === '/api/v1/me'
          ? ({ id: 1, settings: learnerSettingsSchema.parse({}) } as User)
          : path === '/api/v1/courses'
            ? { courses }
            : path === '/api/v1/me/stats'
              ? userStats
              : paths[init!.params.path.id],
      ),
    ),
    POST: jest.fn(() => Promise.resolve({ ...spanish, active: true })),
  };
}

/** The session's active course, which drives the course plugin's features (FR-241). */
function ActiveCourse() {
  return <p>active course {useSettings().activeCourseId ?? 'none'}</p>;
}

function show(api: ReturnType<typeof fakeApi>) {
  render(
    <ApiContext.Provider value={api as unknown as ApiClient}>
      <SessionProvider>
        <ActiveCourse />
        <AppThemeProvider>
          <MemoryRouter initialEntries={['/learn']}>
            <Routes>
              <Route path="/learn" element={<LearnPage />} />
              <Route path="/lesson/:lessonId" element={<p>lesson intro</p>} />
              <Route path="/unit/:unitId/test-out" element={<p>test-out</p>} />
            </Routes>
          </MemoryRouter>
        </AppThemeProvider>
      </SessionProvider>
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
    // Styled props stay off the DOM.
    expect(locked.getAttribute('color')).toBeNull();
    expect(locked.getAttribute('offset')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Japanese section' })).toBeTruthy();
    // One enrolled course: no switcher.
    expect(screen.queryByRole('combobox', { name: 'Course' })).toBeNull();
  });

  // FR-161, FR-163, FR-164
  it('fills the goal ring to the chosen goal and shows the streak and freezes', async () => {
    show(fakeApi([japanese], { ...stats, todayXp: 15 }));
    const ring = await screen.findByRole('progressbar', { name: 'Daily goal' });
    expect(ring.getAttribute('aria-valuemax')).toBe('30');
    expect(ring.getAttribute('aria-valuenow')).toBe('15');
    const fill = screen.getByTestId('goal-ring-fill');
    const length = Number(fill.getAttribute('stroke-dasharray'));
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(length / 2);
    expect(screen.getByLabelText('4 day streak')).toBeTruthy();
    expect(screen.getByLabelText('1 streak freeze')).toBeTruthy();
  });

  // FR-164
  it('asks to spend freezes for a covered gap, and yes keeps the streak', async () => {
    const api = fakeApi([japanese], { ...stats, freezes: 2, pendingFreezeSpend: { days: 2 } });
    api.POST.mockResolvedValue({ ...stats, freezes: 0, pendingFreezeSpend: null } as never);
    show(api);
    expect(
      await screen.findByText('Spend 2 streak freezes to keep your 4-day streak?'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull());
    expect(api.POST).toHaveBeenCalledWith('/api/v1/me/streak/freezes', { body: { spend: true } });
    expect(screen.getByLabelText('0 streak freezes')).toBeTruthy();
  });

  it('no resets the streak', async () => {
    const api = fakeApi([japanese], { ...stats, pendingFreezeSpend: { days: 1 } });
    api.POST.mockResolvedValue({
      ...stats,
      currentStreak: 0,
      pendingFreezeSpend: null,
    } as never);
    show(api);
    expect(
      await screen.findByText('Spend 1 streak freeze to keep your 4-day streak?'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(await screen.findByLabelText('0 day streak')).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/me/streak/freezes', { body: { spend: false } });
    expect(screen.queryByText(/Spend/)).toBeNull();
  });

  it('asks nothing when no gap is pending', async () => {
    show(fakeApi([japanese]));
    await screen.findByRole('progressbar', { name: 'Daily goal' });
    expect(screen.queryByRole('group', { name: 'Streak freezes' })).toBeNull();
  });

  it('closes the ring at the goal and does not overfill it', async () => {
    show(fakeApi([japanese], { ...stats, todayXp: 45 }));
    const ring = await screen.findByRole('progressbar', { name: 'Daily goal' });
    expect(ring.getAttribute('aria-valuenow')).toBe('30');
    expect(Number(screen.getByTestId('goal-ring-fill').getAttribute('stroke-dashoffset'))).toBe(0);
  });

  it('opens the lesson intro when an available node is tapped', async () => {
    show(fakeApi([japanese]));
    fireEvent.click(await screen.findByRole('button', { name: /^Numbers/ }));
    expect(await screen.findByText('lesson intro')).toBeTruthy();
  });

  // FR-024
  it('offers a test-out only on units the path marks available, linking to the player', async () => {
    const api = fakeApi([japanese]);
    paths['1']!.sections[0]!.units[0]!.testOutAvailable = true;
    try {
      show(api);
      fireEvent.click(await screen.findByRole('link', { name: 'Test out of Unit 1' }));
      expect(await screen.findByText('test-out')).toBeTruthy();
    } finally {
      paths['1']!.sections[0]!.units[0]!.testOutAvailable = false;
    }
    show(api);
    await screen.findAllByRole('button', { name: /^Greetings/ });
    expect(screen.queryByRole('link', { name: /^Test out/ })).toBeNull();
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

  // FR-023, NFR-32
  it('lets a learner with no enrollment enroll from the Learn tab and see the course path', async () => {
    const api = fakeApi([{ ...spanish, enrolled: false }]);
    show(api);

    fireEvent.click(await screen.findByRole('button', { name: 'Enroll in Spanish' }));

    expect(await screen.findByRole('button', { name: /^Hola/ })).toBeTruthy();
    expect(api.POST).toHaveBeenCalledWith('/api/v1/courses/{id}/enroll', {
      params: { path: { id: '2' } },
      body: {},
    });
    expect(screen.queryByRole('button', { name: 'Enroll in Spanish' })).toBeNull();
    screen.getByText('active course 2');
  });

  it('offers no Enroll button for a draft course an admin can see', async () => {
    show(fakeApi([{ ...spanish, enrolled: false, status: 'draft' }]));
    await screen.findByText('You are not enrolled in a course yet.');
    expect(screen.queryByRole('button', { name: /^Enroll in/ })).toBeNull();
  });
});
