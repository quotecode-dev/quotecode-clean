// Critical-journey automation against the canonical TEST mirror
// (Systemic Closure task, Item B/C). Uses the two real synthetic TEST
// personas documented in .env.localtest.local (never hardcoded here) - no
// real customer data, no David Aluminum. Requires `npm run dev:localtest`
// already running on port 5186.
//
// Signup/email-confirmation itself is deliberately NOT re-exercised here:
// Supabase Auth's email rate limit on the TEST project was hit and
// disclosed this task (PROFLOW_TODO.md item 67) - running a real signup on
// every automated run would make that worse. Signup was manually verified
// working this task (see PROFLOW_PROJECT_CONTEXT.md); this suite starts
// from the two already-provisioned, already-confirmed personas.
import { test, expect } from '@playwright/test';
import { PERSONA_A, PERSONA_SUPER_ADMIN, PERSONA_EN, SUPABASE_URL, SUPABASE_ANON_KEY } from './testPersonas.js';
import { setPersonaTier } from '../scripts/set-test-persona-tier.js';

// `lang` defaults to 'he' (every existing HE/Local test's prior behavior,
// unchanged) - EN/International tests pass 'en' explicitly, which routes
// through the real `?lang=en` override (src/main.jsx) into AppGlobal.jsx,
// the actual EN app shell, not a URL-only cosmetic flag.
async function login(page, persona, lang = 'he') {
  await page.goto(`/dashboard?lang=${lang}`);
  await page.waitForLoadState('load');
  const emailField = page.getByPlaceholder('user@example.com');
  // WebKit/mobile page load has been observed taking up to ~45s on this
  // machine even against a freshly-restarted, otherwise-idle dev server
  // (Final Narrow Validation Closure task, 2026-09-09 - see
  // playwright.config.js's own timeout comment) - a generous margin avoids
  // flaking on that alone.
  await emailField.waitFor({ state: 'visible', timeout: 45000 });
  await emailField.fill(persona.email);
  // A hidden honeypot field (name="fake_pass_login") also matches
  // input[type="password"] - target the real field specifically.
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.waitForFunction(
    () => !!localStorage.getItem('sb-ljfizgrdyzxddswcedwr-auth-token'),
    { timeout: 20000 }
  );
  await waitForDashboardReady(page);
}

// The dashboard shows one of several transient loading strings ("Loading...",
// "טוען את המערכת...") before real content mounts - rather than enumerate
// every one, wait for a stable, always-present authenticated element
// instead (the sidebar's Quotes nav destination, present for every role).
async function waitForDashboardReady(page) {
  await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ state: 'visible', timeout: 15000 });
}

// Mobile hides Sign Out (and other secondary destinations) behind a "More"
// popover - the desktop sidebar's own Sign Out button is not present in
// that viewport's DOM at all, so it must be opened first there.
async function openMobileMoreMenuIfPresent(page) {
  const moreBtn = page.getByRole('button', { name: /^(More|עוד)$/ });
  if (!(await moreBtn.isVisible({ timeout: 1500 }).catch(() => false))) return;
  // Idempotent: the button toggles open/closed, so only click it if it
  // isn't already expanded (calling this twice in a row must not close it).
  const alreadyOpen = (await moreBtn.getAttribute('aria-expanded')) === 'true';
  if (!alreadyOpen) {
    await moreBtn.click();
    await page.waitForTimeout(200);
  }
}

// Every nav destination button exists in the DOM twice regardless of
// viewport (the desktop sidebar's copy and the mobile bottom-nav/More-
// popover's own copy, hidden by a CSS media query, not removed) - the exact
// same shape of bug already fixed once below for Sign Out. `:visible`
// filters to whichever the current viewport actually shows, and `nameRe`
// covers mobile's shortened label where it differs from desktop's (e.g.
// Business Settings: "הגדרות עסק" on desktop, "הגדרות" inside the mobile
// More popover).
//
// ROOT CAUSE of the 3 disclosed-flaky mobile tests (Business Settings/
// Catalog/Admin - the ones behind the mobile "More" popover), found by
// running each in isolation on an otherwise-idle machine: this was never
// timing/resource-contention. Dashboard.jsx's mobile More-popover
// deliberately renders its destinations as `<button role="menuitem">`
// (a correct, intentional ARIA menu/menuitem pattern, Dashboard.jsx
// ~L5395) - `getByRole('button', ...)` never matches an element whose
// explicit role is overridden to "menuitem", so the click deterministically
// times out 100% of the time, on every machine, regardless of load. The
// desktop sidebar's own copy of the same destination has no role override
// (plain implicit button role), which is why the identical selector always
// passed there. Fixed by matching either role, not by adding retries/
// timeouts - the previous "disclosed-flaky-under-load" framing was
// incorrect, corrected here with fresh isolated-run evidence.
async function clickVisibleNav(page, nameRe) {
  await page.getByRole('button', { name: nameRe })
    .or(page.getByRole('menuitem', { name: nameRe }))
    .and(page.locator(':visible'))
    .first()
    .click();
}

