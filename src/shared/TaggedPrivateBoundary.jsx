// Codex review 2026-10-31 F07 (Owner console, typed: "מאשר את שש הקבוצות של קודקס ... כולל שינוי ב-L-02, L-15 ..."): when the
// measurement tag was loaded on a public page and the app moves to a private address in the same document, nothing private renders - the
// page is loaded again from the server (that fresh load never loads the tag on a private page, so there is no loop).
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { taggedPrivate } from './siteAnalytics';

export default function TaggedPrivateBoundary({ children }) {
  const location = useLocation();
  const blocked = taggedPrivate(`${location.pathname}${location.search}${location.hash}`);
  useLayoutEffect(() => {
    if (blocked) { try { window.location.reload(); } catch { /* nothing private is rendered either way */ } }
  }, [blocked]);
  return blocked ? null : children;
}
