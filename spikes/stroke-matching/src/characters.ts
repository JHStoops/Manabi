// The 20 characters used by the spike: N5 kanji with straight strokes, hooks and sweeps,
// and kana with curves and loops (あ お の め ぬ are the hardest for a resample matcher).
export const CHARACTERS: ReadonlyArray<{ char: string; kind: 'kanji' | 'kana' }> = [
  ...['一', '二', '三', '人', '口', '日', '月', '山', '川', '水'].map((char) => ({
    char,
    kind: 'kanji' as const,
  })),
  ...['あ', 'い', 'う', 'お', 'か', 'さ', 'し', 'の', 'め', 'ぬ'].map((char) => ({
    char,
    kind: 'kana' as const,
  })),
];
