import { createContext, useCallback, useContext, useEffect, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { UnlockedAchievement } from '@manabi/core';
import { useApi } from './session';

/**
 * FR-165: achievement celebrations, each shown once. Unlocks arrive in progress responses
 * (lesson, test-out and review answers) and, on app load, from GET /me/achievements (earned but
 * not seen yet: the app closed before it showed them). The server records `seenAt` when one is
 * shown, so a reload never shows it again; `handled` keeps a refetch or a replayed response
 * from queueing it twice within this page load.
 */
export interface CelebrationState {
  queue: UnlockedAchievement[];
  handled: string[];
}

export type CelebrationAction =
  { type: 'unlocked'; achievements: readonly UnlockedAchievement[] } | { type: 'dismissed' };

export function celebrationReducer(
  state: CelebrationState,
  action: CelebrationAction,
): CelebrationState {
  switch (action.type) {
    case 'unlocked': {
      const fresh = action.achievements.filter(
        (a, i, all) =>
          !state.handled.includes(a.key) && all.findIndex((b) => b.key === a.key) === i,
      );
      if (fresh.length === 0) return state;
      return {
        queue: [...state.queue, ...fresh],
        handled: [...state.handled, ...fresh.map((a) => a.key)],
      };
    }
    case 'dismissed':
      return { ...state, queue: state.queue.slice(1) };
  }
}

const CelebrationContext = createContext<CelebrationState | null>(null);
const CelebrationDispatchContext = createContext<Dispatch<CelebrationAction> | null>(null);

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [state, dispatch] = useReducer(celebrationReducer, { queue: [], handled: [] });

  useEffect(() => {
    let current = true;
    api.GET('/api/v1/me/achievements').then(
      ({ achievements }) => {
        if (!current) return;
        const unseen = achievements.filter((a) => a.earnedAt !== null && a.seenAt === null);
        dispatch({ type: 'unlocked', achievements: unseen });
      },
      // Celebrations are a nicety: a failed load shows none now; the next load shows them.
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [api]);

  return (
    <CelebrationContext.Provider value={state}>
      <CelebrationDispatchContext.Provider value={dispatch}>
        {children}
      </CelebrationDispatchContext.Provider>
    </CelebrationContext.Provider>
  );
}

/** The celebration queue; the host shows its head. */
export function useCelebrations(): CelebrationState {
  const state = useContext(CelebrationContext);
  if (!state) throw new Error('useCelebrations must be used inside CelebrationProvider');
  return state;
}

export function useCelebrationDispatch(): Dispatch<CelebrationAction> {
  const dispatch = useContext(CelebrationDispatchContext);
  if (!dispatch) throw new Error('useCelebrationDispatch must be used inside CelebrationProvider');
  return dispatch;
}

const noop = () => undefined;

/** Queues unlocks from a progress response; a no-op outside a provider (for example in tests). */
export function useCelebrate(): (achievements: readonly UnlockedAchievement[]) => void {
  const dispatch = useContext(CelebrationDispatchContext);
  return useCallback(
    (achievements: readonly UnlockedAchievement[]) =>
      dispatch ? dispatch({ type: 'unlocked', achievements }) : noop(),
    [dispatch],
  );
}
