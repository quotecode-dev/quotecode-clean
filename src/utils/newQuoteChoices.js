import { FileText, FileUp, LayoutTemplate, Sparkles } from 'lucide-react';

// The plain-language ways to start a quote (labels + one-line hints, HE/EN).
// Owner console 2026-11-08 (design A, typed: "מאשר חלופה א׳ - שורות ישירות, כפתור אחד "הצעת מחיר" ..." + stage 2 incl. L-09 / L-23): the
// regular quote and the measured quote are ONE entry - "הצעת מחיר"; every row chooses its own billing (fixed, units, area, length). An old
// internal call to the measured entry still opens the same editor.
export function newQuoteChoices(isHebrew) {
  return [
    {
      id: 'standard',
      Icon: FileText,
      label: isHebrew ? 'הצעת מחיר' : 'Quote',
      hint: isHebrew ? 'שורות של מוצרים ועבודות - בכמות, לפי מידות או בסכום קבוע' : 'Rows of products and work - by quantity, by size or a fixed amount',
    },
    {
      id: 'ai',
      Icon: Sparkles,
      label: isHebrew ? 'הצעת מחיר חכמה עם AI' : 'AI smart quote',
      hint: isHebrew ? 'מתארים את העבודה וה-AI עוזר לנסח' : 'Describe the job and let AI help draft it',
    },
  ];
}

// Owner console 2026-11-03 (typed approval incl. L-23): "quote from a file" (SMART PACK) - shown right after the AI smart quote
// wherever the caller offers it (Owner: "אפשרות חמישית ... אחרי ההצעה החכמה").
export function fileChoice(isHebrew) {
  return {
    id: 'file',
    Icon: FileUp,
    label: isHebrew ? 'הצעת מחיר מקובץ' : 'Quote from a file',
    hint: isHebrew ? 'מעלים הצעה ב-PDF או JPG וקובעים את המחירים שלכם' : 'Upload a quote (PDF or JPG) and set your own prices',
  };
}

// The menu order (Owner 2026-11-03; the measured entry joined the quote 2026-11-08): quote, AI, from a file (when offered), template (when offered).
export function menuChoices(isHebrew, { file = false, template = false } = {}) {
  const [standard, ai, ...rest] = newQuoteChoices(isHebrew);
  return [standard, ai, ...(file ? [fileChoice(isHebrew)] : []), ...rest, ...(template ? [templateChoice(isHebrew)] : [])];
}

// Task 27 (spec §6): the optional fourth way - start from a saved whole-quote template (shown only where the caller offers it).
export function templateChoice(isHebrew) {
  return {
    id: 'template',
    Icon: LayoutTemplate,
    label: isHebrew ? 'מתבנית שמורה' : 'From a saved template',
    hint: isHebrew ? 'פריטים, מחירים וטקסטים מתבנית ששמרתם' : 'Items, prices and texts from a template you saved',
  };
}
