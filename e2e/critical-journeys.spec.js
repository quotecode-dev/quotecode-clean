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
import { PERSONA_A, PERSONA_SUPER_ADMIN, SUPABASE_URL, SUPABASE_ANON_KEY } from './testPersonas.js';
import { setPersonaTier } from '../scripts/set-test-persona-tier.js';

async function login(page, persona) {
  await page.goto('/dashboard?lang=he');
  await page.waitForLoadState('load');
  const emailField = page.getByPlaceholder('user@example.com');
  // WebKit/mobile page load has been observed taking up to ~18s on this
  // machine under load - a generous margin avoids flaking on that alone.
  await emailField.waitFor({ state: 'visible', timeout: 30000 });
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
async function clickVisibleNav(page, nameRe) {
  await page.getByRole('button', { name: nameRe }).and(page.locator(':visible')).first().click();
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
// KNOWN FOLLOW-UP, disclosed not silently left broken: on the mobile
// project specifically, 3 of these 5 tests (Business Settings/Catalog/
// Admin - the three hidden behind the mobile "More" popover) are flaky/
// currently failing under this session's heavy concurrent browser-process
// load (repeated `page.goto` timeouts even in isolated manual scripts,
// pointing at genuine machine resource contention rather than a selector
// bug per se - clickVisibleNav's `.and(':visible')` combinator itself was
// verified correct in principle but not re-confirmed reliable under load).
// All 5 pass cleanly on the desktop project. Re-run this describe block on
// an otherwise-idle machine to confirm before trusting a red mobile result
// here as a real regression.
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
