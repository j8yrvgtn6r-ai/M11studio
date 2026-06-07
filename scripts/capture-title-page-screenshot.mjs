import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.M11_BASE_URL ?? 'http://127.0.0.1:5175';
const outputDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots', 'title-page-m11');

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'M11 Studio' }).waitFor({ timeout: 60000 });

  await page.getByText('Title Page', { exact: true }).first().click({ timeout: 15000 });
  await page.waitForSelector('[data-testid="title-page-viewport"]', { timeout: 15000 });

  await page.fill('[data-testid="field-input-title_page.full_title"]', 'A Phase 3 Study of Drug A in Example Disease');
  await page.getByTestId('field-select-title_page.trial_phase').click();
  await page.getByRole('option', { name: 'Phase 3', exact: true }).click();
  await page.fill('[data-testid="field-input-title_page.sponsor_protocol_identifier"]', 'ACME-2026-001');
  await page.getByTestId('field-select-title_page.original_protocol_indicator').click();
  await page.getByRole('option', { name: 'Yes' }).click();

  await page.screenshot({
    path: path.join(outputDir, 'title-page-editing-sequence.png'),
    fullPage: true,
  });

  await page.getByTestId('viewport-title-done').click({ timeout: 10000 });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(outputDir, 'title-page-viewing-mode.png'),
    fullPage: true,
  });

  await browser.close();
  console.log(`Title page screenshots saved to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
