// Owner console 2026-11-26, typed: "מאשר ליישם בשחרור אחד את שורת הביטחון, הכלים החינמיים, דף היכולת בלי חלק הסרטון עד שיצולם, קובץ ההסבר
// למנועי AI ודף ההשוואה כמו בסקיצות, ולשחרר עד הלייב". Two public pages, Hebrew (Israel, ₪ with VAT) and English (international, US dollars):
// - the comparison page "TEKANGO vs a quote in Word, Excel or WhatsApp" (sketch TEKANGO-sketch-llms-and-comparison-2026-11-26/compare.html,
//   BillOS idea 10 - no competitor names; a fair "which fits whom" part);
// - the capability page "Smart quote from a description" (sketch TEKANGO-sketch-capability-page-2026-11-26, BillOS idea 9): in short, three
//   steps with real product screens (sample data), FAQ, updated date - WITHOUT the video part until the video is filmed (Owner), and without
//   the "Features" breadcrumb / related links of the sketch, whose pages do not exist yet.
// Every fact is the live product's (landing FAQ / plans: Free-10, ₪30 incl. VAT / $18, SMART PACK ₪10 / ₪102, $5 / $51).
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import ProFlowLogo from '../components/ProFlowLogo';
import { FONT_HE } from '../theme/neonTheme';
import { TOOLS } from '../theme/toolsLightTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeo } from '../shared/publicSeoRoutes';
import './marketingPages.css';

const MARKETING_PATHS = Object.freeze({
  compare: { he: '/he/compare/word-excel-whatsapp', en: '/en/compare/word-excel-whatsapp' },
  smartQuote: { he: '/he/features/smart-quote', en: '/en/features/smart-quote' },
});
const UPDATED = '26/11/2026';
// the step screens, each cropped at a text-free row (no line cut at the bottom edge - LIVE check 26/11): their heights at 390 px wide
const SHOT_H = { he: [524, 578, 618], en: [562, 597, 566] }; // step 2 is 358 wide: cropped exactly to the AI window, so no letter of the dimmed page behind it is cut at the edge // HE and EN end at the same row: after "Upload a file", after item 2's qty row, after the total

