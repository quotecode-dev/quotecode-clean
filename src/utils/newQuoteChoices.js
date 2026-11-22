import { FileText, FileUp, LayoutTemplate, Sparkles } from 'lucide-react';

// The plain-language ways to start a quote (labels + one-line hints, HE/EN).
// Owner console 2026-11-08 (design A, typed: "מאשר חלופה א׳ - שורות ישירות, כפתור אחד "הצעת מחיר" ..." + stage 2 incl. L-09 / L-23): the
// regular quote and the measured quote are ONE entry - "הצעת מחיר"; every row chooses its own billing (fixed, units, area, length). An old
// internal call to the measured entry still opens the same editor.
// Owner console 2026-11-11 (unified quote, typed incl. item 11 "תפריט הצעה חדשה"): the start window "איך תרצו להתחיל?" - four ways that
// say HOW the quote starts (not what kind of quote it is); every way can hold apartments, measurements and files.
export const START_SENTENCE = { he: 'אפשר הצעה קצרה או כמה דירות, עם עבודות, מידות וקבצים. הכול ניתן לשינוי בהמשך.', en: 'Create a short quote or cover several apartments, with work, measurements and files. You can change everything later.' };
export function newQuoteChoices(isHebrew) {
  return [
    {
      id: 'standard',
      Icon: FileText,
      label: isHebrew ? 'ממלאים בעצמכם' : 'Fill it in yourselves',
      hint: isHebrew ? 'עבודות, כמויות ומידות - בקצב שלכם' : 'Work, quantities and measurements at your own pace',
    },
    {
      id: 'ai',
      Icon: Sparkles,
      label: isHebrew ? 'מתארים ל-AI' : 'Describe it to AI',
      hint: isHebrew ? 'תיאור העבודה הופך לטיוטה לבדיקה' : 'Turn a description of the work into a draft to review',
    },
  ];
}

// Owner console 2026-11-03 (typed approval incl. L-23): "quote from a file" (SMART PACK) - shown right after the AI smart quote
// wherever the caller offers it (Owner: "אפשרות חמישית ... אחרי ההצעה החכמה").
export function fileChoice(isHebrew) {
  return {
    id: 'file',
    Icon: FileUp,
    label: isHebrew ? 'מעלים קובץ' : 'Upload a file',
    hint: isHebrew ? 'מתחילים מ-PDF או JPG ומזינים את המחירים שלכם' : 'Start from a PDF or JPG and enter your own prices',
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
    hint: isHebrew ? 'משתמשים שוב בעבודות ובטקסטים ששמרתם' : 'Reuse the work and texts you saved',
  };
}
