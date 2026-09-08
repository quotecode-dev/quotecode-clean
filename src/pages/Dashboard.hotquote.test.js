import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Owner requirement (Hot Quote Fixed Geometry / No Layout Shift task): the
// Hot Quote alert's rotating message must never drive the Dashboard header's
// height. Mounting the full Dashboard component here would require heavy
// Supabase/auth/routing mocks disproportionate to what this invariant needs
// (see PROFLOW_PROJECT_CONTEXT.md for the full-browser geometry verification
// this test complements, not replaces).
//
// חוק ברזל (Authenticated UI Coherence task, Dashboard Header Compression):
// Hot Quote עבר מכרטיס-KPI דו-שורתי (minHeight:52px + WebkitLineClamp:2,
// שהיה מנגנון-היציבות המקורי כאן) להתראה דקה חד-שורתית (~44px). מנגנון-
// היציבות עצמו השתנה בהתאם - שורה בודדת עם overflow:hidden+whiteSpace:
// nowrap+textOverflow:ellipsis יש לה אפס שונות-גובה מעצם המבנה (טקסט ארוך
// נחתך תמיד לאותו רוחב-שורה, לעולם לא "שובר שורה" ומרחיב את הגובה) - זו
// גרסה פשוטה/חזקה יותר של אותו עיקרון בדיוק ("רוטציה בין שמות-לקוח
// באורכים משתנים לא רשאית להזיז שום דבר מתחת לדשבורד"), לא ויתור עליו.
// העוגן לחיפוש הבלוק עודכן בהתאם - dash-kpi-card dash-kpi-hot כבר לא קיים.
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

function extractHotQuoteBlock(source) {
  const start = source.indexOf("hotQuotesList.length > 0 && currentHotQuote && (");
  const blockEnd = source.indexOf('</div>\n              )}', start);
  return source.slice(start, blockEnd > start ? blockEnd : start + 2500);
}

describe('Hot Quote fixed geometry (source-level regression guard)', () => {
  const block = extractHotQuoteBlock(dashboardSource);

  it('renders the rotating client/quote message as a single truncated line, never a variable-height multi-line block', () => {
    expect(block).toMatch(/t\.hotQuoteAlert\(currentHotClientName, currentHotViewCount\)/);
    expect(block).toMatch(/whiteSpace:\s*hotQuoteExpanded\s*\?\s*['"]normal['"]\s*:\s*['"]nowrap['"]/);
    expect(block).toMatch(/textOverflow:\s*hotQuoteExpanded\s*\?\s*['"]clip['"]\s*:\s*['"]ellipsis['"]/);
  });

  it('reserves a fixed minHeight on the alert row so a short vs. long client name never shifts surrounding layout', () => {
    expect(block).toMatch(/minHeight:\s*['"]28px['"]/);
  });

  it('only shows the alert when a real hot quote exists (never a fabricated/empty state)', () => {
    expect(block).toMatch(/hotQuotesList\.length > 0 && currentHotQuote/);
  });
});
