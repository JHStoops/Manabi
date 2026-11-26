import { z } from 'zod';
import { itemFields } from './itemEditor';

// FR-221: the item editor's form fields come from the plugin's item schema (DR-06).
describe('itemFields', () => {
  it('describes each top-level field by kind, unwrapping optional and default', () => {
    const schema = z
      .object({
        written: z.string().min(1),
        script: z.enum(['hiragana', 'katakana']),
        strokes: z.number().int(),
        meanings: z.array(z.string()),
        components: z.array(z.string()).default([]),
        senses: z.array(z.object({ meanings: z.array(z.string()) })),
        note: z.string().optional(),
      })
      .strict()
      .refine(() => true);
    expect(itemFields(schema)).toEqual([
      { name: 'written', kind: 'text', optional: false },
      { name: 'script', kind: 'text', optional: false },
      { name: 'strokes', kind: 'number', optional: false },
      { name: 'meanings', kind: 'textList', optional: false },
      { name: 'components', kind: 'textList', optional: true },
      { name: 'senses', kind: 'json', optional: false },
      { name: 'note', kind: 'text', optional: true },
    ]);
  });

  it('has no fields for a schema that is not an object', () => {
    expect(itemFields(z.string())).toEqual([]);
  });
});
