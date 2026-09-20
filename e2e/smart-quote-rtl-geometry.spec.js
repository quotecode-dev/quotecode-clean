// Smart / Structured Quote RTL Geometry regression suite (TEKANGO — Smart
// / Structured Quote RTL Geometry Remediation task, 2026-09-16; expanded
// under the RTL Remediation Closure follow-up task, same day, per Codex's
// own "PARTIAL — required RTL work remains" review: complete automated
// geometry coverage for every repaired site, target the canonical Owner
// TEST port, and strengthen test-source identity).
//
// Root cause this suite guards against: QuoteForm.jsx/AddItemWizard.jsx
// render inside an ancestor that already sets dir="rtl"/dir="ltr"
// (Dashboard.jsx's .dash-app-shell, and this wizard's own dialog root) -
// under that inheritance, plain `flexDirection: 'row'` already mirrors DOM
// order to the correct physical side for RTL. Several rows instead wrote
// `flexDirection: isHebrew ? 'row-reverse' : 'row'`, which is a SECOND
// reversal on top of the one the browser already performs, cancelling it
// back to LTR physical order while every other physical-side style
// (borders, text-align) stayed HE-correct - a real, user-visible mirror
// break, not a lint-only concern. The mode-selector cards had the sibling
// bug: `alignItems: isHebrew ? 'flex-end' : 'flex-start'` inside a
// flex-direction:column container already anchors 'flex-start' to the
// locale's own inline-start under inherited dir - the isHebrew ternary
// flipped it to the physical LEFT under Hebrew instead.
//
// These are REAL geometry assertions (getBoundingClientRect() in a real
// Chromium layout engine), not screenshot-only and not jsdom (jsdom has no
// layout engine and cannot detect this defect class at all - dir="rtl"
// presence alone is not RTL acceptance evidence, see PROFLOW_PROJECT_
// CONTEXT.md §63/§235). Playwright's own `projects` in playwright.config.js
// (desktop/mobile/tablet-portrait/tablet-landscape) run this file once per
// viewport automatically - no per-viewport duplication needed here.
//
// Requires `npm run dev:localtest` already running on the canonical Owner
// TEST port (5186 - see playwright.config.js's own header comment and its
// own baseURL default) - same convention as critical-journeys.spec.js,
// which this file intentionally mirrors rather than introducing a second
// login convention. This file previously overrode baseURL to 5199 (this
// task's own isolated worktree's private verification port at the time) -
// removed per the RTL Remediation Closure task's own explicit instruction
// that final RTL acceptance must run against the one canonical Owner-
// facing port; this worktree (C:\tkrtl1) is now itself the process bound
// to 5186, so inheriting the config's own default is correct, not a
// coincidence.
import { test, expect } from '@playwright/test';
import { PERSONA_A, PERSONA_EN } from './testPersonas.js';

async function login(page, persona, lang = 'he') {
  await page.goto(`/dashboard?lang=${lang}`);
  await page.waitForLoadState('load');
  const emailField = page.getByPlaceholder('user@example.com');
  await emailField.waitFor({ state: 'visible', timeout: 45000 });
  await emailField.fill(persona.email);
  await page.locator('input[name="user_password_field"]').fill(persona.password);
  await page.getByRole('button', { name: /Sign In|התחבר/ }).click();
  await page.waitForFunction(
    () => !!localStorage.getItem('sb-ljfizgrdyzxddswcedwr-auth-token'),
    { timeout: 20000 }
  );
  await page.getByRole('button', { name: /^(Quotes|הצעות מחיר)$/ }).first().waitFor({ state: 'visible', timeout: 15000 });
}

async function openNewQuote(page) {
  // Desktop shows the sidebar CTA; narrower viewports (Tablet
  // Portrait/Mobile) replace the sidebar with `.mobile-bottom-nav`'s own
  // "New"/"חדש" entry - both real, already-existing navigation
  // destinations, not invented for this test.
  const sidebarCta = page.getByRole('button', { name: /^(New Quote|הצעת מחיר חדשה)$/ });
  if (await sidebarCta.count() && await sidebarCta.first().isVisible()) {
    await sidebarCta.first().click();
  } else {
    await page.locator('.mobile-bottom-nav').getByRole('button', { name: /^(New|חדש)$/ }).click();
  }
  await page.getByText(/How would you like to structure this quote|איך תרצו לבנות את ההצעה/).waitFor({ state: 'visible', timeout: 15000 });
}

