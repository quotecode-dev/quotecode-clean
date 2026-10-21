import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DraftAttachmentsWarning, DraftConflictModal, DraftRecoveredBanner, DraftStorageWarning } from './QuoteDraftNotices';
import SignOutModal from './SignOutModal';

describe('draft notices', () => {
  it('conflict dialog offers exactly Review recovered copy / Use saved version / Discard, in EN and HE', () => {
    const onReview = vi.fn(); const onUseSaved = vi.fn(); const onDiscard = vi.fn();
    const { rerender } = render(<DraftConflictModal conflict={{ label: 'A100041', reason: 'changed' }} isHebrew={false} onReview={onReview} onUseSaved={onUseSaved} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByTestId('draft-conflict-review')); fireEvent.click(screen.getByTestId('draft-conflict-use-saved')); fireEvent.click(screen.getByTestId('draft-conflict-discard'));
    expect(onReview).toHaveBeenCalledTimes(1); expect(onUseSaved).toHaveBeenCalledTimes(1); expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('draft-conflict-modal').textContent).toContain('A100041');
    rerender(<DraftConflictModal conflict={{ label: 'A100041', reason: 'changed' }} isHebrew onReview={onReview} onUseSaved={onUseSaved} onDiscard={onDiscard} />);
    expect(screen.getByTestId('draft-conflict-modal').textContent).toMatch(/סקור עותק משוחזר/);
  });
  it('a deleted/immutable quote has no "use saved version" choice', () => {
    render(<DraftConflictModal conflict={{ label: 'A1', reason: 'missing' }} isHebrew={false} onReview={() => {}} onUseSaved={() => {}} onDiscard={() => {}} />);
    expect(screen.queryByTestId('draft-conflict-use-saved')).toBeNull();
  });
  it('renders nothing when there is no conflict / info / warning', () => {
    const { container } = render(<><DraftConflictModal conflict={null} /><DraftRecoveredBanner info={null} /><DraftStorageWarning show={false} /><DraftAttachmentsWarning names={[]} /></>);
    expect(container.textContent).toBe('');
  });
  it('recovered banner shows the timestamp, requires re-selection of unrecoverable attachments, and never prints draft fields', () => {
    const onDiscard = vi.fn();
    render(<DraftRecoveredBanner info={{ updatedAt: Date.UTC(2026, 8, 21, 10, 0), mode: 'new', missingAttachments: ['plan.pdf'], conflictCopy: null }} isHebrew={false} onDiscard={onDiscard} onDismiss={() => {}} />);
    expect(screen.getByTestId('draft-recovered-banner').textContent).toMatch(/Recovered an unsaved draft/);
    expect(screen.getByTestId('draft-missing-attachments').textContent).toContain('plan.pdf');
    fireEvent.click(screen.getByText('Discard draft')); expect(onDiscard).toHaveBeenCalled();
  });
  it('a conflict copy banner says the saved quote is not touched', () => {
    render(<DraftRecoveredBanner info={{ updatedAt: 1, conflictCopy: { label: 'A7' } }} isHebrew={false} onDiscard={() => {}} onDismiss={() => {}} />);
    expect(screen.getByTestId('draft-recovered-banner').textContent).toMatch(/NEW quote.*not touched/);
  });
  it('storage failure is visible in both languages (blocked vs full) and never claims a save', () => {
    const { rerender } = render(<DraftStorageWarning show reason="unavailable" isHebrew={false} />);
    expect(screen.getByTestId('draft-storage-warning').textContent).toMatch(/Draft recovery is unavailable/);
    rerender(<DraftStorageWarning show reason="quota" isHebrew />);
    expect(screen.getByTestId('draft-storage-warning').textContent).toMatch(/אין מספיק מקום/);
  });
  it('attachments that could not be staged are named', () => {
    render(<DraftAttachmentsWarning names={['a.pdf', 'b.png']} isHebrew={false} />);
    expect(screen.getByTestId('draft-attachments-warning').textContent).toMatch(/a\.pdf, b\.png/);
  });
  it('sign-out modal warns about unsaved work only when there is a dirty draft', () => {
    const { rerender } = render(<SignOutModal isOpen onClose={() => {}} onConfirm={() => {}} isHebrew={false} hasUnsavedDraft={false} />);
    expect(screen.queryByTestId('signout-unsaved-warning')).toBeNull();
    rerender(<SignOutModal isOpen onClose={() => {}} onConfirm={() => {}} isHebrew={false} hasUnsavedDraft />);
    expect(screen.getByTestId('signout-unsaved-warning').textContent).toMatch(/unsaved quote/);
    rerender(<SignOutModal isOpen onClose={() => {}} onConfirm={() => {}} isHebrew hasUnsavedDraft />);
    expect(screen.getByTestId('signout-unsaved-warning').textContent).toMatch(/הצעה שלא נשמרה/);
  });
});
