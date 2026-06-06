/**
 * UI smoke: Protocol import v2 PR3 — LLM understanding + M11 generation scaffold.
 * Run: M11_BASE_URL=http://localhost:5173/ npm run smoke:protocol-import
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
    localStorage.setItem('m11-protocol-llm-provider', 'fixture');
    localStorage.setItem('m11-smoke-show-generation-progress', 'true');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor({ timeout: 60_000 });

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await page.getByTestId('app-import-protocol-button').click();
  await page.getByTestId('import-protocol-dialog').waitFor();

  await page.getByTestId('import-protocol-provider-banner').waitFor();
  const expectations = await page.getByTestId('import-protocol-expectations').textContent();
  if (!expectations?.includes('section by section')) {
    throw new Error('Expected updated import expectations copy about section-by-section reconstruction.');
  }

  await page.getByTestId('import-protocol-file-input').setInputFiles(minimalDocx);
  await page.getByTestId('import-overwrite-confirm').click();
  const continueButton = page.getByTestId('import-protocol-continue');
  await continueButton.scrollIntoViewIfNeeded();
  await continueButton.click();

  await page.getByTestId('protocol-import-processing-steps').waitFor();
  await page.getByTestId('import-cancel-processing').waitFor();
  await page.getByTestId('import-generation-progress').waitFor({ timeout: 120_000 });
  await page.getByTestId('import-generation-completed-count').waitFor();

  await page.getByTestId('import-protocol-open-review').waitFor({ timeout: 120_000 });
  await page.getByTestId('protocol-understanding-summary').waitFor();
  await page.getByTestId('import-protocol-open-review').click();
  await page.getByTestId('protocol-import-review-workspace').waitFor();
  await page.getByTestId('import-llm-provider-status').waitFor();
  await page.getByTestId('import-generation-provider').waitFor();

  await page.getByTestId('import-tab-protocol-knowledge').click();
  await page.getByTestId('protocol-knowledge-panel').waitFor();

  await page.getByRole('tab', { name: 'Section review' }).click();
  const firstReviewRow = page.locator('[data-testid^="import-review-row-"]').first();
  await firstReviewRow.waitFor();
  const sectionId =
    (await firstReviewRow.getAttribute('data-testid'))?.replace('import-review-row-', '') ?? '2';

  await page.getByTestId(`import-review-open-${sectionId}`).click();
  await page.getByTestId('section-import-review-screen').waitFor();
  await page.getByTestId('generation-metadata-panel').waitFor();
  await page.getByTestId('generation-provider-badge').waitFor();
  await page.getByTestId('generation-model-badge').waitFor();

  await page.getByTestId('generation-metadata-toggle').click();
  await page.getByTestId('generation-provenance-provider').waitFor();
  await page.getByTestId('referenced-source-sections').waitFor();

  await page.getByTestId('import-section-regenerate').click();
  const versionBadge = page.getByTestId('generation-metadata-panel').getByText(/^v[2-9]\d*$/);
  await versionBadge.waitFor({ timeout: 30_000 });
  const versionText = await versionBadge.textContent();
  if (!versionText || !/v[2-9]/i.test(versionText)) {
    throw new Error(`Expected regenerated draft version > 1, got: ${versionText}`);
  }

  await page.getByTestId('import-section-approve').click();
  await page.getByTestId('import-validation-results').waitFor({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByTestId('import-tab-version-history').click();
  await page.getByTestId('version-history-panel').waitFor();
  const commitCount = await page.locator('[data-testid^="protocol-commit-"]').count();
  if (commitCount < 3) {
    throw new Error(`Expected understanding + generation + regeneration commits, got ${commitCount}`);
  }

  if (pageErrors.length > 0) {
    throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  }

  console.log('Protocol import workflow smoke passed (v2 PR3 LLM understanding + generation).');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
