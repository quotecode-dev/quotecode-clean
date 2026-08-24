// חוק ברזל: מחזירה אך ורק את קוד המדינה הגיאוגרפי הטרי של הבקשה הנוכחית
// (מכותרת ה-geo האמיתית של Vercel) - שום דבר נוסף, ואינה נוגעת במסד
// הנתונים בכלל. נועדה להיקרא ע"י Dashboard.jsx פעם אחת בלבד, ברגע בפועל
// שבו מתגלה שאין עדיין שורת business_settings למשתמש המחובר (ר'
// fetchSettings) - לא לשום שימוש אחר. חייבת להישאר ללא מטמון (no-store)
// כדי שכל קריאה תשקף את כתובת ה-IP הנוכחית ולא ערך ישן (למשל אחרי החלפת VPN).
export default function handler(req, res) {
  // אך ורק מכותרת ה-geo האמיתית של Vercel - לעולם לא מפרמטר/גוף שהלקוח
  // שולח, כדי שאי-אפשר יהיה "לזייף" geo ע"י שליחת ערך משלך.
  const rawCountry = req.headers['x-vercel-ip-country'];
  const country = rawCountry ? String(rawCountry).toUpperCase() : null;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ country });
}
