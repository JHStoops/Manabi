import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createLanguagePluginRegistry } from '@manabi/core';
import type { LanguageFeatures, LanguagePlugin } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';
import { useApi, useSettings } from './session';

/** The language plugins the web app ships; a course names its plugin (FR-242). */
export const plugins = createLanguagePluginRegistry([japanese]);

/** The active course's plugin; null while loading, with no active course, or an unknown plugin. */
export const ActivePluginContext = createContext<LanguagePlugin | null>(null);

/**
 * Whether the active plugin is still being looked up, known (`ready`), or known to be absent
 * (`none`: no active course, an unknown plugin, or courses that failed to load). FR-241.
 */
export type ActivePluginStatus = 'loading' | 'ready' | 'none';

/** Without a provider the plugin is reported as still loading. */
export const ActivePluginStatusContext = createContext<ActivePluginStatus>('loading');

/** Looks up the active course's plugin from GET /courses whenever the active course changes. */
export function ActivePluginProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  // Enrolling dispatches the new active course to the session (LearnPage), so this follows it.
  const { activeCourseId } = useSettings();
  const [plugin, setPlugin] = useState<LanguagePlugin | null>(null);
  const [status, setStatus] = useState<ActivePluginStatus>('loading');

  useEffect(() => {
    let current = true;
    if (activeCourseId === null) {
      setPlugin(null);
      setStatus('none');
      return;
    }
    setPlugin(null);
    setStatus('loading');
    api.GET('/api/v1/courses').then(
      ({ courses }) => {
        const code = courses.find((c) => c.id === activeCourseId)?.plugin;
        if (!current) return;
        const found = code && plugins.has(code) ? plugins.get(code) : null;
        setPlugin(found);
        setStatus(found ? 'ready' : 'none');
      },
      // Features stay off when courses cannot be loaded; the Learn tab shows the error.
      () => {
        if (!current) return;
        setPlugin(null);
        setStatus('none');
      },
    );
    return () => {
      current = false;
    };
  }, [api, activeCourseId]);

  return (
    <ActivePluginStatusContext.Provider value={status}>
      <ActivePluginContext.Provider value={plugin}>{children}</ActivePluginContext.Provider>
    </ActivePluginStatusContext.Provider>
  );
}

const noFeatures: LanguageFeatures = {
  characterStudy: false,
  strokeDrawing: false,
  readingAnnotations: false,
  inputConversion: false,
};

/** FR-241: the active course plugin's feature flags; all off without an active plugin. */
export function useFeatures(): LanguageFeatures {
  return useContext(ActivePluginContext)?.features ?? noFeatures;
}
