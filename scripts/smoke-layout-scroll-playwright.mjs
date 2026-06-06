/**
 * UI smoke: workspace pane vertical scrolling.
 *
 * Run: M11_BASE_URL=http://localhost:5176/ npm run smoke:layout-scroll
 */
import { chromium } from 'playwright';
import { assertScrollContainerScrolls, assertWorkspacePaneScrolling } from './playwright-scroll-helpers.mjs';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:5173/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('m11-template-reference-enabled', 'true');
    localStorage.setItem('m11-study-model-enabled', 'true');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'M11 Studio' }).waitFor({ timeout: 60_000 });

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await assertWorkspacePaneScrolling(page);
  console.log('Workspace pane scrolling: PASS');

  await browser.close();
  console.log('Playwright layout scroll smoke: PASS');
}

main().catch((error) => {
  console.error('Playwright layout scroll smoke: FAIL');
  console.error(error);
  process.exit(1);
});
