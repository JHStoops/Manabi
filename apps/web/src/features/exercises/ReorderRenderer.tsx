import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import type { ReorderPayload } from '@manabi/core';
import type { ExerciseRendererProps } from './registry';
import { ChoiceButton, Prompt, shuffled } from './ui';

// EX-06 reorder (FR-042): drag the sentence's chunks into order with mouse or touch, or move a
// focused chunk with the arrow keys (IF-03). The current order is always the answer.

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const Chunk = styled(ChoiceButton)`
  /* Touch drags move the chunk instead of scrolling the page. */
  touch-action: none;
  cursor: grab;
  /* The dragged chunk is marked by shape and opacity, not color alone (NFR-31). */
  &[data-dragging='true'] {
    border-style: dashed;
    opacity: 0.6;
    cursor: grabbing;
  }
`;

const Hint = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.small};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/** A shuffled start order that is not already accepted, unless no other order exists. */
function startOrder({ answer: { tiles }, acceptedOrders }: ReorderPayload): number[] {
  const solved = (order: number[]) =>
    acceptedOrders.some((accepted) =>
      accepted.every((i, k) => tiles[i]!.surface === tiles[order[k]!]!.surface),
    );
  let order = shuffled(tiles.map((_, index) => index));
  for (let tries = 0; solved(order) && tries < 20; tries++) {
    order = shuffled(order);
  }
  return order;
}

export default function ReorderRenderer({
  payload,
  plugin,
  onAnswer,
}: ExerciseRendererProps<ReorderPayload, number[]>) {
  const { t } = useTranslation();
  const hintId = useId();
  const { tiles } = payload.answer;
  const [order, setOrder] = useState(() => startOrder(payload));
  const [dragging, setDragging] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // A moved chunk button is re-rendered in its new place; keep keyboard focus on it.
  const focusChunk = useRef<number | null>(null);

  useEffect(() => onAnswer(order), [order, onAnswer]);

  useEffect(() => {
    if (focusChunk.current === null) return;
    root.current?.querySelector<HTMLElement>(`[data-chunk="${focusChunk.current}"]`)?.focus();
    focusChunk.current = null;
  }, [order]);

  /** Moves chunk `index` to position `to`. */
  const moveTo = (index: number, to: number) => {
    const next = order.filter((i) => i !== index);
    next.splice(to, 0, index);
    setOrder(next);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const position = order.indexOf(index);
    const to = position + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
    if (to === position || to < 0 || to >= order.length) return;
    event.preventDefault();
    focusChunk.current = index;
    moveTo(index, to);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (dragging === null) return;
    const over = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-chunk]');
    const index = Number(over?.dataset.chunk);
    if (!over || !root.current?.contains(over) || index === dragging) return;
    const to = order.indexOf(index);
    // Move only once past the target's middle in the direction of travel, so a wider target
    // still under the pointer after the move does not swap straight back.
    // shortcut: compares x only, so a drag onto another wrapped line uses horizontal position;
    // upgrade if long sentences wrap and dragging between lines feels wrong.
    const rect = over.getBoundingClientRect();
    const middle = rect.left + rect.width / 2;
    const forward = to > order.indexOf(dragging);
    if (forward ? event.clientX <= middle : event.clientX >= middle) return;
    moveTo(dragging, to);
  };

  return (
    <div>
      <Prompt>{payload.prompt}</Prompt>
      <Row
        ref={root}
        role="group"
        aria-label={t('exercise.reorder.chunks')}
        aria-describedby={hintId}
      >
        {order.map((index, position) => (
          <Chunk
            key={index}
            type="button"
            lang={plugin.code}
            // Read again after a keyboard move, so screen readers hear the new position.
            aria-label={t('exercise.reorder.chunk', {
              text: tiles[index]!.surface,
              position: position + 1,
              count: order.length,
            })}
            data-chunk={index}
            data-dragging={dragging === index}
            onKeyDown={(event) => onKeyDown(event, index)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              // Captured, so the moves keep coming to this chunk while it passes over others.
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(index);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
            onLostPointerCapture={() => setDragging(null)}
          >
            {tiles[index]!.surface}
          </Chunk>
        ))}
      </Row>
      <Hint id={hintId}>{t('exercise.reorder.hint')}</Hint>
    </div>
  );
}
