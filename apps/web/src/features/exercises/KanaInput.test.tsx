import { fireEvent, render, screen } from '@testing-library/react';
import { japanese } from '@manabi/lang-ja';
import type { LanguagePlugin } from '@manabi/core';
import { KanaInput } from './KanaInput';

const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });

describe('KanaInput (FR-142)', () => {
  it('converts romaji live, with capitals giving katakana', () => {
    const onChange = jest.fn();
    render(<KanaInput plugin={japanese} aria-label="answer" onChange={onChange} />);
    const input = screen.getByLabelText('answer') as HTMLInputElement;
    type(input, 'ka');
    expect(input.value).toBe('か');
    type(input, 'かn');
    expect(input.value).toBe('かn');
    type(input, 'かna');
    expect(input.value).toBe('かな');
    type(input, 'KYOU');
    expect(input.value).toBe('キョウ');
    expect(onChange).toHaveBeenLastCalledWith('キョウ');
  });

  it('passes IME composition through unchanged, then converts later romaji', () => {
    const onChange = jest.fn();
    render(<KanaInput plugin={japanese} aria-label="answer" onChange={onChange} />);
    const input = screen.getByLabelText('answer') as HTMLInputElement;
    fireEvent.compositionStart(input);
    type(input, 'ka');
    expect(input.value).toBe('ka');
    type(input, 'か');
    expect(input.value).toBe('か');
    fireEvent.compositionEnd(input);
    expect(input.value).toBe('か');
    expect(onChange).toHaveBeenLastCalledWith('か');
    type(input, 'かka');
    expect(input.value).toBe('かか');
  });

  it('is a plain text field for a plugin without input conversion', () => {
    const plugin = { ...japanese, features: { ...japanese.features, inputConversion: false } };
    const onChange = jest.fn();
    render(<KanaInput plugin={plugin as LanguagePlugin} aria-label="answer" onChange={onChange} />);
    const input = screen.getByLabelText('answer') as HTMLInputElement;
    type(input, 'ka');
    expect(input.value).toBe('ka');
    expect(onChange).toHaveBeenLastCalledWith('ka');
  });
});
