// §51.15 "AI HELP ENTRY MUST BE SELF-EXPLANATORY": every in-workflow AI entry = the canonical AI Chat icon + a visible label.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import AiHelpButton from './AiHelpButton';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

describe('AiHelpButton', () => {
  it.each([
    [true, false, 'שאל את AI'], [true, true, 'צריך עזרה? שאל את AI'], [false, false, 'Ask AI'], [false, true, 'Need help? Ask AI'],
  ])('isHebrew=%s long=%s shows the visible label "%s" next to the canonical AI Chat icon', (isHebrew, long, label) => {
    render(<AiHelpButton isHebrew={isHebrew} long={long} testId="x" />);
    const btn = screen.getByTestId('x');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveTextContent(label);
    expect(btn.querySelector('[data-ai-chat-icon="canonical"]')).not.toBeNull();
    expect(btn.getAttribute('aria-label')).toMatch(isHebrew ? /שאל את AI.*צ׳אט AI/ : /Ask AI.*AI Chat/);
    expect(btn.getAttribute('dir')).toBe(isHebrew ? 'rtl' : 'ltr');
  });
  it('opens the ONE assistant through the shared event (no second chat instance)', () => {
    const spy = vi.fn(); window.addEventListener('open-proflow-ai-chat', spy);
    render(<AiHelpButton testId="y" />); fireEvent.click(screen.getByTestId('y'));
    window.removeEventListener('open-proflow-ai-chat', spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('one canonical AI Chat entry visual', () => {
  const SITES = ['src/pages/Dashboard.jsx', 'src/components/AddItemWizard.jsx', 'src/components/QuoteDraftNotices.jsx', 'src/components/EditClientModal.jsx', 'src/components/PricingModal.jsx', 'src/components/QuoteForm.jsx'];
  it('the header AI Chat button and the entry both render AiChatIcon (one source)', () => {
    expect(read('src/pages/Dashboard.jsx')).toMatch(/className="dash-header-ai-btn"[\s\S]{0,400}<AiChatIcon /);
    expect(read('src/components/AiHelpButton.jsx')).toMatch(/<AiChatIcon /);
    expect(read('src/components/AiHelpButton.jsx')).not.toMatch(/from 'lucide-react'/); // no private icon
  });
  it.each(SITES)('%s: every workflow entry is the labelled AiHelpButton (never icon-only / compact)', (p) => {
    const uses = read(p).match(/<AiHelpButton [^>]*\/>/g) || [];
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).not.toMatch(/\bcompact\b/);
  });
  it('the authenticated floating trigger uses the canonical icon too', () => {
    expect(read('src/AIChatWidget.jsx')).toMatch(/isDashboard \? <AiChatIcon /);
  });
});
