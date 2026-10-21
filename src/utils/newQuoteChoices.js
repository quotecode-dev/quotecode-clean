import { FileText, LayoutTemplate, Ruler, Sparkles } from 'lucide-react';

// The three plain-language ways to start a quote (labels + one-line hints, HE/EN).
export function newQuoteChoices(isHebrew) {
  return [
    {
      id: 'standard',
      Icon: FileText,
      label: isHebrew ? 'הצעת מחיר רגילה' : 'Standard quote',
      hint: isHebrew ? 'מתחילים מטופס ריק ומוסיפים פריטים' : 'Start from a blank quote and add items',
    },
    {
      id: 'ai',
      Icon: Sparkles,
      label: isHebrew ? 'הצעת מחיר חכמה עם AI' : 'AI smart quote',
      hint: isHebrew ? 'מתארים את העבודה וה-AI עוזר לנסח' : 'Describe the job and let AI help draft it',
    },
    {
      id: 'structured',
      Icon: Ruler,
      label: isHebrew ? 'הצעה מדודה לפי מקצוע' : 'Profession-aware measured quote',
      // Owner 2026-10-18 ("להחזיר את כל מה ששונה ללא אישור שלי") #13: round 1 (L-09) opens a measured quote as a simple list - the hint no longer promises rooms
      // + Owner console 2026-10-18 ("אפילו ילד בן 10 יוכל להכין הצעה" -> "א"): the plainest wording
      hint: isHebrew ? 'מכניסים מידות, והמחיר מחושב לבד' : 'Enter the measurements - the price is calculated for you',
    },
  ];
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
