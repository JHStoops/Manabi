import styled from '@emotion/styled';
import type { ReadingInContextPayload } from '@manabi/core';
import ChoiceRenderer from './ChoiceRenderer';
import type { ExerciseRendererProps } from './registry';

// EX-09 reading in context (FR-043): the word with its kanji marked, then the readings as a
// multiple choice (keys 1 to 4 choose, as in EX-01).

const Word = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing(4)};
  font-size: ${({ theme }) => theme.fontSizes.title};
  color: ${({ theme }) => theme.colors.text};
  text-align: center;
`;

/** The kanji asked about, underlined so it shows without color (NFR-31). */
const Kanji = styled.mark`
  background: none;
  color: inherit;
  text-decoration: underline 3px;
  text-underline-offset: 0.2em;
`;

export default function ReadingInContextRenderer({
  payload,
  plugin,
  onAnswer,
}: ExerciseRendererProps<ReadingInContextPayload, number>) {
  const { word, kanji } = payload;
  const at = word.text.indexOf(kanji.text);
  return (
    <div>
      <Word lang={plugin.code}>
        {word.text.slice(0, at)}
        <Kanji>{kanji.text}</Kanji>
        {word.text.slice(at + kanji.text.length)}
      </Word>
      <ChoiceRenderer payload={payload} plugin={plugin} onAnswer={onAnswer} />
    </div>
  );
}
