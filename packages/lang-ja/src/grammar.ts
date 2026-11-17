import type { AnalyzerToken, GrammarPointPatterns, TokenMatcher } from '@manabi/core';

const matches = (token: AnalyzerToken, m: TokenMatcher): boolean =>
  (m.surface === undefined || token.surface === m.surface) &&
  (m.base === undefined || token.baseForm === m.base) &&
  (m.pos === undefined || m.pos.every((tag, i) => token.pos[i] === tag));

/**
 * FR-236: keys of the points with a detection pattern that matches a run of consecutive
 * kuromoji-ipadic tokens, in the order the points are given.
 */
export function detectGrammar(
  tokens: readonly AnalyzerToken[],
  points: readonly GrammarPointPatterns[],
): string[] {
  return points
    .filter(({ detection }) =>
      detection.some((pattern) =>
        tokens.some((_, start) =>
          pattern.every(
            (m, i) => tokens[start + i] !== undefined && matches(tokens[start + i]!, m),
          ),
        ),
      ),
    )
    .map(({ key }) => key);
}