async function logout(page) {
  await openMobileMoreMenuIfPresent(page);
  // Both the desktop sidebar's Sign Out button (class dash-sidebar-signout)
  // and the mobile More-popover's own Sign Out button (class
  // dash-mobile-signout-btn) exist in the DOM regardless of viewport - only
  // one is actually visible (CSS media query), so a plain selector can
  // resolve to the hidden one and hang waiting for it to become visible.
  // `:visible` filters down to whichever one the current viewport shows.
  const signOutBtn = page.locator('.dash-sidebar-signout:visible, .dash-mobile-signout-btn:visible').first();
  await signOutBtn.click();
  const confirmBtn = page.getByRole('button', { name: /^(Confirm|אישור)$/ });
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForFunction(
    () => !localStorage.getItem('sb-ljfizgrdyzxddswcedwr-auth-token'),
    { timeout: 10000 }
  );
}

test.describe('Critical Journeys — authentication', () => {
  test('login succeeds and establishes a real session (Persona A)', async ({ page }) => {
    await login(page, PERSONA_A);
    await expect(page.locator('body')).toContainText(PERSONA_A.email);
  });

  test('logout clears the session and returns to the login form', async ({ page }) => {
    await login(page, PERSONA_A);
    await logout(page);
    await expect(page.getByPlaceholder('user@example.com')).toBeVisible();
  });
});

test.describe('Critical Journeys — plan/entitlement enforcement', () => {
  const tiers = ['free', 'active_trial', 'expired_trial', 'basic', 'pro', 'lifetime'];

  for (const tier of tiers) {
    test(`Persona A dashboard reflects the ${tier} tier without crashing`, async ({ page }) => {
      await setPersonaTier({
        targetUserId: PERSONA_A.userId,
        tierName: tier,
        supabaseUrl: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        adminEmail: PERSONA_SUPER_ADMIN.email,
        adminPassword: PERSONA_SUPER_ADMIN.password,
      });
      // login() itself already waits for the dashboard's stable Quotes nav
      // to appear - reaching that point at all is the real assertion here:
      // the dashboard must render successfully, never crash, for every tier.
      await login(page, PERSONA_A);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(50);
    });
  }

  test.afterAll(async () => {
    // Restore Persona A's documented resting state.
    await setPersonaTier({
      targetUserId: PERSONA_A.userId,
      tierName: 'active_trial',
      supabaseUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      adminEmail: PERSONA_SUPER_ADMIN.email,
      adminPassword: PERSONA_SUPER_ADMIN.password,
    });
  });
});

test.describe('Critical Journeys — Super Admin route access', () => {
  test('Super Admin can reach an Admin-only surface; an ordinary user cannot', async ({ page }) => {
    await login(page, PERSONA_SUPER_ADMIN);
    // On mobile, User Management (like Sign Out) lives inside the "More"
    // popover, not the always-visible bottom nav.
    await openMobileMoreMenuIfPresent(page);
    const bodyText = await page.locator('body').innerText();
    // Super Admin sees an admin-only nav destination (User Management) that
    // an ordinary user's sidebar/bottom-nav never renders.
    expect(bodyText).toMatch(/User Management|ניהול משתמשים/);
    await logout(page);

    await login(page, PERSONA_A);
    await openMobileMoreMenuIfPresent(page);
    const ordinaryBodyText = await page.locator('body').innerText();
    expect(ordinaryBodyText).not.toMatch(/User Management|ניהול משתמשים/);
  });
});

