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
      hint: isHebrew ? 'חדרים, יחידות ומדידות לפי המקצוע שלך' : 'Rooms, units and measurements for your trade',
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
