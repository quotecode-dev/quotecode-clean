// Codex SEC-ST-02 (Owner 2026-10-30): the browser's list of accepted attachment types equals the bucket's list in the migration, and any
// other type is uploaded as a generic file (never refused, never served as a page).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { QUOTE_FILE_TYPES, uploadContentType } from './quoteFileTypes';

describe('quote file types', () => {
  it('the migration grants exactly this list to the quote-files bucket', () => {
    const sql = readFileSync('supabase/migrations/20261030700000_security_followups.sql', 'utf8');
    const list = sql.slice(sql.indexOf('allowed_mime_types = ARRAY['), sql.indexOf(']', sql.indexOf('allowed_mime_types = ARRAY[')));
    expect([...list.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual([...QUOTE_FILE_TYPES]);
  });
  it('a known type is kept; markup, scripts, unknown and empty types become a generic file', () => {
    expect(uploadContentType({ type: 'application/pdf' })).toBe('application/pdf');
    expect(uploadContentType({ type: 'IMAGE/PNG' })).toBe('image/png');
    for (const t of ['text/html', 'image/svg+xml', 'application/javascript', 'video/mp4', '', undefined]) expect(uploadContentType({ type: t })).toBe('application/octet-stream');
  });
  it('the attachment upload uses it', () => {
    expect(readFileSync('src/utils/quoteSaveOrchestrator.js', 'utf8')).toContain('contentType: uploadContentType(file)');
  });
});
