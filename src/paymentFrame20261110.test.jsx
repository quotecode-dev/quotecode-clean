// Owner console 2026-11-10 (typed: "מאשר פתיחת דף התשלום של פיי פלוס כחלון מעל האפליקציה (כולל חזרה אוטומטית, ופתיחה רגילה אם החלון לא
// נטען), כולל שינוי ב-L-01 ו-L-22, שחרור עד הלייב"): the PayPlus payment page opens in a window above the app.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act, renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import PaymentFrame from './components/PaymentFrame';
import { framedPaymentUrl, handOffBillingReturnInFrame, PAYMENT_FRAME_RETURN } from './shared/paymentFrameReturn';
import { BILLING_RETURN_KINDS } from './domain/subscriptions/packageCheckout';
import useBillingReturn from './hooks/useBillingReturn';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const URL_ = 'https://payments.payplus.co.il/aa9cec6e-56f7-4357-9a98-5f0a5d5b5ef0';
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const props = (o = {}) => ({ url: URL_, isHebrew: true, onClose: vi.fn(), onReturn: vi.fn(), onFallback: vi.fn(), ...o });

describe('which pages open in the window', () => {
  it('only the PayPlus payment pages', () => {
    expect(framedPaymentUrl(URL_)).toBe(true);
    for (const u of ['http://payments.payplus.co.il/x', 'https://evil.example/x', 'https://payments.payplus.co.il.evil.example/x', 'mailto:a@b.c', null]) expect(framedPaymentUrl(u)).toBe(false);
  });
  it('the return kinds of the window are the app return kinds', () => {
    expect(src('./shared/paymentFrameReturn.js')).toContain(`const KINDS = ${JSON.stringify(BILLING_RETURN_KINDS).replace(/"/g, "'").replace(/,/g, ', ')};`);
  });
});

describe.each([[true, 'תשלום מאובטח', 'פתיחה בדף מלא', 'rtl'], [false, 'Secure payment', 'Open as a full page', 'ltr']])('PaymentFrame isHebrew=%s', (he, title, full, dir) => {
  it('a window above the app with the payment page, a close button and a full-page link', () => {
    const p = props({ isHebrew: he });
    const { getByTestId, getByRole } = render(<PaymentFrame {...p} />);
    expect(getByRole('dialog').getAttribute('aria-label')).toBe(title);
    expect(getByRole('dialog').getAttribute('dir')).toBe(dir);
    expect(getByTestId('payment-frame-iframe').getAttribute('src')).toBe(URL_);
    expect(getByTestId('payment-frame-full').textContent).toBe(full);
    fireEvent.click(getByTestId('payment-frame-full'));
    expect(p.onFallback).toHaveBeenCalledWith(URL_);
    fireEvent.click(getByTestId('payment-frame-close'));
    expect(p.onClose).toHaveBeenCalled();
  });
});

describe('the automatic return and the fallback', () => {
  it('the return comes only from the window itself, same origin, a known kind', () => {
    const p = props();
    const { getByTestId } = render(<PaymentFrame {...p} />);
    const win = getByTestId('payment-frame-iframe').contentWindow;
    act(() => { window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', source: win, data: { type: PAYMENT_FRAME_RETURN, kind: 'processing' } })); });
    act(() => { window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: window, data: { type: PAYMENT_FRAME_RETURN, kind: 'processing' } })); });
    act(() => { window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: win, data: { type: PAYMENT_FRAME_RETURN, kind: 'paid!' } })); });
    expect(p.onReturn).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: win, data: { type: PAYMENT_FRAME_RETURN, kind: 'processing' } })); });
    expect(p.onReturn).toHaveBeenCalledWith('processing');
  });
  it('"Back to website" on the payment page (a page of this site without a return): the window closes', () => {
    const p = props();
    const { getByTestId } = render(<PaymentFrame {...p} />);
    expect(window.__tekangoPaymentWindowOpen).toBe(true);
    const win = getByTestId('payment-frame-iframe').contentWindow;
    act(() => { window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: win, data: { type: PAYMENT_FRAME_RETURN, close: true } })); });
    expect(p.onClose).toHaveBeenCalled();
    expect(p.onReturn).not.toHaveBeenCalled();
  });
  it('the window did not load in time: the payment page opens as a full page', () => {
    vi.useFakeTimers();
    const p = props({ loadMs: 1000 });
    render(<PaymentFrame {...p} />);
    act(() => { vi.advanceTimersByTime(1001); });
    expect(p.onFallback).toHaveBeenCalledWith(URL_);
  });
  it('the window loaded: no fallback', () => {
    vi.useFakeTimers();
    const p = props({ loadMs: 1000 });
    const { getByTestId } = render(<PaymentFrame {...p} />);
    fireEvent.load(getByTestId('payment-frame-iframe'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(p.onFallback).not.toHaveBeenCalled();
  });
  it('the browser refused to show the page (content policy): full page', () => {
    const p = props();
    render(<PaymentFrame {...p} />);
    const ev = new Event('securitypolicyviolation'); ev.effectiveDirective = 'frame-src';
    act(() => { document.dispatchEvent(ev); });
    expect(p.onFallback).toHaveBeenCalledWith(URL_);
  });
});

