import { supabase } from './supabase';

// נקודת אמת יחידה למחיקת כל הנתונים העסקיים של משתמש (הצעות מחיר, קבצים מצורפים,
// לקוחות, שירותים, הוצאות). היה משוכפל בעבר ב-4 מקומות שונים (איפוס נתונים ומחיקת
// משתמש ע"י Super Admin, ביטול חשבון ע"י המשתמש עצמו, הקפאת/מחיקת חשבון) עם רמות
// שלמות שונות - חלק שכחו למחוק quote_items/quote_attachments לפני quotes, ואף אחד
// לא בדק שגיאות בין שלב לשלב, כך שכשלון באמצע המחיקה נבלע בשקט והמשתמש קיבל הודעת
// הצלחה כוזבת גם כשחלק מהנתונים נשארו במסד. כל שלב כאן בודק error ועוצר מיד אם נכשל.
async function deleteOrThrow(table, applyFilter, label) {
  const { error } = await applyFilter(supabase.from(table).delete());
  if (error) {
    throw new Error(`Failed to delete ${label} (table: ${table}): ${error.message}`);
  }
}

/**
 * מוחקת לצמיתות את כל נתוני העסק של משתמש: quote_items, quote_attachments,
 * quotes, clients, services, expenses. אינה נוגעת בשורת business_settings עצמה -
 * זו באחריות הקורא (יש זרימות ששומרות אותה עם reset, ויש שמוחקות/מאנונמות אותה).
 * זורקת חריגה עם שם הטבלה שנכשלה בה המחיקה, כדי שהקורא יוכל להציג שגיאה אמיתית
 * במקום הודעת "הצלחה" כוזבת כשחלק מהמחיקה נכשלה.
 */
export async function wipeUserData(userId) {
  if (!userId) throw new Error('wipeUserData: missing userId');

  const { data: userQuotes, error: quotesFetchError } = await supabase
    .from('quotes')
    .select('id')
    .eq('user_id', userId);

  if (quotesFetchError) {
    throw new Error(`Failed to look up quotes to delete: ${quotesFetchError.message}`);
  }

  const quoteIds = (userQuotes || []).map(q => q.id);

  if (quoteIds.length > 0) {
    await deleteOrThrow('quote_items', q => q.in('quote_id', quoteIds), 'quote line items');
    await deleteOrThrow('quote_attachments', q => q.in('quote_id', quoteIds), 'quote attachments');
  }

  await deleteOrThrow('quotes', q => q.eq('user_id', userId), 'quotes');
  await deleteOrThrow('clients', q => q.eq('user_id', userId), 'clients');
  await deleteOrThrow('services', q => q.eq('user_id', userId), 'services');
  await deleteOrThrow('expenses', q => q.eq('user_id', userId), 'expenses');
}
