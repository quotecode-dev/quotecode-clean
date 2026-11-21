// The simple-quotes sketch's line icons (Owner console 2026-11-20 / 2026-11-21: the sketch is the approved demo; the three TEKANGO icons the
// Owner chose stay - the Customer Twin two heads, the TEKANGO eye, the TEKANGO AI mark - and every other icon is the sketch's). One 24px
// grid, 2px round stroke, the same paths as the sketch file. Decorative only (aria-hidden); the control keeps its own name.
const PATHS = {
  pen: <path d="M17 3l4 4L8 20H4v-4z" />,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  clip: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></>,
  up: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  down: <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  plusCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  tmpl: <><rect x="3" y="3" width="18" height="7" rx="1" /><rect x="3" y="14" width="8" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  back: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
};

export function SketchIcon({ name, size = 17, style, className }) {
  if (name === 'dots') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={style} className={className}>
        <circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" style={style} className={className}>
      {PATHS[name]}
    </svg>
  );
}
