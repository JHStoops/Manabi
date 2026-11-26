import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import type { Item, LanguagePlugin, Tile } from '@manabi/core';
import { useSettings } from '../../state/session';

const Text = styled.span<{ large: boolean }>`
  font-size: ${({ large }) => (large ? '1.25em' : '1em')};
`;

/**
 * FR-140, SDD section 9: stored tiles as text, with `<ruby>` readings from the plugin's
 * `annotate` in the learner's furigana mode and at the learner's target text size. A plugin
 * without reading annotations (FR-241) gets none.
 */
export function AnnotatedText({
  plugin,
  tiles,
  learnedItems,
}: {
  plugin: LanguagePlugin;
  tiles: readonly Tile[];
  /** The learner's items at stage 4 or above. */
  learnedItems: Item[];
}) {
  const { readingAnnotations, targetTextSize } = useSettings();
  const text = tiles.map((tile) => tile.surface).join('');
  const annotations = plugin.features.readingAnnotations
    ? plugin.annotate(tiles, learnedItems, readingAnnotations)
    : [];
  const parts: ReactNode[] = [];
  let at = 0;
  for (const { start, end, value } of annotations) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <ruby key={start}>
        {text.slice(start, end)}
        <rt>{value}</rt>
      </ruby>,
    );
    at = end;
  }
  parts.push(text.slice(at));
  return (
    <Text lang={plugin.code} large={targetTextSize === 'large'}>
      {parts}
    </Text>
  );
}