const COMPARE = {
  he: {
    cta: '10 הצעות חינם', h1: 'TEKANGO מול הצעת מחיר בוורד, באקסל או בוואטסאפ',
    lead: 'רוב העסקים מתחילים עם מסמך וורד, גיליון אקסל או הודעה בוואטסאפ. ככה זה נראה כשעוברים למערכת שבנויה להצעות מחיר.',
    updated: 'עודכן ב-', colWhat: 'מה צריך', colOld: 'וורד, אקסל או וואטסאפ',
    rows: [
      ['הכנת ההצעה', 'בוחרים פריטים מהקטלוג או מתארים במילים, והסכומים והמע״מ מחושבים לבד', 'מעתיקים מסמך ישן, מקלידים ומחשבים בעצמכם'],
      ['מראה מקצועי', 'מסמך עם הלוגו והפרטים שלכם, בשלושה סגנונות', 'תלוי בתבנית שבניתם'],
      ['שליחה ללקוח', 'קישור בוואטסאפ או במייל', 'קובץ מצורף או הודעה'],
      ['לדעת שהלקוח פתח', 'רואים אם ההצעה נפתחה וכמה פעמים', 'לא יודעים'],
      ['אישור הלקוח', 'חתימה דיגיטלית מהטלפון', 'הדפסה וסריקה, או "מאשר" בהודעה'],
      ['שינוי אחרי שליחה', 'הקישור מתעדכן עד שהלקוח חותם', 'שולחים קובץ חדש ומקווים שיפתח את הנכון'],
      ['מעקב', 'רשימה אחת עם מצב כל הצעה: טיוטה, נשלחה, נצפתה, אושרה', 'תיקיות, קבצים וגלילה בשיחות'],
      ['עלות', <>10 הצעות חינם, ואז <bdi dir="ltr">₪30.00</bdi> לחודש כולל מע״מ</>, 'כלים שכבר יש לכם'],
    ],
    whenH: 'מה מתאים למי', oldOkH: 'וורד או אקסל מספיקים כש...', oldOk: ['שולחים הצעה אחת לכמה חודשים', 'לא צריך חתימה של הלקוח', 'לא חשוב לדעת אם הלקוח פתח'],
    tkH: 'TEKANGO שווה את זה כש...', tk: ['שולחים כמה הצעות בשבוע', 'רוצים חתימה של הלקוח בלי הדפסות', 'רוצים לראות מי פתח ומי מחכה לטלפון', 'עובדים מהטלפון, גם בשטח'],
    endH: 'רוצים לנסות על ההצעה הבאה?', endP: '10 הצעות חינם, בלי כרטיס אשראי.',
  },
  en: {
    cta: '10 free quotes', h1: 'TEKANGO vs. a quote in Word, Excel or WhatsApp',
    lead: 'Most businesses start with a Word document, an Excel sheet or a WhatsApp message. This is what changes when you move to an app built for quotes.',
    updated: 'Updated on ', colWhat: 'What you need', colOld: 'Word, Excel or WhatsApp',
    rows: [
      ['Making the quote', 'Pick items from your catalog or describe the job in words; totals are calculated for you', 'Copy an old document, type and calculate yourself'],
      ['A professional look', 'A document with your logo and details, in three styles', 'Depends on the template you built'],
      ['Sending it', 'A link by WhatsApp or e-mail', 'An attachment or a message'],
      ['Knowing the client opened it', 'You see whether the quote was opened and how many times', 'You don\'t know'],
      ['Client approval', 'A digital signature from the phone', 'Print and scan, or "OK" in a message'],
      ['Changes after sending', 'The link updates until the client signs', 'Send a new file and hope they open the right one'],
      ['Follow-up', 'One list with the status of every quote: draft, sent, viewed, approved', 'Folders, files and scrolling through chats'],
      ['Cost', '10 free quotes, then $18 a month', 'Tools you already have'],
    ],
    whenH: 'Which fits whom', oldOkH: 'Word or Excel are enough when...', oldOk: ['You send one quote every few months', 'You don\'t need the client\'s signature', 'It doesn\'t matter whether the client opened it'],
    tkH: 'TEKANGO is worth it when...', tk: ['You send several quotes a week', 'You want the client\'s signature without printing', 'You want to see who opened and who is waiting for a call', 'You work from your phone, on site too'],
    endH: 'Want to try it on your next quote?', endP: '10 free quotes, no card needed.',
  },
};

