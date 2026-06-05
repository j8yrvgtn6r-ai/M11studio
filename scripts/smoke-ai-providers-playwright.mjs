/**
 * UI smoke: Settings AI Providers configuration UX + import provider awareness.
 * Run: M11_BASE_URL=http://localhost:5175/ npm run smoke:ai-providers
 */
import { chromium } from 'playwright';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:5175/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.removeItem('m11-protocol-openai-config-v1');
    localStorage.removeItem('m11-protocol-azure-openai-config-v1');
    localStorage.removeItem('m11-protocol-llm-health-v1');
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('m11-protocol-llm-provider', 'openai');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor({ timeout: 60_000 });

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await page.getByTestId('app-settings-button').click();
  await page.getByTestId('settings-nav-ai-providers').click();
  await page.getByTestId('ai-providers-settings-panel').waitFor();
  await page.getByTestId('ai-provider-selection').waitFor();

  await page.getByTestId('fixture-save-config').click();
  await page.getByTestId('ai-active-provider-label').waitFor();
  const fixtureActive = await page.getByTestId('ai-active-provider-label').textContent();
  if (!fixtureActive?.includes('Fixture')) {
    throw new Error(`Expected Fixture active after save, got: ${fixtureActive}`);
  }

  await page.getByTestId('openai-api-key-input').fill('sk-fake-test-key-1234');
  await page.getByTestId('openai-save-config').click();
  await page.getByTestId('openai-masked-key').waitFor();
  await page.getByTestId('openai-test-connection').click();
  await page.getByTestId('openai-health-status').waitFor({ timeout: 30_000 });
  const openAiHealth = await page.getByTestId('openai-health-status').textContent();
  if (!openAiHealth || /Connected/i.test(openAiHealth)) {
    throw new Error(`Expected OpenAI auth/config error for fake key, got: ${openAiHealth}`);
  }

  await page.getByTestId('openai-clear-config').click();
  await page.getByTestId('fixture-save-config').click();
  const fixtureAgain = await page.getByTestId('ai-active-provider-label').textContent();
  if (!fixtureAgain?.includes('Fixture')) {
    throw new Error(`Expected fixture fallback after clear, got: ${fixtureAgain}`);
  }

  await page.getByRole('button', { name: 'Back to protocol' }).click();
  await page.getByTestId('app-import-protocol-button').click();
  await page.getByTestId('import-protocol-dialog').waitFor();
  await page.getByTestId('import-protocol-provider-banner').waitFor();
  await page.getByTestId('import-dialog-active-provider').waitFor();
  const importProvider = await page.getByTestId('import-dialog-active-provider').textContent();
  if (!importProvider?.includes('Fixture')) {
    throw new Error(`Expected Fixture in import dialog, got: ${importProvider}`);
  }

  if (pageErrors.length > 0) {
    throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  }

  console.log('AI Providers configuration smoke passed.');
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
