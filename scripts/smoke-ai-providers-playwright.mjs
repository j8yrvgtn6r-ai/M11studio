/**
 * UI smoke: Settings AI Providers visibility + import review provenance.
 * Run: M11_BASE_URL=http://localhost:5175/ npm run smoke:ai-providers
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
    localStorage.setItem('m11-protocol-llm-provider', 'openai');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor({ timeout: 60_000 });

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await page.getByTestId('app-settings-button').click();
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await page.getByTestId('settings-nav-ai-providers').click();
  await page.getByTestId('ai-providers-settings-panel').waitFor();

  const activeProvider = await page.getByTestId('ai-active-provider-label').textContent();
  if (!activeProvider?.includes('Fixture')) {
    throw new Error(`Expected Fixture active provider without API key, got: ${activeProvider}`);
  }

  const apiKeyConfigured = await page.getByTestId('ai-api-key-configured').textContent();
  if (!apiKeyConfigured?.includes('No')) {
    throw new Error(`Expected API key configured = No for fixture fallback, got: ${apiKeyConfigured}`);
  }

  await page.getByTestId('ai-provider-card-fixture').waitFor();
  await page.getByTestId('provider-card-status-active').waitFor();
  await page.getByTestId('llm-safety-notice').waitFor();

  await page.getByRole('button', { name: 'Back to protocol' }).click();
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor();

  await page.getByTestId('app-import-protocol-button').click();
  await page.getByTestId('import-protocol-dialog').waitFor();
  await page.getByTestId('import-protocol-file-input').setInputFiles(minimalDocx);
  await page.getByTestId('import-overwrite-confirm').click();
  await page.getByTestId('import-protocol-continue').click();
  await page.getByTestId('import-protocol-open-review').waitFor({ timeout: 120_000 });
  await page.getByTestId('import-protocol-open-review').click();
  await page.getByTestId('protocol-import-review-workspace').waitFor();

  await page.getByTestId('import-llm-provider-status').waitFor();
  await page.getByTestId('import-fixture-provider-badge').waitFor();
  await page.getByTestId('import-understanding-provider').waitFor();
  await page.getByTestId('import-generation-provider').waitFor();

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
  await page.getByTestId('generation-provenance-model').waitFor();
  await page.getByTestId('referenced-source-sections').waitFor();

  if (pageErrors.length > 0) {
    throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  }

  console.log('AI Providers smoke passed (Settings visibility + import provenance).');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