const SMART = {
  he: {
    cta: '10 הצעות חינם', h1: 'הצעת מחיר חכמה מתיאור', updated: 'עודכן ב-',
    shortH: 'בקצרה', shortP: 'מתארים את העבודה במילים, או אומרים אותה בקול, ו-TEKANGO בונה טיוטה של שורות וכמויות. אתם ממלאים את המחיר שלכם בכל שורה, משנים מה שצריך ושומרים.',
    shortL: ['בלי להקליד שורה אחרי שורה', 'אפשר לדבר במקום להקליד', 'המחיר תמיד שלכם, לא של ה-AI', 'שום דבר לא נשלח ללקוח עד שאתם שולחים'],
    stepsH: 'שלושה צעדים',
    steps: [
      ['בוחרים "מתארים ל-AI"', 'בהצעה חדשה, במסך "איך תרצו להתחיל?".', 'מסך "איך תרצו להתחיל?" עם האפשרות "מתארים ל-AI"'],
      ['מתארים ובודקים את הטיוטה', 'כותבים או אומרים, למשל "החלפת 3 חלונות ודלת הזזה, פירוק הישנים והתקנה". מסמנים את השורות שמתאימות וממלאים את המחיר שלכם.', 'חלון ההצעה החכמה עם טיוטת השורות'],
      ['מוסיפים להצעה ושומרים', 'השורות נכנסות לעורך ההצעה. משנים מה שצריך, ושומרים או שולחים ללקוח.', 'עורך ההצעה עם השורות שנוספו'],
    ],
    faqH: 'שאלות נפוצות',
    faq: [
      ['האם ה-AI קובע את המחירים?', 'לא. ה-AI מציע שורות וכמויות, ואתם ממלאים את המחיר שלכם בכל שורה.'],
      ['אפשר לדבר במקום להקליד?', 'כן. לוחצים על המיקרופון ואומרים את העבודה.'],
      ['מה קורה אם הטיוטה לא מדויקת?', 'מסמנים רק את השורות שמתאימות, ואת השאר מוחקים או מתקנים בעורך. אפשר גם ללחוץ על "תיאור אחר" ולנסות שוב.'],
      ['האם הלקוח רואה את הטיוטה?', 'לא. ההצעה נשלחת ללקוח רק כשאתם שולחים אותה.'],
      ['כמה זה עולה?', <>ההצעה החכמה היא חלק מ&quot;חכם פלוס&quot;, תוספת לבחירה: <bdi dir="ltr">₪10.00</bdi> לחודש, או <bdi dir="ltr">₪102.00</bdi> לשנה במנוי שנתי. בשבעת הימים החינמיים היא כלולה. בחלון רואים כמה אחוזים נשארו לכם מהשימוש החודשי.</>],
    ],
    endH: 'רוצים לנסות?', endP: 'פותחים חשבון בחינם ומכינים את ההצעה הראשונה.',
  },
  en: {
    cta: '10 free quotes', h1: 'Smart quote from a description', updated: 'Updated on ',
    shortH: 'In short', shortP: 'Describe the job in words, or just say it, and TEKANGO builds a draft with lines and quantities. You fill in your own price on every line, change what you need, and save.',
    shortL: ['No typing line after line', 'Speak instead of typing', 'The price is always yours, not the AI\'s', 'Nothing reaches the client until you send it'],
    stepsH: 'Three steps',
    steps: [
      ['Choose "Describe it to AI"', 'In a new quote, on the "How would you like to start?" screen.', 'The "How would you like to start?" screen with "Describe it to AI"'],
      ['Describe it and check the draft', 'Type or say it, e.g. "Replace 3 windows and a sliding door, remove the old ones and install". Tick the lines that fit and fill in your price.', 'The smart quote window with the draft lines'],
      ['Add to the quote and save', 'The lines go into the quote editor. Change what you need, then save or send it to the client.', 'The quote editor with the added lines'],
    ],
    faqH: 'Frequently asked questions',
    faq: [
      ['Does the AI set the prices?', 'No. The AI suggests lines and quantities, and you fill in your own price on every line.'],
      ['Can I speak instead of typing?', 'Yes. Tap the microphone and say the job.'],
      ['What if the draft is not accurate?', 'Tick only the lines that fit, and delete or fix the rest in the editor. You can also tap "Different description" and try again.'],
      ['Does the client see the draft?', 'No. The client gets the quote only when you send it.'],
      ['How much does it cost?', 'The smart quote is part of SMART PACK, an optional add-on: $5 a month, or $51 a year with a yearly plan. It is included during the 7 free days. The window shows how many percent of this month\'s usage you have left.'],
    ],
    endH: 'Want to try it?', endP: 'Open a free account and make your first quote.',
  },
};

const navy = TOOLS.button;
const box = { background: '#ffffff', border: `1px solid ${TOOLS.border}`, borderRadius: '12px', padding: '18px 20px' };

