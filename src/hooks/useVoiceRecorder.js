// Owner console 2026-10-19 (voice assistant, docs/VOICE_ASSISTANT_PLAN_2026-10-19.md; "שזה ייושם גם בהצעת AI החכמה"): one recording
// helper for dictation outside the chat - tap to record (up to MAX_RECORD_SECONDS), tap again to stop; the recording goes to the
// injected `transcribe(blob)` (the voice-ai function) and the text comes back through onText. Nothing is stored.
import { useEffect, useRef, useState } from 'react';
import { MAX_RECORD_SECONDS, pickRecorderMime, voiceSupported } from '../utils/voiceAssistant';

export default function useVoiceRecorder({ transcribe, onText }) {
  const [supported] = useState(() => typeof transcribe === 'function' && voiceSupported());
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // 'mic_denied' | 'failed' | 'limit' | 'smart_pack'
  const recRef = useRef(null);
  const timerRef = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; });
  useEffect(() => () => {
    clearInterval(timerRef.current);
    try { if (recRef.current?.state === 'recording') recRef.current.stop(); } catch { /* gone */ }
  }, []);

  const start = async () => {
    if (!supported || recording || busy) return;
    setError(null);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setError('mic_denied'); return; }
    const mimeType = pickRecorderMime();
    let rec;
    try { rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); } catch { stream.getTracks().forEach((t) => t.stop()); setError('failed'); return; }
    const chunks = [];
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
      setRecording(false);
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' });
      if (blob.size < 200) return;
      setBusy(true);
      try {
        const r = await transcribe(blob);
        if (r?.ok && String(r.text || '').trim()) onTextRef.current?.(String(r.text).trim());
        else setError(r?.code === 'limit' || r?.code === 'smart_pack' ? r.code : 'failed');
      } catch { setError('failed'); } finally { setBusy(false); }
    };
    recRef.current = rec;
    rec.start();
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SECONDS) { try { rec.stop(); } catch { /* already stopped */ } }
        return s + 1;
      });
    }, 1000);
  };
  const stop = () => { try { recRef.current?.stop(); } catch { /* already stopped */ } };
  return { supported, recording, seconds, busy, error, toggle: recording ? stop : start };
}
