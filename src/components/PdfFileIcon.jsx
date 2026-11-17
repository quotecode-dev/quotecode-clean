// חוק ברזל (Public Quote Action Icons, TEST Acceptance Package 1 - הפניה
// חזותית מהבעלים): lucide-react (ספריית האייקונים היחידה שכבר בשימוש בכל
// הפרויקט) אין לה אייקון "מסמך עם טקסט PDF קריא בפנים" - שום שם קיים
// (FileType/FileType2/FileBadge וכו') לא מכיל טקסט קריא בפועל, רק סימוני-
// צורה גנריים. הדיווח הזה עצמו הוא ה"REPORT" המבוקש לפני שנוספה תלות
// חדשה - ההחלטה הייתה לא להוסיף ספריית אייקונים שנייה לפרויקט (סטייה
// ארכיטקטונית) אלא לבנות SVG מקומי קטן אחד, יחיד ומשותף (לא משוכפל בין
// שני קבצי השוק) שמחקה בדיוק את מוסכמות lucide עצמה - viewBox 24x24,
// stroke="currentColor" fill="none", strokeWidth/size כ-props זהים -
// כדי שהוא ייראה חלק אחד עם Phone/Printer הסמוכים אליו, לא כמו רכיב זר.
// צורת הדף+הפינה המקופלת מבוססת בדיוק על path הבסיס של lucide File/
// FileText (לא הומצאה צורה חדשה) - רק נוסף טקסט "PDF" מלא (fill, לא
// stroke - קריא בגודל קטן) בחלק התחתון, תואם את הפנייה החזותית של הבעלים.
export default function PdfFileIcon({ size = 24, strokeWidth = 1.75, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontSize="6.2"
        fontWeight="800"
        fontFamily="Arial, sans-serif"
        stroke="none"
        fill={color}
      >
        PDF
      </text>
    </svg>
  );
}
