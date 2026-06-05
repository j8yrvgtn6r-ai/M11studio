/**
 * UI smoke: Protocol import with real DOCX extraction (v2 PR 1).
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
  if (await continueButton.isEnabled()) {
    throw new Error('Continue should be disabled before overwrite confirmation');
  }

  await page.getByTestId('import-protocol-file-input').setInputFiles(minimalDocx);
  await page.getByTestId('import-overwrite-confirm').click();
  await continueButton.click();

  await page.getByTestId('protocol-import-processing-steps').waitFor();
  await page
    .locator('[data-testid="import-step-reading-docx"][data-state="complete"]')
    .waitFor({ timeout: 90_000 });

  const readingDetail = page.getByTestId('import-step-detail-reading-docx');
  await readingDetail.waitFor({ timeout: 15_000 });
  const readingText = await readingDetail.textContent();
  if (!readingText || !/paragraph/i.test(readingText)) {
    throw new Error(`Expected paragraph count in reading-docx step, got: ${readingText}`);
  }

  await page.getByTestId('import-protocol-open-review').waitFor({ timeout: 90_000 });
  await page.getByTestId('import-protocol-open-review').click();
  await page.getByTestId('protocol-import-review-workspace').waitFor();

  await page.getByTestId('import-tab-source-extraction').click();
  await page.getByTestId('source-extraction-panel').waitFor();

  const paragraphCount = Number.parseInt(
    (await page.getByTestId('source-paragraph-count').textContent()) ?? '0',
    10,
  );
  const sectionCount = Number.parseInt(
    (await page.getByTestId('source-section-candidate-count').textContent()) ?? '0',
    10,
  );

  if (paragraphCount <= 0) {
    throw new Error('Expected paragraph count > 0 after extraction');
  }
  if (sectionCount <= 0) {
    throw new Error('Expected source section candidate count > 0 after extraction');
  }

  await page.getByRole('tab', { name: 'Section review' }).click();

  const firstReviewRow = page.locator('[data-testid^="import-review-row-"]').first();
  await firstReviewRow.waitFor();
  const sectionId = (await firstReviewRow.getAttribute('data-testid'))?.replace(
    'import-review-row-',
    '',
  ) ?? '2';

  await page.getByTestId(`import-review-open-${sectionId}`).click();
  await page.getByTestId('section-import-review-screen').waitFor();
  await page.getByTestId('m11-template-reference-panel').waitFor({ timeout: 15_000 });
  await page.getByTestId('import-open-original-protocol').waitFor();

  await page.getByTestId('import-section-approve').click();
  await page.getByText('Validation results').waitFor({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back to protocol' }).click();
  await page.locator('#protocol-explorer').getByRole('button', { name: /1\.3 Schedule of Activities/ }).click();
  await page.getByText('SoA Configuration').waitFor({ timeout: 15_000 });

  if (pageErrors.length > 0) {
    throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  }

  console.log('Protocol import workflow smoke passed (real DOCX extraction).');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
