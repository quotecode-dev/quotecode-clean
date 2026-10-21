import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import NewQuoteMenu from './NewQuoteMenu';
import SidebarAccountMenu from './SidebarAccountMenu';

afterEach(cleanup);

describe.each([['Hebrew', true], ['English', false]])('NewQuoteMenu (%s)', (_l, isHebrew) => {
  it.each(['sidebar', 'toolbar'])('%s variant: menu semantics, keyboard navigation, focus return on Escape', (variant) => {
    render(<NewQuoteMenu isHebrew={isHebrew} variant={variant} onStandard={vi.fn()} onAi={vi.fn()} onStructured={vi.fn()} />);
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

  it('the sidebar row keeps the dash-sidebar-cta class and the three plain-language labels', () => {
    render(<NewQuoteMenu isHebrew={isHebrew} variant="sidebar" onStandard={vi.fn()} />);
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveClass('dash-sidebar-cta');
    fireEvent.click(trigger);
    const labels = screen.getAllByRole('menuitem').map((i) => i.querySelector('strong').textContent);
    expect(labels).toEqual(isHebrew
      ? ['הצעת מחיר רגילה', 'הצעת מחיר חכמה עם AI', 'הצעה לפי מידות']
      : ['Standard quote', 'AI smart quote', 'Profession-aware measured quote']);
  });
});

describe('NewQuoteMenu placement stays inside the shell', () => {
  const rectOf = (left, right, bottom = 100) => ({ left, right, top: bottom - 40, bottom, width: right - left, height: 40, x: left, y: bottom - 40 });
  const place = (dir, variant, trig, shell) => {
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.classList?.contains('dash-shell-outer')) return rectOf(...shell);
      return rectOf(...trig);
    });
    window.innerWidth = 1001;
    const { container } = render(<div className="dash-shell-outer" dir={dir}><NewQuoteMenu isHebrew={dir === 'rtl'} variant={variant} /></div>);
    fireEvent.click(container.querySelector('button'));
    const menu = screen.getByRole('menu');
    const out = { left: parseFloat(menu.style.left), width: parseFloat(menu.style.width) };
    spy.mockRestore();
    return out;
  };
  it.each([
    ['ltr', 'toolbar', [820, 976], [11, 991]],
    ['rtl', 'toolbar', [26, 182], [11, 991]],
    ['ltr', 'sidebar', [20, 190], [11, 991]],
    ['rtl', 'sidebar', [812, 982], [11, 991]],
  ])('%s %s menu is fully inside the shell with a capped width', (dir, variant, trig, shell) => {
    const { left, width } = place(dir, variant, trig, shell);
    expect(width).toBeLessThanOrEqual(268);
    expect(left).toBeGreaterThanOrEqual(shell[0]);
    expect(left + width).toBeLessThanOrEqual(shell[1]);
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