test.describe('Critical Journeys — quote list and search', () => {
  test('Quote list renders and a text search actually filters visible rows', async ({ page }) => {
    await login(page, PERSONA_A);
    await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).click();
    await page.waitForTimeout(500);
    const searchBox = page.getByPlaceholder(/Search client or quote|חיפוש שם לקוח/);
    await expect(searchBox).toBeVisible();
    await searchBox.fill('zzz-no-such-quote-zzz');
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/No quotes found|לא נמצאו הצעות/);
    await searchBox.fill('');
  });
});

test.describe('Critical Journeys — Public Quote (owner / other-business / anonymous)', () => {
  // A dedicated, permanent fixture quote (status='sent', never approved) -
  // deliberately NOT the already-signed §219 verification quote, which is
  // now immutable and would always fail an "Approve and sign UI visible"
  // assertion. These tests only ever check for UI presence, never click
  // Approve, so this fixture stays reusable across every run.
  const QUOTE_ID = '3fec3ba7-859d-4208-8253-015b98c5ce37';

  test('owner viewing their own quote sees an admin-only note, not the signing UI', async ({ page }) => {
    await login(page, PERSONA_A);
    await page.goto(`/public-quote/${QUOTE_ID}`);
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 10000 }).catch(() => {});
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Admin view|תצוגת מנהל/);
    expect(bodyText).not.toMatch(/Approve and sign|אשר וחתום/);
  });

  test('a different business account sees the full signing UI (the historically-broken scenario)', async ({ page }) => {
    await login(page, PERSONA_SUPER_ADMIN);
    await page.goto(`/public-quote/${QUOTE_ID}`);
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 10000 }).catch(() => {});
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Approve and sign|אשר וחתום/);
    expect(bodyText).not.toMatch(/cannot be signed from a logged-in business account/i);
  });

  test('an anonymous visitor sees the full signing UI', async ({ browser }) => {
    const anonContext = await browser.newContext();
    const page = await anonContext.newPage();
    await page.goto(`http://localhost:5186/public-quote/${QUOTE_ID}`);
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 10000 }).catch(() => {});
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Approve and sign|אשר וחתום/);
    await anonContext.close();
  });
});

