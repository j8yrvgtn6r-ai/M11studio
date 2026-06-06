/**
 * UI smoke: Hybrid mapping-first import — structural mapping, imported sections, validation review.
 * Run: M11_BASE_URL=http://localhost:5173/ npm run smoke:protocol-import
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertScrollContainerScrolls, assertWorkspacePaneScrolling } from './playwright-scroll-helpers.mjs';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:5175/';
const __dirname = dirname(fileURLToPath(import.meta.url));
const minimalDocx = join(__dirname, 'fixtures', 'minimal.docx');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleMessages = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    consoleMessages.push(message.text());
  });

  function assertNoImportFailures(label) {
    const blockedPatterns = [
      'filter is not a function',
      'import context is incomplete',
      'Import generation context not ready',
    ];
    for (const pattern of blockedPatterns) {
      if (pageErrors.some((message) => message.includes(pattern))) {
        throw new Error(`${label}: page error contains "${pattern}": ${pageErrors.join('; ')}`);
      }
    }
  }

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

  await page.getByTestId('import-quick-reconstruction-copy').waitFor();
  const quickCopy = await page.getByTestId('import-quick-reconstruction-copy').textContent();
  if (!quickCopy?.includes('key M11 sections')) {
    throw new Error('Expected Quick Reconstruction explanatory copy in import modal.');
  }
  if (await page.getByText('Full reconstruction').isVisible().catch(() => false)) {
    throw new Error('Import modal should not show mode selection controls.');
  }

  await page.getByTestId('import-protocol-provider-banner').waitFor();
  const expectations = await page.getByTestId('import-protocol-expectations').textContent();
  if (!expectations?.includes('key M11 sections')) {
    throw new Error('Expected Quick Reconstruction copy in import expectations.');
  }

  await page.getByTestId('import-protocol-file-input').setInputFiles(minimalDocx);
  await page.getByTestId('import-overwrite-confirm').click();
  const continueButton = page.getByTestId('import-protocol-continue');
  await continueButton.scrollIntoViewIfNeeded();
  await continueButton.click();

  await page.waitForTimeout(1500);
  const uploadError = await page.getByTestId('import-upload-error').textContent().catch(() => null);
  if (uploadError?.includes('filter is not a function')) {
    throw new Error(`Upload blocked by filter error: ${uploadError}`);
  }
  if (pageErrors.some((message) => message.includes('filter is not a function'))) {
    throw new Error(`Page error during upload start: ${pageErrors.join('; ')}`);
  }

  await page.getByTestId('import-protocol-dialog').waitFor({ state: 'hidden', timeout: 30_000 });
  await page.getByTestId('protocol-reconstruction-progress-title').waitFor({ timeout: 30_000 });
  await page.getByTestId('protocol-build-console').waitFor({ timeout: 30_000 });

  const sawPreReadyImportContext = await page
    .waitForFunction(() => {
      const phase = document
        .querySelector('[data-testid="protocol-build-console"]')
        ?.getAttribute('data-import-context-phase');
      return phase === 'extraction';
    }, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);

  if (sawPreReadyImportContext) {
    const earlyNeedsGeneration = page
      .locator(
        '[data-testid^="map-section-"][data-generation-state="needsGeneration"], [data-testid^="map-section-"][data-generation-state="notGenerated"]',
      )
      .first();
    if (await earlyNeedsGeneration.isVisible().catch(() => false)) {
      await earlyNeedsGeneration.click();
      const generateSection = page.getByTestId('viewport-generate-section');
      if (await generateSection.isVisible().catch(() => false)) {
        if (!(await generateSection.isDisabled())) {
          throw new Error('Generate Section should be disabled until import context is ready.');
        }
        await expectGenerationUnavailableCopy(page);
      }
    }
  }
  assertNoImportFailures('After Continue (understanding phase)');

  await page.waitForFunction(() => {
    const phase = document
      .querySelector('[data-testid="protocol-build-console"]')
      ?.getAttribute('data-import-context-phase');
    return phase === 'core-ready' || phase === 'enriching' || phase === 'ready';
  }, { timeout: 60_000 });

  await page.getByTestId('protocol-build-toggle').click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="protocol-build-console"]')?.textContent ?? '';
    return text.includes('Knowledge Agent started') || text.includes('Knowledge Agent completed');
  }, { timeout: 60_000 });
  let buildConsoleText = await page.getByTestId('protocol-build-console').evaluate(
    (el) => el.textContent ?? '',
  );
  if (!buildConsoleText.includes('Building Core Study Model')) {
    throw new Error('Expected Building Core Study Model in build console.');
  }
  if (!buildConsoleText.includes('Core Study Model complete')) {
    throw new Error('Expected Core Study Model complete in build console.');
  }
  if (!buildConsoleText.includes('sections mapped')) {
    throw new Error('Expected structural mapping summary in build console.');
  }

  const buildConsoleScroll = page.getByTestId('protocol-build-console-scroll');
  if (await buildConsoleScroll.isVisible().catch(() => false)) {
    await buildConsoleScroll.evaluate((el) => {
      if (!(el instanceof HTMLElement)) {
        return;
      }
      const filler = document.createElement('div');
      filler.style.height = '1200px';
      el.appendChild(filler);
    });
    await assertScrollContainerScrolls(page, {
      scrollTestId: 'protocol-build-console-scroll',
      label: 'Protocol Build Console',
    });
  }
  await assertWorkspacePaneScrolling(page);

  await page.getByTestId('protocol-build-toggle').click();

  // Non-blocking workspace: explorer visible, modal stays closed during reconstruction
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor();
  if (await page.getByTestId('import-protocol-dialog').isVisible().catch(() => false)) {
    throw new Error('Import modal should close when reconstruction starts and stay closed during generation.');
  }

  await page.waitForFunction(() => {
    const status = document.querySelector('[data-testid="protocol-build-console"]')?.getAttribute('data-status');
    const importedCount = document.querySelectorAll('[data-generation-state="importedUnvalidated"]').length;
    const generatedCount = document.querySelectorAll('[data-generation-state="generated"]').length;
    const reviewCount = document.querySelectorAll('[data-generation-state="needsReview"]').length;
    const summary =
      document.querySelector('[data-testid="protocol-build-console-summary"]')?.textContent?.toLowerCase() ?? '';
    const phase = document
      .querySelector('[data-testid="protocol-build-console"]')
      ?.getAttribute('data-import-context-phase');
    return (
      importedCount > 0 ||
      generatedCount > 0 ||
      reviewCount > 0 ||
      summary.includes('generating') ||
      summary.includes('complete') ||
      status === 'running' ||
      phase === 'enriching'
    );
  }, { timeout: 120_000 });

  const buildConsole = page.getByTestId('protocol-build-console');
  const buildStatus = await buildConsole.getAttribute('data-status');
  if (buildStatus === 'running' || buildStatus === 'paused') {
    await page.getByTestId('protocol-build-spinner').waitFor({ timeout: 120_000 });
    await page.getByTestId('protocol-build-pause').waitFor();
    await page.getByTestId('protocol-build-cancel').waitFor();
  }

  const importedIndicator = page
    .locator('[data-testid^="import-section-indicator-"][data-generation-state="importedUnvalidated"]')
    .first();
  const generatedIndicator = page
    .locator(
      '[data-testid^="import-section-indicator-"][data-generation-state="generated"], [data-testid^="import-section-indicator-"][data-generation-state="needsReview"]',
    )
    .first();
  const contentIndicator = (await importedIndicator.count()) > 0 ? importedIndicator : generatedIndicator;
  await contentIndicator.waitFor({ timeout: 120_000 });
  const reviewSectionId =
    (await contentIndicator.getAttribute('data-testid'))?.replace('import-section-indicator-', '') ?? '1';
  await page.locator(`[data-testid="map-section-${reviewSectionId}"]`).click();
  await page.getByTestId('viewport-import-generated-text').waitFor({ timeout: 15_000 });
  const importedText = await page.getByTestId('viewport-import-generated-text').inputValue();
  if (importedText.trim().length < 20) {
    throw new Error(`Expected verbatim imported section text, got fragment: "${importedText.trim()}"`);
  }

  const importedMapTile = page.locator(`[data-testid="map-section-${reviewSectionId}"]`);
  const importedMapState = await importedMapTile.getAttribute('data-generation-state');
  if (importedMapState !== 'importedUnvalidated') {
    throw new Error(`Expected imported MAP tile state importedUnvalidated, got ${importedMapState}`);
  }
  const importedMapClass = await importedMapTile.getAttribute('class');
  if (importedMapClass?.includes('bg-muted/80')) {
    throw new Error('Imported MAP tile must not use neutral gray styling.');
  }

  const validateButton = page.getByTestId('viewport-validate-section');
  if (!(await validateButton.isVisible().catch(() => false))) {
    throw new Error('Validate button should appear for importedUnvalidated section.');
  }
  await validateButton.click();
  await page.getByTestId('section-validation-review-panel').waitFor({ timeout: 15_000 });
  await page.getByTestId('validation-view-track-changes').click();
  await page.getByTestId('validation-track-changes-view').waitFor({ timeout: 15_000 });
  await page.getByTestId('validation-view-side-by-side').click();
  await page.getByTestId('validation-side-by-side-view').waitFor({ timeout: 15_000 });
  await page.getByTestId('validation-accept-button').click();

  const pendingTile = page
    .locator(
      '[data-testid^="map-section-"][data-generation-state="queued"], [data-testid^="map-section-"][data-generation-state="generating"]',
    )
    .first();
  if (await pendingTile.isVisible().catch(() => false)) {
    await pendingTile.click();
    await page
      .locator('[data-testid="viewport-section-queued"], [data-testid="viewport-section-generating"]')
      .first()
      .waitFor({ timeout: 10_000 });
    await page.locator(`[data-testid="map-section-${reviewSectionId}"]`).click();
    await page.getByTestId('viewport-import-generated-text').waitFor({ timeout: 15_000 });
  }

  const needsGenerationTile = page
    .locator('[data-testid^="map-section-"][data-generation-state="needsGeneration"]')
    .first();
  if (await needsGenerationTile.isVisible().catch(() => false)) {
    await needsGenerationTile.click();
    await page.getByTestId('viewport-section-not-generated').waitFor({ timeout: 15_000 });
  }

  await page.getByTestId('import-reconstruction-banner').waitFor({ timeout: 180_000 });

  await page.getByTestId('protocol-build-toggle').click();
  buildConsoleText = await page.getByTestId('protocol-build-console').evaluate((el) => el.textContent ?? '');
  if (!buildConsoleText.includes('First draft available')) {
    throw new Error('Expected First draft available in build console.');
  }
  if (!buildConsoleText.includes('Deep Study Model enrichment started')) {
    throw new Error('Expected Deep Study Model enrichment started in build console.');
  }
  if (
    !buildConsoleText.includes('Priority generation complete') &&
    !buildConsoleText.includes('Hybrid import workspace ready')
  ) {
    throw new Error('Expected Priority generation complete or Hybrid import workspace ready in build console.');
  }
  if (!buildConsoleText.includes('Mapping content into M11 hierarchy')) {
    throw new Error('Expected structural mapping progress in build console.');
  }
  if (!buildConsoleText.includes('Knowledge Agent started')) {
    throw new Error('Expected Knowledge Agent started in build console.');
  }
  assertNoImportFailures('During hybrid import');
  await page.getByTestId('protocol-build-toggle').click();

  const notGeneratedTile = page
    .locator(
      '[data-testid^="map-section-"][data-generation-state="needsGeneration"], [data-testid^="map-section-"][data-generation-state="notGenerated"]',
    )
    .first();
  if (await notGeneratedTile.isVisible().catch(() => false)) {
    await notGeneratedTile.click();
    await page.getByTestId('viewport-section-not-generated').waitFor({ timeout: 15_000 });
    const viewportGenerate = page.getByTestId('viewport-generate-section');
    await viewportGenerate.waitFor({ timeout: 15_000 });
    if (await viewportGenerate.isDisabled()) {
      throw new Error('Generate Section should enable once import context is ready.');
    }
  }

  const buildGenerateRemaining = page.getByTestId('protocol-build-generate-remaining');
  if (await buildGenerateRemaining.isVisible().catch(() => false)) {
    if (await buildGenerateRemaining.isDisabled()) {
      throw new Error('Generate Remaining Sections should enable once import context is ready.');
    }
  }

  await page.getByTestId('app-review-import-button').click();
  await page.getByTestId('protocol-import-review-workspace').waitFor();
  const studyModelBannerDismiss = page
    .getByTestId('study-model-updated-banner')
    .getByRole('button', { name: 'Dismiss' });
  if (await studyModelBannerDismiss.isVisible().catch(() => false)) {
    await studyModelBannerDismiss.click();
  }
  const reviewGenerateRemaining = page.getByTestId('import-generate-remaining-sections');
  if (await reviewGenerateRemaining.isVisible().catch(() => false)) {
    if (await reviewGenerateRemaining.isDisabled()) {
      throw new Error('Review workspace Generate Remaining should enable once import context is ready.');
    }
  }

  await page.getByRole('tab', { name: 'Section review' }).click();
  const firstReviewRow = page.locator('[data-testid^="import-review-row-"]').first();
  await firstReviewRow.waitFor();
  const sectionId =
    (await firstReviewRow.getAttribute('data-testid'))?.replace('import-review-row-', '') ?? '2';

  await page.getByTestId(`import-review-open-${sectionId}`).click({ force: true });
  await page.getByTestId('section-import-review-screen').waitFor();
  await page.getByTestId('generation-metadata-panel').waitFor();

  await page.getByTestId('generation-metadata-toggle').click();
  await page.getByTestId('import-section-regenerate').click();
  const versionBadge = page.getByTestId('generation-metadata-panel').getByText(/^v[2-9]\d*$/);
  await versionBadge.waitFor({ timeout: 30_000 });

  await page.getByTestId('import-section-approve').click();
  await page.getByTestId('import-validation-results').waitFor({ timeout: 15_000 });

  if (pageErrors.length > 0) {
    throw new Error(`Page errors: ${pageErrors.join('; ')}`);
  }
  assertNoImportFailures('Final');

  console.log('Protocol import workflow smoke passed (hybrid mapping-first import + validation).');
  await browser.close();
}

async function expectGenerationUnavailableCopy(page) {
  const copy = await page.getByTestId('viewport-section-not-generated').innerText();
  if (!copy.includes('Generation unavailable until Core Study Model is ready')) {
    throw new Error(`Expected generation-unavailable copy, got: ${copy}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
