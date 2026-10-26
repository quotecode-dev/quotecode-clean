// Owner 2026-10-26: tests answer the app's own question window (src/components/AppDialog.jsx) the way a user does - by its buttons.
import { expect } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

/** waits for the open question, answers it (true = the confirming button) and returns its text */
export async function answerAppDialog(yes) {
  const dialog = await screen.findByTestId('app-dialog-confirm');
  const text = dialog.querySelector('[data-testid="app-dialog-text"]').textContent;
  await act(async () => { fireEvent.click(screen.getByTestId(yes ? 'app-dialog-yes' : 'app-dialog-no')); });
  await waitFor(() => expect(screen.queryByTestId('app-dialog-confirm')).toBeNull());
  return text;
}