// Returns 'rtl' or 'ltr' as actually rendered (not assumed from lang param).
async function currentDir(page) {
  return page.evaluate(() => document.documentElement.dir || document.body.dir);
}

// Shared side-by-side-vs-wrapped comparator: several repaired rows use
// `flexWrap: 'wrap'` deliberately (a pre-existing, Owner-locked, unrelated
// contract - see QuoteForm.jsx's own "320px English" comment on the Terms
// & Warranty header) so at narrow viewports the second element can fall to
// its own line. Side-by-side inline-start/inline-end order is only a
// meaningful assertion when both elements actually still share a row;
// when wrapped, DOM order must instead read top-to-bottom.
function assertInlineStartOrder(dir, firstBox, secondBox) {
  const sameRow = Math.abs(firstBox.y - secondBox.y) < 10;
  if (!sameRow) {
    expect(firstBox.y).toBeLessThan(secondBox.y);
    return;
  }
  if (dir === 'rtl') {
    expect(firstBox.x).toBeGreaterThan(secondBox.x);
  } else {
    expect(firstBox.x).toBeLessThan(secondBox.x);
  }
}

async function switchToDivided(page) {
  await page.getByRole('button', { name: /Quote by units|הצעה לפי חלוקה/ }).click();
  await page.getByText(/Add the first unit|הוספת היחידה הראשונה/).waitFor({ state: 'visible', timeout: 10000 });
}

async function addUnit(page, name) {
  await page.getByRole('button', { name: /Add the first unit|Add another unit|הוספת היחידה הראשונה|הוסף עוד יחידה/ }).first().click();
  const input = page.locator('input[placeholder*="Apartment"], input[placeholder*="דירה"]').last();
  await input.fill(name);
  return input;
}

// Runs the wizard through to (but not past) the Review step for a simple
// per-unit-priced manual item, added to the given unit. Handles the
// data-dependent WHAT-step branch (a persona with real catalog services
// configured shows the catalog list first and requires the manual-fallback
// link; a persona with none goes straight to the free-text field) rather
// than assuming one locale always takes one path.
async function openWizardToReview(page, unitAddButtonName, description) {
  await page.getByRole('button', { name: unitAddButtonName }).click();
  await page.getByRole('heading', { name: /What are you adding\?|מה מוסיפים\?/ }).waitFor({ state: 'visible', timeout: 10000 });

  const manualLink = page.getByRole('button', { name: /Not in the catalog\? Add a product or work manually|לא מצאתם בקטלוג\? הוסיפו מוצר או עבודה ידנית/ });
  if (await manualLink.count() && await manualLink.isVisible()) {
    await manualLink.click();
  }
  const descField = page.locator('#wiz-description');
  await descField.waitFor({ state: 'visible', timeout: 5000 });
  await descField.fill(description);
  await page.getByRole('button', { name: /^Next$|^הבא$/ }).click();

  await page.getByRole('button', { name: /Price for each|מחיר לכל יחידה/ }).click();
  await page.getByRole('button', { name: /^Next$|^הבא$/ }).click();

  await page.locator('#wiz-quantity').fill('2');
  await page.locator('#wiz-unit-price').fill('100');
  await page.getByRole('button', { name: /^Next$|^הבא$/ }).click();
  await page.getByText(description).first().waitFor({ state: 'visible', timeout: 5000 });
}

