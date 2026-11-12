import type { LanguagePlugin } from './index';
import {
  DuplicateLanguagePluginError,
  UnknownLanguagePluginError,
  createLanguagePluginRegistry,
} from './index';

const plugin = (code: string) => ({ code, name: code }) as unknown as LanguagePlugin;

describe('createLanguagePluginRegistry', () => {
  const ja = plugin('ja');
  const zh = plugin('zh');
  const registry = createLanguagePluginRegistry([ja, zh]);

  it('looks plugins up by language code', () => {
    expect(registry.get('ja')).toBe(ja);
    expect(registry.get('zh')).toBe(zh);
    expect(registry.has('ja')).toBe(true);
    expect(registry.has('ko')).toBe(false);
    expect(registry.codes()).toEqual(['ja', 'zh']);
  });

  it("looks a course's plugin up from its plugin field", () => {
    expect(registry.forCourse({ plugin: 'zh' })).toBe(zh);
  });

  it('throws UnknownLanguagePluginError for an unregistered code', () => {
    const lookup = () => registry.get('ko');
    expect(lookup).toThrow(UnknownLanguagePluginError);
    expect(lookup).toThrow('No language plugin is registered for "ko"');
    expect(() => registry.forCourse({ plugin: 'ko' })).toThrow(
      expect.objectContaining({ name: 'UnknownLanguagePluginError', code: 'ko' }),
    );
  });

  it('refuses two plugins with the same code', () => {
    expect(() => createLanguagePluginRegistry([ja, plugin('ja')])).toThrow(
      DuplicateLanguagePluginError,
    );
  });

  it('can be empty', () => {
    expect(createLanguagePluginRegistry([]).codes()).toEqual([]);
  });
});
