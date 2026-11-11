// Extracts ordered stroke paths from a KanjiVG SVG file (https://kanjivg.tagaini.net).
// KanjiVG uses a 109 x 109 coordinate space with y pointing down; each stroke is a
// <path id="kvg:XXXXX-sN" d="..."> centreline.

export const KANJIVG_SIZE = 109;

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name.replace(':', '\\:')}="([^"]*)"`).exec(tag);
  return m?.[1];
}

/** Returns the stroke `d` strings in stroke order. */
export function parseKanjiVgStrokes(svg: string): string[] {
  const strokes: Array<{ n: number; d: string }> = [];
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const id = attr(tag, 'id');
    const d = attr(tag, 'd');
    const n = id ? /-s(\d+)$/.exec(id)?.[1] : undefined;
    if (n && d) strokes.push({ n: Number(n), d });
  }
  return strokes.sort((a, b) => a.n - b.n).map((s) => s.d);
}
