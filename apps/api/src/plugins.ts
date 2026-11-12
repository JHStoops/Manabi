import { createLanguagePluginRegistry } from '@manabi/core';
import { japanese } from '@manabi/lang-ja';

/** The language plugins this server ships, by code (SDD section 4); a course row names its plugin. */
export const languagePlugins = createLanguagePluginRegistry([japanese]);