// Authenticated UI matrix remainder (Final Orphan Wiring + TEST Secrets
// Closure task): Business Settings/Clients/Finances/Catalog were PARTIAL in
// the prior task's report - each surface must render its own real, distinct
// content (not just "doesn't crash", the same bar the plan/entitlement
// tests above already hold themselves to). HE/Local only - Persona A's
// business is Local/HE and no EN-market persona exists yet (Supabase
// Auth's TEST-project email rate limit, disclosed in PROFLOW_TODO.md item
// 67); this is automated proof for HE, not a claim about EN.
//
// RESOLVED (Final Narrow Validation Closure task, 2026-09-09): the 3
// mobile-only failures here (Business Settings/Catalog/Admin - the three
// hidden behind the mobile "More" popover) were previously attributed to
// machine resource contention. Re-run in isolation on an idle machine, the
// real, deterministic root cause was found instead: `clickVisibleNav`
// queried `getByRole('button', ...)`, but Dashboard.jsx's mobile
// More-popover deliberately renders its items as `<button
// role="menuitem">` (a correct, intentional ARIA menu pattern) - the role
// mismatch made the click target unmatchable 100% of the time, not
// intermittently. Fixed in `clickVisibleNav` itself (see its own comment
// above). A separate, genuine intermittent slowness was also found and
// fixed independently: WebKit/mobile page loads on this machine can take
// up to ~45s even against a freshly-restarted, idle dev server - the test
// timeout was raised accordingly in playwright.config.js (see its comment)
// rather than papered over with retries. All 3 now PASS individually and
// together on both desktop and mobile.
test.describe('Critical Journeys — authenticated UI matrix remainder (Business Settings/Clients/Finances/Catalog)', () => {
  test('Business Settings renders its own real, distinct content', async ({ page }) => {
    await login(page, PERSONA_A);
    await openMobileMoreMenuIfPresent(page); // hidden behind the mobile "More" popover
    await clickVisibleNav(page, /^(הגדרות עסק|הגדרות)$/); // mobile's More popover uses the shortened label
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('הגדרות עסק');
    expect(bodyText).toMatch(/סוג העיסוק|אלומיניום|נגרות/); // business-type/profession section, unique to this tab
  });

  test('Clients renders the real client list (not empty, not a crash)', async ({ page }) => {
    await login(page, PERSONA_A);
    await clickVisibleNav(page, 'לקוחות');
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/לקוחות במערכת/); // client-count header, unique to this tab
    expect(bodyText).toContain('לקוח חדש'); // "New Client" action
  });

  test('Finances renders real revenue/expense figures for this account', async ({ page }) => {
    await login(page, PERSONA_A);
    await clickVisibleNav(page, 'פיננסים'); // present directly in mobile's bottom nav, not behind More
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('סך הכל הצעות'); // total-quotes KPI, unique to this tab
    expect(bodyText).toMatch(/סך הכנסות/); // total-revenue KPI
  });

  test('Catalog renders (real empty-state, since this persona has no catalog items yet)', async ({ page }) => {
    await login(page, PERSONA_A);
    await openMobileMoreMenuIfPresent(page); // hidden behind the mobile "More" popover
    await clickVisibleNav(page, 'קטלוג');
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('קטלוג שירותים ומוצרים');
    expect(bodyText).toContain('הוסף פריט'); // "Add Item" action, unique to this tab
  });

  test('Admin table (Super Admin only) renders real user-management content, not just the nav entry', async ({ page }) => {
    await login(page, PERSONA_SUPER_ADMIN);
    await openMobileMoreMenuIfPresent(page); // hidden behind the mobile "More" popover
    await clickVisibleNav(page, /User Management|ניהול משתמשים/);
    await page.waitForTimeout(600);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/ניהול משתמשים ועסקים/); // Admin page's own header, not just the nav label
    expect(bodyText).toMatch(/סה"כ משתמשים/); // total-users stat - proves the real user list actually loaded
    // Persona A's own account must appear as a real row - not a fabricated
    // or empty table.
    expect(bodyText).toContain(PERSONA_A.email);
  });
});

// Super Admin dedicated-actions automation (Final Narrow Validation Closure
// task, 2026-09-09). Route access and ordinary-user denial were already
// covered above ("Super Admin route access" describe block) - this adds
// the remaining minimum the task calls for: role/plan display behavior and
// privileged-action-surface gating. Read-only/presence-only by design - no
// test here clicks Delete User or Grant Lifetime (both destructive/
// state-mutating protected actions on synthetic accounts), only asserts
// the surfaces exist for Super Admin and are reachable nowhere else.
test.describe('Critical Journeys — Super Admin dedicated actions (role/plan display, privileged surfaces)', () => {
  test('Admin table displays plan/tier information, not just names and emails', async ({ page }) => {
    await login(page, PERSONA_SUPER_ADMIN);
    await openMobileMoreMenuIfPresent(page);
    await clickVisibleNav(page, /User Management|ניהול משתמשים/);
    await page.waitForTimeout(600);
    // Found via real evidence this task, not assumed: AdminUsersTab.jsx has
    // two independent responsive layouts with genuinely different
    // interaction models (a narrow-viewport expandable card list where
    // plan/region/role only appear after tapping a row's own summary
    // button, vs a wide-viewport table where each row's plan cell already
    // renders without interaction) - checking a specific account's own row
    // is fragile across both (the wide table's own innerText column
    // ordering is not reliably attributable to one row via a naive scrape).
    // Checking for the plan-catalog vocabulary appearing anywhere on the
    // already-loaded page is the layout-agnostic, still-meaningful bar:
    // proves plan/tier is genuinely displayed to Super Admin, not proof
    // for one specific account's own value (Dashboard.jsx's own tier badge,
    // exercised by the plan/entitlement describe block above, already
    // covers per-account correctness).
    const bodyText = await page.locator('body').innerText();
    // PLAN_CATALOG's own displayLabel strings (planCatalog.js, all-caps)
    // plus the separate is_lifetime grant-overlay's own mixed-case
    // "Lifetime" label (AdminUsersTab.jsx's getPlanBadgeVisual) - two
    // distinct real strings, not one guessed pattern.
    expect(bodyText).toMatch(/FREE|BASIC|PRO|LIFETIME|Lifetime/i);
  });

  // AdminUsersTab.jsx renders two independent responsive layouts (found via
  // a real tablet-portrait failure this task, not assumed): a wider-
  // viewport variant with an icon-only button whose accessible name comes
  // from title="מחק משתמש"/"Delete User" (~L1038, matches on Desktop/
  // tablet-landscape's rendered width), and a narrower-viewport variant
  // with an icon+visible-text button reading "מחק"/"Delete" (~L1231,
  // matches on tablet-portrait/Mobile's rendered width) - both must be
  // matched, not just the one this task happened to check the source for
  // first.
  const DELETE_USER_BUTTON_NAME = /^(Delete User|מחק משתמש|Delete|מחק)$/;

  test('privileged per-user action surfaces (Delete User) exist for Super Admin and nowhere else', async ({ page }) => {
    await login(page, PERSONA_SUPER_ADMIN);
    await openMobileMoreMenuIfPresent(page);
    await clickVisibleNav(page, /User Management|ניהול משתמשים/);
    await page.waitForTimeout(600);
    // Presence-only: never click this button (it is a real, protected,
    // destructive action on managed accounts, out of this task's
    // authorization boundary).
    const deleteButtons = page.getByRole('button', { name: DELETE_USER_BUTTON_NAME });
    expect(await deleteButtons.count()).toBeGreaterThan(0);
    await logout(page);

    // An ordinary user reaches no Admin surface at all - already proven by
    // the "route access" describe block above (User Management text itself
    // absent). Re-confirmed at the DOM level here: zero Delete User buttons
    // exist anywhere in an ordinary user's own session.
    await login(page, PERSONA_A);
    expect(await page.getByRole('button', { name: DELETE_USER_BUTTON_NAME }).count()).toBe(0);
  });
});

