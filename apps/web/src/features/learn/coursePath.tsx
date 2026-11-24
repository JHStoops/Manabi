import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { CourseListEntry, CoursePath, UserStats } from '@manabi/core';
import { useApi } from '../../state/session';

/** FR-020, FR-023: the learner's courses and the active course's path, a cache of the API. */
export interface CoursePathState {
  courses: CourseListEntry[] | null;
  activeId: number | null;
  path: CoursePath | null;
  /** FR-161, FR-163: the daily goal and streak, loaded beside the courses; null while loading. */
  stats: UserStats | null;
  error: unknown;
}

export type CoursePathAction =
  | { type: 'coursesLoaded'; courses: CourseListEntry[] }
  | { type: 'activated'; courseId: number }
  | { type: 'pathLoaded'; path: CoursePath }
  | { type: 'statsLoaded'; stats: UserStats }
  | { type: 'failed'; error: unknown };

export const initialCoursePathState: CoursePathState = {
  courses: null,
  activeId: null,
  path: null,
  stats: null,
  error: null,
};

export function coursePathReducer(
  state: CoursePathState,
  action: CoursePathAction,
): CoursePathState {
  switch (action.type) {
    case 'coursesLoaded':
      return {
        ...state,
        courses: action.courses,
        activeId: action.courses.find((c) => c.active)?.id ?? null,
      };
    case 'activated':
      return {
        ...state,
        courses: state.courses?.map((c) => ({ ...c, active: c.id === action.courseId })) ?? null,
        activeId: action.courseId,
        path: null,
        error: null,
      };
    case 'pathLoaded':
      return { ...state, path: action.path, error: null };
    case 'statsLoaded':
      return { ...state, stats: action.stats };
    case 'failed':
      return { ...state, error: action.error };
  }
}

const StateContext = createContext<CoursePathState | null>(null);
const DispatchContext = createContext<Dispatch<CoursePathAction> | null>(null);

/** Loads GET /courses, then the active course's path whenever the active course changes. */
export function CoursePathProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [state, dispatch] = useReducer(coursePathReducer, initialCoursePathState);

  useEffect(() => {
    let current = true;
    api.GET('/api/v1/courses').then(
      (body) => current && dispatch({ type: 'coursesLoaded', courses: body.courses }),
      (error: unknown) => current && dispatch({ type: 'failed', error }),
    );
    return () => {
      current = false;
    };
  }, [api]);

  // A stats failure leaves the ring out; it must not hide the path.
  useEffect(() => {
    let current = true;
    api.GET('/api/v1/me/stats').then(
      (stats) => current && dispatch({ type: 'statsLoaded', stats }),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [api]);

  const { activeId } = state;
  useEffect(() => {
    if (activeId === null) return;
    let current = true;
    api.GET('/api/v1/courses/{id}/path', { params: { path: { id: String(activeId) } } }).then(
      (path) => current && dispatch({ type: 'pathLoaded', path }),
      (error: unknown) => current && dispatch({ type: 'failed', error }),
    );
    return () => {
      current = false;
    };
  }, [api, activeId]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useCoursePath(): CoursePathState {
  const state = useContext(StateContext);
  if (!state) throw new Error('useCoursePath must be used inside CoursePathProvider');
  return state;
}

export function useCoursePathDispatch(): Dispatch<CoursePathAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('useCoursePathDispatch must be used inside CoursePathProvider');
  return dispatch;
}