function PageFrame({ lang, seoPath, cta, testId, children }) {
  const navigate = useNavigate();
  const he = lang === 'he';
  useEffect(() => { setSeoMeta(publicSeo(seoPath)); }, [seoPath]);
  const signup = () => navigate(`/dashboard?signup=true&lang=${lang}`);
  return (
    <div style={{ minHeight: '100vh', display: 'flow-root', background: TOOLS.bg, color: TOOLS.textPrimary, fontFamily: FONT_HE, lineHeight: 1.65 }} dir={he ? 'rtl' : 'ltr'} lang={lang} data-testid={testId}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* PRODUCT_TRUTH_DECORATIVE: the logo links back to the landing page of the same language */}
        <a href={`/${lang}`} aria-label="TEKANGO" onClick={(e) => { e.preventDefault(); navigate(`/${lang}`); }} style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}><ProFlowLogo size={26} darkText /></a>
        {/* PRODUCT_TRUTH_DECORATIVE: marketing CTA opening the account-creation screen (the landing signup path) */}
        <button type="button" onClick={signup} style={{ background: navy, color: '#ffffff', border: `1px solid ${navy}`, borderRadius: '8px', minHeight: '44px', padding: '0 18px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{cta}</button>
      </div>
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 16px 40px' }}>{children(signup)}</main>
    </div>
  );
}

const h1Style = { fontSize: 'clamp(26px, 4vw, 40px)', lineHeight: 1.2, margin: '8px 0', color: navy, fontWeight: 800 };
const updatedStyle = { fontSize: '14px', color: TOOLS.textSecondary, margin: '0 0 22px' };
const secH2 = { fontSize: '24px', color: navy, margin: '34px 0 12px', fontWeight: 800 };

