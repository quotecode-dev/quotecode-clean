import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Task 19 wiring guard: the Calendar gets the owner, the ACCOUNT market flag, the tenant's loaded quotes and the ONE Supabase client; a
// calendar task opens the EXISTING task flow (the Tasks screen's edit form) - no new write path, no reminder, no new task state.
const norm = (text) => text.split(String.fromCharCode(13)).join('');
const dashboard = norm(readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8'));
const tasksTab = norm(readFileSync(join(cwd(), 'src', 'components', 'TasksTab.jsx'), 'utf8'));
const calendarTab = norm(readFileSync(join(cwd(), 'src', 'components', 'CalendarTab.jsx'), 'utf8'));

describe('Dashboard - Task 19 Calendar wiring', () => {
  it('renders CalendarTab for the calendar tab with the owner, account market, tenant quotes and client', () => {
    const block = dashboard.slice(dashboard.indexOf("{activeTab === 'calendar' && ("), dashboard.indexOf("{activeTab === 'finances' && ("));
    for (const prop of ['<CalendarTab', 'client={supabase}', 'userId={session?.user?.id}', 'isLocalIsraeliBusiness={isLocalIsraeliBusiness}', 'quotes={quotes}', "onOpenTask={(taskId) => { setTaskOpenId(taskId); setActiveTab('tasks'); }}"]) {
      expect(block, prop).toContain(prop);
    }
    expect(dashboard).toContain("calendarNav: isHebrew ? 'יומן' : 'Calendar',");
  });
  it('the Tasks screen opens that task in its own existing edit form', () => {
    expect(dashboard).toMatch(/openTaskId=\{taskOpenId\}\s*\n\s*onOpenTaskConsumed=\{\(\) => setTaskOpenId\(null\)\}/);
    expect(tasksTab).toMatch(/const task = tasks\.find\(\(t\) => t\.id === openTaskId\);\n\s*if \(task\) \{ setView\(task\.status === 'completed' \? 'completed' : 'open'\); openEdit\(task\); \}/);
  });
  it('the calendar reads only: the one task data path, no insert / update / delete, no reminders, no foreign holiday data or country', () => {
    expect(calendarTab).toMatch(/import \{ listTasks \} from '\.\.\/utils\/tasksClient';/);
    expect(calendarTab).not.toMatch(/createTask|updateTask|deleteTask|setTaskStatus|\.insert\(|\.update\(|\.delete\(|reminder|notification|Notification\(/);
    expect(calendarTab).not.toMatch(/America\/New_York|countryCode|holidayCountry|nager|hebcal\.com|fetch\(/i);
  });
});
