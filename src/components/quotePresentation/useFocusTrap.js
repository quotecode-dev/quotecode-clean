// Task 16 - keeps Tab / Shift+Tab inside an open modal surface (dialogs, the preview sheet).
import { useEffect } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableWithin(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getAttribute('aria-hidden') !== 'true');
}

export default function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const root = ref.current;
      if (!root) return;
      // a dialog stacked above this surface owns the trap
      if (!root.contains(document.activeElement) && document.activeElement && document.activeElement.closest('.qp-backdrop') && !root.closest('.qp-backdrop')) return;
      const list = focusableWithin(root);
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ref, active]);
}