function EndBox({ h, p, cta, onCta }) {
  return (
    <div style={{ marginTop: '34px', background: TOOLS.accentSoft, borderRadius: '14px', padding: '22px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
      <div style={{ minWidth: 0, flex: '1 1 260px' }}><h2 style={{ margin: '0 0 4px', fontSize: '20px', color: navy, fontWeight: 700 }}>{h}</h2><p style={{ margin: 0, color: TOOLS.textSecondary }}>{p}</p></div>
      {/* PRODUCT_TRUTH_DECORATIVE: marketing CTA opening the account-creation screen (the landing signup path) */}
      <button type="button" onClick={onCta} style={{ background: navy, color: '#ffffff', border: `1px solid ${navy}`, borderRadius: '8px', minHeight: '44px', padding: '0 18px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{cta}</button>
    </div>
  );
}

export function ComparePage({ lang = 'he' }) {
  const t = COMPARE[lang];
  const cell = { padding: '12px 14px', textAlign: 'start', verticalAlign: 'top', borderBottom: '1px solid #e8eef0' };
  return (
    <PageFrame lang={lang} seoPath={MARKETING_PATHS.compare[lang]} cta={t.cta} testId="compare-page">
      {(signup) => (
        <>
          <h1 style={h1Style}>{t.h1}</h1>
          <p style={{ fontSize: '18px', color: TOOLS.textSecondary, margin: '0 0 6px', maxWidth: '760px' }}>{t.lead}</p>
          <p style={updatedStyle}>{t.updated}<bdi dir="ltr">{UPDATED}</bdi></p>
          <div className="tl-compare-table" style={{ background: '#ffffff', border: `1px solid ${TOOLS.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
              <thead><tr>{[t.colWhat, 'TEKANGO', t.colOld].map((h) => <th key={h} scope="col" style={{ ...cell, background: navy, color: '#ffffff', fontWeight: 700 }}>{h}</th>)}</tr></thead>
              <tbody>
                {t.rows.map(([a, b, c]) => (
                  <tr key={a}>
                    <th scope="row" style={{ ...cell, fontWeight: 700, color: navy, width: '24%' }}>{a}</th>
                    <td style={cell}><span style={{ display: 'inline-flex', gap: '6px', alignItems: 'baseline' }}><Check size={15} strokeWidth={3} color="#24694c" aria-hidden="true" style={{ flexShrink: 0, alignSelf: 'center' }} /><span>{b}</span></span></td>
                    <td style={{ ...cell, color: TOOLS.textSecondary }}>{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tl-compare-cards" style={{ display: 'none', gap: '12px' }}>
            {t.rows.map(([a, b, c]) => (
              <div key={a} style={{ ...box, padding: '14px 16px' }}>
                <h3 style={{ margin: '0 0 8px', color: navy, fontSize: '17px', fontWeight: 700 }}>{a}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7.5em) minmax(0, 1fr)', gap: '8px', padding: '6px 0', borderTop: '1px solid #eef2f4', fontSize: '15px' }}><b style={{ color: TOOLS.textSecondary, fontWeight: 600 }}>TEKANGO</b><span>{b}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7.5em) minmax(0, 1fr)', gap: '8px', padding: '6px 0', borderTop: '1px solid #eef2f4', fontSize: '15px' }}><b style={{ color: TOOLS.textSecondary, fontWeight: 600 }}>{t.colOld}</b><span>{c}</span></div>
              </div>
            ))}
          </div>
          <h2 style={secH2}>{t.whenH}</h2>
          <div className="tl-compare-two" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '16px' }}>
            {[[t.oldOkH, t.oldOk], [t.tkH, t.tk]].map(([h, items]) => (
              <div key={h} style={box}><h3 style={{ margin: '0 0 8px', color: navy, fontSize: '18px', fontWeight: 700 }}>{h}</h3><ul style={{ margin: 0, paddingInlineStart: '20px', listStyleType: 'disc' }}>{items.map((x) => <li key={x} style={{ margin: '4px 0' }}>{x}</li>)}</ul></div>
            ))}
          </div>
          <EndBox h={t.endH} p={t.endP} cta={t.cta} onCta={signup} />
        </>
      )}
    </PageFrame>
  );
}

export function SmartQuoteFeaturePage({ lang = 'he' }) {
  const t = SMART[lang];
  return (
    <PageFrame lang={lang} seoPath={MARKETING_PATHS.smartQuote[lang]} cta={t.cta} testId="feature-smart-quote">
      {(signup) => (
        <>
          <h1 style={h1Style}>{t.h1}</h1>
          <p style={updatedStyle}>{t.updated}<bdi dir="ltr">{UPDATED}</bdi></p>
          <div style={{ ...box, maxWidth: '760px' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: navy, fontWeight: 700 }}>{t.shortH}</h2>
            <p style={{ margin: '0 0 10px' }}>{t.shortP}</p>
            <ul style={{ margin: 0, paddingInlineStart: '20px', listStyleType: 'disc' }}>{t.shortL.map((x) => <li key={x} style={{ margin: '4px 0' }}>{x}</li>)}</ul>
          </div>
          <h2 style={secH2}>{t.stepsH}</h2>
          <ol className="fp-steps">
            {t.steps.map(([h, p, alt], i) => (
              <li key={h} style={{ ...box, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: 0, color: navy, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span aria-hidden="true" style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: navy, color: '#ffffff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800 }}>{i + 1}</span>{h}
                </h3>
                <p style={{ margin: 0, color: TOOLS.textSecondary }}>{p}</p>
                <img src={`/assets/features/smart-quote-step${i + 1}-${lang}.png`} alt={alt} width={i === 1 ? 358 : 390} height={SHOT_H[lang][i]} loading="lazy" decoding="async" className="fp-shot" style={{ borderRadius: '10px', border: `1px solid ${TOOLS.border}` }} />
              </li>
            ))}
          </ol>
          <h2 style={secH2}>{t.faqH}</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {t.faq.map(([q, a], i) => (
              <details key={q} className="fp-faq" open={i === 0} style={{ ...box, padding: '8px 20px' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: opens / closes one answer of the public capability page FAQ */}
                <summary><h3 style={{ margin: 0, color: navy, fontSize: '17px', fontWeight: 700 }}>{q}</h3></summary>
                <p style={{ margin: '0 0 10px', color: TOOLS.textSecondary }}>{a}</p>
              </details>
            ))}
          </div>
          <EndBox h={t.endH} p={t.endP} cta={t.cta} onCta={signup} />
        </>
      )}
    </PageFrame>
  );
}
