// Task 21 - "AI smart quote" draft dialog (opened by the AI choice of the new-quote menu, on top of the blank quote form).
// The user describes the job; the server (ai-quote-draft) proposes quote LINES; the user reviews them, unticks what does not fit and
// explicitly applies the rest to the UNSAVED form, where every line stays editable. Nothing is saved, issued or sent here.
// Prices: only lines matched to the user's own catalog carry that catalog price; every other line arrives without a price and the form
// asks for it. When the function is not available on this server the dialog says so plainly and offers manual entry / the AI chat.
// Task 33 (contract v2): the review shows, per line, the description, quantity, unit, where the quantity comes from (the user's text /
// a shown calculation / an implied single piece), the price source (verified catalog row / unverified price unit / none) and what is
// missing - plus the user's own text, the clarification questions and any written measure no line uses. Every line is editable; a ticked
// line without a positive quantity blocks "add" until the user fills or unticks it. A unit change drops a catalog price (its price unit
// was verified only for the server's unit). Apply runs once per draft.
// Task 34 (contract v3): each line also shows the part of the user's own text it comes from; a quantity the server could not bind to that
// part arrives empty with an explicit "could not verify" note - the user enters it.
// Owner console 2026-10-19 (voice assistant; "שזה ייושם גם בהצעת AI החכמה"): the description can be dictated (a microphone under the
// field adds the spoken text to it), and the draft's clarification questions can be answered by voice - the answer is added to the
// description and the draft is generated again. Shown only when the Dashboard passes `transcribe` and the browser can record.
import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, Check, Mic, Square } from 'lucide-react';
import useVoiceRecorder from '../hooks/useVoiceRecorder';
import AiModalHeader from './AiModalHeader';
import { APP as NEON } from '../theme/neonTheme';
import { MAX_DESCRIPTION_CHARS, MIN_DESCRIPTION_CHARS, DRAFT_UNITS } from '../../supabase/functions/_shared/aiQuoteDraft.js';
import { getProfessionalUnitLabel } from '../utils/professionalQuoteItem';

const positiveQuantity = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) && n > 0 && n <= 100000 ? Math.round(n * 100) / 100 : null;
};
// Task 34 extension (Owner AI specification, section ד): for a line whose quantity is missing AND whose unit is unknown, quantity and unit
// are decided TOGETHER - the unit starts unchosen and must be an explicit choice ("no unit" included) before the line can be added.
const toEditable = (line) => ({ ...line, quantityInput: line.quantity != null ? String(line.quantity) : '', edited: false, original: line,
  unitChosen: line.quantity != null || line.unit != null });

