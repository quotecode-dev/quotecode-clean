// Owner 2026-10-27 ("אשמח גם אם לכל סוכן יהיה אייקון בולט עם פרצוף ציורי שאוכל גם לתת לו שם"; the Owner chose style A - "הכוונה סגנון א"):
// the agents room characters - ONE series (law 45: the same line, colors and frame; no stock art): a drawn face in the agent's color
// with its role mark in the corner (manager = star, SEO = magnifier, service = speech bubble + headset, security = shield).
import { useId } from 'react';

const INK = '#1d2b33';
// + social (Owner 2026-10-27, "מאשר את שלב 1 של סוכנת הרשתות"): the same line - a drawn face in her color, a heart in the corner
const COLORS = { manager: '#315f6f', seo: '#2f7a5c', service: '#b8682f', security: '#3b4f8f', social: '#a8466a' };

function Face({ agent }) {
  const eyes = (y = 64) => <><circle cx="50" cy={y} r="3.2" fill={INK} /><circle cx="70" cy={y} r="3.2" fill={INK} /></>;
  const cheeks = <><circle cx="44" cy="72" r="3.2" fill="#e8998a" opacity=".7" /><circle cx="76" cy="72" r="3.2" fill="#e8998a" opacity=".7" /></>;
  const smile = <path d="M51 76 Q60 83 69 76" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
  if (agent === 'manager') return (
    <>
      <path d="M20 122 Q22 96 60 96 Q98 96 100 122 Z" fill="#ffffff" />
      <rect x="53" y="84" width="14" height="14" fill="#e9b88f" />
      <circle cx="60" cy="62" r="26" fill="#f3c9a2" />
      <circle cx="60" cy="29" r="10" fill="#3a2a20" />
      <path d="M34 62 Q32 34 60 33 Q88 34 86 62 Q84 50 72 45 Q60 52 40 50 Q36 54 34 62 Z" fill="#3a2a20" />
      <path d="M34 62 Q32 74 36 84 L40 84 Q37 72 38 60 Z M86 62 Q88 74 84 84 L80 84 Q83 72 82 60 Z" fill="#3a2a20" />
      {cheeks}{eyes()}
      <circle cx="50" cy="64" r="7.5" fill="#ffffff" fillOpacity=".25" stroke={INK} strokeWidth="2" />
      <circle cx="70" cy="64" r="7.5" fill="#ffffff" fillOpacity=".25" stroke={INK} strokeWidth="2" />
      <line x1="57.5" y1="64" x2="62.5" y2="64" stroke={INK} strokeWidth="2" />
      {smile}
    </>
  );
  if (agent === 'seo') return (
    <>
      <path d="M20 122 Q22 96 60 96 Q98 96 100 122 Z" fill="#e9f5ef" />
      <rect x="53" y="84" width="14" height="14" fill="#d9a77c" />
      <circle cx="60" cy="62" r="26" fill="#eab98e" />
      <path d="M34 60 L36 42 L44 46 L48 34 L56 42 L62 32 L68 42 L76 36 L78 46 L86 44 L86 60 Q78 48 60 48 Q42 48 34 60 Z" fill="#5a3b22" />
      <path d="M45 57 Q50 53 55 56" stroke="#5a3b22" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M65 58 L75 58" stroke="#5a3b22" strokeWidth="2.5" strokeLinecap="round" />
      {eyes()}
      <path d="M51 75 Q60 85 69 75 Q60 78 51 75 Z" fill="#7a2e2e" />
    </>
  );
  if (agent === 'service') return (
    <>
      <path d="M20 122 Q22 96 60 96 Q98 96 100 122 Z" fill="#fff4ea" />
      <path d="M30 86 Q26 34 60 32 Q94 34 90 86 Z" fill="#7a4a2a" />
      <rect x="53" y="84" width="14" height="14" fill="#e9b88f" />
      <circle cx="60" cy="62" r="26" fill="#f3c9a2" />
      <path d="M36 60 Q38 38 60 38 Q82 38 84 60 Q74 46 60 50 Q46 46 36 60 Z" fill="#7a4a2a" />
      {cheeks}{eyes()}
      <path d="M51 75 Q60 83 69 75" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M32 66 Q32 30 60 30 Q88 30 88 66" stroke={INK} strokeWidth="4" fill="none" />
      <rect x="27" y="58" width="9" height="16" rx="4" fill={INK} /><rect x="84" y="58" width="9" height="16" rx="4" fill={INK} />
      <path d="M88 73 Q86 83 72 83" stroke={INK} strokeWidth="3" fill="none" /><circle cx="71" cy="83" r="3" fill={INK} />
    </>
  );
  if (agent === 'social') return (
    <>
      <path d="M20 122 Q22 96 60 96 Q98 96 100 122 Z" fill="#fbeef3" />
      <path d="M80 40 Q104 46 98 82 Q94 72 84 66 Z" fill="#2e1d14" />
      <rect x="53" y="84" width="14" height="14" fill="#c99872" />
      <circle cx="60" cy="62" r="26" fill="#ddaa80" />
      <path d="M34 60 Q34 34 60 34 Q86 34 86 60 Q78 44 62 47 Q46 43 34 60 Z" fill="#2e1d14" />
      <circle cx="35" cy="70" r="2.5" fill="#f5b942" /><circle cx="85" cy="70" r="2.5" fill="#f5b942" />
      {cheeks}{eyes()}
      <path d="M51 75 Q60 84 69 75" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  );
  return (
    <>
      <path d="M20 122 Q22 96 60 96 Q98 96 100 122 Z" fill="#eef1fb" />
      <rect x="53" y="84" width="14" height="14" fill="#c99872" />
      <circle cx="60" cy="63" r="26" fill="#ddaa80" />
      <path d="M34 54 Q36 30 60 30 Q84 30 86 54 Z" fill="#1d2b4f" />
      <path d="M30 54 L90 54 Q90 60 84 60 L36 60 Q30 60 30 54 Z" fill="#16213f" />
      <circle cx="60" cy="43" r="4.5" fill="#f5b942" />
      {eyes(67)}
      <path d="M53 78 Q60 82 67 78" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  );
}

