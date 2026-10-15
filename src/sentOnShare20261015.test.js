// Owner 2026-10-15 (a real WhatsApp share stayed "Needs sending"): every send path, checked in the source - WhatsApp (list, cards,
// statistics: all reach sendWhatsApp) marks Sent when WhatsApp opens, email marks Sent after a successful send, both only in the legacy
// output phase; "Copy message" never marks; the Issue flow and the manual status keep their existing save path. And the legal pages'
// Back works in a new tab.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const src = (p) => readFileSync(join(cwd(), p), 'utf8');
const dash = src('src/pages/Dashboard.jsx');
const body = (name) => { const i = dash.indexOf(`const ${name} = `); expect(i, name).toBeGreaterThan(-1); const j = dash.indexOf('\n  };', i); return dash.slice(i, j); };

describe('sent-on-share wiring', () => {
  it('WhatsApp: marks Sent right after WhatsApp opens, only on the legacy path (authorized = enforced -> the server marks)', () => {
    const b = body('sendWhatsApp');
    const open = b.indexOf("else window.open(url, '_blank');");
    const mark = b.indexOf('if (!authorized) markSentAfterShare(proposal);');
    expect(open).toBeGreaterThan(-1); expect(mark).toBeGreaterThan(open);
    // the unfinished-draft and missing-price guards still run before anything is opened or marked
    expect(b.indexOf('isUnfinishedSavedQuote(proposal)')).toBeLessThan(open);
  });
  it('email: marks Sent only after the success, never in the enforced phase', () => {
    const b = body('executeEmailSend');
    const ok = b.indexOf("'📧 Email sent successfully!'");
    const mark = b.indexOf("if (sendGate.mode !== 'authority_required') markSentAfterShare(quote);");
    expect(ok).toBeGreaterThan(-1); expect(mark).toBeGreaterThan(ok);
    expect(b.slice(b.indexOf('} catch (err)'))).not.toContain('markSentAfterShare');
  });
  it('copy message is not a send; the issue flow + manual status keep the save path', () => {
    expect(body('copyQuoteMessage')).not.toContain('markSentAfterShare');
    expect(dash.match(/markSentAfterShare\(/g)).toHaveLength(2); // exactly the WhatsApp + email calls (the definition is "= async (proposal)")
    expect(body('requestIssueQuote')).toContain("setQuoteStatus('Sent')");
  });
  it('legal pages: Back uses goBackOrHome (works in a new tab)', () => {
    for (const p of ['src/pages/Terms.jsx', 'src/pages/Privacy.jsx', 'src/pages/Contact.jsx']) {
      const s = src(p);
      expect(s, p).not.toContain('navigate(-1)');
      expect(s, p).toContain('onClick={() => goBackOrHome(navigate, isHebrew)}');
    }
  });
});