describe('the return page inside the window', () => {
  const fakeWin = ({ framed = true, search = '?billing=processing' } = {}) => {
    const root = { textContent: 'app' };
    const parent = { postMessage: vi.fn() };
    const w = { location: { search, origin: 'https://www.tekango.com' }, parent, document: { documentElement: { lang: 'he' }, getElementById: () => root, body: root } };
    w.self = w; w.top = framed ? {} : w;
    return { w, root, parent };
  };
  it('hands the kind to the app behind (same origin) and does not start the app', () => {
    const { w, root, parent } = fakeWin();
    expect(handOffBillingReturnInFrame(w)).toBe(true);
    expect(parent.postMessage).toHaveBeenCalledWith({ type: PAYMENT_FRAME_RETURN, kind: 'processing' }, 'https://www.tekango.com');
    expect(root.textContent).toBe('חוזרים לאפליקציה...');
  });
  it('another page of this site inside the payment window: asks the app to close the window, starts nothing', () => {
    const { w, parent } = fakeWin({ search: '' });
    parent.__tekangoPaymentWindowOpen = true;
    expect(handOffBillingReturnInFrame(w)).toBe(true);
    expect(parent.postMessage).toHaveBeenCalledWith({ type: PAYMENT_FRAME_RETURN, close: true }, 'https://www.tekango.com');
  });
  it('a normal page (not in the window) or an unknown kind: the app starts as usual', () => {
    expect(handOffBillingReturnInFrame(fakeWin({ framed: false }).w)).toBe(false);
    expect(handOffBillingReturnInFrame(fakeWin({ search: '?billing=paid' }).w)).toBe(false);
    expect(handOffBillingReturnInFrame(fakeWin({ search: '' }).w)).toBe(false);
  });
  it('main.jsx checks it before the app starts', () => {
    expect(src('./main.jsx')).toMatch(/if \(!handOffBillingReturnInFrame\(\)\) boot\(\)/);
  });
});

describe('the app takes the return from the window', () => {
  it('the return flow opens the plans window with the return, without leaving the app', () => {
    window.sessionStorage.setItem('tekango:billing-departure', JSON.stringify({ userId: 'u1', at: Date.now() }));
    const openPlans = vi.fn();
    const summary = { state: 'ready', phase: { billing: 'enforced' }, market: 'IL' };
    const { result } = renderHook(() => useBillingReturn({ summary, userId: 'u1', plansOpen: true, refreshQuiet: () => Promise.resolve(), openPlans }));
    expect(result.current.kind).toBeNull();
    act(() => { window.dispatchEvent(new CustomEvent(PAYMENT_FRAME_RETURN, { detail: { kind: 'processing' } })); });
    expect(result.current.kind).toBe('processing');
    act(() => { window.dispatchEvent(new CustomEvent(PAYMENT_FRAME_RETURN, { detail: { kind: 'bogus' } })); });
    expect(result.current.kind).toBe('processing');
    window.sessionStorage.clear();
  });
  it('the dashboard opens PayPlus pages in the window (purchase and SMART PACK), never leaves the page for them first', () => {
    const d = src('./pages/Dashboard.jsx');
    expect(d).not.toContain('window.location.assign(r.redirectUrl)');
    expect(d).toContain('leaveForPayment(r.redirectUrl)');
    expect(d).toContain('markBillingDeparture(session?.user?.id); leaveForPayment(url);');
    expect(d).toMatch(/<PaymentFrame url=\{paymentUrl\}/);
  });
  it('the site allows exactly this site and the PayPlus payment host in a window', () => {
    const csp = JSON.parse(src('../vercel.json')).headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy').value;
    expect(csp).toContain("frame-src 'self' blob: https://challenges.cloudflare.com https://payments.payplus.co.il;");
  });
});
