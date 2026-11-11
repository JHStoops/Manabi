# State

State uses React's `useReducer` and `useContext` only. No Redux, no TanStack Query, no other state library.

Provider pattern, one folder or file per slice:

1. Define the state type, an action union and a pure `reducer(state, action)`.
2. Create two contexts: one for state, one for `dispatch`, so consumers that only dispatch do not re-render on state changes.
3. Export a `<XProvider>` that calls `useReducer` and renders both context providers.
4. Export hooks (`useX`, `useXDispatch`) that read the contexts and throw if used outside the provider.
5. Mount providers in `main.tsx` (or just above the routes that need them).

The server is the source of truth for progress. Client state is a cache of server responses plus UI state; never compute authoritative progress on the client.