const COPY = {
  he: {
    title: 'הצעת מחיר חכמה עם AI',
    intro: 'תארו את העבודה במילים שלכם. ה-AI יציע פריטים להצעה, ואתם תבדקו ותחליטו מה להוסיף.',
    label: 'מה העבודה?',
    placeholder: 'לדוגמה: החלפת 3 חלונות אלומיניום בסלון, כולל פירוק החלונות הישנים והתקנת רשתות',
    generate: 'יצירת טיוטה עם AI',
    generating: 'ה-AI מכין טיוטה…',
    manual: 'מילוי ידני',
    tooShort: `כתבו לפחות ${MIN_DESCRIPTION_CHARS} תווים על העבודה.`,
    reviewTitle: 'טיוטה מוצעת — בדקו לפני שמוסיפים',
    reviewHint: 'סמנו את הפריטים שמתאימים ותקנו תיאור, כמות או יחידה לפי הצורך. אחרי ההוספה אפשר לערוך כל פריט בטופס. שום דבר לא נשמר עד שתשמרו את ההצעה.',
    yourText: 'התיאור שלכם',
    subject: 'נושא מוצע',
    itemText: 'תיאור הפריט',
    qty: 'כמות',
    unit: 'יחידה',
    noUnit: 'ללא יחידה',
    chooseUnit: 'בחרו יחידה',
    blockedLines: (names) => `כדי להוסיף, השלימו כמות ויחידה ב: ${names} — או בטלו את הסימון שלהם.`,
    goToField: 'מעבר לשדה',
    againLoses: 'תיקנתם פריטים בטיוטה הזו. תיאור חדש יבטל את התיקונים. להמשיך?',
    againConfirm: 'כן, לתיאור חדש',
    againKeep: 'להישאר בטיוטה',
    price: 'מחיר',
    fromCatalog: 'מהקטלוג',
    catalogItem: (name) => `מהקטלוג: ${name}`,
    needsPrice: 'יש להזין מחיר',
    needsPriceNoMatch: 'יש להזין מחיר — לא נמצא פריט תואם בקטלוג',
    unitUnverified: (name) => `נמצא בקטלוג „${name}”, אבל יחידת המחיר שלו לא תואמת בוודאות ליחידה הזו — יש להזין מחיר`,
    basis: { stated: 'הכמות מהתיאור', derived: (d) => `חושב מהתיאור: ${d}`, implied_single: 'כמות 1 משתמעת מהתיאור — בדקו', edited: 'עודכן על ידיכם' },
    missingLabel: 'חסר',
    missingQuantity: 'כמות',
    unverified: 'לא הצלחנו לאמת מול התיאור לאיזו עבודה שייכת הכמות — בדקו והזינו אותה',
    ambiguous: 'בתיאור מופיעות כמה כמויות שיכולות להתאים לשורה זו — בחרו והזינו את הכמות הנכונה',
    evidence: 'מהתיאור',
    questions: 'כדי להשלים את ההצעה',
    unassigned: (list) => `מידות מהתיאור שלא שויכו לאף פריט: ${list}. בדקו שלא חסר פריט.`,
    needQuantity: 'השלימו כמות בכל פריט מסומן (או בטלו את הסימון שלו) לפני ההוספה.',
    apply: (n) => `הוספת ${n} פריטים להצעה`,
    again: 'תיאור אחר',
    cancel: 'ביטול',
    openChat: 'שאלו את צ׳אט ה-AI',
    dictate: 'הכתבה בקול',
    stopDictate: (s) => `עצירה ושימוש בהקלטה (0:${String(s).padStart(2, '0')})`,
    transcribing: 'ממיר את הדיבור לטקסט…',
    answerByVoice: 'מענה בקול לשאלות',
    voiceErrors: { mic_denied: 'אין גישה למיקרופון. אפשר לאשר גישה בהגדרות הדפדפן, או להקליד.', failed: 'לא הצלחתי להבין את ההקלטה. אפשר לנסות שוב או להקליד.', limit: 'הגעת למכסת הפעולות הקוליות היומית. אפשר להמשיך בהקלדה.' },
    errors: {
      not_deployed: 'שירות טיוטות ה-AI עדיין לא מותקן בשרת הזה (השרת השיב שהשירות לא נמצא). אפשר למלא את ההצעה ידנית או לשאול את צ׳אט ה-AI.',
      service_unreachable: 'שירות טיוטות ה-AI לא זמין בשרת הזה: השרת עצמו עונה, אבל השירות לא ענה לבקשה. בדרך כלל זה אומר שהשירות עדיין לא הותקן בשרת. אפשר למלא את ההצעה ידנית או לשאול את צ׳אט ה-AI.',
      unavailable: 'לא הצלחנו להתחבר לשרת. בדקו את החיבור לאינטרנט ונסו שוב, או מלאו את ההצעה ידנית.',
      offline: 'אין חיבור לאינטרנט. התחברו ונסו שוב, או מלאו את ההצעה ידנית.',
      server_error: 'שירות טיוטות ה-AI נתקל בשגיאה בשרת. נסו שוב מאוחר יותר, או מלאו את ההצעה ידנית.',
      provider: 'שירות ה-AI לא החזיר טיוטה כרגע. נסו שוב בעוד רגע, או מלאו את ההצעה ידנית.',
      no_items: 'לא נמצאו פריטים בתיאור. נסו לפרט יותר מה העבודה כוללת.',
      market_unresolved: 'כדי ליצור טיוטה צריך קודם להשלים את אזור העסק בהגדרות העסק.',
      unauthenticated: 'החיבור לחשבון פג. התחברו מחדש ונסו שוב.',
      invalid: `התיאור צריך להיות באורך ${MIN_DESCRIPTION_CHARS}–${MAX_DESCRIPTION_CHARS} תווים.`,
      failed: 'משהו השתבש ביצירת הטיוטה. נסו שוב, או מלאו את ההצעה ידנית.',
    },
  },
  en: {
    title: 'AI smart quote',
    intro: 'Describe the job in your own words. The AI suggests quote items, and you check and decide what to add.',
    label: 'What is the job?',
    placeholder: 'e.g. Replace 3 aluminium windows in the living room, including removing the old windows and fitting screens',
    generate: 'Create a draft with AI',
    generating: 'The AI is preparing a draft…',
    manual: 'Fill in manually',
    tooShort: `Write at least ${MIN_DESCRIPTION_CHARS} characters about the job.`,
    reviewTitle: 'Suggested draft — check before adding',
    reviewHint: 'Tick the items that fit and correct the description, quantity or unit where needed. After adding, every item stays editable in the form. Nothing is saved until you save the quote.',
    yourText: 'Your description',
    subject: 'Suggested subject',
    itemText: 'Item description',
    qty: 'Qty',
    unit: 'Unit',
    noUnit: 'No unit',
    chooseUnit: 'Choose a unit',
    blockedLines: (names) => `To add, complete the quantity and unit of: ${names} — or untick them.`,
    goToField: 'Go to the field',
    againLoses: 'You changed items in this draft. A new description discards those changes. Continue?',
    againConfirm: 'Yes, new description',
    againKeep: 'Stay in this draft',
    price: 'Price',
    fromCatalog: 'From catalog',
    catalogItem: (name) => `From catalog: ${name}`,
    needsPrice: 'Enter a price',
    needsPriceNoMatch: 'Enter a price — no matching catalog item',
    unitUnverified: (name) => `Found “${name}” in your catalog, but its price unit is not confirmed for this unit — enter a price`,
    basis: { stated: 'Quantity from your description', derived: (d) => `Calculated from your description: ${d}`, implied_single: 'Quantity 1 implied by your description — check it', edited: 'Changed by you' },
    missingLabel: 'Missing',
    missingQuantity: 'quantity',
    unverified: 'We could not verify against your description which job this quantity belongs to — check it and enter it',
    ambiguous: 'Your description has several quantities that could fit this line — pick and enter the right one',
    evidence: 'From your description',
    questions: 'To complete the quote',
    unassigned: (list) => `Measurements in your description not assigned to any item: ${list}. Check that no item is missing.`,
    needQuantity: 'Fill in the quantity of every ticked item (or untick it) before adding.',
    apply: (n) => `Add ${n} items to the quote`,
    again: 'Different description',
    cancel: 'Cancel',
    openChat: 'Ask the AI chat',
    dictate: 'Dictate',
    stopDictate: (s) => `Stop and use the recording (0:${String(s).padStart(2, '0')})`,
    transcribing: 'Turning your speech into text…',
    answerByVoice: 'Answer the questions by voice',
    voiceErrors: { mic_denied: 'No microphone access. You can allow it in your browser settings, or type.', failed: "I couldn't understand the recording. Try again or type.", limit: "You've reached today's voice limit. You can keep typing." },
    errors: {
      not_deployed: 'The AI draft service is not installed on this server yet (the server answered that it was not found). You can fill in the quote manually or ask the AI chat.',
      service_unreachable: 'The AI draft service is not available on this server: the server itself answers, but the service did not respond to the request. This usually means it has not been installed on the server yet. You can fill in the quote manually or ask the AI chat.',
      unavailable: 'We could not reach the server. Check your internet connection and try again, or fill in the quote manually.',
      offline: 'You are offline. Reconnect and try again, or fill in the quote manually.',
      server_error: 'The AI draft service hit a server error. Try again later, or fill in the quote manually.',
      provider: 'The AI service did not return a draft right now. Try again in a moment, or fill in the quote manually.',
      no_items: 'No items were found in the description. Try describing what the job includes in more detail.',
      market_unresolved: 'To create a draft, first complete your business region in Business settings.',
      unauthenticated: 'Your session expired. Sign in again and retry.',
      invalid: `The description must be ${MIN_DESCRIPTION_CHARS}–${MAX_DESCRIPTION_CHARS} characters long.`,
      failed: 'Something went wrong while creating the draft. Try again, or fill in the quote manually.',
    },
  },
};

