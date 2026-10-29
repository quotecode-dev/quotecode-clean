// Task 16 (correction A) - the landing's readable sample quotation (Classic / Modern / Visual), following the approved
// refined reference composition (revision-r2-refined app.js quote()). Pure presentation: no controls, no headings
// (the page keeps a single h1), every text >= 12px. The full-size real page is /he|en/sample-quote.
import { buildLandingQuoteModel } from './landingQuoteModel';
import { Download, MessageCircle, Phone, Printer } from 'lucide-react';
import { QuoteItemThumb } from '../../quoteDocument/QuoteMedia';

function Issuer({ m }) {
  return (
    <div className="tl-issuer">
      <img className="tl-issuer-logo" src={m.logo} alt={m.business} width="218" height="52" />
      <div className="tl-issuer-details">
        <b>{m.business}</b>
        <span className="tl-issuer-phone"><bdi dir="ltr">{m.businessPhone}</bdi></span>
        <span>{m.businessEmail}</span>
        <span>{m.businessAddress}</span>
      </div>
    </div>
  );
}

function Meta({ m, includeNumber = true }) {
  return (
    <div className="tl-meta">
      {includeNumber && <div className="tl-meta-cell"><small>{m.labels.number}</small><b dir="ltr">{m.number}</b></div>}
      <div className="tl-meta-cell"><small>{m.labels.date}</small><b dir="ltr">{m.date}</b></div>
      <div className="tl-meta-cell"><small>{m.labels.valid}</small><b dir="ltr">{m.valid}</b></div>
    </div>
  );
}

// Recipient area - the public quote renderer's base contract: "לכבוד"/"To" + the CLIENT block first (RTL places it on
// the right, LTR on the left), then "לידי"/"Attn" + the independent CONTACT block (opposite side on wide screens, its
// own block below on narrow ones). No contact -> no contact block. The business is NOT a recipient party; it stays in
// the document header (issuer) and the footer.
function Parties({ m }) {
  return (
    <div className="tl-parties" data-landing-parties="">
      <div className="tl-party tl-party--client" data-role="client">
        <small>{m.labels.to}</small>
        <b className="tl-party-name">{m.client.name}</b>
        {m.client.details.map((d) => <span key={d}>{d}</span>)}
      </div>
      {m.contact && (
        <div className="tl-party tl-party--contact" data-role="contact">
          <small>{m.labels.attn}</small>
          <b className="tl-party-name">{m.contact.name}</b>
          {m.contact.role && <span>{m.contact.role}</span>}
        </div>
      )}
    </div>
  );
}

// Landing sample numeric axis (Owner 2026-10-06): the three numeric columns use a physical right edge plus a fixed
// decimal slot. This keeps ones under ones, tens under tens and decimal points on one vertical axis, including mixed
// quantities such as 2 / 3.4 / 1. Figures remain tabular/lining and LTR-isolated.
function AlignedNumber({ value }) {
  const text = String(value);
  const match = text.match(/^([−-]?[₪$]?)([\d,]+)(\.\d+)?$/u);
  if (!match) return text;
  const [, prefix, integer, fraction] = match;
  // Codex release 3 step 1 (Owner 2026-10-29, typed: "מאשר שחרור 3 של קודקס: נגישות המספרים ... כולל שינוי ב-L-02, L-15, בלי שינוי
  // באנימציה ובמראה"): an aria-label on a plain span is not announced (a prohibited-ARIA finding on every sample number); the full value is
  // one screen-reader-only text (.sr-only, out of the grid flow) and the two visual fragments stay hidden from assistive technology
  return (
    <span className="tl-num-value">
      <span className="sr-only">{text}</span>
      <span className="tl-num-integer" aria-hidden="true">{prefix}{integer}</span>
      <span className={`tl-num-fraction${fraction ? '' : ' tl-num-fraction--placeholder'}`} aria-hidden="true">
        {fraction || '.0'}
      </span>
    </span>
  );
}

function HeaderCall({ m }) {
  return (
    <span className="tl-header-call" aria-hidden="true">
      <Phone size={13} strokeWidth={2.2} />{m.labels.call}
    </span>
  );
}

