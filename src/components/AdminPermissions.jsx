// Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: ... ומשתמש מפקח עם מסך הרשאות מנהל" (spec docs/ADMIN_SUPERVISOR_AND_NAV_SPEC_2026-10-20.md):
// the "הרשאות מנהל" screen - the Owner only. The current supervisors (edit / remove all), and "add a supervisor": pick an existing user,
// tick a box per admin screen and per admin action, save. Every box comes from the destination registry (ADMIN_PERMISSIONS), so a future
// screen appears here unticked. The server does the work: set_admin_permissions() (super admin only, audited) and
// list_admin_permission_holders(); the protected actions (delete, lifetime / extension, appointing supervisors) are never a box.
import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, UserPlus, Save, Trash2, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../shared/supabase';
import AdminScreenFrame from './AdminScreenFrame';
import { ADMIN_PERMISSIONS } from './adminDestinations';
import './adminUsers.css';

const C = {
  title: { he: 'הרשאות מנהל', en: 'Admin permissions' },
  subtitle: { he: (n) => `${n} מפקחים`, en: (n) => `${n} supervisors` },
  add: { he: 'הוספת מפקח', en: 'Add a supervisor' },
  search: { he: 'חיפוש משתמש לפי אימייל או שם העסק...', en: 'Search a user by email or business name...' },
  pick: { he: 'בחירה', en: 'Choose' },
  none: { he: 'עדיין אין מפקחים. לחצו "הוספת מפקח" כדי לתת למשתמש קיים הרשאות.', en: 'No supervisors yet. Choose "Add a supervisor" to give an existing user permissions.' },
  edit: { he: 'עריכת הרשאות', en: 'Edit permissions' },
  removeAll: { he: 'הסרת כל ההרשאות', en: 'Remove all permissions' },
  save: { he: 'שמירה', en: 'Save' },
  saved: { he: 'ההרשאות נשמרו.', en: 'Permissions saved.' },
  removed: { he: 'כל ההרשאות הוסרו.', en: 'All permissions removed.' },
  failed: { he: 'השמירה לא הצליחה. נסו שוב.', en: 'Could not save. Try again.' },
  loading: { he: 'טוען...', en: 'Loading...' },
  ownerOnly: { he: 'תמיד נשארים רק אצלך: מחיקת משתמשים, מנוי לכל החיים או הארכה בחינם, ומינוי מפקחים.', en: 'Always yours only: deleting users, lifetime subscriptions or free extensions, and appointing supervisors.' },
  close: { he: 'סגירה', en: 'Close' },
  forUser: { he: 'הרשאות עבור', en: 'Permissions for' },
  screens: { he: 'מסכים', en: 'Screens' },
  actions: { he: 'פעולות', en: 'Actions' },
  noResults: { he: 'לא נמצאו משתמשים.', en: 'No users found.' },
};

