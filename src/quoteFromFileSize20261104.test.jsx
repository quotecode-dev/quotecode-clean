// Owner console 2026-11-04 (typed: "מאשר תיקון הצגת גודל הקובץ, שחרור עד הלייב"): the picked file's size in the "quote from a file"
// dialog - a 49 KB file showed "0.0 MB"; under 1 MB it is shown in KB, from 1 MB in MB with one decimal, in both languages.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuoteFromFileDialog from './components/QuoteFromFileDialog';
import { fileSizeLabel } from './utils/quoteFromFileClient';

const pdf = (size) => { const f = new File([new Uint8Array(4)], 'quote.pdf', { type: 'application/pdf' }); Object.defineProperty(f, 'size', { value: size }); return f; };

function pick(isHebrew, size) {
  render(<QuoteFromFileDialog isOpen isHebrew={isHebrew} sym={isHebrew ? '₪' : '$'} formatMoneyDisplay={(v) => Number(v).toFixed(2)} currency={isHebrew ? 'ILS' : 'USD'}
    catalog={[]} readFile={vi.fn()} readAllowance={async () => ({ limit: 50, remaining: 50, period: '2026-11' })} onClose={vi.fn()} onApply={vi.fn()} />);
  fireEvent.change(screen.getByTestId('quote-from-file-input'), { target: { files: [pdf(size)] } });
  return screen.getByTestId('quote-from-file-chosen').textContent;
}

describe('the size of the picked file', () => {
  it('under 1 MB in KB (never "0.0 MB"), from 1 MB in MB', () => {
    expect(fileSizeLabel(49 * 1024)).toBe('49 KB');
    expect(fileSizeLabel(200)).toBe('1 KB');
    expect(fileSizeLabel(999 * 1024)).toBe('999 KB');
    expect(fileSizeLabel(1024 * 1024 - 1)).toBe('1.0 MB');
    expect(fileSizeLabel(1024 * 1024)).toBe('1.0 MB');
    expect(fileSizeLabel(Math.round(2.46 * 1024 * 1024))).toBe('2.5 MB');
    expect(fileSizeLabel(8 * 1024 * 1024)).toBe('8.0 MB');
  });
  it('the dialog shows it in Hebrew and in English', () => {
    expect(pick(true, 49 * 1024)).toBe('הקובץ שנבחר: quote.pdf (49 KB)');
  });
  it('English', () => {
    const text = pick(false, 3 * 1024 * 1024);
    expect(text).toContain('quote.pdf (3.0 MB)');
    expect(text).not.toContain('0.0 MB');
  });
});
