/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// voice-ai (Owner console 2026-10-19, task-control activeTask.voiceChat20261019, plan docs/VOICE_ASSISTANT_PLAN_2026-10-19.md):
// the smart chat's microphone and spoken answers. Two operations, signed-in users only:
//  - transcribe: a short recording (<= 60 s from the browser) -> text. The text is then sent by the browser as an ordinary chat-ai
//    question, so every chat gate (truth answers, money / plan gates, the daily 30) applies unchanged.
//  - speak: an answer text (<= 1,500 characters) -> speech (mp3, base64 in JSON).
//  - Identity: the gateway verifies the JWT (verify_jwt = true) and the code verifies it again with auth.getUser.
//  - Language (IRON-AI-003): from business_settings.country only (Local -> Hebrew, International -> English), never from the body.
//  - Cost: every operation claims one of the day's 60 (voice_ai_claim_operation, the caller's own JWT); over the cap -> 429.
//  - Nothing is stored: no audio, no transcript, no log row. The provider sees only the recording / the answer text.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const VOICE_CONTRACT_VERSION = 1;
export const TRANSCRIBE_MODEL = 'gpt-transcribe';
export const TRANSCRIBE_FALLBACK_MODEL = 'whisper-1';
export const SPEECH_MODEL = 'gpt-4o-mini-tts';
export const SPEECH_FALLBACK_MODEL = 'tts-1';
export const MAX_AUDIO_BASE64 = 2_000_000; // ~1.5 MB of compressed audio, comfortably more than 60 s of browser opus / aac
export const MAX_SPEAK_CHARS = 1500;
const AUDIO_TYPES: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a' };
const PROVIDER_TIMEOUT_MS = 25000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ contractVersion: VOICE_CONTRACT_VERSION, ...body }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Markdown / list marks are read aloud badly - the spoken text keeps the words only. */
export function speakableText(text: string): string {
  return String(text || '')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, MAX_SPEAK_CHARS);
}

function baseMime(mime: unknown): string {
  return String(mime || '').toLowerCase().split(';')[0].trim();
}

function decodeBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}

function encodeBase64(bytes: Uint8Array): string {
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

async function providerFetch(url: string, init: RequestInit): Promise<Response | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROVIDER_TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: abort.signal }); } catch { return null; } finally { clearTimeout(timer); }
}

async function transcribe(audio: Uint8Array, mime: string, language: 'he' | 'en'): Promise<string | null> {
  const ext = AUDIO_TYPES[mime];
  for (const model of [TRANSCRIBE_MODEL, TRANSCRIBE_FALLBACK_MODEL]) {
    const form = new FormData();
    form.append('file', new Blob([audio], { type: mime }), `voice.${ext}`);
    form.append('model', model);
    form.append('language', language);
    form.append('response_format', 'json');
    const res = await providerFetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` }, body: form,
    });
    if (!res || !res.ok) continue;
    const data = await res.json().catch(() => null) as { text?: unknown } | null;
    if (data && typeof data.text === 'string') return data.text.trim();
  }
  return null;
}

async function speak(text: string, isHebrew: boolean): Promise<Uint8Array | null> {
  const attempts = [
    { model: SPEECH_MODEL, voice: 'marin', instructions: isHebrew ? 'Speak natural, clear Israeli Hebrew in a warm, friendly, professional tone.' : 'Speak clearly in a warm, friendly, professional tone.' },
    { model: SPEECH_FALLBACK_MODEL, voice: 'alloy' },
  ];
  for (const a of attempts) {
    const res = await providerFetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...a, input: text, response_format: 'mp3' }),
    });
    if (!res || !res.ok) continue;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length) return buf;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ ok: false, code: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ ok: false, code: 'invalid_request' }, 400); }
  const mode = body?.mode;
  if (mode !== 'transcribe' && mode !== 'speak') return reply({ ok: false, code: 'invalid_request' }, 400);

  // validate the payload before any identity / provider work
  let audio: Uint8Array | null = null;
  let mime = '';
  let text = '';
  if (mode === 'transcribe') {
    mime = baseMime(body.mime);
    if (!AUDIO_TYPES[mime] || typeof body.audio !== 'string' || !body.audio || body.audio.length > MAX_AUDIO_BASE64) return reply({ ok: false, code: 'invalid_audio' }, 400);
    audio = decodeBase64(body.audio);
    if (!audio || audio.length < 200) return reply({ ok: false, code: 'invalid_audio' }, 400);
  } else {
    text = speakableText(typeof body.text === 'string' ? body.text : '');
    if (!text) return reply({ ok: false, code: 'invalid_request' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply({ ok: false, code: 'unauthenticated' }, 401);
  const caller = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  let userId: string | null = null;
  try { const { data } = await caller.auth.getUser(); userId = data?.user?.id ?? null; } catch { userId = null; }
  if (!userId) return reply({ ok: false, code: 'unauthenticated' }, 401);

  const { data: settings, error: settingsError } = await caller.from('business_settings').select('country').eq('user_id', userId).maybeSingle();
  if (settingsError) return reply({ ok: false, code: 'server_error' }, 500);
  const country = (settings as { country?: string } | null)?.country;
  if (country !== 'Local' && country !== 'International') return reply({ ok: false, code: 'market_unresolved' }, 409);
  const isHebrew = country === 'Local';

  const { data: claim, error: claimError } = await caller.rpc('voice_ai_claim_operation');
  if (claimError) return reply({ ok: false, code: 'server_error' }, 500);
  if ((claim as { allowed?: boolean } | null)?.allowed === false) return reply({ ok: false, code: 'daily_limit', limit: (claim as { limit?: number }).limit ?? 60 }, 429);

  if (mode === 'transcribe') {
    const transcript = await transcribe(audio as Uint8Array, mime, isHebrew ? 'he' : 'en');
    if (transcript === null) return reply({ ok: false, code: 'provider_failure' }, 502);
    return reply({ ok: true, text: transcript });
  }
  const speech = await speak(text, isHebrew);
  if (!speech) return reply({ ok: false, code: 'provider_failure' }, 502);
  return reply({ ok: true, audio: encodeBase64(speech), mime: 'audio/mpeg' });
});
