import { Shield, FileText, Users2, Settings as SettingsIcon, BarChart3, Package } from 'lucide-react';

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
export function getDashboardNavCapabilities({ isSuperAdmin, t, isHebrew }) {
  const capabilities = [
    { id: 'main', icon: FileText, label: t.quotesNav, role: 'any', mobileGroup: 'bottom' },
    { id: 'settings', icon: SettingsIcon, label: t.settingsNav, mobileLabel: isHebrew ? 'הגדרות' : 'Settings', role: 'any', mobileGroup: 'more' },
    { id: 'clients', icon: Users2, label: t.clientsNav, role: 'any', mobileGroup: 'bottom' },
    { id: 'finances', icon: BarChart3, label: t.financesNav, role: 'any', mobileGroup: 'bottom' },
    { id: 'catalog', icon: Package, label: t.catalogNav, role: 'any', mobileGroup: 'more' },
    { id: 'admin_clients', icon: Shield, label: t.usersAdminNav, role: 'super_admin', mobileGroup: 'more' },
  ];
  return capabilities.filter((cap) => cap.role === 'any' || (cap.role === 'super_admin' && isSuperAdmin));
}
