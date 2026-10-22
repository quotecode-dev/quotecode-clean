// Owner console 2026-10-23: the daily tip - a small card in the bottom end corner (left in HE, right in EN; the Dashboard's floating
// chat tab is hidden - the chat launcher lives in the header), above the mobile bottom bar on a phone. It never blocks the work: no backdrop, the page stays usable,
// it hides by itself after AUTO_HIDE_MS (a thin bar shows the time left; paused while the pointer or focus is on it). Owner: "מודרני, חד
// וברור, עם אנימציה" - a spring entrance, a brand gradient edge, a soft pulse around the mark, a smooth exit; no motion at all when the
// user asked for reduced motion. Law 45: the TEKANGO icons (the AI tile, the Customer Twin mark) and the app's own line icon for
// templates. HE / RTL and EN / LTR.
import { useEffect, useRef, useState } from 'react';
import { X, FileStack } from 'lucide-react';
import TekangoAiIcon from './TekangoAiIcon';
import CustomerTwinIcon from './CustomerTwinIcon';

export const AUTO_HIDE_MS = 20000;
const EXIT_MS = 220;
const CSS = `
.tk-tip{position:fixed;z-index:10030;inset-block-end:24px;inset-inline-end:24px;width:min(372px,calc(100vw - 32px));box-sizing:border-box;
  border-radius:18px;padding:1.5px;background:linear-gradient(135deg,#6366f1,#2563eb 45%,#22d3ee);
  box-shadow:0 22px 48px -12px rgba(30,41,99,.38),0 6px 18px rgba(37,99,235,.18);
  animation:tk-tip-in .55s cubic-bezier(.2,.9,.25,1.15) both}
.tk-tip.is-leaving{animation:tk-tip-out ${EXIT_MS}ms ease-in both}
.tk-tip-inner{position:relative;overflow:hidden;border-radius:16.5px;background:#fff;padding:14px 14px 16px;color:#334155}
.tk-tip-chip{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;letter-spacing:.01em;padding:3px 10px;border-radius:999px;
  color:#3730a3;background:linear-gradient(135deg,#eef2ff,#e0f2fe);border:1px solid #c7d2fe}
.tk-tip-mark{position:relative;flex-shrink:0;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center}
.tk-tip-mark::before{content:'';position:absolute;inset:0;border-radius:14px;background:radial-gradient(circle,rgba(99,102,241,.28),rgba(99,102,241,0) 70%);
  animation:tk-tip-pulse 2.4s ease-in-out infinite}
.tk-tip-mark > *{position:relative}
.tk-tip-text{margin:6px 0 0;font-size:.9rem;line-height:1.55;color:#1e293b;font-weight:500}
.tk-tip-btn{min-height:44px;padding:0 16px;border-radius:12px;font-weight:700;font-family:inherit;font-size:.86rem;cursor:pointer;
  transition:transform .15s ease,box-shadow .15s ease,background-color .15s ease}
.tk-tip-primary{color:#fff;border:none;background:linear-gradient(135deg,#4f46e5,#2563eb);box-shadow:0 6px 14px -4px rgba(37,99,235,.55)}
.tk-tip-primary:hover{transform:translateY(-1px);box-shadow:0 10px 18px -6px rgba(37,99,235,.6)}
.tk-tip-ghost{color:#1d4ed8;background:#fff;border:1px solid #bfdbfe}
.tk-tip-ghost:hover{background:#eff6ff}
.tk-tip-btn:focus-visible,.tk-tip-x:focus-visible,.tk-tip-off:focus-visible{outline:3px solid #6366f1;outline-offset:2px}
.tk-tip-x{flex-shrink:0;width:32px;height:32px;border:none;background:none;color:#64748b;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;border-radius:9px}
.tk-tip-x:hover{background:#f1f5f9;color:#0f172a}
.tk-tip-off{margin-inline-start:auto;min-height:44px;border:none;background:none;color:#64748b;font-size:.8rem;text-decoration:underline;cursor:pointer;font-family:inherit}
.tk-tip-bar{position:absolute;inset-inline:0;inset-block-end:0;height:3px;background:linear-gradient(90deg,#6366f1,#22d3ee);transform-origin:var(--tk-tip-origin,left);
  animation:tk-tip-time var(--tk-tip-ms) linear both}
.tk-tip:hover .tk-tip-bar,.tk-tip:focus-within .tk-tip-bar{animation-play-state:paused}
@keyframes tk-tip-in{from{opacity:0;transform:translateY(18px) scale(.94);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
@keyframes tk-tip-out{to{opacity:0;transform:translateY(12px) scale(.97)}}
@keyframes tk-tip-pulse{0%,100%{transform:scale(.9);opacity:.55}50%{transform:scale(1.18);opacity:1}}
@keyframes tk-tip-time{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (max-width:768px){.tk-tip{inset-inline:16px;width:auto;inset-block-end:calc(env(safe-area-inset-bottom,0px) + 84px)}}
@media (prefers-reduced-motion:reduce){.tk-tip,.tk-tip.is-leaving,.tk-tip-mark::before,.tk-tip-bar{animation:none}.tk-tip-btn{transition:none}}`;