for (const [label, persona, lang] of [['HE', PERSONA_A, 'he'], ['EN', PERSONA_EN, 'en']]) {
  test.describe(`Smart Quote RTL geometry (${label})`, () => {
    test(`${label}: 1-2. Mode selector cards anchor to their own inline-start, DOM order preserved from inline-start`, async ({ page }) => {
      await login(page, persona, lang);
      await openNewQuote(page);
      const dir = await currentDir(page);
      expect(dir).toBe(label === 'HE' ? 'rtl' : 'ltr');

      const cards = page.locator('button').filter({ hasText: /Regular quote|Quote by units|הצעה רגילה|הצעה לפי חלוקה/ });
      await expect(cards).toHaveCount(2);

      const boxes = [];
      for (let i = 0; i < 2; i++) {
        const card = cards.nth(i);
        const cardBox = await card.boundingBox();
        const titleBox = await card.locator('span').first().boundingBox();
        boxes.push({ cardBox, titleBox });
      }

      const [first, second] = boxes; // DOM order: [Regular, Units]
      // The grid (`repeat(auto-fit, minmax(220px,1fr))`) collapses to a
      // single column at narrow viewports (Mobile) - side-by-side order is
      // only meaningful when the two cards actually share a row.
      assertInlineStartOrder(dir, first.cardBox, second.cardBox);
      if (dir === 'rtl') {
        expect(Math.abs((first.cardBox.x + first.cardBox.width) - (first.titleBox.x + first.titleBox.width))).toBeLessThan(20);
        expect(Math.abs((second.cardBox.x + second.cardBox.width) - (second.titleBox.x + second.titleBox.width))).toBeLessThan(20);
      } else {
        expect(Math.abs(first.cardBox.x - first.titleBox.x)).toBeLessThan(20);
        expect(Math.abs(second.cardBox.x - second.titleBox.x)).toBeLessThan(20);
      }
    });

    test(`${label}: 3. Editor header title anchors to inline-start, Cancel to inline-end`, async ({ page }) => {
      await login(page, persona, lang);
      await openNewQuote(page);
      const dir = await currentDir(page);

      const title = page.locator('h2').first();
      const cancelBtn = page.getByRole('button', { name: /Cancel & Return|ביטול וחזרה לרשימה/ });
      assertInlineStartOrder(dir, await title.boundingBox(), await cancelBtn.boundingBox());
    });

    test(`${label}: 4-6. Terms & Warranty header, icon-title row, and expanded restore/collapse row`, async ({ page }) => {
      await login(page, persona, lang);
      await openNewQuote(page);
      const dir = await currentDir(page);

      // 4. Terms outer header row: icon-title group (DOM-first) vs the
      // "Customize for this quote" toggle (DOM-second) - only present
      // while collapsed.
      const twLabel = page.getByText(/^Terms & Warranty$|^תנאים ואחריות$/);
      const iconTitleGroup = twLabel.locator('xpath=..');
      const toggleBtn = page.getByRole('button', { name: /Customize for this quote|התאמה להצעה זו/ });
      assertInlineStartOrder(dir, await iconTitleGroup.boundingBox(), await toggleBtn.boundingBox());

      // 5. Icon-title row itself: the FileText icon (DOM-first) vs the
      // label span (DOM-second) - always a tight inline pair, never wraps.
      const icon = iconTitleGroup.locator('svg').first();
      const label2 = iconTitleGroup.locator('span').first();
      const iconBox = await icon.boundingBox();
      const labelBox = await label2.boundingBox();
      if (dir === 'rtl') {
        expect(iconBox.x).toBeGreaterThan(labelBox.x);
      } else {
        expect(iconBox.x).toBeLessThan(labelBox.x);
      }

      // 6. Expand to reveal the Restore-defaults/Collapse action row.
      await toggleBtn.click();
      const restoreBtn = page.getByRole('button', { name: /Restore Business Settings defaults|שחזר ברירת מחדל מהגדרות העסק/ });
      const collapseBtn = page.getByRole('button', { name: /^Collapse$|^כווץ$/ });
      assertInlineStartOrder(dir, await restoreBtn.boundingBox(), await collapseBtn.boundingBox());
    });

    test(`${label}: 7-10, 12-13. Unit header, compact item row, safe-removal dialog, and wizard review rows`, async ({ page }) => {
      await login(page, persona, lang);
      await openNewQuote(page);
      const dir = await currentDir(page);

      await switchToDivided(page);
      const unitNameInput = await addUnit(page, 'RTL Geometry Test Unit');

      // 7. Unit header row: the collapse-chevron button (DOM-first) vs the
      // "Remove unit" button (DOM-last, real interactive children) - the
      // row wraps at narrow widths, so use the shared wrap-aware comparator.
      const unitHeaderRow = unitNameInput.locator('xpath=..');
      const chevronBtn = unitHeaderRow.locator('button').first();
      const removeUnitBtn = page.getByRole('button', { name: /^Remove unit$|^הסר יחידה$/ });
      assertInlineStartOrder(dir, await chevronBtn.boundingBox(), await removeUnitBtn.boundingBox());

      // Add one real item directly to this unit (not Unassigned - the
      // ever-present default placeholder section, Fix A's own known
      // pre-existing seed, also has its own identical-prefix "Add product
      // or work to Unassigned" button, so the unit's own name must
      // disambiguate which one) so its itemCount becomes 1 - this both
      // exercises the compact item row and makes "Remove unit" trigger the
      // safe-removal dialog (only shown when itemCount > 0), without a
      // separate move-item step.
      const addItemToUnitBtn = /Add product or work to RTL Geometry Test Unit|הוסף מוצר או עבודה לRTL Geometry Test Unit/;
      await openWizardToReview(page, addItemToUnitBtn, 'RTL Geometry Test Item');

      // 12. Wizard ReviewGroup row: item-name label (DOM-first) vs the
      // "Change name" edit link (DOM-second). Scoped to a <span> - the
      // review step's own wrapping container can also match on plain text
      // content, which is not the actual label element.
      const reviewLabel = page.locator('span', { hasText: /^RTL Geometry Test Item$/ }).first();
      const reviewHeaderRow = reviewLabel.locator('xpath=..');
      const editLink = reviewHeaderRow.getByRole('button');
      assertInlineStartOrder(dir, await reviewLabel.boundingBox(), await editLink.boundingBox());

      // 13. Wizard SummaryRow: "How many units?" label (DOM-first) vs its
      // value (DOM-second).
      const summaryLabel = page.getByText(/^How many\?$|^כמה יחידות\?$/);
      const summaryRow = summaryLabel.locator('xpath=..');
      const summaryValue = summaryRow.locator('span').nth(1);
      assertInlineStartOrder(dir, await summaryLabel.boundingBox(), await summaryValue.boundingBox());

      await page.getByRole('button', { name: /^Add to quote$|^הוספה להצעה$/ }).click();
      await page.getByText('RTL Geometry Test Item').first().waitFor({ state: 'visible', timeout: 5000 });

      // 8-9. Compact item card row: the item's name block (DOM-first,
      // flex:1) vs its "Edit" button (later in DOM). Scoped to a <div> -
      // CompactItemCard renders the name in a <div>, not a <span>.
      const itemNameBlock = page.locator('div', { hasText: /^RTL Geometry Test Item$/ }).first();
      const editBtn = page.getByRole('button', { name: /^Edit$|^עריכה$/ }).first();
      assertInlineStartOrder(dir, await itemNameBlock.boundingBox(), await editBtn.boundingBox());

      // 10-11. Safe-removal dialog: since the unit now has itemCount=1,
      // "Remove unit" opens the confirmation dialog instead of removing
      // directly.
      await removeUnitBtn.click();
      const dialogHeading = page.getByRole('heading', { level: 3, name: /^Remove |^הסרת /i });
      await dialogHeading.waitFor({ state: 'visible', timeout: 5000 });
      // The heading's icon (DOM-first) and its text (a raw text node, not a
      // separate element) share the row - assert the icon sits at the
      // heading's own inline-start edge rather than comparing two element
      // boxes that would otherwise nest inside each other.
      const headingIcon = dialogHeading.locator('svg').first();
      const headingBox = await dialogHeading.boundingBox();
      const iconBox = await headingIcon.boundingBox();
      if (dir === 'rtl') {
        expect(Math.abs((headingBox.x + headingBox.width) - (iconBox.x + iconBox.width))).toBeLessThan(5);
      } else {
        expect(Math.abs(headingBox.x - iconBox.x)).toBeLessThan(5);
      }

      const cancelDialogBtn = page.getByRole('button', { name: /^Cancel$|^ביטול$/ });
      const removeConfirmBtn = page.getByRole('button', { name: /^Remove unit$|^הסר יחידה$/ }).last();
      assertInlineStartOrder(dir, await cancelDialogBtn.boundingBox(), await removeConfirmBtn.boundingBox());

      // Clean up: cancel, never actually remove the unit.
      await cancelDialogBtn.click();
    });

    test(`${label}: 11. Wizard narrow/mobile progress row (Mobile viewport only)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'The narrow progress-row layout only renders under the wizard\'s own isNarrow (max-width: 560px) branch - NOT APPLICABLE at wider viewports, not inferred as passing.');

      await login(page, persona, lang);
      await openNewQuote(page);
      await switchToDivided(page);
      await addUnit(page, 'RTL Progress Row Unit');
      await page.getByRole('button', { name: /Add product or work to RTL Progress Row Unit|הוסף מוצר או עבודה לRTL Progress Row Unit/ }).click();
      await page.getByRole('heading', { name: /What are you adding\?|מה מוסיפים\?/ }).waitFor({ state: 'visible', timeout: 10000 });

      const dir = await currentDir(page);
      const progressBar = page.getByRole('progressbar');
      const stepLabel = progressBar.locator('span').first();
      const stepOfTotal = progressBar.locator('span').nth(1);
      assertInlineStartOrder(dir, await stepLabel.boundingBox(), await stepOfTotal.boundingBox());
    });
  });
}
