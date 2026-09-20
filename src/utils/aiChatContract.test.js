import { describe, it, expect } from 'vitest';
import { CHAT_CONTRACT_VERSION, ANSWER_SOURCES, DIRECT_FACT_KINDS } from './aiChatContract';
import {
  CHAT_CONTRACT_VERSION as EDGE_CHAT_CONTRACT_VERSION,
  ANSWER_SOURCES as EDGE_ANSWER_SOURCES,
  DIRECT_FACT_KINDS as EDGE_DIRECT_FACT_KINDS,
} from '../../supabase/functions/_shared/aiChatContract.ts';

describe('aiChatContract frontend/Edge parity (§19: FRONTEND/EDGE INTENT ID DRIFT: ZERO)', () => {
  it('CHAT_CONTRACT_VERSION matches the Edge Function contract exactly', () => {
    expect(CHAT_CONTRACT_VERSION).toBe(EDGE_CHAT_CONTRACT_VERSION);
    expect(CHAT_CONTRACT_VERSION).toBe(3);
  });

  it('ANSWER_SOURCES matches the Edge Function contract exactly', () => {
    expect(ANSWER_SOURCES).toEqual([...EDGE_ANSWER_SOURCES]);
  });

  it('DIRECT_FACT_KINDS matches the Edge Function contract exactly', () => {
    expect(DIRECT_FACT_KINDS).toEqual([...EDGE_DIRECT_FACT_KINDS]);
  });
});
