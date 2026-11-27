import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import styled from '@emotion/styled';

// FR-075: a windowed grid. Only the rows near the viewport are in the DOM, so a course's
// thousands of kanji scroll smoothly on a phone. The page (window) scrolls, not the grid.

const Outer = styled.div`
  position: relative;
  width: 100%;
`;

const Cells = styled.ul`
  position: absolute;
  left: 0;
  right: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
`;

/** Rows drawn beyond each edge of the viewport, so a fast scroll does not show blanks. */
const OVERSCAN = 3;

/** How many cells of at least `minCellWidth` fit across `width`. */
export const columnsFor = (width: number, minCellWidth: number, gap: number) =>
  Math.max(1, Math.floor((width + gap) / (minCellWidth + gap)));

/**
 * The rows that overlap the viewport, plus overscan, as [startRow, endRow). `top` is the grid's
 * top edge relative to the viewport: negative once it has scrolled up past it.
 */
export function visibleRows(
  top: number,
  viewportHeight: number,
  rowCount: number,
  rowHeight: number,
): [number, number] {
  const startRow = Math.min(rowCount, Math.max(0, Math.floor(-top / rowHeight) - OVERSCAN));
  const endRow = Math.min(
    rowCount,
    Math.max(startRow, Math.ceil((viewportHeight - top) / rowHeight) + OVERSCAN),
  );
  return [startRow, endRow];
}

export function VirtualGrid<T>({
  items,
  itemKey,
  renderItem,
  label,
  minCellWidth,
  cellHeight,
  gap,
  onNearEnd,
}: {
  items: readonly T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  label: string;
  minCellWidth: number;
  cellHeight: number;
  gap: number;
  /** Called when the drawn rows reach the last few loaded ones: time to load the next page. */
  onNearEnd?: () => void;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [top, setTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const rowHeight = cellHeight + gap;

  const measure = useCallback(() => {
    const el = outer.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setWidth(rect.width);
    setTop(rect.top);
    setViewportHeight(window.innerHeight);
  }, []);

  useLayoutEffect(measure, [measure, items.length]);

  useEffect(() => {
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    // The grid's width also changes when the layout switches between tab bar and side rail.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    if (observer && outer.current) observer.observe(outer.current);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure]);

  const columns = columnsFor(width, minCellWidth, gap);
  const rowCount = Math.ceil(items.length / columns);
  const [startRow, endRow] = visibleRows(top, viewportHeight, rowCount, rowHeight);
  const first = startRow * columns;
  const last = Math.min(items.length, endRow * columns);

  useEffect(() => {
    if (onNearEnd && last >= items.length - columns * OVERSCAN) onNearEnd();
  }, [onNearEnd, last, items.length, columns]);

  return (
    <Outer ref={outer} style={{ height: Math.max(0, rowCount * rowHeight - gap) }}>
      <Cells
        aria-label={label}
        style={{
          top: startRow * rowHeight,
          gap,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: cellHeight,
        }}
      >
        {items.slice(first, last).map((item, i) => (
          // The list is windowed, so each cell says where it sits in the whole list.
          <li key={itemKey(item)} aria-setsize={items.length} aria-posinset={first + i + 1}>
            {renderItem(item)}
          </li>
        ))}
      </Cells>
    </Outer>
  );
}