function Items({ m, expanded, showImages }) {
  return (
    <table className="tl-items">
      <colgroup><col className="tl-c1" /><col className="tl-c2" /><col className="tl-c3" /><col className="tl-c4" /></colgroup>
      <thead>
        <tr>
          <th scope="col">{m.labels.item}</th>
          <th scope="col" className="tl-num tl-num-axis tl-qty-axis">{m.labels.qty}</th>
          <th scope="col" className="tl-num tl-num-axis">{m.labels.unit}</th>
          <th scope="col" className="tl-num tl-num-axis">{m.labels.amount}</th>
        </tr>
      </thead>
      <tbody>
        {m.rows.map((r) => (
          <tr key={r.name}>
            <td>
              <div className={showImages && r.image ? 'tl-item-with-thumb' : undefined}>
                {showImages && r.image && <QuoteItemThumb image={{ url: r.image.src, alt: r.image.alt, role: 'item' }} isHebrew={m.lang === 'he'} />}
                <div className="tl-item-text"><b>{r.name}</b>{expanded && <span className="tl-item-detail">{r.detail}</span>}</div>
              </div>
            </td>
            <td className="tl-num tl-num-axis tl-qty-axis" dir="ltr"><AlignedNumber value={r.qty} /></td>
            <td className="tl-num tl-num-axis" dir="ltr"><AlignedNumber value={r.unit} /></td>
            <td className="tl-num tl-num-axis" dir="ltr"><AlignedNumber value={r.amount} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ m }) {
  return (
    <div className="tl-totals">
      <div className="tl-total-row"><span>{m.labels.subtotal}</span><b className="tl-total-amount" dir="ltr"><AlignedNumber value={m.totals.subtotal} /></b></div>
      <div className="tl-total-row"><span>{m.labels.discount}</span><b className="tl-total-amount" dir="ltr"><AlignedNumber value={m.totals.discount} /></b></div>
      {m.totals.tax && <div className="tl-total-row"><span>{m.labels.tax}</span><b className="tl-total-amount" dir="ltr"><AlignedNumber value={m.totals.tax} /></b></div>}
      <div className="tl-total-row tl-final"><span>{m.labels.total}</span><b className="tl-total-amount" dir="ltr"><AlignedNumber value={m.totals.total} /></b></div>
    </div>
  );
}

function Closing({ m, notes = true }) {
  return (
    <>
      {notes && (
        <div className="tl-notes">
          <div className="tl-note"><b>{m.labels.notes}</b>{m.notes}</div>
          <div className="tl-note"><b>{m.labels.terms}</b>{m.terms}</div>
        </div>
      )}
      <div className="tl-approval">
        <div className="tl-approval-copy"><b>{m.labels.approve}</b><span>{m.labels.approveText}</span></div>
        <div className="tl-sigline">{m.labels.signature}</div>
      </div>
    </>
  );
}

function Actions({ m }) {
  return (
    <div className="tl-doc-actions" aria-hidden="true">
      <span className="tl-doc-action tl-doc-action--pdf"><Download size={22} />{m.labels.pdf}</span>
      <span className="tl-doc-action tl-doc-action--print"><Printer size={22} />{m.labels.print}</span>
      <span className="tl-doc-action tl-doc-action--call"><Phone size={22} />{m.labels.call}</span>
      <span className="tl-doc-action tl-doc-action--whatsapp"><MessageCircle size={22} />{m.labels.whatsapp}</span>
    </div>
  );
}

function Figure({ img, overlay }) {
  return (
    <figure className="tl-figure">
      <img src={img.src} alt="" width="240" height="180" loading="lazy" decoding="async" />
      <figcaption className={overlay ? 'tl-cap tl-cap--overlay' : 'tl-cap'}>{img.caption}</figcaption>
    </figure>
  );
}

export default function LandingQuoteDocument({ locale = 'he', style = 'classic', expanded = false, compactMobile = false, contact }) {
  const m = buildLandingQuoteModel(locale, { contact });
  const bandEnd = style === 'visual'
    ? <div className="tl-visual-number"><span className="tl-kicker">{m.labels.quote}</span><b dir="ltr">{m.number}</b></div>
    : null;
  return (
    <article className={`tl-doc tl-doc--${style}${compactMobile ? ' tl-doc--compact-mobile' : ''}`} dir={m.dir} lang={m.lang} data-landing-doc={style}>
      <div className="tl-doc-pad">
        {style === 'classic' && (
          <>
            <div className="tl-letterhead-band">
              <div className="tl-brandline"><Issuer m={m} /><div className="tl-band-corner"><HeaderCall m={m} />{bandEnd}</div></div>
              <Meta m={m} />
            </div>
            <div className="tl-classic-rule" />
            <div className="tl-doc-title">{m.labels.quote} · {m.title}</div>
            <p className="tl-doc-subtitle">{m.subtitle}</p>
          </>
        )}
        {style === 'modern' && (
          <>
            <div className="tl-letterhead-band">
              <div className="tl-brandline"><Issuer m={m} /><div className="tl-band-corner"><HeaderCall m={m} />{bandEnd}</div></div>
              <Meta m={m} />
            </div>
            <span className="tl-kicker">{m.labels.quote} <span dir="ltr">{m.number}</span></span>
            <div className="tl-doc-title">{m.title}</div>
            <p className="tl-doc-subtitle">{m.subtitle}</p>
          </>
        )}
        {style === 'visual' && (
          <>
            <div className="tl-letterhead-band">
              <div className="tl-brandline"><Issuer m={m} /><div className="tl-band-corner"><HeaderCall m={m} />{bandEnd}</div></div>
              <Meta m={m} includeNumber={false} />
            </div>
            <div className="tl-doc-title">{m.title}</div>
            <p className="tl-doc-subtitle">{m.subtitle}</p>
          </>
        )}
        {style === 'modern' && (
          <div className="tl-rail">{m.images.map((img) => <Figure key={img.src} img={img} />)}</div>
        )}
        {style === 'visual' && (
          <div className="tl-visual-area">
            <div className="tl-visual-hero"><Figure img={m.images[0]} overlay /></div>
            <div className="tl-visual-side"><Figure img={m.images[1]} overlay /><Figure img={m.images[2]} overlay /></div>
          </div>
        )}
        <Parties m={m} />
        <Items m={m} expanded={expanded} showImages={style !== 'classic'} />
        <Totals m={m} />
        <Closing m={m} />
        <Actions m={m} />
      </div>
      <div className="tl-doc-foot"><span>{m.business}</span><span dir="ltr">{m.number} · 1 / 1</span></div>
    </article>
  );
}
