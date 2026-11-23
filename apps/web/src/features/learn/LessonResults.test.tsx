import { render, screen } from '@testing-library/react';
import '../../i18n';
import { LessonResults } from './LessonResults';

describe('LessonResults', () => {
  it('shows XP earned and progress within the level', () => {
    render(<LessonResults xpEarned={15} totalXp={350} />);
    expect(screen.getByText('+15 XP')).toBeTruthy();
    expect(screen.getByText('Level 3')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Progress to level 4' });
    expect(bar.getAttribute('value')).toBe('50');
    expect(bar.getAttribute('max')).toBe('300');
    expect(screen.getByText('50 / 300 XP to level 4')).toBeTruthy();
  });
});
