// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-15 ואת תוכנית החזרה בכל המסכים" - the visible Back of every screen that was opened
// from another screen: "Back to <that screen>", the same single step as the phone / browser Back (useInAppBack).
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { backLabel } from '../utils/navLabels';

export default function NavBackBar({ previous, onBack, isHebrew }) {
  if (!previous) return null;
  const Arrow = isHebrew ? ArrowRight : ArrowLeft;
  return (
    // PRODUCT_TRUTH_DECORATIVE: returns to the screen the user came from (the same step as the system Back); no data changes
    <button type="button" className="dash-nav-back no-print" data-testid="nav-back" onClick={onBack}>
      <Arrow size={16} strokeWidth={2.2} aria-hidden="true" />
      <span>{backLabel(previous, isHebrew)}</span>
    </button>
  );
}
