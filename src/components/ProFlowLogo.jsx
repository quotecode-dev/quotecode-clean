// הפרמטר rtl נשמר לתאימות לאחור בלבד (קריאות קיימות עדיין מעבירות אותו) -
// המותג הטקסטואלי הנקי הנוכחי סימטרי ואינו זקוק עוד לכיוון שונה לכל שפה.
//
// מותג הפלטפורמה בכל כותרת באפליקציה (כולל תצוגת Super Admin, דסקטופ ומובייל)
// הוא תמיד לוגו הטקסט הזוהר האחיד של ProFlow - ולא תמונת לוגו מותאמת אישית
// שהעלה עסק מסוים. לוגו עסק נשאר מוצג במסמכי ההצעה/מיילים שנשלחים ללקוח
// (שם הוא רלוונטי), אך לא בכותרת הפנימית של המערכת עצמה. כך גם נמנעות
// לחלוטין בעיות עיצוב/גודל/חיתוך שנגרמו בעבר מתמונות בגדלים שרירותיים.
export default function ProFlowLogo({ size = 48, darkText = false }) {
  return (
    <span dir="ltr" style={{
      fontSize: `${size * 0.75}px`,
      fontWeight: '900',
      letterSpacing: '-0.5px',
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: "'Rubik', Arial, Segoe UI, sans-serif",
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flexShrink: 0
    }}>
      <span style={{ color: darkText ? '#0f172a' : '#ffffff' }}>Pro</span>
      <span style={{
        marginLeft: '1px',
        background: 'linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: '#c084fc',
        filter: 'drop-shadow(0 0 8px rgba(192, 132, 252, 0.55))'
      }}>Flow</span>
    </span>
  );
}
