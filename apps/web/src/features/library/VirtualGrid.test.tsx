import { act, cleanup, render, screen, within } from '@testing-library/react';
import { VirtualGrid, columnsFor, visibleRows } from './VirtualGrid';

// FR-075: only the rows near the viewport are rendered.

afterEach(cleanup);

describe('columnsFor', () => {
  it('fits as many cells as the width allows, at least one', () => {
    expect(columnsFor(328, 88, 8)).toBe(3);
    expect(columnsFor(1000, 88, 8)).toBe(10);
    expect(columnsFor(0, 88, 8)).toBe(1);
  });
});

describe('visibleRows', () => {
  it('covers the viewport plus three rows of overscan', () => {
    expect(visibleRows(0, 800, 100, 100)).toEqual([0, 11]);
    expect(visibleRows(-5000, 800, 100, 100)).toEqual([47, 61]);
  });

  it('stays within the rows there are', () => {
    expect(visibleRows(0, 800, 4, 100)).toEqual([0, 4]);
    expect(visibleRows(-50000, 800, 4, 100)).toEqual([4, 4]);
    expect(visibleRows(2000, 800, 100, 100)).toEqual([0, 0]);
  });
});

describe('VirtualGrid', () => {
  const items = Array.from({ length: 1000 }, (_, i) => `item ${i}`);

  function mount(onNearEnd = jest.fn()) {
    render(
      <VirtualGrid
        items={items}
        itemKey={(s) => s}
        renderItem={(s) => s}
        label="Things"
        minCellWidth={88}
        cellHeight={92}
        gap={8}
        onNearEnd={onNearEnd}
      />,
    );
    return onNearEnd;
  }

  it('renders only the rows near the viewport, each saying where it sits', () => {
    const onNearEnd = mount();
    const cells = within(screen.getByRole('list', { name: 'Things' })).getAllByRole('listitem');
    expect(cells.length).toBeLessThan(50);
    expect(cells[0]!.textContent).toBe('item 0');
    expect(cells[0]!.getAttribute('aria-setsize')).toBe('1000');
    expect(cells[1]!.getAttribute('aria-posinset')).toBe('2');
    expect(onNearEnd).not.toHaveBeenCalled();
  });

  it('follows the window scroll and asks for more near the end', () => {
    const onNearEnd = mount();
    const outer = screen.getByRole('list', { name: 'Things' }).parentElement!;
    // jsdom has no layout: place the grid as if scrolled far down a 300 px wide column.
    const at = (top: number) => {
      outer.getBoundingClientRect = () => ({ top, width: 300 }) as DOMRect;
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
    };
    at(-10_000);
    // 3 columns of 100 px rows: row 100 is at the viewport's top.
    screen.getByText('item 300');
    expect(screen.queryByText('item 0')).toBeNull();
    at(-33_000);
    screen.getByText('item 999');
    expect(onNearEnd).toHaveBeenCalled();
  });
});
