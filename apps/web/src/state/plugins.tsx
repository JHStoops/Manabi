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

/** Looks up the active course's plugin from GET /courses whenever the active course changes. */
export function ActivePluginProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  // Enrolling dispatches the new active course to the session (LearnPage), so this follows it.
  const { activeCourseId } = useSettings();
  const [plugin, setPlugin] = useState<LanguagePlugin | null>(null);

  useEffect(() => {
    let current = true;
    if (activeCourseId === null) {
      setPlugin(null);
      return;
    }
    api.GET('/api/v1/courses').then(
      ({ courses }) => {
        const code = courses.find((c) => c.id === activeCourseId)?.plugin;
        if (current) setPlugin(code && plugins.has(code) ? plugins.get(code) : null);
      },
      // Features stay off when courses cannot be loaded; the Learn tab shows the error.
      () => current && setPlugin(null),
    );
    return () => {
      current = false;
    };
  }, [api, activeCourseId]);

  return <ActivePluginContext.Provider value={plugin}>{children}</ActivePluginContext.Provider>;
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
