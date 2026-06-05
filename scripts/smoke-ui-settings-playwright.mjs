/**
 * UI smoke: Settings ICH M11 document uploads + Controlled Terminology + Template Reference.
 * Run: M11_BASE_URL=http://localhost:PORT/ npm run smoke:ui-settings
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:5175/';
const __dirname = dirname(fileURLToPath(import.meta.url));
const minimalPdf = join(__dirname, 'fixtures', 'minimal.pdf');

async function uploadPdf(page, kind) {
  const input = page.getByTestId(`ich-m11-upload-input-${kind}`);
  await input.setInputFiles(minimalPdf);
  await page.getByTestId(`ich-m11-doc-card-${kind}`).getByText('PDF uploaded successfully').waitFor({
    timeout: 15_000,
  });
}

async function clickDownload(page, testId) {
  const downloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null);
  await page.getByTestId(testId).click();
  const download = await downloadPromise;
  if (download) {
    const name = download.suggestedFilename().toLowerCase();
    if (!name.endsWith('.pdf')) {
      throw new Error(`Expected PDF download, got ${download.suggestedFilename()}`);
    }
    await download.path();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor({ timeout: 60_000 });

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await page.getByTestId('app-settings-button').click({ timeout: 10_000 });
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor({ timeout: 15_000 });

  await page.getByTestId('ich-m11-settings-panel').waitFor({ timeout: 15_000 });
  await page.getByRole('heading', { name: 'Technical Specification' }).waitFor();
  await page.getByRole('heading', { name: 'Template', exact: true }).waitFor();

  const viewSpec = page.getByTestId('ich-m11-view-technical-specification');
  const viewTemplate = page.getByTestId('ich-m11-view-template');
  if (await viewSpec.isEnabled()) {
    throw new Error('View should be disabled before Technical Specification upload');
  }
  if (await viewTemplate.isEnabled()) {
    throw new Error('View should be disabled before Template upload');
  }

  await uploadPdf(page, 'technical-specification');
  await viewSpec.click();
  await page.getByTestId('reference-document-pdf-viewer').waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('reference-document-pdf-viewer').waitFor({ state: 'hidden' });
  await clickDownload(page, 'ich-m11-download-technical-specification');

  await uploadPdf(page, 'template');
  await viewTemplate.click();
  await page.getByTestId('reference-document-pdf-viewer').waitFor();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('reference-document-pdf-viewer').waitFor({ state: 'hidden' });
  await clickDownload(page, 'ich-m11-download-template');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('app-settings-button').click({ timeout: 10_000 });
  await page.getByTestId('ich-m11-settings-panel').waitFor();
  if (!(await viewSpec.isEnabled())) {
    throw new Error('Technical Specification PDF not persisted after reload');
  }
  if (!(await viewTemplate.isEnabled())) {
    throw new Error('Template PDF not persisted after reload');
  }

  await page.getByRole('button', { name: 'Controlled Terminology' }).click();
  await page.getByTestId('ich-m11-controlled-terminology-panel').waitFor();
  await page.getByTestId('ich-m11-terminology-search').fill('Control Type');
  await page.getByText('Active Comparator').waitFor();

  await page.getByRole('button', { name: 'Back to protocol' }).click();
  await page.locator('#m11-template-reference-toggle').click();
  await page.getByTestId('m11-template-reference-panel').waitFor();
  if (!(await page.getByRole('button', { name: 'Open full template PDF' }).isEnabled())) {
    throw new Error('Template PDF button should be enabled after upload');
  }

  if (pageErrors.length > 0) {
    throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  }

  console.log('UI settings + reference document upload smoke passed.');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
