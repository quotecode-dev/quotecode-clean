import { Shield, FileText, User, Settings as SettingsIcon, LayoutGrid, BarChart3, ListChecks, CalendarDays } from 'lucide-react';
import ChartSquareIcon from '../components/ChartSquareIcon';

// חוק ברזל (Functional Parity Across Viewports task, 2026-09-08 - root fix
// for the Functional-Parity Root-Cause Audit): מקור-אמת יחיד לרשימת יעדי-
// הניווט (Quotes/Settings/Clients/Finances/Catalog/Admin) ולזכאות-role שלהם.
// Dashboard.jsx צורך את הרשימה המסוננת הזו הן ב-Desktop sidebar והן ב-Mobile
// bottom-nav/More menu - לעולם לא שני תנאי-role עצמאיים. הוספת יעד חדש, או
// שינוי מי רשאי לראות יעד קיים, היא עריכה אחת כאן, לא פעמיים (אחת לכל
// viewport) - זה בדיוק מה שמנע בעבר admin_clients מלהיות זמין ב-Mobile.
//
// mobileGroup קובע רק *מיקום/הצגה* ב-Mobile (bottom-nav הראשי מול "עוד"
// popover) - לא זכאות. role קובע זכאות (בדיוק כמו ה-isSuperAdmin הבודד
// שכבר קיים ב-Dashboard.jsx - לא לוגיקת-הרשאה חדשה/כפולה).
//
// mobileLabel אופציונלי: שומר על טקסט-Mobile הקיים בפועל (למשל "הגדרות"
// הקצר יותר, לעומת "הגדרות עסק" של ה-label הרגיל ב-Desktop) כדי שאיחוד
// המקור לא ישנה בשוגג טקסט-נראה קיים - זהות-היעד משותפת, הטקסט-המוצג
// עדיין רשאי להיות שונה בין viewports (per the task's own explicit rule).
//
// Approved 980px dashboard (2026-10-08): the desktop sidebar order is
// Quotes, Clients, Catalog, Expenses & Reports, Business Settings (the "New
// quote" row is rendered above this list). The mobile bottom-nav / More menu
// keep their own grouping and short labels (mobileGroup / mobileLabel).
export function getDashboardNavCapabilities({ isSuperAdmin, t, isHebrew }) {
  const capabilities = [
    { id: 'main', icon: FileText, label: t.quotesNav, role: 'any', mobileGroup: 'bottom' },
    { id: 'clients', icon: User, label: t.clientsNav, role: 'any', mobileGroup: 'bottom' },
    { id: 'catalog', icon: LayoutGrid, label: t.catalogNav, role: 'any', mobileGroup: 'more' },
    { id: 'finances', icon: ChartSquareIcon, label: t.financesNav, mobileLabel: isHebrew ? 'פיננסים' : 'Finances', role: 'any', mobileGroup: 'bottom' },
    // Task 17: quote statistics - desktop after Finances (approved order kept); mobile in More (approved bottom row kept)
    { id: 'statistics', icon: BarChart3, label: t.statisticsNav, role: 'any', mobileGroup: 'more' },
    // Task 18: durable manual tasks - desktop after Statistics (approved order kept); mobile in More (approved bottom row kept)
    { id: 'tasks', icon: ListChecks, label: t.tasksNav, role: 'any', mobileGroup: 'more' },
    // Task 19: calendar - desktop after Tasks (approved order kept); mobile in More (approved bottom row kept)
    { id: 'calendar', icon: CalendarDays, label: t.calendarNav, role: 'any', mobileGroup: 'more' },
    { id: 'settings', icon: SettingsIcon, label: t.settingsNav, mobileLabel: isHebrew ? 'הגדרות' : 'Settings', role: 'any', mobileGroup: 'more' },
    { id: 'admin_clients', icon: Shield, label: t.usersAdminNav, role: 'super_admin', mobileGroup: 'more' },
  ];
  return capabilities.filter((cap) => cap.role === 'any' || (cap.role === 'super_admin' && isSuperAdmin));
}
