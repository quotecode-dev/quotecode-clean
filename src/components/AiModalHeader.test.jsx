// §51.16: ONE header row [title] [AI action] [Close]; desktop long label / mobile short label, both real visible text (CSS picks one).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AiModalHeader from './AiModalHeader';

describe('AiModalHeader', () => {
  it.each([[true, 'צריך עזרה? שאל את AI', 'שאל את AI'], [false, 'Need help? Ask AI', 'Ask AI']])('isHebrew=%s: title, AI action (both labels), Close in ONE row', (isHebrew, long, short) => {
    const onClose = vi.fn();
    render(<AiModalHeader title="T" onClose={onClose} closeLabel="close-x" isHebrew={isHebrew} testId="h" />);
    const row = screen.getByTestId('h-header');
    expect(row.className).toContain('pf-modal-head');
    expect(row.getAttribute('dir')).toBe(isHebrew ? 'rtl' : 'ltr');
    expect([...row.children].map((c) => c.className)).toEqual(['pf-modal-head-title', 'pf-modal-head-ai', 'pf-modal-head-close']);
    const btn = screen.getByTestId('h');
    expect(btn.querySelector('.pf-ai-label-long').textContent).toBe(long);
    expect(btn.querySelector('.pf-ai-label-short').textContent).toBe(short);
    expect(btn.querySelector('[data-ai-chat-icon="canonical"]')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('close-x'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('without a title the AI action is still the centre column', () => {
    render(<AiModalHeader onClose={() => {}} closeLabel="c" testId="p" />);
    expect(screen.getByTestId('p-header').children[1].className).toBe('pf-modal-head-ai');
  });
});
