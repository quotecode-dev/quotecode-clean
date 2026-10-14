import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Task 18 wiring guard (the full Dashboard needs heavy Supabase/auth mocks; the rendered behaviour is proven in TasksTab.test.jsx,
// StatisticsTab.test.jsx and the real 5186 matrix): the Tasks screen gets the authenticated owner, the ACCOUNT market flag, the
// tenant's already-loaded quotes / clients, the shared status toast and the ONE Supabase client; the hot-quote follow-up only hands
// a draft over and switches tab - it never writes.
const norm = (text) => text.split(String.fromCharCode(13)).join('');
const dashboard = norm(readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8'));

describe('Dashboard - Task 18 Tasks wiring', () => {
  it('renders TasksTab for the tasks tab with the owner, account market, tenant rows, status toast and client', () => {
    const block = dashboard.slice(dashboard.indexOf("{activeTab === 'tasks' && ("), dashboard.indexOf("{activeTab === 'finances' && ("));
    expect(block).toMatch(/<TasksTab/);
    for (const prop of ['client={supabase}', 'userId={session?.user?.id}', 'isLocalIsraeliBusiness={isLocalIsraeliBusiness}', 'quotes={quotes}', 'clients={clients}', 'onStatus={setStatusMsg}', 'followUpDraft={taskFollowUpDraft}', 'onFollowUpConsumed={() => setTaskFollowUpDraft(null)}']) {
      expect(block, prop).toContain(prop);
    }
  });
  it('the hot-quote follow-up hands over a draft and opens the tab (no insert here)', () => {
    expect(dashboard).toMatch(/onCreateFollowUpTask=\{\(quote\) => \{ const draft = followUpDraftFor\(quote\); if \(draft\) \{ setTaskFollowUpDraft\(draft\); setActiveTab\('tasks'\); \} \}\}/);
    expect(dashboard).not.toMatch(/from\('tasks'\)/);
  });
  it('the nav label is localized', () => {
    expect(dashboard).toContain("tasksNav: isHebrew ? 'משימות' : 'Tasks',");
  });
});
