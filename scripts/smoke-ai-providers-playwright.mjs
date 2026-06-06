/**

 * UI smoke: Settings AI Providers configuration UX + import provider awareness.

 * Run: M11_BASE_URL=http://localhost:5173/ npm run smoke:ai-providers

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

  await page.getByTestId('ai-provider-tabs').waitFor();



  await page.getByTestId('ai-tab-openai').click();

  await page.getByTestId('openai-config-form').waitFor();

  const modelSelect = await page.getByTestId('openai-model-select').textContent();

  if (!modelSelect?.includes('gpt-5')) {

    throw new Error(`Expected gpt-5 default model, got: ${modelSelect}`);

  }

  if (await page.getByTestId('azure-config-form').isVisible().catch(() => false)) {

    throw new Error('Azure config should be hidden on OpenAI tab');

  }



  await page.getByTestId('ai-tab-azure-openai').click();

  await page.getByTestId('azure-config-form').waitFor();

  if (await page.getByTestId('openai-config-form').isVisible().catch(() => false)) {

    throw new Error('OpenAI config should be hidden on Azure tab');

  }



  await page.getByTestId('ai-tab-simulation-mode').click();

  await page.getByTestId('ai-provider-card-fixture').waitFor();

  if (await page.getByTestId('azure-config-form').isVisible().catch(() => false)) {

    throw new Error('Azure config should be hidden on Simulation Mode tab');

  }



  await page.getByTestId('fixture-save-config').click();

  const simulationActive = await page.getByTestId('ai-active-provider-label').textContent();

  if (!simulationActive?.includes('Simulation Mode')) {

    throw new Error(`Expected Simulation Mode active after save, got: ${simulationActive}`);

  }



  await page.getByTestId('ai-tab-openai').click();

  await page.getByTestId('openai-api-key-input').fill('sk-fake-test-key-1234');

  await page.getByTestId('openai-save-config').click();

  await page.getByTestId('openai-masked-key').waitFor();

  await page.evaluate(() => localStorage.setItem('m11-smoke-simulate-llm-timeout', 'healthCheck'));
  await page.getByTestId('openai-test-connection').click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="openai-health-status"]')?.textContent ?? '';
    return text.toLowerCase().includes('timed out');
  }, { timeout: 30_000 });
  let openAiHealth = await page.getByTestId('openai-health-status').textContent();
  if (!openAiHealth?.toLowerCase().includes('timed out')) {
    throw new Error(`Expected simulated health-check timeout, got: ${openAiHealth}`);
  }

  await page.evaluate(() => localStorage.removeItem('m11-smoke-simulate-llm-timeout'));
  await page.getByTestId('openai-test-connection').click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="openai-health-status"]')?.textContent ?? '';
    return text.toLowerCase().includes('authentication') || text.toLowerCase().includes('failed');
  }, { timeout: 30_000 });
  openAiHealth = await page.getByTestId('openai-health-status').textContent();
  if (!openAiHealth || /\bConnected\b/i.test(openAiHealth)) {
    throw new Error(`Expected OpenAI failure for fake key, got: ${openAiHealth}`);
  }



  await page.getByTestId('openai-clear-config').click();

  await page.getByTestId('ai-tab-simulation-mode').click();

  const simulationAgain = await page.getByTestId('ai-active-provider-label').textContent();

  if (!simulationAgain?.includes('Simulation Mode')) {

    throw new Error(`Expected Simulation Mode fallback after clear, got: ${simulationAgain}`);

  }



  await page.getByRole('button', { name: 'Back to protocol' }).click();

  await page.getByTestId('app-import-protocol-button').click();

  await page.getByTestId('import-protocol-dialog').waitFor();

  await page.getByTestId('import-protocol-provider-banner').waitFor();

  await page.getByTestId('import-dialog-active-provider').waitFor();

  const importProvider = await page.getByTestId('import-dialog-active-provider').textContent();

  if (!importProvider?.includes('Simulation Mode')) {

    throw new Error(`Expected Simulation Mode in import dialog, got: ${importProvider}`);

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


