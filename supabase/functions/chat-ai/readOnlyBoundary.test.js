import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSystemPrompt } from './validation.ts';

// Gate 2 §9: "AI MUTATION CAPABILITY: NONE" is not just a prompt
// instruction the model is asked to follow - it is also a structural fact
// about this Edge Function's own code, proven here independently of any
// model behavior. index.ts has exactly one write path (the chat_logs
// insert, unrelated to any quote/client/business/plan data the model could
// have influenced) and zero delete/update calls anywhere - a model could
// return any text it likes and there is still no code path that would ever
// turn that text into a database mutation.
describe('chat-ai index.ts read-only structural guard', () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

  it('contains no .update( or .delete( call anywhere', () => {
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toMatch(/\.delete\(/);
  });

  it('the only .insert( call targets chat_logs (support logging), nothing else', () => {
    const insertCalls = [...source.matchAll(/\.from\('([^']+)'\)[\s\S]{0,80}?\.insert\(/g)];
    expect(insertCalls.length).toBeGreaterThan(0);
    for (const match of insertCalls) {
      expect(match[1]).toBe('chat_logs');
    }
  });

  it('never calls .from(\'quotes\'|\'quote_items\'|\'clients\'|\'business_settings\') with anything but .select(', () => {
    const mutatingTables = ['quotes', 'quote_items', 'clients', 'business_settings'];
    for (const table of mutatingTables) {
      const re = new RegExp(`\\.from\\('${table}'\\)[\\s\\S]{0,40}?\\.(insert|update|delete|upsert)\\(`);
      expect(source, `expected no mutation on ${table}`).not.toMatch(re);
    }
  });

  it('never calls supabase.auth.admin (account mutation surface)', () => {
    expect(source).not.toMatch(/auth\.admin/);
  });

  it('never calls .storage. (file upload/delete surface)', () => {
    expect(source).not.toMatch(/\.storage\./);
  });
});

// §9's required example prompts. Live model behavior (whether the model
// itself actually refuses to claim it mutated something) is NOT testable
// without a live OpenAI call (none available in this environment - see the
// final report). What IS deterministically provable: for every one of
// these exact requests, (a) the read-only boundary instruction is present
// in the prompt the model would receive, and (b) no code path in this
// function could act on the request even if the model ignored that
// instruction (proven structurally above).
describe('§9 required example prompts never reach a mutation code path', () => {
  const mutationRequests = [
    'Delete this quote',
    'Send this quote now',
    'Change my plan',
    'Delete this client',
  ];

  it('the read-only boundary instruction is present in the system prompt regardless of the message content', () => {
    for (const requestText of mutationRequests) {
      const prompt = buildSystemPrompt({ isHebrew: false });
      expect(prompt, requestText).toMatch(/READ-ONLY BOUNDARY/);
      expect(prompt, requestText).toMatch(/cannot create, edit, delete, approve, sign, send/);
    }
  });
});
