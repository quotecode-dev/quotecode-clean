// ==============================================================================
// 🚨 PROFLOW HARD RULE: Strict dynamic routing, language enforcement & subscription limits (AdminUsersTab.jsx). Absolute ban on bypassing plan restrictions via URL manipulation.
// ==============================================================================

import { useState } from 'react';
import { publishBlocker, resolveBlockers } from '../utils/aiHelpBlockers';
import { invokeWithFreshSession } from '../shared/invokeWithFreshSession';
import { getFunctionErrorMessage } from '../utils/functionError';
import AdminUsersView from './AdminUsersView';
import AdminUserDetails from './AdminUserDetails';
import AdminProtectedDialog from './AdminProtectedDialog';
import { useAdminAccountSummary, legacyOperationsRetired, adminTargetUserId } from '../domain/subscriptions/adminAccountSummary';
import { accountDateTime } from '../utils/adminDates';
import { supabase } from '../shared/supabase';

export default function AdminUsersTab({
  isHebrew,
  allAccounts = [],
  filteredAdminAccounts = [],
  adminSearchTerm = '',
  setAdminSearchTerm,
  handleSort,
  sortField,
  sortDirection,
  onOpenUserDetails,
  selectedAccount = null,
  onBackFromDetails = null,
  onAccountsChanged = null,
  onOpenActivity = null,
  // Owner console 2026-10-20 (L-22 supervisor): the protected actions (reset / delete / lifetime) stay the Owner's only - a supervisor
  // (canProtect false) never sees them; the server refuses them anyway (super_admin checks in every admin-* function).
  canProtect = true,
}) {
  const [resetModalUser, setResetModalUser] = useState(null);
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [lifetimeActionUser, setLifetimeActionUser] = useState(null);
  const [trialActionUser, setTrialActionUser] = useState(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminReasonInput, setAdminReasonInput] = useState('');
  // TEKANGO Admin V1 (Task 3.5): typed target confirmation for Delete
  // Account specifically - the one irreversible action here, so it gets
  // one extra safety layer beyond reason+password+re-auth: the admin must
  // type the target's own exact email before the submit button enables.
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  // Admin redesign part A (Owner 2026-10-16, spec §7): a completed action shows its verified result INSIDE the dialog, then the list
  // refreshes from the server (no page reload)
  const [actionDone, setActionDone] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // פאנל "אבחון" (בדיקת מיילי תזכורת חי, דרך Resend) - מכווץ כברירת מחדל
  // ומופרד מהממשק הראשי לניהול משתמשים, כדי לא לבלבל בין כלי בדיקה/פיתוח
  // לבין פעולות ניהול אמיתיות. היכולת עצמה (קריאה ל-Edge Function במצב
  // "test") לא השתנתה - רק המיקום שלה בממשק.

  // OD-16 / subscriptions cross-cut (stream D): the trial extension and is_lifetime operations write only the LEGACY record.
  // They keep working while the new plan system is not active, and become unavailable once the free_issue (output) phase is
  // enforced - read from the read-only admin summary RPC for the dialog's target (no call when no dialog is open). The Edge
  // functions refuse independently (409 legacy_trial_retired). Admin never edits entitlement or ledger rows.
  const legacyTarget = trialActionUser || lifetimeActionUser;
  const { summary: legacyTargetSummary } = useAdminAccountSummary(legacyTarget ? legacyTarget.user_id : null);
  const legacyRetired = legacyOperationsRetired(legacyTargetSummary);
  const legacyRetiredText = isHebrew
    ? 'הפעולה מהמערכת הקודמת אינה זמינה: מערכת המסלולים החדשה פעילה בחשבון. המסלול, היתרה והזכאות נקבעים רק בשרת.'
    : 'This legacy operation is unavailable: the new plan system is active for this account. Plan, balance and entitlement are decided only by the server.';
  // Codex verification AV-03 (2026-10-17): the revoke explains the revoke - the account returns to the state its own data and the server
  // give it, no charge, no promise of an entitlement that is not proven
  const revokeOnlyText = isHebrew
    ? 'ביטול LIFETIME: החשבון חוזר למצב שנקבע לפי נתוני החשבון והשרת (למשל מסלול החינם), ללא חיוב. מסלול או יתרה אינם נוצרים מהביטול.'
    : 'Revoking Lifetime: the account returns to the state its own data and the server give it (for example the Free plan), with no charge. Revoking creates no plan or balance.';
  // Night task 2026-10-16 (PLN-7): what the Lifetime switch really does today
  const legacyOnlyText = isHebrew
    ? 'מנוי לכל החיים: המערכת והצ׳אט יציגו לחשבון „מנוי לכל החיים” וכל היכולות פתוחות בו, ללא חיוב. במערך המסלולים זה לא משנה מסלול או יתרה.'
    : 'Lifetime: the app and the chat show the account as a "Lifetime subscription" with every capability open and no charge. In the plan system it does not change a plan or a balance.';



  // TEKANGO Admin V1 (Task 2): the KPI/table markup that consumed
  // totalU/localU/intlU/activeRecent/newUsersList/unreadNewUsersCount/
  // activeAccountsList was removed below (replaced by AdminUsersView, with
  // KPIs now owned by the shared Header/AdminOverview) - those derived
  // values (including a last-sign-in-recency "active now" count the
  // Owner's rule forbids outright) are removed with it, not left as dead
  // code that still computed a forbidden signal.

  // TEKANGO Admin V1 (Task 3.1/3.2, binding rule): "SENSITIVE ADMIN
  // ACTIONS: RE-AUTH REQUIRED... A client-side password dialog alone is
  // NOT sufficient." Every protected action below now goes through this
  // one shared two-step flow instead of the prior client-only
  // signInWithPassword-then-write pattern:
  //   1. admin-reauth-verify: the password is checked SERVER-SIDE (never
  //      just client-side), and mints a short-lived (5 min), single-use
  //      proof row bound to this exact actor+action+target+{reason}.
  //   2. the actual privileged Edge Function (admin-set-lifetime/
  //      admin-extend-trial/admin-delete-user/admin-cleanup-user-quotes)
  //      atomically claims that proof before doing anything else, then
  //      performs the write, reads back the authoritative new state, and
  //      writes an admin_audit_log row - see _shared/adminReauth.ts.
  // A stale/replayed/mismatched proof is refused by the second call even
  // if somehow forged/guessed - claiming is atomic and one-shot.
  async function runProtectedAction({ action, targetUserId, reason, functionName, extraBody = {} }) {
    const { data: verifyData, error: verifyError } = await invokeWithFreshSession('admin-reauth-verify', {
      body: { action, targetUserId, params: { reason }, password: adminPasswordInput },
    });
    if (verifyError || !verifyData?.success || !verifyData?.proofToken) {
      // AI HELP V4 §5: the protected-action owner publishes the typed blocker (never the server text); resolved on the next success
      publishBlocker('ADMIN_PROTECTED_ACTION', { scope: 'surface', surface: 'admin_clients' });
    }
    if (verifyError) {
      throw new Error(await getFunctionErrorMessage(verifyError, isHebrew ? 'אימות הסיסמה נכשל.' : 'Password verification failed.'));
    }
    if (!verifyData?.success || !verifyData?.proofToken) {
      throw new Error(verifyData?.error || (isHebrew ? 'סיסמת המנהל שגויה.' : 'Incorrect admin password!'));
    }

    const { data: actionData, error: actionError } = await invokeWithFreshSession(functionName, {
      body: { targetUserId, proofToken: verifyData.proofToken, reason, ...extraBody },
    });
    if (actionError) {
      const message = await getFunctionErrorMessage(actionError, isHebrew ? 'הפעולה נכשלה.' : 'Action failed.');
      throw new Error(message === 'legacy_trial_retired' ? legacyRetiredText : message);
    }
    if (!actionData?.success) {
      throw new Error(actionData?.error || (isHebrew ? 'הפעולה נכשלה.' : 'Action failed.'));
    }
    resolveBlockers(['ADMIN_PROTECTED_ACTION']);
    return actionData;
  }

  function validateReasonAndTarget(targetUserId) {
    if (!targetUserId) {
      throw new Error(isHebrew ? 'לא נמצא מזהה משתמש.' : 'No user id found.');
    }
    if (!adminReasonInput.trim()) {
      throw new Error(isHebrew ? 'יש להזין סיבה לפעולה זו.' : 'A reason is required for this action.');
    }
  }

  const handleExecuteDataReset = async (e) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetError('');
    setIsResetting(true);
    try {
      const targetUserId = resetModalUser.user_id;
      if (deleteConfirmInput.trim().toLowerCase() !== (resetModalUser.email || '').trim().toLowerCase()) {
        throw new Error(isHebrew ? 'כתובת המייל לאישור אינה תואמת.' : 'The confirmation email does not match.');
      }
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({ action: 'reset_quotes', targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-cleanup-user-quotes' });
      setAdminPasswordInput('');
      setActionDone(true);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleExecuteUserDelete = async (e) => {
    e.preventDefault();
    if (!deleteModalUser) return;
    setResetError('');
    setIsResetting(true);
    try {
      // PRODUCT_TRUTH_CAPABILITY: admin_console
      if (deleteModalUser.role === 'super_admin') {
        throw new Error(isHebrew ? 'לא ניתן למחוק משתמש Super Admin!' : 'Cannot delete Super Admin!');
      }
      const targetUserId = deleteModalUser.user_id;
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({ action: 'delete_user', targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-delete-user' });
      setAdminPasswordInput('');
      setActionDone(true);
    } catch (err) {
      console.error("Delete error:", err);
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08, Owner
  // mandate: "No single-click Lifetime toggle... Grant Lifetime must
  // explicitly write the new Lifetime state. Revoke Lifetime must
  // explicitly clear Lifetime state."). Writes only is_lifetime (explicit
  // column, migration 20260908000000) - plan/trial_ends_at untouched.
  // Backend (admin-set-lifetime) does its own authoritative read-back
  // after the write, on top of the guard_business_settings_plan_trial()
  // trigger's own independent server-side role re-verification.
  const handleExecuteLifetimeAction = async (e) => {
    e.preventDefault();
    if (!lifetimeActionUser) return;
    setResetError('');
    setIsResetting(true);
    const nextIsLifetime = !(lifetimeActionUser.is_lifetime === true);
    try {
      if (legacyRetired) throw new Error(legacyRetiredText);
      const targetUserId = lifetimeActionUser.user_id;
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({
        action: nextIsLifetime ? 'grant_lifetime' : 'revoke_lifetime',
        targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-set-lifetime', extraBody: { grant: nextIsLifetime },
      });
      setAdminPasswordInput('');
      setActionDone(true);
    } catch (err) {
      console.error("Legacy is_lifetime action error:", err);
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // TEKANGO Admin V1 (Task 3.4): legacy trial extension (server-side fixed rule). The prior
  // implementation (Dashboard.jsx's own handleExtendTrial14Days) had NO
  // re-auth at all - a real gap versus Reset/Delete/Lifetime, closed here
  // by routing it through the exact same protected-action flow. Backend
  // (admin-extend-trial) independently re-enforces the "expired or no
  // active trial only" eligibility rule server-side.
  const handleExecuteTrialExtension = async (e) => {
    e.preventDefault();
    if (!trialActionUser) return;
    setResetError('');
    setIsResetting(true);
    try {
      if (legacyRetired) throw new Error(legacyRetiredText);
      const targetUserId = trialActionUser.user_id;
      validateReasonAndTarget(targetUserId);
      await runProtectedAction({ action: 'extend_trial', targetUserId, reason: adminReasonInput.trim(), functionName: 'admin-extend-trial' });
      setAdminPasswordInput('');
      setActionDone(true);
    } catch (err) {
      console.error("Legacy trial extension error:", err);
      setResetError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // L-22 (Owner 2026-10-28): the Owner marks / unmarks a test account (set_admin_test_account, super admin only, audited); the
  // accounts reload so the mark and the counts come back from the server
  async function markTestAccount(account, isTest) {
    const { data, error } = await supabase.rpc('set_admin_test_account', { p_user_id: adminTargetUserId(account), p_is_test: isTest });
    if (error || !data?.ok) return false;
    setRefreshKey((k) => k + 1);
    if (typeof onAccountsChanged === 'function') await onAccountsChanged();
    return true;
  }

  function closeDialogs() {
    if (isResetting) return;
    const wasDone = actionDone;
    // the account just deleted from its own details page: back to the list (it no longer exists)
    const deletedOpenAccount = wasDone && deleteModalUser && selectedAccount && deleteModalUser.id === selectedAccount.id;
    setResetModalUser(null); setDeleteModalUser(null); setLifetimeActionUser(null); setTrialActionUser(null);
    setAdminPasswordInput(''); setAdminReasonInput(''); setDeleteConfirmInput(''); setResetError(''); setActionDone(false);
    if (wasDone) {
      setRefreshKey((k) => k + 1);
      if (typeof onAccountsChanged === 'function') onAccountsChanged();
      if (deletedOpenAccount && typeof onBackFromDetails === 'function') onBackFromDetails();
    }
  }

  // TEKANGO Admin V1 (Task 2): getRemainingTimeFormatted/isHebrewText/
  // getAccountDerived were only consumed by the old inline table + mobile
  // card list, both now replaced by AdminUsersView (which derives the same
  // facts itself via resolveAccountEntitlement) - removed as genuinely dead
  // code rather than left unused (isRecentActive in particular was a
  // last-sign-in-recency "active" flag, which the Owner's Admin V1 rule
  // forbids surfacing at all, so this is not just a cleanup but a removal
  // of a forbidden derived signal).

  return (
    <div className="admin-screen-host" dir={isHebrew ? 'rtl' : 'ltr'}>

      {/* Admin redesign part A (Owner 2026-10-16, spec §7 + §9): ONE accessible protected dialog (AdminProtectedDialog) for every
          action - reason + server-verified admin password, the typed target email for a reset / delete, the exact scope, the result. */}
      {deleteModalUser && (
        <AdminProtectedDialog
          isHebrew={isHebrew} kind="delete" target={deleteModalUser}
          reason={adminReasonInput} onReason={setAdminReasonInput} password={adminPasswordInput} onPassword={setAdminPasswordInput}
          confirmEmail={deleteConfirmInput} onConfirmEmail={setDeleteConfirmInput}
          busy={isResetting} error={resetError} done={actionDone} onSubmit={handleExecuteUserDelete} onClose={closeDialogs}
        />
      )}

      {resetModalUser && (
        <AdminProtectedDialog
          isHebrew={isHebrew} kind="reset" target={resetModalUser}
          reason={adminReasonInput} onReason={setAdminReasonInput} password={adminPasswordInput} onPassword={setAdminPasswordInput}
          confirmEmail={deleteConfirmInput} onConfirmEmail={setDeleteConfirmInput}
          busy={isResetting} error={resetError} done={actionDone} onSubmit={handleExecuteDataReset} onClose={closeDialogs}
        />
      )}

      {/* Protected Actions: Lifetime grant/revoke — חוק ברזל (Explicit Lifetime Entitlement Model, 2026-09-08): commercial-entitlement
          mutation, a real server password check, an independent server-side guard. Shows the target, the current and the next state. */}
      {lifetimeActionUser && (() => {
        const targetIsLifetime = lifetimeActionUser.is_lifetime === true;
        // Owner console 2026-10-16: the states in words (the subscription status wording), never a raw technical field.
        const lifetimeWords = (on) => (on ? (isHebrew ? 'מנוי לכל החיים' : 'Lifetime subscription') : (isHebrew ? 'ללא מנוי לכל החיים' : 'No Lifetime subscription'));
        return (
          <AdminProtectedDialog
            isHebrew={isHebrew} kind={targetIsLifetime ? 'revoke' : 'grant'} target={lifetimeActionUser}
            reason={adminReasonInput} onReason={setAdminReasonInput} password={adminPasswordInput} onPassword={setAdminPasswordInput}
            busy={isResetting} error={resetError} done={actionDone} onSubmit={handleExecuteLifetimeAction} onClose={closeDialogs}
            disabled={isResetting || legacyRetired}
          >
            <div className="av-statline"><span>{isHebrew ? 'מצב נוכחי' : 'Current state'}</span><strong>{lifetimeWords(targetIsLifetime)}</strong></div>
            <div className="av-statline"><span>{isHebrew ? 'מצב לאחר פעולה' : 'Result'}</span><strong>{lifetimeWords(!targetIsLifetime)}</strong></div>
            <p className="av-small av-muted" style={{ margin: '8px 0' }}>{targetIsLifetime ? revokeOnlyText : legacyOnlyText}</p>
            {legacyRetired && <div className="av-notice av-bad">{legacyRetiredText}</div>}
          </AdminProtectedDialog>
        );
      })()}

      {/* TEKANGO Admin V1 (Task 3.4): the legacy trial extension stays reachable only through code (D-04: not a routine action). */}
      {trialActionUser && (
        <AdminProtectedDialog
          isHebrew={isHebrew} kind="trial" target={trialActionUser}
          reason={adminReasonInput} onReason={setAdminReasonInput} password={adminPasswordInput} onPassword={setAdminPasswordInput}
          busy={isResetting} error={resetError} done={actionDone} onSubmit={handleExecuteTrialExtension} onClose={closeDialogs}
          disabled={isResetting || legacyRetired}
        >
          <div className="av-statline"><span>{isHebrew ? 'תקופת ניסיון נוכחית' : 'Current trial'}</span>{trialActionUser?.trial_ends_at ? <bdi className="av-num">{accountDateTime(trialActionUser.trial_ends_at, trialActionUser, (isHebrew ? 'Local' : 'International'))}</bdi> : <span>{isHebrew ? 'אין' : 'None'}</span>}</div>
          {legacyRetired && <div className="av-notice av-bad">{legacyRetiredText}</div>}
        </AdminProtectedDialog>
      )}

      {/* TEKANGO Admin V1 (Task 2): the section title/KPI row that used to
          render here is removed - it duplicated the shared Header's own
          Admin KPI slot (Dashboard.jsx) and AdminOverview.jsx, which the
          Owner's binding rule forbids ("no duplicated KPI region"). It also
          included an "ACTIVE (10M)" last-sign-in-recency tile, which the
          Owner's rule separately forbids outright ("no active now from weak
          timestamps"). "New in last 24h" is still reachable for real, via
          AdminOverview's own Recently Registered card (created_at-based). */}

      {/* Diagnostics - collapsed by default. Live email-test capability, moved out
          of the primary user-management flow (see redesign spec). Functionally
          unchanged from before - only its position/visibility changed. */}
      {/* TEKANGO Admin V1 (Task 2): the search input + desktop table +
          mobile card list that used to render inline here (below) are all
          replaced by AdminUsersView - the real business-first directory
          (Business+email/Plan/Trial-expiry/Registered/Market/Actions
          columns, plan/trial/market filters, pagination), which owns its
          own search box. This component (AdminUsersTab) keeps owning only
          the protected-action dialogs (reset/delete/lifetime) below and
          wires them into AdminUsersView's onReset/onDelete/onLifetime. */}
      {selectedAccount ? (
        <AdminUserDetails
          account={selectedAccount}
          isHebrew={isHebrew}
          onBack={onBackFromDetails}
          accounts={allAccounts}
          onOpenActivity={onOpenActivity}
          onReset={!canProtect ? null : (a) => { setResetError(''); setAdminPasswordInput(''); setAdminReasonInput(''); setDeleteConfirmInput(''); setActionDone(false); setResetModalUser(a); }}
          onDelete={!canProtect ? null : (a) => { setResetError(''); setAdminPasswordInput(''); setAdminReasonInput(''); setDeleteConfirmInput(''); setActionDone(false); setDeleteModalUser(a); }}
          onLifetime={!canProtect ? null : (a) => { setResetError(''); setAdminPasswordInput(''); setAdminReasonInput(''); setActionDone(false); setLifetimeActionUser(a); }}
          onTestMark={!canProtect ? null : markTestAccount}
          refreshKey={refreshKey}
        />
      ) : (
      <AdminUsersView
        accounts={allAccounts}
        orderedAccounts={filteredAdminAccounts}
        search={adminSearchTerm}
        onSearch={setAdminSearchTerm}
        onSort={handleSort}
        sortField={sortField}
        sortDirection={sortDirection}
        isHebrew={isHebrew}
        onDetails={onOpenUserDetails}
        onReset={!canProtect ? null : (a) => { setResetError(''); setAdminPasswordInput(''); setAdminReasonInput(''); setDeleteConfirmInput(''); setActionDone(false); setResetModalUser(a); }}
        onDelete={!canProtect ? null : (a) => { setResetError(''); setAdminPasswordInput(''); setAdminReasonInput(''); setDeleteConfirmInput(''); setActionDone(false); setDeleteModalUser(a); }}
        onLifetime={!canProtect ? null : (a) => { setResetError(''); setAdminPasswordInput(''); setAdminReasonInput(''); setActionDone(false); setLifetimeActionUser(a); }}
        refreshKey={refreshKey}
        onRefreshAccounts={onAccountsChanged}
      />
      )}
    </div>
  );
}
