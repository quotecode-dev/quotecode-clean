// Owner 2026-10-15 (video): a new page opens at its top (or its #section), Back returns to the exact position, same-page changes keep it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import RouteScrollManager from './RouteScrollManager';

let nav = null;
function Grab() { nav = useNavigate(); return null; }
const Page = ({ name }) => <div>{name}<section id="cancellation">cancellation</section></div>;

function setY(y) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 20000, configurable: true });
  Element.prototype.scrollIntoView = vi.fn();
  sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const mount = () => render(
  <MemoryRouter initialEntries={['/he']}>
    <RouteScrollManager />
    <Grab />
    <Routes>
      <Route path="/he" element={<Page name="landing" />} />
      <Route path="/he/terms" element={<Page name="terms" />} />
    </Routes>
  </MemoryRouter>,
);

describe('RouteScrollManager', () => {
  it('the first render leaves the browser alone (a fresh load keeps its own position / hash handling)', () => {
    mount();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it('a new page opens at its top; Back returns to the exact position the user left', () => {
    mount();
    setY(5565); // the user scrolled to the landing footer
    act(() => nav('/he/terms'));
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
    setY(300); // read a bit of the Terms
    act(() => nav(-1));
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 5565);
  });
  it('a link to a #section scrolls to that section instead of the top', () => {
    mount();
    act(() => nav('/he/terms#cancellation'));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 0);
  });
  it('a same-page change (query / in-page anchor) keeps the position', () => {
    mount();
    setY(1200);
    act(() => nav('/he?x=1'));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
