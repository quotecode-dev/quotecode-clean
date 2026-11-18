// Leads stage 1 (Owner 18/11; IRON-ICON-001 / law 45): the lead icon - a message bubble with an incoming arrow, in the TEKANGO series -
// approved with the demo (decision 10 "א: מאושר כמו בהדגמה"), and the four contact-entry icons of the approved demo, drawn exactly as there.
export function LeadIcon({ size = 18, accent = '#0F6672' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" data-icon="tekango-lead">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16.1A2.5 2.5 0 0 1 4 13.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 10h7.5M12.5 6.8 15.7 10l-3.2 3.2" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LeadEntryIcon({ kind }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': 'true' };
  if (kind === 'call') return <svg {...common} strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;
  if (kind === 'meet') return <svg {...common} strokeLinecap="round"><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0" /></svg>;
  if (kind === 'msg') return <svg {...common} strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg>;
  return <svg {...common} strokeLinecap="round"><path d="M5 4h14v16H5zM8 9h8M8 13h8M8 17h5" /></svg>;
}

export function LeadBackIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="ld-back-ic"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