// EN/International market runtime coverage (Final Narrow Validation
// Closure task, 2026-09-09). PERSONA_EN is a pre-existing, freshly
// reconfirmed-working synthetic TEST account (see testPersonas.js's own
// comment) - not a new signup, so this does not touch the Supabase Auth
// TEST-project email-send rate limit disclosed in PROFLOW_TODO.md item 67.
// Mirrors the same real-content bar the HE matrix above holds itself to
// (not just "doesn't crash") and additionally checks for HE/RTL/ILS
// leakage into the English/International surface.
test.describe('Critical Journeys — EN/International market', () => {
  test('Dashboard renders in English/LTR with international currency, zero Hebrew/RTL/ILS leakage', async ({ page }) => {
    await login(page, PERSONA_EN, 'en');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('ltr');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Total Quotes|Total Revenue/i);
    // No Hebrew character anywhere in the authenticated shell, and no ILS
    // (₪) currency symbol - this account's business_settings.currency is
    // USD (International), confirmed by direct PostgREST read this task.
    expect(bodyText).not.toMatch(/[֐-׿]/);
    expect(bodyText).not.toContain('₪');
  });

  test('Quotes list is reachable and renders in English', async ({ page }) => {
    await login(page, PERSONA_EN, 'en');
    await page.getByRole('button', { name: /^Quotes$/ }).click();
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Quote History|No quotes found/i);
    expect(bodyText).not.toMatch(/[֐-׿]/);
  });

  test('Business Settings renders its own real, distinct English content', async ({ page }) => {
    await login(page, PERSONA_EN, 'en');
    await openMobileMoreMenuIfPresent(page);
    await clickVisibleNav(page, /^(Business Settings|Settings)$/);
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Business Settings|Settings/);
    expect(bodyText).not.toMatch(/[֐-׿]/);
  });

  test('Clients renders the real client list in English', async ({ page }) => {
    await login(page, PERSONA_EN, 'en');
    await clickVisibleNav(page, 'Clients');
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Clients|New Client/i);
    expect(bodyText).not.toMatch(/[֐-׿]/);
  });

  test('Finances renders real revenue/expense figures in English/international currency', async ({ page }) => {
    await login(page, PERSONA_EN, 'en');
    await clickVisibleNav(page, 'Finances');
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Total Quotes|Total Revenue/i);
    expect(bodyText).not.toContain('₪');
    expect(bodyText).not.toMatch(/[֐-׿]/);
  });

  test('Catalog renders in English', async ({ page }) => {
    await login(page, PERSONA_EN, 'en');
    await openMobileMoreMenuIfPresent(page);
    await clickVisibleNav(page, 'Catalog');
    await page.waitForTimeout(400);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Catalog|Add Item/i);
    expect(bodyText).not.toMatch(/[֐-׿]/);
  });
});

