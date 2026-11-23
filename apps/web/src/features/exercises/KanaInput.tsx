import { useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { LanguagePlugin } from '@manabi/core';

type KanaInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  plugin: LanguagePlugin;
  /** Called with the field's text after each change. */
  onChange(value: string): void;
};

/**
 * FR-142: a text field that converts romaji to kana as the learner types, using the plugin's
 * `convertInput`. Text from a device IME is left alone while it is being composed. Renders
 * nothing for a plugin without input conversion (FR-241); callers then use a plain field.
 */
export function KanaInput({ plugin, onChange, ...rest }: KanaInputProps) {
  const [value, setValue] = useState('');
  const composing = useRef(false);
  if (!plugin.features.inputConversion) return null;

  const update = (text: string) => {
    setValue(text);
    onChange(text);
  };
  return (
    <input
      {...rest}
      value={value}
      onCompositionStart={() => (composing.current = true)}
      onCompositionEnd={(event) => {
        composing.current = false;
        update(event.currentTarget.value);
      }}
      onChange={(event) => {
        const text = event.target.value;
        // shortcut: converting the whole value moves the caret to the end when editing mid-text;
        // upgrade if learners edit inside long answers.
        update(
          composing.current || (event.nativeEvent as InputEvent).isComposing
            ? text
            : plugin.convertInput(text, 'romaji'),
        );
      }}
    />
  );
}
