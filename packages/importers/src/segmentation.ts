import path from 'node:path';
import type { AnalyzerId, AnalyzerToken, LanguagePlugin, SegmentedTile } from '@manabi/core';
import type * as Kuromoji from 'kuromoji';
import type { IpadicFeatures, Tokenizer } from 'kuromoji';

/** A loaded analyzer: text in, tokens out. Adapters hold no language rules (FR-240). */
export type Analyzer = (text: string) => AnalyzerToken[];

// kuromoji writes "*" for an empty field.
const field = (value: string | undefined): string | null =>
  value === undefined || value === '*' ? null : value;

/** kuromoji 0.1.2 with its bundled IPADIC dictionary, read from disk (about 0.2 s). */
async function loadKuromojiIpadic(): Promise<Analyzer> {
  const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
  // Imported here so the API, worker and CLI load kuromoji only when they segment.
  // Native ESM (tsx) exposes a CommonJS module only as `default`; bundles and Jest give both.
  const mod: typeof Kuromoji & { default?: typeof Kuromoji } = await import('kuromoji');
  const { builder } = mod.default ?? mod;
  const kuromoji = await new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) =>
    builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t))),
  );
  return (text) =>
    kuromoji.tokenize(text).map((t) => ({
      surface: t.surface_form,
      pos: [t.pos, t.pos_detail_1, t.pos_detail_2, t.pos_detail_3].filter((p) => p !== '*'),
      conjugationType: field(t.conjugated_type),
      conjugationForm: field(t.conjugated_form),
      baseForm: field(t.basic_form),
      reading: field(t.reading),
    }));
}

/** Analyzer adapters keyed by the id a plugin declares in `analyzer` (FR-238). */
const adapters: Record<AnalyzerId, () => Promise<Analyzer>> = {
  'kuromoji-ipadic': loadKuromojiIpadic,
};

// Each analyzer is loaded once per process; a failed load is retried on the next call.
const loaded = new Map<AnalyzerId, Promise<Analyzer>>();

/** The analyzer for an adapter id, loading it on first use. */
export function loadAnalyzer(id: AnalyzerId): Promise<Analyzer> {
  const load = adapters[id];
  if (!load) return Promise.reject(new Error(`No analyzer adapter is registered for "${id}"`));
  let analyzer = loaded.get(id);
  if (!analyzer) {
    analyzer = load();
    loaded.set(id, analyzer);
    analyzer.catch(() => loaded.delete(id));
  }
  return analyzer;
}

/** For plugins with `analyzer: null`: one token per space-separated word, with no tags. */
const whitespaceAnalyzer: Analyzer = (text) =>
  text
    .split(/\s+/u)
    .filter(Boolean)
    .map((surface) => ({
      surface,
      pos: [],
      conjugationType: null,
      conjugationForm: null,
      baseForm: null,
      reading: null,
    }));

/**
 * FR-238: the one segmentation path (SDD section 4). Runs the plugin's declared analyzer on the
 * text, then the plugin's `segment`. Node only: used by the Tatoeba import, pack import of
 * authored answer text and the API's authoring saves. Store only the Tile part of each result;
 * `counted` is for the coverage check.
 */
export async function segmentText(plugin: LanguagePlugin, text: string): Promise<SegmentedTile[]> {
  const analyze =
    plugin.analyzer === null ? whitespaceAnalyzer : await loadAnalyzer(plugin.analyzer);
  return plugin.segment(analyze(text));
}
