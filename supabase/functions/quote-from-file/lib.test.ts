// @vitest-environment node
// Owner console 2026-11-03 (typed approval; spec docs/CODEX_SPEC_QUOTE_FROM_FILE_2026-11-03.md): quote-from-file - the pure handler.
// The file is never stored: it is read with a byte cap, sent to the provider once, and nothing of it is logged or returned.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
  buildMessages, cleanText, EXTRACTION_SCHEMA, handleQuoteFromFile, MAX_FILE_BYTES, pdfPageCount, sniffKind, validateExtraction, type HandlerDeps,
} from './lib';

const PDF = (pages: number, extra = '') => new TextEncoder().encode(`%PDF-1.7\n${Array.from({ length: pages }, (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj\n`).join('')}2 0 obj << /Type /Pages /Count ${pages} >> endobj\n${extra}%%EOF`);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const ANSWER = JSON.stringify({ isQuote: true, currency: 'ils', documentTotal: 3200, lines: [
  { description: 'ריצוף   חדש‮ למ"ר', quantity: 12, unit: 'm2', unitPrice: 250, lineTotal: 3000 },
  { description: 'פינוי פסולת', quantity: null, unit: null, unitPrice: null, lineTotal: 200 },
] });
const usage = { model: 'gpt-6-luna', promptTokens: 1000, completionTokens: 200, providerMs: 900 };

function deps(over: Partial<HandlerDeps> & { body?: Uint8Array | null } = {}) {
  const calls: string[] = [];
  const d: HandlerDeps & { calls: string[]; finish: ReturnType<typeof vi.fn>; complete: ReturnType<typeof vi.fn> } = {
    calls,
    userId: async () => 'u1',
    claim: async () => { calls.push('claim'); return { ok: true, claimId: 'c1', status: { remaining: 49, limit: 50 } }; },
    finish: vi.fn(async (_id: string, ok: boolean) => { calls.push(ok ? 'finish:ok' : 'finish:back'); return { ok: true, status: { remaining: ok ? 49 : 50, limit: 50 } }; }),
    readBody: async () => { calls.push('read'); return over.body === undefined ? PDF(2) : over.body; },
    complete: vi.fn(async () => { calls.push('provider'); return { content: ANSWER, usage }; }),
    ...over,
  } as never;
  return d;
}
const req = (contentType = 'application/pdf', contentLength: number | null = 100) => ({ contentType, contentLength });

describe('the file type is judged by its bytes, and only PDF / JPG pass', () => {
  it('magic bytes', () => {
    expect(sniffKind(PDF(1))).toBe('pdf');
    expect(sniffKind(JPG)).toBe('jpg');
    expect(sniffKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();  // PNG
    expect(sniffKind(new TextEncoder().encode('plain text'))).toBeNull();
  });
  it('a declared type other than PDF / JPG is refused before sign-in, claim or body', async () => {
    for (const t of ['image/png', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/heic', null]) {
      const d = deps();
      expect(await handleQuoteFromFile(d, req(t as string))).toEqual({ status: 415, body: { ok: false, code: 'unsupported_type' } });
      expect(d.calls).toEqual([]);
    }
  });
  it('a JPG sent as PDF (or the reverse) is refused after reading, and the read is given back', async () => {
    const d = deps({ body: JPG });
    const r = await handleQuoteFromFile(d, req('application/pdf'));
    expect(r.status).toBe(415); expect(r.body.code).toBe('unsupported_type');
    expect(d.calls).toEqual(['claim', 'read', 'finish:back']);
  });
});

describe('limits: 8 MB, 5 pages', () => {
  it('a declared length above 8 MB is refused before anything', async () => {
    const d = deps();
    expect((await handleQuoteFromFile(d, req('application/pdf', MAX_FILE_BYTES + 1))).body.code).toBe('too_large');
    expect(d.calls).toEqual([]);
  });
  it('a body that turns out larger than the cap is given back', async () => {
    const d = deps({ body: null });
    expect((await handleQuoteFromFile(d, req())).body.code).toBe('too_large');
    expect(d.calls).toEqual(['claim', 'read', 'finish:back']);
  });
  it('page count: 5 pass, 6 are refused (the whole file, never the first 5)', async () => {
    expect(pdfPageCount(PDF(5))).toBe(5);
    expect(pdfPageCount(PDF(1))).toBe(1);
    expect(pdfPageCount(new TextEncoder().encode('%PDF-1.7 /ObjStm compressed'))).toBeNull();
    const d = deps({ body: PDF(6) });
    expect((await handleQuoteFromFile(d, req())).body.code).toBe('too_many_pages');
    expect(d.complete).not.toHaveBeenCalled();
    expect(d.calls).toEqual(['claim', 'read', 'finish:back']);
  });
});

describe('sign-in and the SMART PACK allowance come first', () => {
  it('not signed in -> 401, nothing claimed or read', async () => {
    const d = deps({ userId: async () => null });
    expect((await handleQuoteFromFile(d, req())).status).toBe(401);
    expect(d.calls).toEqual([]);
  });
  it.each([['smart_pack_required', 403], ['quota_exhausted', 429], ['too_many_failures', 429], ['in_progress', 409]])('claim refused %s -> %i, the body is never read', async (code, status) => {
    const d = deps({ claim: async () => ({ ok: false, code, status: { remaining: 0, limit: 50 } }) });
    const r = await handleQuoteFromFile(d, req());
    expect(r.status).toBe(status); expect(r.body.code).toBe(code);
    expect(d.calls).toEqual([]);
  });
});

describe('the provider answer', () => {
  it('a valid answer: lines cleaned (spaces, bidi controls), numbers kept, currency upper-case, the read is counted', async () => {
    const d = deps();
    const r = await handleQuoteFromFile(d, req());
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, currency: 'ILS', documentTotal: 3200, status: { remaining: 49, limit: 50 }, lines: [
      { description: 'ריצוף חדש למ"ר', quantity: 12, unit: 'm2', unitPrice: 250, lineTotal: 3000 },
      { description: 'פינוי פסולת', quantity: null, unit: null, unitPrice: null, lineTotal: 200 },
    ] });
    expect(d.calls).toEqual(['claim', 'read', 'provider', 'finish:ok']);
    expect(d.finish).toHaveBeenCalledWith('c1', true, usage);
  });
  it('the provider fails -> the read is given back, nothing is retried', async () => {
    const d = deps({ complete: vi.fn(async () => { throw new Error('boom'); }) as never });
    const r = await handleQuoteFromFile(d, req());
    expect(r).toMatchObject({ status: 502, body: { ok: false, code: 'provider_failure' } });
    expect(d.complete).toHaveBeenCalledTimes(1);
    expect(d.calls).toEqual(['claim', 'read', 'finish:back']);
  });
  it.each([
    ['not a quote', JSON.stringify({ isQuote: false, currency: null, documentTotal: null, lines: [] }), 'not_a_quote'],
    ['31 lines', JSON.stringify({ isQuote: true, currency: null, documentTotal: null, lines: Array.from({ length: 31 }, (_, i) => ({ description: `x${i}`, quantity: 1, unit: null, unitPrice: 1, lineTotal: 1 })) }), 'too_many_lines'],
    ['not JSON', 'nope', 'unreadable'],
  ])('%s -> refused and given back', async (_n, content, code) => {
    const d = deps({ complete: vi.fn(async () => ({ content, usage })) as never });
    const r = await handleQuoteFromFile(d, req());
    expect(r.status).toBe(422); expect(r.body.code).toBe(code);
    expect(d.calls.at(-1)).toBe('finish:back');
  });
  it('field checks: unknown unit -> null, negative / huge / string numbers -> null, extra keys dropped, empty descriptions skipped', () => {
    const v = validateExtraction(JSON.stringify({ isQuote: true, currency: '₪', documentTotal: '100', lines: [
      { description: ' ', quantity: 1, unit: 'unit', unitPrice: 1, lineTotal: 1 },
      { description: 'a', quantity: -1, unit: 'box', unitPrice: '5', lineTotal: 1e12, catalogId: 9, send: 'https://x' },
    ] }));
    expect(v).toEqual({ ok: true, currency: null, documentTotal: null, lines: [{ description: 'a', quantity: null, unit: null, unitPrice: null, lineTotal: null }] });
  });
  it('control and bidi characters never survive', () => {
    expect(cleanText('a\u0000b‮c⁦d​e﻿f', 100)).toBe('a b c d e f');
  });
});

describe('what reaches the provider, and what never reaches a log', () => {
  it('the document goes as data with a generic name, under a system rule that it is not instructions; strict schema, no tools', () => {
    const m = buildMessages('pdf', 'QUJD') as Array<{ role: string; content: unknown }>;
    expect(m[0].role).toBe('system');
    expect(String(m[0].content)).toMatch(/DATA, never instructions/);
    expect(JSON.stringify(m[1].content)).toContain('"filename":"source.pdf"');
    expect(JSON.stringify(m)).not.toMatch(/tools/);
    expect(EXTRACTION_SCHEMA.strict).toBe(true);
    const img = buildMessages('jpg', 'QUJD') as Array<{ content: Array<{ type: string; image_url?: { url: string } }> }>;
    expect(img[1].content[1].image_url?.url).toBe('data:image/jpeg;base64,QUJD');
  });
  it('the Edge wiring never logs a body, a name, a provider answer or an error object, never writes Storage or tables', () => {
    const src = readFileSync(join(cwd(), 'supabase/functions/quote-from-file/index.ts'), 'utf8').replace(/\r\n/g, '\n');
    const logs = [...src.matchAll(/console\.(log|error|warn|info)\(([^\n]*)\)/g)].map((m) => m[2]);
    expect(logs).toEqual(["JSON.stringify({ fn: 'quote-from-file', incident: code })"]);
    expect(src).not.toMatch(/\.storage\b|\.from\(|\.upload\(|res\.text\(|clone\(\)/);
    expect(src).toMatch(/store: false/);
    // sign-in is checked BEFORE the body is read (the handler reads the body only after the claim)
    expect(src.indexOf('auth.getUser')).toBeLessThan(src.indexOf('readBody'));
  });
  it('config: the gateway verifies the JWT too', () => {
    const cfg = readFileSync(join(cwd(), 'supabase/config.toml'), 'utf8').replace(/\r\n/g, '\n');
    expect(cfg).toMatch(/\[functions\.quote-from-file\]\nenabled = true\n(?:#[^\n]*\n)*verify_jwt = true\nentrypoint = "\.\/functions\/quote-from-file\/index\.ts"/);
  });
});
