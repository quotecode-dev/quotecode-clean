// Smart support email, stage 2 - the two model calls (spec sections 9.3 and 10): sorting (cheap model, JSON) and the GREEN draft
// (cheap model, plain text). Runtime-independent: the fetch is injected, so vitest drives it with a fake provider.
//  - The draft knows only the product facts the public chat knows (chat-ai buildSystemPrompt with no account): no account data is
//    ever put in an email (spec 3.2 / 3.3 - a reply can never leak another account), prices come only from the facts (3.4).
//  - The email is data between markers; only its newest part is sent (quoted history is cut, spec 10).
//  - Anything that goes wrong returns null: the caller then treats the email as RED (the Owner decides), never as an empty answer.
import { buildSystemPrompt } from '../chat-ai/validation.ts';
import { buildNoInventionBlock, removeInventedOffers } from '../chat-ai/noInvention.ts';
import { CHEAP_MODEL, LEGACY_CHEAP_MODEL } from '../chat-ai/chatTools.ts';
import { buildTriageInstructions, newestPart, parseModelTriage, type Triage } from './triage.ts';
import { signature, type Lang } from './templates.ts';

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
export type ModelDeps = { fetch: FetchLike; apiKey: string; timeoutMs?: number };

const emailBlock = (subject: string | null, text: string | null) =>
  `BEGIN EMAIL\nSubject: ${String(subject || '').slice(0, 300)}\n\n${newestPart(text)}\nEND EMAIL`;

async function chat(deps: ModelDeps, system: string, user: string, maxTokens: number, json: boolean): Promise<string | null> {
  for (const model of [CHEAP_MODEL, LEGACY_CHEAP_MODEL]) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), deps.timeoutMs ?? 25000);
    try {
      const legacy = model === LEGACY_CHEAP_MODEL;
      const res = await deps.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${deps.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          ...(legacy ? { max_tokens: maxTokens, temperature: 0.2 } : { max_completion_tokens: maxTokens, reasoning_effort: 'none' }),
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: abort.signal,
      });
      if (!res.ok) continue;
      // deno-lint-ignore no-explicit-any
      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content.trim();
    } catch {
      // try the next model
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** The model's bin for an email the fixed list did not decide. null provider answer -> RED (never a guess). */
export async function modelTriage(deps: ModelDeps, subject: string | null, text: string | null): Promise<Triage> {
  if (!deps.apiKey) return { bin: 'red', reason: 'model_not_configured', summary: null, kind: null };
  const raw = await chat(deps, buildTriageInstructions(), emailBlock(subject, text), 200, true);
  if (raw === null) return { bin: 'red', reason: 'model_unavailable', summary: null, kind: null };
  return parseModelTriage(raw);
}

const DRAFT_LIMIT = 2500;

/** The GREEN draft: an answer from the product facts only, in the sender's language, signed with the fixed signature. */
export async function draftReply(deps: ModelDeps, subject: string | null, text: string | null, lang: Lang): Promise<string | null> {
  if (!deps.apiKey) return null;
  const isHebrew = lang === 'he';
  const system = buildSystemPrompt({ isHebrew }) + buildNoInventionBlock(isHebrew, false) + `

EMAIL REPLY MODE (this answer is sent as an email from TEKANGO support):
- Write only the body of a short, friendly email reply in ${isHebrew ? 'Hebrew' : 'English'}: start with "${isHebrew ? 'שלום,' : 'Hello,'}" and do NOT add a signature (it is added for you).
- Plain text only: no markdown, no bullet symbols other than "-", no links other than www.tekango.com.
- You do NOT know who the sender is and you have NO access to any account: never state anything about the sender's own account, quotes, plan or payments. If the answer depends on their account, explain where in TEKANGO they can see it themselves.
- You ARE the TEKANGO support team answering by email: never tell the sender to write to the support address.
- Never promise money, a discount, a refund, a date or a change. Never invent a feature, a price or a step.
- If the email cannot be answered from the facts above, answer exactly: CANNOT_ANSWER`;
  const raw = await chat(deps, system, emailBlock(subject, text), 600, false);
  if (!raw || /CANNOT_ANSWER/.test(raw)) return null;
  const cleaned = removeInventedOffers(raw.replace(/\r/g, ''), { screenshots: false }).trim();
  if (cleaned.length < 10) return null;
  return `${cleaned.slice(0, DRAFT_LIMIT)}\n\n${signature(lang)}`;
}
