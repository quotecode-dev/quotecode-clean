import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import NewQuoteMenu from './NewQuoteMenu';
import SidebarAccountMenu from './SidebarAccountMenu';

afterEach(cleanup);

// Owner console 2026-11-08 (design A + stage 2 of the one quote builder, typed incl. L-09 / L-23): the regular and the measured entries are ONE "הצעת מחיר"
describe.each([['Hebrew', true], ['English', false]])('NewQuoteMenu (%s)', (_l, isHebrew) => {
  it.each(['sidebar', 'toolbar'])('%s variant: menu semantics, keyboard navigation, focus return on Escape', (variant) => {
    render(<NewQuoteMenu isHebrew={isHebrew} variant={variant} onStandard={vi.fn()} onAi={vi.fn()} onStructured={vi.fn()} onTemplate={vi.fn()} />);
    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('the sidebar row keeps the dash-sidebar-cta class and the plain-language labels (one quote entry)', () => {
    render(<NewQuoteMenu isHebrew={isHebrew} variant="sidebar" onStandard={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveClass('dash-sidebar-cta');
    fireEvent.click(trigger);
    const labels = screen.getAllByRole('menuitem').map((i) => i.querySelector('strong').textContent);
    // Owner console 2026-11-11 (unified quote, item 11): the start window names HOW the quote starts
    expect(labels).toEqual(isHebrew
      ? ['ממלאים בעצמכם', 'מתארים ל-AI']
      : ['Fill it in yourselves', 'Describe it to AI']);
  });
});

// Owner console 2026-11-11 (unified quote, typed incl. item 11): a centred start window - title, the sentence that every way can hold
// apartments, measurements and files, the four ways with their explanation lines, and Back (closes, focus returns to the trigger)
describe.each([['Hebrew', true, 'איך תרצו להתחיל?', 'חזרה'], ['English', false, 'How would you like to start?', 'Back']])('the start window (%s)', (_l, isHebrew, title, back) => {
  it('is a dialog with the title, the sentence, four ways and Back', () => {
    render(<NewQuoteMenu isHebrew={isHebrew} variant="toolbar" onStandard={vi.fn()} onAi={vi.fn()} onFile={vi.fn()} onTemplate={vi.fn()} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog.textContent).toMatch(isHebrew ? /אפשר הצעה קצרה או כמה דירות/ : /several apartments/);
    expect(screen.getAllByRole('menuitem').map((i) => i.dataset.choice)).toEqual(['standard', 'ai', 'file', 'template']);
    fireEvent.click(screen.getByRole('button', { name: back }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('SidebarAccountMenu', () => {
  it('opens Settings and Sign out; Sign out keeps the dash-sidebar-signout hook and calls the confirmation opener', () => {
    const onSettings = vi.fn();
    const onSignOut = vi.fn();
    render(<SidebarAccountMenu isHebrew={false} onSettings={onSettings} onSignOut={onSignOut} />);
    const gear = screen.getByRole('button', { name: 'Account and settings menu' });
    expect(gear).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(gear);
    const [settings, signOut] = screen.getAllByRole('menuitem');
    expect(signOut).toHaveClass('dash-sidebar-signout');
    fireEvent.click(settings);
    expect(onSettings).toHaveBeenCalledTimes(1);
    fireEvent.click(gear);
    fireEvent.click(screen.getAllByRole('menuitem')[1]);
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
