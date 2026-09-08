import { describe, it, expect } from 'vitest';
import { getFunctionErrorMessage } from './functionError';

describe('getFunctionErrorMessage', () => {
  it('extracts the real server-provided message from error.context', async () => {
    const error = { context: { json: async () => ({ error: 'Forbidden: you may only send your own quote' }) } };
    expect(await getFunctionErrorMessage(error, 'fallback')).toBe('Forbidden: you may only send your own quote');
  });

  it('falls back to error.message when context has no readable error field', async () => {
    const error = { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({}) } };
    expect(await getFunctionErrorMessage(error, 'fallback')).toBe('Edge Function returned a non-2xx status code');
  });

  it('falls back to the provided fallback when there is no context at all (network failure)', async () => {
    const error = { message: undefined };
    expect(await getFunctionErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('falls back safely when context.json() throws', async () => {
    const error = { context: { json: async () => { throw new Error('not json'); } } };
    expect(await getFunctionErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('handles a null/undefined error gracefully', async () => {
    expect(await getFunctionErrorMessage(null, 'fallback')).toBe('fallback');
    expect(await getFunctionErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
