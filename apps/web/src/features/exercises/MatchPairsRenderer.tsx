import { useState } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import type { MatchPairsPayload } from '@manabi/core';
import type { ExerciseRendererProps } from './registry';
import { ChoiceButton, Prompt, shuffled } from './ui';

// EX-02 match pairs (FR-042): tap a term and a match to pair them. A wrong pairing is retried
// (Product Spec section 4); the answer is reported once every pair is matched.

const Columns = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const Column = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(2)};
`;

type Side = 'term' | 'match';

// NFR-31: a matched pair is marked by an icon, not color alone.
const matchedIcon = '✓';

export default function MatchPairsRenderer({
  payload,
  onAnswer,
}: ExerciseRendererProps<MatchPairsPayload, number[]>) {
  const { t } = useTranslation();
  const [matchOrder] = useState(() => shuffled(payload.pairs.map((_, index) => index)));
  const [selected, setSelected] = useState<{ side: Side; index: number } | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [missed, setMissed] = useState(false);

  const tap = (side: Side, index: number) => {
    if (matched.includes(index)) return;
    if (!selected || selected.side === side) {
      setSelected(selected?.side === side && selected.index === index ? null : { side, index });
      return;
    }
    setSelected(null);
    setMissed(selected.index !== index);
    if (selected.index !== index) return;
    const next = [...matched, index];
    setMatched(next);
    if (next.length === payload.pairs.length) onAnswer(payload.pairs.map((_, term) => term));
  };

  const button = (side: Side, index: number) => {
    const done = matched.includes(index);
    const text = side === 'term' ? payload.pairs[index]!.term : payload.pairs[index]!.match;
    return (
      <ChoiceButton
        key={index}
        type="button"
        aria-disabled={done}
        aria-pressed={selected?.side === side && selected.index === index}
        onClick={() => tap(side, index)}
      >
        {done && <span aria-hidden="true">{matchedIcon} </span>}
        {text}
      </ChoiceButton>
    );
  };

  return (
    <div>
      <Prompt>{t('exercise.matchPairs')}</Prompt>
      <Columns>
        <Column>{payload.pairs.map((_, index) => button('term', index))}</Column>
        <Column>{matchOrder.map((index) => button('match', index))}</Column>
      </Columns>
      <p role="status">{missed ? t('exercise.notAPair') : ''}</p>
    </div>
  );
}
