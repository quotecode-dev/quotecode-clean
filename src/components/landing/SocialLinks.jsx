// Owner console 2026-11-05 (typed: "מאשר הוספת קישורים לרשתות החברתיות בתחתית דפי הנחיתה לפי השוק, כולל שינוי ב-L-06, שחרור עד הלייב
// אחרי שאאשר את המראה מצילומים בבוקר"; "לשים אייקונים קטנים למטה של הרשתות החברתיות וכמובן האנגלית לאנגלית והעברית לעברית"): small
// icons at the bottom of the landing page, each market its own accounts (Hebrew page = TEKANGO Israel, English page = TEKANGO Global),
// every link in a new tab. The networks' own marks, one colour (currentColor) - a network's trademark is the one exception to the single
// TEKANGO icon set.
const MARKS = {
  facebook: <path d="M9.1 23.7v-8H6.6V12h2.5v-1.6c0-4.1 1.8-6 5.9-6 .8 0 2.1.2 2.6.3v3.3h-1.4c-1.9 0-2.4.7-2.4 2.2V12h3.9l-.7 3.7h-3.2V24c5.9-.7 10.2-5.8 10.2-12C24 5.4 18.6 0 12 0S0 5.4 0 12c0 5.6 3.9 10.4 9.1 11.7Z" />,
  instagram: (
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="17.6" cy="6.4" r="1.35" />
    </>
  ),
  tiktok: <path d="M12.5 0h3.9c.1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8V10c-1.4 0-2.9-.3-4.2-1-.6-.3-1.1-.6-1.6-.9v8.7c-.1 1.4-.5 2.8-1.4 3.9a7.2 7.2 0 0 1-5.9 3.2c-1.4.1-2.9-.3-4.1-1A7.1 7.1 0 0 1 1.7 17c0-.5 0-1 0-1.5.2-1.9 1.1-3.7 2.6-5a7.3 7.3 0 0 1 6.1-1.7v4.4c-1-.3-2.1-.2-3 .4-.6.4-1.1 1-1.4 1.8-.2.5-.1 1.1-.1 1.6.2 1.6 1.8 3 3.5 2.9 1.1 0 2.2-.7 2.8-1.6.2-.3.4-.7.4-1.1.1-1.8.1-3.6.1-5.4V0Z" />,
  youtube: <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.5 15.6V8.4l6.3 3.6-6.3 3.6Z" />,
};

export default function SocialLinks({ links = [], label }) {
  if (!links.length) return null;
  return (
    <nav className="tl-footer-social" aria-label={label} data-social-links>
      {links.map((l) => (
        // PRODUCT_TRUTH_DECORATIVE: opens the market's own TEKANGO social account in a new tab; nothing on the site changes
        <a key={l.network} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label} data-social={l.network}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">{MARKS[l.network]}</svg>
        </a>
      ))}
    </nav>
  );
}