export default function DailyTipCard({ tip, isHebrew, onAction, onDismiss, onTurnOff }) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef(null);
  const left = useRef(AUTO_HIDE_MS);
  const startedAt = useRef(0);
  const cb = useRef({ onDismiss, onTurnOff });
  cb.current = { onDismiss, onTurnOff };
  // a smooth exit, then the caller's own close
  const leave = (then) => { clearTimeout(timer.current); setLeaving(true); setTimeout(() => cb.current[then](), EXIT_MS); };
  const run = () => { startedAt.current = Date.now(); clearTimeout(timer.current); timer.current = setTimeout(() => leave('onDismiss'), left.current); };
  const pause = () => { clearTimeout(timer.current); left.current = Math.max(0, left.current - (Date.now() - startedAt.current)); };
  useEffect(() => { left.current = AUTO_HIDE_MS; setLeaving(false); run(); return () => clearTimeout(timer.current); }, [tip?.id]);
  if (!tip) return null;
  const c = isHebrew ? tip.he : tip.en;
  const mark = tip.icon === 'twin' ? <CustomerTwinIcon size={36} /> : tip.icon === 'template'
    ? <span style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#eef2ff,#e0f2fe)', color: '#3730a3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FileStack size={20} aria-hidden="true" /></span>
    : <TekangoAiIcon size={36} />;
  return (
    <div className={`tk-tip no-print${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="daily-tip" data-tip={tip.id}
      style={{ '--tk-tip-ms': `${AUTO_HIDE_MS}ms`, '--tk-tip-origin': isHebrew ? 'right' : 'left' }}
      onMouseEnter={pause} onMouseLeave={run} onFocus={pause} onBlur={run}>
      <style>{CSS}</style>
      <div className="tk-tip-inner">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span className="tk-tip-mark">{mark}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="tk-tip-chip">{isHebrew ? 'הידעתם?' : 'Did you know?'}</span>
            <p className="tk-tip-text">{c.text}</p>
          </div>
          {/* PRODUCT_TRUTH_DECORATIVE: closes today's tip (it counts as seen); changes no data */}
          <button type="button" className="tk-tip-x" onClick={() => leave('onDismiss')} aria-label={isHebrew ? 'סגירה' : 'Close'} data-testid="daily-tip-close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
          {/* PRODUCT_TRUTH_DECORATIVE: opens the capability the tip names (the same action as its own menu / button); changes no data */}
          <button type="button" className="tk-tip-btn tk-tip-primary" onClick={() => { clearTimeout(timer.current); onAction(); }} data-testid="daily-tip-action">{c.action}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: closes today's tip (it counts as seen); changes no data */}
          <button type="button" className="tk-tip-btn tk-tip-ghost" onClick={() => leave('onDismiss')} data-testid="daily-tip-ok">{isHebrew ? 'הבנתי' : 'Got it'}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: turns the daily tips off in this browser; changes no data */}
          <button type="button" className="tk-tip-off" onClick={() => leave('onTurnOff')} data-testid="daily-tip-off">{isHebrew ? 'לא להציג טיפים' : 'No more tips'}</button>
        </div>
        <span className="tk-tip-bar" aria-hidden="true" />
      </div>
    </div>
  );
}
