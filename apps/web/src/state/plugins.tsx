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
 * Whether the active plugin is still being looked up, known (`ready`), known to be absent
 * (`none`: no active course or an unknown plugin), or not known because the courses failed to
 * load (`error`). FR-241.
 */
export type ActivePluginStatus = 'loading' | 'ready' | 'none' | 'error';

/** Without a provider the plugin is reported as still loading. */
export const ActivePluginStatusContext = createContext<ActivePluginStatus>('loading');

/** Looks up the active course's plugin from GET /courses whenever the active course changes. */
export function ActivePluginProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  // Enrolling dispatches the new active course to the session (LearnPage), so this follows it.
  const { activeCourseId } = useSettings();
  // The lookup's outcome for one course; derived below, so a changed course never shows the last one's.
  const [looked, setLooked] = useState<{
    courseId: number;
    plugin: LanguagePlugin | null;
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    let current = true;
    if (activeCourseId === null) return;
    api.GET('/api/v1/courses').then(
      ({ courses }) => {
        const code = courses.find((c) => c.id === activeCourseId)?.plugin;
        if (current)
          setLooked({
            courseId: activeCourseId,
            plugin: code && plugins.has(code) ? plugins.get(code) : null,
            failed: false,
          });
      },
      // Features stay off when courses cannot be loaded; the Learn tab shows the error.
      () => current && setLooked({ courseId: activeCourseId, plugin: null, failed: true }),
    );
    return () => {
      current = false;
    };
  }, [api, activeCourseId]);

  const known = activeCourseId !== null && looked?.courseId === activeCourseId;
  const plugin = known ? looked.plugin : null;
  const status: ActivePluginStatus =
    activeCourseId === null
      ? 'none'
      : !known
        ? 'loading'
        : looked.failed
          ? 'error'
          : plugin
            ? 'ready'
            : 'none';

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