const inputStyle = (isHebrew) => ({ width: '100%', padding: '11px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 });
const primaryBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: NEON.gradient, color: '#ffffff', border: 'none', padding: '12px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px' };
const secondaryBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'none', border: `1px solid ${NEON.borderStrong}`, color: NEON.textSecondary, padding: '12px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', minHeight: '44px' };

export default function AiQuoteDraftDialog({ isOpen, isHebrew, onClose, onApply, onOpenChat, requestDraft, formatMoneyDisplay, sym, transcribe = null }) {
  const t = COPY[isHebrew ? 'he' : 'en'];
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState('describe'); // describe | loading | review
  const [errorCode, setErrorCode] = useState(null);
  const [draft, setDraft] = useState(null);
  const [lines, setLines] = useState([]);
  const [selected, setSelected] = useState([]);
  const fieldRef = useRef(null);
  const dialogRef = useRef(null);
  const requestSeq = useRef(0);
  const appliedRef = useRef(false);
  const [confirmAgain, setConfirmAgain] = useState(false);
  const voiceTargetRef = useRef('describe'); // 'describe' = add to the description; 'answer' = add, then generate again
  const voice = useVoiceRecorder({ transcribe, onText: (text) => handleVoiceText(text) });

  useEffect(() => {
    if (!isOpen) return;
    setDescription(''); setPhase('describe'); setErrorCode(null); setDraft(null); setLines([]); setSelected([]);
    setTimeout(() => fieldRef.current?.focus(), 0);
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => { requestSeq.current += 1; onClose(); };
  const generate = async (override) => {
    const text = (typeof override === 'string' ? override : description).trim();
    if (text.length < MIN_DESCRIPTION_CHARS) { setErrorCode('too_short'); return; }
    const seq = ++requestSeq.current;
    setErrorCode(null); setPhase('loading');
    const result = await requestDraft(text);
    if (seq !== requestSeq.current) return; // dialog closed or a newer request started
    if (result?.status === 'ok') {
      appliedRef.current = false;
      setDraft({ ...result, sourceText: text }); setLines(result.items.map(toEditable)); setSelected(result.items.map(() => true)); setPhase('review');
    } else {
      setErrorCode(result?.status || 'failed'); setPhase('describe');
    }
  };
  const editLine = (i, patch) => setLines((all) => all.map((l, j) => {
    if (j !== i) return l;
    const next = { ...l, ...patch, edited: l.edited || 'quantityInput' in patch || 'unit' in patch || 'description' in patch, unitChosen: l.unitChosen || 'unit' in patch };
    // the catalog price was verified for the server's unit only - another unit drops it (the user enters the price in the form)
    if ('unit' in patch && patch.unit !== l.original.unit) { next.unitPrice = null; next.priceSource = l.original.catalogName ? 'catalog_unit_unverified' : 'none'; }
    if ('unit' in patch && patch.unit === l.original.unit) { next.unitPrice = l.original.unitPrice; next.priceSource = l.original.priceSource; }
    return next;
  }));
  const chosenIdx = lines.map((_, i) => i).filter((i) => selected[i]);
  const lineIncomplete = (l) => positiveQuantity(l.quantityInput) == null || !l.unitChosen || !String(l.description || '').trim();
  const incompleteIdx = chosenIdx.filter((i) => lineIncomplete(lines[i]));
  const incomplete = incompleteIdx.length > 0;
  const focusFirstIncomplete = () => {
    const i = incompleteIdx[0]; if (i == null) return;
    const root = dialogRef.current?.querySelector(`[data-line-index="${i}"]`);
    const l = lines[i];
    const target = positiveQuantity(l.quantityInput) == null ? root?.querySelector('input[inputmode="decimal"]') : !l.unitChosen ? root?.querySelector('select') : root?.querySelector('input[type="text"]');
    target?.focus();
  };
  const edits = lines.some((l) => l.edited) || selected.some((v) => !v);
  const goAgain = () => { setConfirmAgain(false); setPhase('describe'); setDraft(null); setLines([]); };
  const chosen = chosenIdx.map((i) => {
    const l = lines[i];
    return { description: String(l.description).trim(), quantity: positiveQuantity(l.quantityInput), unit: l.unit || null, unitPrice: l.unitPrice, catalogId: l.unitPrice != null ? l.catalogId : null };
  });
  const apply = () => {
    if (!chosen.length || incomplete || appliedRef.current) return;
    appliedRef.current = true; // one apply per draft (a double click never adds the lines twice)
    onApply(chosen, draft.subject || '');
  };
  function handleVoiceText(text) {
    const joined = (description.trim() ? `${description.trim()}${voiceTargetRef.current === 'answer' ? '\n' : ' '}${text}` : text).slice(0, MAX_DESCRIPTION_CHARS);
    setDescription(joined);
    if (voiceTargetRef.current === 'answer') generate(joined);
  }
  const startVoice = (target) => { voiceTargetRef.current = target; voice.toggle(); };
  const voiceBtnStyle = { ...secondaryBtn, alignSelf: 'flex-start', color: voice.recording ? '#ffffff' : NEON.textPrimary, background: voice.recording ? '#dc2626' : 'none', borderColor: voice.recording ? '#dc2626' : NEON.borderStrong };
  const voiceLabel = (idle) => (voice.recording ? t.stopDictate(voice.seconds) : voice.busy ? t.transcribing : idle);
  const errorText = errorCode === 'too_short' ? t.tooShort : errorCode ? (t.errors[errorCode] || t.errors.failed) : null;
  const money = (v) => (formatMoneyDisplay ? `${sym || ''}${formatMoneyDisplay(v)}` : String(v));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      dir={isHebrew ? 'rtl' : 'ltr'}
      ref={dialogRef}
      tabIndex={-1}
      className="pf-ai-quote-draft"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', boxSizing: 'border-box', outline: 'none' }}
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
    >
      <div style={{ background: NEON.bgCard, borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <AiModalHeader className="pf-modal-head--bar" title={t.title} onClose={close} closeLabel={t.cancel} closeContent={<X size={20} />} isHebrew={isHebrew} testId="ai-quote-draft" />
        <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: isHebrew ? 'right' : 'left' }}>
          {phase !== 'review' ? (
            <>
              <p style={{ margin: 0, fontSize: '0.84rem', color: NEON.textSecondary, lineHeight: 1.45 }}>{t.intro}</p>
              <label htmlFor="ai-quote-draft-description" style={{ fontSize: '0.86rem', fontWeight: 700, color: NEON.textPrimary }}>{t.label}</label>
              <textarea
                id="ai-quote-draft-description"
                ref={fieldRef}
                value={description}
                maxLength={MAX_DESCRIPTION_CHARS}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.placeholder}
                disabled={phase === 'loading'}
                aria-invalid={!!errorText}
                aria-describedby={errorText ? 'ai-quote-draft-error' : undefined}
                style={inputStyle(isHebrew)}
              />
              {voice.supported && (
                /* PRODUCT_TRUTH_DECORATIVE: dictates the job description (the spoken text is added to the field; nothing is sent until "create") */
                <button type="button" data-testid="ai-quote-draft-dictate" onClick={() => startVoice('describe')} disabled={phase === 'loading' || voice.busy} aria-pressed={voice.recording} style={voiceBtnStyle}>
                  {voice.recording ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}<bdi>{voiceLabel(t.dictate)}</bdi>
                </button>
              )}
              {voice.error && <div role="alert" data-testid="ai-quote-draft-voice-error" style={{ color: NEON.red, fontSize: '0.8rem', lineHeight: 1.4 }}>{t.voiceErrors[voice.error]}</div>}
              {errorText && <div id="ai-quote-draft-error" role="alert" style={{ color: NEON.red, fontSize: '0.8rem', lineHeight: 1.4 }}>{errorText}</div>}
              {phase === 'loading' && <div role="status" aria-live="polite" style={{ fontSize: '0.82rem', color: NEON.textSecondary }}>{t.generating}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: closes the AI draft dialog and leaves the blank quote form for manual entry */}
                <button type="button" onClick={close} style={secondaryBtn}>{t.manual}</button>
                {['not_deployed', 'service_unreachable', 'unavailable', 'server_error', 'provider'].includes(errorCode) && onOpenChat && (
                  // PRODUCT_TRUTH_DECORATIVE: hands off to the ONE existing AI chat (same open-proflow-ai-chat entry) when drafting is unavailable
                  <button type="button" onClick={() => { close(); onOpenChat(); }} style={secondaryBtn}>{t.openChat}</button>
                )}
                {/* PRODUCT_TRUTH_CAPABILITY: smart_quote */}
                <button type="button" onClick={generate} disabled={phase === 'loading'} style={{ ...primaryBtn, opacity: phase === 'loading' ? 0.7 : 1 }}>
                  <Sparkles size={16} aria-hidden="true" />{phase === 'loading' ? t.generating : t.generate}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: NEON.textPrimary }}>{t.reviewTitle}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: NEON.textSecondary, lineHeight: 1.45 }}>{t.reviewHint}</p>
              <div data-testid="ai-quote-draft-source" style={{ fontSize: '0.78rem', color: NEON.textSecondary, background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: '8px', padding: '8px 10px', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                <strong style={{ color: NEON.textPrimary }}>{t.yourText}:</strong> <bdi>{draft.sourceText}</bdi>
              </div>
              {draft.subject && <div style={{ fontSize: '0.82rem', color: NEON.textSecondary }}><strong style={{ color: NEON.textPrimary }}>{t.subject}:</strong> {draft.subject}</div>}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }} data-testid="ai-quote-draft-lines">
                {lines.map((line, i) => {
                  const qty = positiveQuantity(line.quantityInput);
                  const missingQty = qty == null;
                  const basisText = line.edited ? t.basis.edited
                    : line.quantityBasis === 'derived' && line.derivation ? t.basis.derived(line.derivation)
                      : line.quantityBasis === 'stated' || line.quantityBasis === 'implied_single' ? t.basis[line.quantityBasis] : null;
                  const missingText = line.missing === 'unverified' && missingQty ? t.unverified : line.missing === 'ambiguous' && missingQty ? t.ambiguous
                    : line.missing && line.missing !== 'quantity' && line.missing !== 'unverified' && line.missing !== 'ambiguous' ? line.missing : (missingQty ? t.missingQuantity : null);
                  return (
                    <li key={i} data-testid="ai-quote-draft-line" data-line-index={i} data-missing={missingQty ? 'quantity' : (!line.unitChosen ? 'unit' : undefined)} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', border: `1px solid ${selected[i] ? NEON.violetLight : NEON.border}`, borderRadius: '10px', background: selected[i] ? NEON.violetLighter : NEON.bgCardAlt, minHeight: '44px', boxSizing: 'border-box' }}>
                      {/* PRODUCT_TRUTH_DECORATIVE: ticks / unticks one suggested draft line before it is applied to the unsaved form */}
                      <input type="checkbox" aria-label={`${line.description}`} checked={!!selected[i]} onChange={() => setSelected((s) => s.map((v, j) => (j === i ? !v : v)))} style={{ marginTop: '10px', width: '18px', height: '18px', flexShrink: 0 }} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: '1 1 auto' }}>
                        <input type="text" aria-label={t.itemText} value={line.description} maxLength={200} onChange={(e) => editLine(i, { description: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '7px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', fontWeight: 700, fontFamily: 'inherit', textAlign: isHebrew ? 'right' : 'left' }} />
                        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', fontSize: '0.76rem', color: NEON.textSecondary }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{t.qty}:
                            <input type="text" inputMode="decimal" dir="ltr" className="pf-num" aria-label={t.qty} aria-invalid={missingQty} value={line.quantityInput} onChange={(e) => editLine(i, { quantityInput: e.target.value })} style={{ width: '76px', boxSizing: 'border-box', padding: '6px 8px', border: `1px solid ${missingQty ? (NEON.amber || NEON.red) : NEON.borderStrong}`, borderRadius: '7px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', textAlign: 'left' }} />
                          </label>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{t.unit}:
                            <select aria-label={t.unit} aria-invalid={!line.unitChosen} value={line.unitChosen ? (line.unit || '') : '__choose'} onChange={(e) => { if (e.target.value !== '__choose') editLine(i, { unit: e.target.value || null }); }} style={{ padding: '6px 8px', border: `1px solid ${line.unitChosen ? NEON.borderStrong : (NEON.amber || NEON.red)}`, borderRadius: '7px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', fontFamily: 'inherit' }}>
                              {!line.unitChosen && <option value="__choose" disabled>{t.chooseUnit}</option>}
                              <option value="">{t.noUnit}</option>
                              {DRAFT_UNITS.map((u) => <option key={u} value={u}>{getProfessionalUnitLabel(u, isHebrew)}</option>)}
                            </select>
                          </label>
                        </span>
                        {line.evidence && <span data-testid="ai-quote-draft-evidence" style={{ fontSize: '0.74rem', color: NEON.textSecondary, overflowWrap: 'anywhere' }}>{t.evidence}: „<bdi>{line.evidence}</bdi>”</span>}
                        {basisText && <span data-testid="ai-quote-draft-basis" style={{ fontSize: '0.74rem', color: NEON.textSecondary }}>{basisText}</span>}
                        {missingText && <span data-testid="ai-quote-draft-missing" style={{ fontSize: '0.76rem', color: NEON.amber || NEON.textSecondary, fontWeight: 600 }}>{t.missingLabel}: {missingText}</span>}
                        <span data-testid="ai-quote-draft-price" data-price-source={line.priceSource} style={{ fontSize: '0.76rem', color: NEON.textSecondary }}>{t.price}: {line.unitPrice != null
                          ? <><bdi className="pf-money" dir="ltr">{money(line.unitPrice)}</bdi> · {line.catalogName ? t.catalogItem(line.catalogName) : t.fromCatalog}</>
                          : <span style={{ color: NEON.amber || NEON.textSecondary, fontWeight: 600 }}>{line.priceSource === 'catalog_unit_unverified' && line.original.catalogName ? t.unitUnverified(line.original.catalogName) : (line.original.catalogName ? t.needsPrice : t.needsPriceNoMatch)}</span>}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {draft.unassignedMeasures?.length > 0 && <div role="note" data-testid="ai-quote-draft-unassigned" style={{ fontSize: '0.78rem', color: NEON.amber || NEON.textSecondary, fontWeight: 600, lineHeight: 1.45 }}>{t.unassigned(draft.unassignedMeasures.join(', '))}</div>}
              {draft.questions?.length > 0 && (
                <div data-testid="ai-quote-draft-questions" style={{ fontSize: '0.8rem', color: NEON.textPrimary, lineHeight: 1.45 }}>
                  <strong>{t.questions}:</strong>
                  <ul style={{ margin: '4px 0 0', paddingInlineStart: '18px' }}>{draft.questions.map((q) => <li key={q}>{q}</li>)}</ul>
                  {voice.supported && !edits && (
                    /* PRODUCT_TRUTH_DECORATIVE: answers the draft's questions by voice - the answer is added to the description and the draft is created again */
                    <button type="button" data-testid="ai-quote-draft-answer-voice" onClick={() => startVoice('answer')} disabled={voice.busy} aria-pressed={voice.recording} style={{ ...voiceBtnStyle, marginTop: '8px' }}>
                      {voice.recording ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}<bdi>{voiceLabel(t.answerByVoice)}</bdi>
                    </button>
                  )}
                  {voice.error && <div role="alert" style={{ color: NEON.red, fontSize: '0.8rem', lineHeight: 1.4, marginTop: '4px' }}>{t.voiceErrors[voice.error]}</div>}
                </div>
              )}
              {incomplete && (
                <div role="status" data-testid="ai-quote-draft-need-quantity" style={{ fontSize: '0.78rem', color: NEON.amber || NEON.textSecondary, fontWeight: 600, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                  <span>{t.blockedLines(incompleteIdx.map((i) => `„${String(lines[i].description || '').trim() || '—'}”`).join(', '))}</span>
                  {/* PRODUCT_TRUTH_DECORATIVE: moves the focus to the first field that still blocks adding the draft lines */}
                  <button type="button" data-testid="ai-quote-draft-goto-field" onClick={focusFirstIncomplete} style={{ background: 'none', border: 'none', padding: '4px 2px', minHeight: '32px', cursor: 'pointer', color: NEON.violetLight, fontWeight: 700, textDecoration: 'underline', fontSize: '0.78rem' }}>{t.goToField}</button>
                </div>
              )}
              {confirmAgain && (
                <div role="alertdialog" aria-label={t.again} data-testid="ai-quote-draft-again-confirm" style={{ fontSize: '0.8rem', color: NEON.textPrimary, border: `1px solid ${NEON.amber || NEON.border}`, borderRadius: '8px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span>{t.againLoses}</span>
                  <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* PRODUCT_TRUTH_DECORATIVE: keeps the edited draft (cancels "different description") */}
                    <button type="button" onClick={() => setConfirmAgain(false)} style={secondaryBtn}>{t.againKeep}</button>
                    {/* PRODUCT_TRUTH_DECORATIVE: confirms discarding the draft edits and returns to the description */}
                    <button type="button" onClick={goAgain} style={secondaryBtn}>{t.againConfirm}</button>
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: returns to the description step of the AI draft dialog (the description text is kept) */}
                <button type="button" onClick={() => (edits ? setConfirmAgain(true) : goAgain())} style={secondaryBtn}>{t.again}</button>
                {/* PRODUCT_TRUTH_CAPABILITY: smart_quote */}
                <button type="button" onClick={apply} disabled={!chosen.length || incomplete} style={{ ...primaryBtn, opacity: chosen.length && !incomplete ? 1 : 0.6 }}>
                  <Check size={16} aria-hidden="true" />{t.apply(chosen.length)}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
