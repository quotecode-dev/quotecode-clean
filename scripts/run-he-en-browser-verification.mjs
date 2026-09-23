// Real authenticated BROWSER verification (not API) for both HE and EN synthetic TEST personas at
// the canonical 5186 URL, per task §14. Signs in through the real login form, opens the real AI
// Chat widget via its own documented open event, sends a real message, and reads the rendered
// response text from the DOM.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ENV_PATH = 'C:/tkrc-pt/.env.localtest.local';
const envText = readFileSync(ENV_PATH, 'utf-8');
function envVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.*)$`, 'm'));
  if (!m) throw new Error(`missing env var ${name}`);
  return m[1].trim();
}
const URL_ = 'http://192.168.1.189:5186/';
const require = createRequire('C:/tkrtool/package.json');
const { chromium } = require('playwright');

async function verifyPersona({ emailVar, passVar, lang, expectedSubstring, prompt }) {
  const email = envVar(emailVar);
  const password = envVar(passVar);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = { lang, steps: [] };
  try {
    await page.goto(`${URL_}dashboard?lang=${lang}`, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    // Real sign-in through the actual login form.
    await page.fill('input[name="user_email_field"]', email);
    await page.fill('input[name="user_password_field"]', password);
    result.steps.push('filled login form');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const urlAfterLogin = page.url();
    result.urlAfterLogin = urlAfterLogin;
    result.steps.push('submitted login, url=' + urlAfterLogin);
    // Open the real AI Chat widget via its own documented external-open event (same event the
    // header/help buttons fire) - avoids depending on a specific button's exact DOM position.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-proflow-ai-chat', { detail: { source: 'terminal_verification' } })));
    await page.waitForTimeout(1200);
    const placeholderText = lang === 'he' ? 'שאל משהו...' : 'Ask something...';
    const input = page.locator(`input[placeholder="${placeholderText}"], textarea[placeholder="${placeholderText}"]`).first();
    await input.waitFor({ state: 'visible', timeout: 8000 });
    result.steps.push('chat input visible');
    await input.fill(prompt);
    await input.press('Enter');
    result.steps.push('message sent: ' + prompt);
    await page.waitForTimeout(4000);
    const panelText = await page.evaluate(() => document.body.innerText);
    result.containsExpected = panelText.includes(expectedSubstring);
    result.panelTextTail = panelText.slice(-1500);
  } catch (e) {
    result.error = e.message;
  } finally {
    await browser.close();
  }
  return result;
}

async function run() {
  const results = [];
  results.push(await verifyPersona({
    emailVar: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', passVar: 'PROFLOW_TEST_PLAN_PERSONAS_PASSWORD',
    lang: 'he', prompt: 'אפשר לעשות הצעה מדודה?',
    expectedSubstring: 'הצעת מחיר מקצועית/מדודה קיימת ב-TEKANGO',
  }));
  results.push(await verifyPersona({
    emailVar: 'PROFLOW_TEST_INTL_PRO_EMAIL', passVar: 'PROFLOW_TEST_PLAN_PERSONAS_PASSWORD',
    lang: 'en', prompt: 'Can I reuse professional items across quotes?',
    expectedSubstring: 'Advanced professional item reuse exists in TEKANGO',
  }));
  writeFileSync(
    'C:/Users/sales/AppData/Local/Temp/claude/c--Users-sales-Documents-YoutubeChanel-WebSite-quotecode-saas/e71c6bd5-79f6-4b07-8f2c-20b10a7f2263/scratchpad/browser-he-en-results.json',
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results.map(r => ({ lang: r.lang, containsExpected: r.containsExpected, error: r.error, steps: r.steps })), null, 2));
}
run().catch(e => { console.error('FATAL', e); process.exit(1); });
