// Notices for durable quote drafts: recovered-draft banner, storage-failure warning, and the server-conflict dialog.
// Text only - none of these ever prints draft field values.
const box = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', boxSizing: 'border-box' };

const fmt = (ms, isHebrew) => {
  try { return new Date(ms).toLocaleString(isHebrew ? 'he-IL' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; }
};

export function DraftRecoveredBanner({ info, isHebrew, onDiscard, onDismiss }) {
  if (!info) return null;
  return (
    <div role="status" data-testid="draft-recovered-banner" style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
      <span style={{ flex: '1 1 220px' }}>
        {info.conflictCopy
          ? (isHebrew ? `זהו עותק משוחזר של הצעה ${info.conflictCopy.label}: ההצעה השמורה השתנתה בשרת מאז. שמירה תיצור הצעה חדשה - ההצעה השמורה לא תושפע.` : `This is a recovered copy of quote ${info.conflictCopy.label}: the saved quote changed on the server since. Saving creates a NEW quote - the saved quote is not touched.`)
          : (isHebrew ? `שוחזרה טיוטה שלא נשמרה (עודכנה לאחרונה: ${fmt(info.updatedAt, true)}).` : `Recovered an unsaved draft (last updated ${fmt(info.updatedAt, false)}).`)}
      </span>
      {(info.missingAttachments || []).length > 0 && (
        <span data-testid="draft-missing-attachments" style={{ flex: '1 1 100%', color: '#9a3412', fontWeight: 600 }}>
          {isHebrew ? `לא ניתן היה לשחזר את הקבצים המצורפים הבאים - יש לבחור אותם מחדש: ${info.missingAttachments.join(', ')}` : `These attachments could not be recovered - please select them again: ${info.missingAttachments.join(', ')}`}
        </span>
      )}
      <button type="button" onClick={onDiscard} style={{ background: 'white', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}>
        {isHebrew ? 'מחק טיוטה' : 'Discard draft'}
      </button>
      <button type="button" onClick={onDismiss} aria-label={isHebrew ? 'סגור' : 'Dismiss'} style={{ background: 'transparent', color: '#065f46', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
    </div>
  );
}

export function DraftStorageWarning({ show, reason, isHebrew }) {
  if (!show) return null;
  return (
    <div role="alert" data-testid="draft-storage-warning" style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.9rem' }}>
      {reason === 'quota'
        ? (isHebrew ? 'אין מספיק מקום באחסון המקומי: לא ניתן לשמור טיוטה במכשיר זה. שינויים שלא נשמרו עלולים ללכת לאיבוד - שמור את ההצעה בהקדם.' : 'Local storage is full: your draft cannot be saved on this device. Unsaved changes may be lost - please save the quote soon.')
        : (isHebrew ? 'שחזור טיוטה אינו זמין בדפדפן/מכשיר זה (אחסון מקומי חסום, למשל בגלישה פרטית). שינויים שלא נשמרו עלולים ללכת לאיבוד אם העמוד ייטען מחדש.' : 'Draft recovery is unavailable in this browser/device (local storage is blocked, e.g. private mode). Unsaved changes may be lost if the page reloads.')}
    </div>
  );
}

export function DraftConflictModal({ conflict, isHebrew, onReview, onUseSaved, onDiscard }) {
  if (!conflict) return null;
  const label = conflict.label || '';
  const deleted = conflict.reason === 'missing';
  return (
    <div style={box} role="dialog" aria-modal="true" data-testid="draft-conflict-modal">
      <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', direction: isHebrew ? 'rtl' : 'ltr' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '1.1rem', marginBottom: '10px' }}>
          {isHebrew ? 'נמצאה טיוטה שלא נשמרה - וההצעה השתנתה' : 'An unsaved draft was found - and the quote changed'}
        </h3>
        <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 0 16px' }}>
          {deleted
            ? (isHebrew ? `הצעה ${label} כבר אינה קיימת (או אינה ניתנת לעריכה). הטיוטה שלך נשמרה - היא לא תדרוס דבר.` : `Quote ${label} no longer exists (or can no longer be edited). Your draft is kept - it will not overwrite anything.`)
            : (isHebrew ? `הצעה ${label} השתנתה בשרת (במכשיר או בחלון אחר) אחרי שהטיוטה נשמרה. כדי לא לדרוס שינויים שנשמרו, בחר/י מה לעשות:` : `Quote ${label} changed on the server (another device or window) after your draft was saved. To avoid overwriting saved changes, choose:`)}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button type="button" data-testid="draft-conflict-review" onClick={onReview} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
            {isHebrew ? 'סקור עותק משוחזר (ייפתח כהצעה חדשה)' : 'Review recovered copy (opens as a new quote)'}
          </button>
          {!deleted && (
            <button type="button" data-testid="draft-conflict-use-saved" onClick={onUseSaved} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
              {isHebrew ? 'השתמש בגרסה השמורה (הטיוטה תימחק)' : 'Use saved version (the draft is deleted)'}
            </button>
          )}
          <button type="button" data-testid="draft-conflict-discard" onClick={onDiscard} style={{ background: 'white', color: '#b91c1c', border: '1px solid #fecaca', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
            {isHebrew ? 'מחק טיוטה משוחזרת' : 'Discard recovered draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DraftAttachmentsWarning({ names, isHebrew }) {
  if (!names || names.length === 0) return null;
  return (
    <div role="alert" data-testid="draft-attachments-warning" style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', fontSize: '0.9rem' }}>
      {isHebrew ? `לא ניתן לשמור את הקבצים המצורפים הבאים בטיוטה: ${names.join(', ')}. אם העמוד ייטען מחדש יהיה צורך לבחור אותם שוב.` : `These attachments could not be kept in the draft: ${names.join(', ')}. If the page reloads you will need to select them again.`}
    </div>
  );
}
