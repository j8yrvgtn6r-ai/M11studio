/**
 * UI smoke: Protocol import / rewrite workflow v1.
 * Run: M11_BASE_URL=http://localhost:5175/ npm run smoke:protocol-import
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:5175/';
const __dirname = dirname(fileURLToPath(import.meta.url));
const minimalDocx = join(__dirname, 'fixtures', 'minimal.docx');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('m11-template-reference-enabled', 'true');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor({ timeout: 60_000 });

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await page.getByTestId('app-import-protocol-button').click();
  await page.getByTestId('import-protocol-dialog').waitFor();

  const continueButton = page.getByTestId('import-protocol-continue');
  await continueButton.waitFor();
  if (await continueButton.isEnabled()) {
    throw new Error('Continue should be disabled before overwrite confirmation');
  }

  await page.getByTestId('import-protocol-file-input').setInputFiles(minimalDocx);
  await page.getByTestId('import-overwrite-confirm').click();
  await continueButton.click();

  await page.getByTestId('protocol-import-processing-steps').waitFor();
  await page.getByTestId('import-step-uploading').waitFor();
  await page.getByTestId('import-protocol-open-review').waitFor({ timeout: 90_000 });
  await page.getByTestId('import-protocol-open-review').click();
  await page.getByTestId('protocol-import-review-workspace').waitFor();

  const firstReviewRow = page.locator('[data-testid^="import-review-row-"]').first();
  await firstReviewRow.waitFor();
  const sectionId = await firstReviewRow.getAttribute('data-testid');
  const id = sectionId?.replace('import-review-row-', '') ?? '2';

  await page.getByTestId(`import-review-open-${id}`).click();
  await page.getByTestId('section-import-review-screen').waitFor();
  await page.getByTestId('m11-template-reference-panel').waitFor({ timeout: 15_000 });
  await page.getByTestId('import-open-original-protocol').waitFor();

  await page.getByTestId('import-section-approve').click();
  await page.getByText('Validation results').waitFor({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByTestId('import-download-original-protocol').click();

  await page.getByRole('button', { name: 'Back to protocol' }).click();
  await page.locator('#protocol-explorer').getByRole('button', { name: /1\.3 Schedule of Activities/ }).click();
  await page.getByText('SoA Configuration').waitFor({ timeout: 15_000 });

  if (pageErrors.length > 0) {
    throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  }

  console.log('Protocol import workflow smoke passed.');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