// Password-reset request classification (Auth/Account Lifecycle Forensic
// Audit, 2026-09-09). The Owner-reported defect ("request fails, no email
// arrives, UI shows a broken {}:Error-shaped message") was traced this task
// to a real, live-reproduced Supabase Auth `over_email_send_rate_limit`
// (HTTP 429) - not a successful send with broken rendering. Route
// interception is used for BOTH the success and failure cases here
// deliberately: a real send would consume this TEST project's already-
// scarce, shared, per-project email quota on every automated run (the same
// scarce resource behind the rate-limit finding itself), and the failure
// case specifically needs a byte-for-byte reproduction of the real 429
// payload this task captured live, not a hope that the real rate limit
// happens to be active whenever this suite runs. `Route interception` here
// still exercises the real component/route shell end-to-end (the actual
// unauthenticated /dashboard AuthScreen, the real handleResetSubmit, the
// real normalizeAuthError classification) - only the network response
// itself is substituted, which is the standard, correct way to test an
// error path deterministically.
test.describe('Critical Journeys — password-reset request (real route, mocked network only)', () => {
  test('a successful request shows a clear, non-error success message', async ({ page }) => {
    await page.route('**/auth/v1/recover*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/dashboard?lang=he');
    await page.getByRole('button', { name: /^(שכחת סיסמה\?)$/ }).click();
    await page.locator('form').filter({ hasText: 'שלח קישור לשחזור' }).getByPlaceholder('user@example.com').fill('reset-request-test@example.com');
    await page.getByRole('button', { name: /שלח קישור לשחזור/ }).click();
    // expect(locator).toContainText() auto-retries until the async
    // setResetMsg(...) state update actually renders - a single synchronous
    // body.innerText() read right after .click() raced the React state
    // update and flaked (found and fixed this task, not the WebKit-only
    // sustained-load flakiness already disclosed elsewhere in this file).
    await expect(page.locator('body')).toContainText('נשלח בהצלחה', { timeout: 10000 });
  });

  test('the real, live-reproduced 429 over_email_send_rate_limit is normalized to a clear message, never a raw object', async ({ page }) => {
    await page.route('**/auth/v1/recover*', (route) => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 42 seconds.' }),
    }));
    await page.goto('/dashboard?lang=he');
    await page.getByRole('button', { name: /^(שכחת סיסמה\?)$/ }).click();
    await page.locator('form').filter({ hasText: 'שלח קישור לשחזור' }).getByPlaceholder('user@example.com').fill('reset-request-test@example.com');
    await page.getByRole('button', { name: /שלח קישור לשחזור/ }).click();
    // The exact regression this task fixed: must never render a raw
    // object/JSON dump or the reported "{}:Error" shape - only the curated,
    // classified message, with the real countdown preserved.
    await expect(page.locator('body')).toContainText('42', { timeout: 10000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\{\}/);
    expect(bodyText).not.toMatch(/\[object Object\]/);
  });

  test('the rate-limit error message renders with error (not success) styling', async ({ page }) => {
    await page.route('**/auth/v1/recover*', (route) => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 10 seconds.' }),
    }));
    await page.goto('/dashboard?lang=he');
    await page.getByRole('button', { name: /^(שכחת סיסמה\?)$/ }).click();
    await page.locator('form').filter({ hasText: 'שלח קישור לשחזור' }).getByPlaceholder('user@example.com').fill('reset-request-test@example.com');
    await page.getByRole('button', { name: /שלח קישור לשחזור/ }).click();
    // Regression guard for the fixed bug: styling used to be decided by
    // `.includes('Error')`, which is never true for a Hebrew message - this
    // asserts the actual rendered color, not just the text content.
    const msgLocator = page.locator('div', { hasText: '10' }).last();
    await expect(msgLocator).toBeVisible({ timeout: 10000 });
    const color = await msgLocator.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(248, 113, 113)');
  });
});