export default function AdminPermissions({ isHebrew = true, accounts = [] }) {
  const t = (k) => (isHebrew ? C[k].he : C[k].en);
  const L = (x) => (isHebrew ? x.he : x.en);
  const [holders, setHolders] = useState(null);
  const [editing, setEditing] = useState(null); // { userId, email, name, perms:Set }
  const [term, setTerm] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => supabase.rpc('list_admin_permission_holders').then(({ data, error }) => setHolders(error ? [] : (data || [])));
  useEffect(() => { load(); }, []);

  const holderIds = new Set((holders || []).map((h) => h.user_id));
  const candidates = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return (accounts || []).filter((a) => a.role !== 'super_admin' && !holderIds.has(a.user_id)
      && [a.email, a.business_name].some((v) => String(v || '').toLowerCase().includes(q))).slice(0, 8);
  }, [term, accounts, holders]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (userId, email, name, perms) => { setEditing({ userId, email, name, perms: new Set(perms || []) }); setAdding(false); setTerm(''); setNotice(''); };
  const toggle = (id) => setEditing((e) => { const s = new Set(e.perms); if (s.has(id)) s.delete(id); else s.add(id); return { ...e, perms: s }; });
  const save = async (perms, msg) => {
    if (!editing || busy) return;
    setBusy(true); setNotice('');
    const { error } = await supabase.rpc('set_admin_permissions', { p_user_id: editing.userId, p_permissions: perms });
    setBusy(false);
    if (error) { setNotice(t('failed')); return; }
    setNotice(msg); await load();
    if (!perms.length) setEditing(null);
  };

  const screens = ADMIN_PERMISSIONS.filter((p) => !p.action);
  const actions = ADMIN_PERMISSIONS.filter((p) => p.action);
  return (
    <AdminScreenFrame title={t('title')} subtitle={C.subtitle[isHebrew ? 'he' : 'en']((holders || []).length)} label={t('title')} isHebrew={isHebrew}
      controls={(
        <div className="admin-filters">
          {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
          <button type="button" className="admin-inquiry-settings-btn" onClick={() => { setAdding(true); setEditing(null); setNotice(''); }} data-testid="permissions-add"><UserPlus size={15} />{t('add')}</button>
        </div>
      )}>
      <p className="admin-plan-system-notice" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ShieldCheck size={16} aria-hidden="true" />{t('ownerOnly')}</p>

      {adding && (
        <div className="admin-perm-panel" data-testid="permissions-picker">
          <label className="admin-search" style={{ width: '100%' }}>
            <Search size={16} />
            <input type="text" aria-label={t('search')} placeholder={t('search')} value={term} onChange={(e) => setTerm(e.target.value)} data-testid="permissions-search" autoFocus />
          </label>
          {term.trim() && candidates.length === 0 && <p className="admin-empty" role="status">{t('noResults')}</p>}
          <ul className="admin-perm-list">
            {candidates.map((a) => (
              <li key={a.user_id}>
                <span><strong dir="ltr">{a.email}</strong> · <bdi>{a.business_name || '-'}</bdi></span>
                {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                <button type="button" className="admin-inquiry-settings-btn" onClick={() => open(a.user_id, a.email, a.business_name, [])} data-testid="permissions-pick">{t('pick')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <div className="admin-perm-panel" data-testid="permissions-editor">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px' }}><KeyRound size={17} aria-hidden="true" />{t('forUser')} <bdi dir="ltr">{editing.email}</bdi>
            {/* PRODUCT_TRUTH_DECORATIVE: closes the permissions editor without saving */}
            <button type="button" className="admin-icon-button" style={{ marginInlineStart: 'auto' }} aria-label={t('close')} onClick={() => setEditing(null)}><X size={16} /></button>
          </h3>
          {[['screens', screens], ['actions', actions]].map(([k, list]) => (
            <fieldset key={k} className="admin-perm-fieldset">
              <legend>{t(k)}</legend>
              {list.map((p) => (
                <label key={p.id} className="admin-inquiry-toggle">
                  {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
                  <input type="checkbox" checked={editing.perms.has(p.id)} onChange={() => toggle(p.id)} data-testid={`permission-${p.id}`} />
                  <span>{L(p.label)}</span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="admin-inquiry-actions" style={{ marginTop: 10 }}>
            {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
            <button type="button" className="admin-inquiry-primary" disabled={busy} onClick={() => save([...editing.perms].sort(), t('saved'))} data-testid="permissions-save"><Save size={15} />{busy ? t('loading') : t('save')}</button>
            {holderIds.has(editing.userId) && (
              // PRODUCT_TRUTH_CAPABILITY: admin_console
              <button type="button" disabled={busy} onClick={() => save([], t('removed'))} data-testid="permissions-remove"><Trash2 size={15} />{t('removeAll')}</button>
            )}
          </div>
        </div>
      )}
      {notice && <p role="status" data-testid="permissions-notice" style={{ color: '#0F6672', fontSize: 13 }}>{notice}</p>}

      {holders === null ? <p className="admin-empty" role="status">{t('loading')}</p> : holders.length === 0 ? (
        <p className="admin-empty" role="status" data-testid="permissions-empty">{t('none')}</p>
      ) : (
        <ul className="admin-perm-list" data-testid="permissions-holders">
          {holders.map((h) => (
            <li key={h.user_id} data-testid="permissions-holder">
              <span><strong dir="ltr">{h.email}</strong> · <bdi>{h.business_name || '-'}</bdi>
                <span className="admin-perm-chips">{(h.permissions || []).map((p) => { const d = ADMIN_PERMISSIONS.find((x) => x.id === p); return <span key={p} className="admin-badge">{d ? L(d.label) : p}</span>; })}</span>
              </span>
              {/* PRODUCT_TRUTH_CAPABILITY: admin_console */}
              <button type="button" className="admin-inquiry-settings-btn" onClick={() => open(h.user_id, h.email, h.business_name, h.permissions)} data-testid="permissions-edit">{t('edit')}</button>
            </li>
          ))}
        </ul>
      )}
    </AdminScreenFrame>
  );
}