function Mark({ agent }) {
  const c = COLORS[agent];
  const ring = <circle cx="90" cy="92" r="15" fill="#ffffff" stroke={c} strokeWidth="3" />;
  if (agent === 'manager') return <>{ring}<polygon points="90,83 92.23,88.93 98.56,89.22 93.61,93.17 95.29,99.28 90,95.8 84.71,99.28 86.39,93.17 81.44,89.22 87.77,88.93" fill="#f5b942" /></>;
  if (agent === 'seo') return <>{ring}<circle cx="88" cy="90" r="5.5" fill="none" stroke={c} strokeWidth="3" /><line x1="92" y1="94" x2="97" y2="99" stroke={c} strokeWidth="3.5" strokeLinecap="round" /></>;
  if (agent === 'service') return <>{ring}<path d="M83 85 h14 a3 3 0 0 1 3 3 v7 a3 3 0 0 1 -3 3 h-8 l-4 4 v-4 h-2 a3 3 0 0 1 -3 -3 v-7 a3 3 0 0 1 3 -3 z" fill={c} /></>;
  if (agent === 'social') return <>{ring}<path d="M90 99 C82 93 80 89 82 86 C84 83 88 84 90 87 C92 84 96 83 98 86 C100 89 98 93 90 99 Z" fill={c} /></>;
  return <>{ring}<path d="M90 82 L99 85.5 V92 Q99 99 90 103 Q81 99 81 92 V85.5 Z" fill={c} /><path d="M86 92 L89 95 L94.5 89" stroke="#ffffff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>;
}

export default function AgentAvatar({ agent, size = 56, mark = true }) {
  const clip = `agent-clip-${useId().replace(/:/g, '')}`;
  const a = COLORS[agent] ? agent : 'security';
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false" data-testid={`agent-avatar-${a}`} style={{ flex: '0 0 auto', display: 'block' }}>
      <defs><clipPath id={clip}><circle cx="60" cy="60" r="56" /></clipPath></defs>
      <circle cx="60" cy="60" r="56" fill={COLORS[a]} />
      <g clipPath={`url(#${clip})`}><Face agent={a} /></g>
      <circle cx="60" cy="60" r="56" fill="none" stroke="#ffffff" strokeWidth="3" />
      {mark && <Mark agent={a} />}
    </svg>
  );
}
