import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// App-return guards: coming back to the app makes supabase-js re-emit SIGNED_IN for the SAME
// session. That must not replace the session object (which re-ran every [session] effect and
// pushed a history entry per return), while real token refresh / user switch / sign-out must
// still update state.
const src = readFileSync(join(cwd(), 'src', 'pages', 'Dashboard.jsx'), 'utf8');

describe('same-session redundant re-render is closed', () => {
  it('SIGNED_IN/TOKEN_REFRESHED keep the existing session object when user id AND access token are unchanged', () => {
    expect(src).toMatch(/setSession\(prev => \(\s*prev\?\.user\?\.id && prev\.user\.id === newSession\?\.user\?\.id && prev\.access_token === newSession\?\.access_token\s*\? prev\s*: newSession\s*\)\);/);
  });
  it('a changed token / user still replaces the session, and SIGNED_OUT still clears it', () => {
    expect(src).toMatch(/event === 'SIGNED_OUT'\) \{\s*setSession\(null\);/);
    expect(src).toContain('lastLoadedUserIdRef.current = null;');
    expect(src).toMatch(/newSession\.user\.id !== lastLoadedUserIdRef\.current/);
  });
  it('the history/popstate effect is keyed on session PRESENCE, not object identity', () => {
    expect(src).toMatch(/const hasSession = !!session;\s*useEffect\(\(\) => \{\s*if \(hasSession\) \{\s*window\.history\.pushState/);
    expect(src).toMatch(/\}, \[hasSession\]\);/);
  });
  it('auth refresh/listener behavior is untouched (no autoRefresh disable, listener present)', () => {
    expect(src).toContain('supabase.auth.onAuthStateChange');
    expect(read('src/shared/supabase.js')).not.toMatch(/autoRefreshToken:\s*false|persistSession:\s*false/);
  });
  it('market routing redirect remains a single guarded assignment (no new redirect added)', () => {
    expect((src.match(/window\.location\.href = '\/dashboard\?lang='/g) || []).length).toBe(1);
  });
});

function read(p) { return readFileSync(join(cwd(), p), 'utf8'); }
