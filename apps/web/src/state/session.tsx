import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { createApiClient } from '@manabi/api-client';
import type { ApiClient } from '@manabi/api-client';
import { learnerSettingsSchema } from '@manabi/core';
import type { LearnerSettings, User } from '@manabi/core';

/** The generated API client (IF-05); same origin, session cookie. Tests provide a fake. */
export const ApiContext = createContext<ApiClient>(createApiClient());
export const useApi = () => useContext(ApiContext);

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: User };

export type SessionAction = { type: 'signedIn'; user: User } | { type: 'signedOut' };

export function sessionReducer(_state: SessionState, action: SessionAction): SessionState {
  return action.type === 'signedIn'
    ? { status: 'signedIn', user: action.user }
    : { status: 'signedOut', user: null };
}

const SessionContext = createContext<SessionState | null>(null);
const SessionDispatchContext = createContext<Dispatch<SessionAction> | null>(null);

/** Loads the signed-in user from GET /api/v1/me; sign-in and sign-out screens dispatch changes. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [state, dispatch] = useReducer(sessionReducer, { status: 'loading', user: null });

  useEffect(() => {
    let current = true;
    api.GET('/api/v1/me').then(
      (user) => current && dispatch({ type: 'signedIn', user }),
      // shortcut: any failure (401, server down) counts as signed out; show a distinct
      // "cannot reach the server" state when the sign-in screen needs it.
      () => current && dispatch({ type: 'signedOut' }),
    );
    return () => {
      current = false;
    };
  }, [api]);

  return (
    <SessionContext.Provider value={state}>
      <SessionDispatchContext.Provider value={dispatch}>{children}</SessionDispatchContext.Provider>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const state = useContext(SessionContext);
  if (!state) throw new Error('useSession must be used inside SessionProvider');
  return state;
}

export function useSessionDispatch(): Dispatch<SessionAction> {
  const dispatch = useContext(SessionDispatchContext);
  if (!dispatch) throw new Error('useSessionDispatch must be used inside SessionProvider');
  return dispatch;
}

const defaultSettings = learnerSettingsSchema.parse({});

/** The signed-in learner's settings, or the defaults when signed out or outside a provider. */
export function useSettings(): LearnerSettings {
  return useContext(SessionContext)?.user?.settings ?? defaultSettings;
}
