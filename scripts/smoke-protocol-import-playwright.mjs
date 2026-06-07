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
    localStorage.removeItem('m11-protocol-import-v3');
    localStorage.removeItem('m11-protocol-import-v2');
    localStorage.removeItem('m11-protocol-import-v1');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#protocol-explorer').getByText('Protocol Explorer').waitFor({ timeout: 60_000 });

  const getStarted = page.getByRole('button', { name: 'Get Started' });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
  }

  await page.getByTestId('app-file-menu').click();
  await page.getByTestId('app-import-protocol-menu-item').click();
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
  if ((await page.getByTestId('protocol-build-console').getAttribute('data-expanded')) !== 'true') {
    await page.getByTestId('protocol-build-toggle').click();
  }

  async function ensureBuildConsoleExpanded() {
    if ((await page.getByTestId('protocol-build-console').getAttribute('data-expanded')) !== 'true') {
      await page.getByTestId('protocol-build-toggle').click();
    }
    await page.getByTestId('protocol-build-console-scroll').waitFor({ state: 'visible', timeout: 10_000 });
  }

  async function waitForBuildConsoleMessage(message, timeout = 120_000) {
    await ensureBuildConsoleExpanded();
    await page.waitForFunction(
      (expected) => {
        const scroll = document.querySelector('[data-testid="protocol-build-console-scroll"]');
        return Boolean(scroll?.textContent?.includes(expected));
      },
      message,
      { timeout },
    );
  }

  async function readBuildConsoleLog() {
    await ensureBuildConsoleExpanded();
    return page.getByTestId('protocol-build-console-scroll').evaluate((el) => el.textContent ?? '');
  }

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

  // Milestone messages scroll out of the 1500-event console buffer once generation floods the log.
  await waitForBuildConsoleMessage('Building Canonical Document');
  await waitForBuildConsoleMessage('Canonical document complete');
  await waitForBuildConsoleMessage('sections mapped');
  await waitForBuildConsoleMessage('Building Core Study Model');
  await waitForBuildConsoleMessage('Core Study Model complete');

  await page.waitForFunction(() => {
    const phase = document
      .querySelector('[data-testid="protocol-build-console"]')
      ?.getAttribute('data-import-context-phase');
    return phase === 'core-ready' || phase === 'enriching' || phase === 'ready';
  }, { timeout: 60_000 });

  let buildConsoleText = await readBuildConsoleLog();

  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="protocol-build-console-scroll"]')?.textContent ?? '';
    return text.includes('Knowledge Agent started') || text.includes('Knowledge Agent completed');
  }, { timeout: 60_000 });
  buildConsoleText = await readBuildConsoleLog();

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
    const mapImportedCount = document.querySelectorAll(
      '[data-testid^="map-section-"][data-generation-state="importedUnvalidated"]',
    ).length;
    const generatedCount = document.querySelectorAll('[data-generation-state="generated"]').length;
    const reviewCount = document.querySelectorAll('[data-generation-state="needsReview"]').length;
    const summary =
      document.querySelector('[data-testid="protocol-build-console-summary"]')?.textContent?.toLowerCase() ?? '';
    const phase = document
      .querySelector('[data-testid="protocol-build-console"]')
      ?.getAttribute('data-import-context-phase');
    return (
      importedCount > 0 ||
      mapImportedCount > 0 ||
      generatedCount > 0 ||
      reviewCount > 0 ||
      summary.includes('generating') ||
      summary.includes('complete') ||
      status === 'running' ||
      phase === 'enriching'
    );
  }, { timeout: 120_000 });

  const liveMapImported = page.locator(
    '[data-testid^="map-section-"][data-generation-state="importedUnvalidated"]',
  );
  const liveMapProgress = page.locator(
    '[data-testid^="map-section-"][data-generation-state="importedUnvalidated"], [data-testid^="map-section-"][data-generation-state="needsReview"], [data-testid^="map-section-"][data-generation-state="generated"]',
  );
  if ((await liveMapImported.count()) === 0 && (await liveMapProgress.count()) === 0) {
    throw new Error('MAP should show imported or generated section tiles during import.');
  }

  const explorerStatusIcon = page.locator('[data-testid^="import-section-indicator-"]').first();
  await explorerStatusIcon.waitFor({ timeout: 15_000 });
  const explorerStatusState = await explorerStatusIcon.getAttribute('data-generation-state');
  if (!explorerStatusState) {
    throw new Error('Protocol Explorer should show workflow status icons with data-generation-state.');
  }

  const activeProcessingAnimation = page.locator(
    '[data-testid^="map-processing-"] .animate-spin, [data-testid^="import-section-indicator-"] .animate-spin, [data-testid^="import-section-indicator-"] .animate-pulse',
  );
  if ((await activeProcessingAnimation.count()) === 0) {
    const buildStatus = await page.getByTestId('protocol-build-console').getAttribute('data-status');
    if (buildStatus === 'running') {
      throw new Error('Expected subtle spinner/pulse on active generating/validating/import states.');
    }
  }

  const buildConsole = page.getByTestId('protocol-build-console');
  const buildStatus = await buildConsole.getAttribute('data-status');
  if (buildStatus === 'running' || buildStatus === 'paused') {
    await page.getByTestId('protocol-build-spinner').waitFor({ timeout: 120_000 });
    await page.getByTestId('protocol-build-pause').waitFor();
    await page.getByTestId('protocol-build-cancel').waitFor();
  }

  const narrativeSectionIndicatorSelector =
    '[data-testid^="import-section-indicator-"]:not([data-testid="import-section-indicator-title"]):not([data-testid="import-section-indicator-amendment"])';
  const importedIndicator = page
    .locator(`${narrativeSectionIndicatorSelector}[data-generation-state="importedUnvalidated"]`)
    .first();
  const generatedIndicator = page
    .locator(
      `${narrativeSectionIndicatorSelector}[data-generation-state="generated"], ${narrativeSectionIndicatorSelector}[data-generation-state="needsReview"]`,
    )
    .first();
  const contentIndicator = (await importedIndicator.count()) > 0 ? importedIndicator : generatedIndicator;
  await contentIndicator.waitFor({ timeout: 120_000 });
  const reviewSectionId =
    (await contentIndicator.getAttribute('data-testid'))?.replace('import-section-indicator-', '') ?? '1';
  await page.locator(`[data-testid="map-section-${reviewSectionId}"]`).click();
  await page.getByTestId('viewport-import-generated-text').waitFor({ timeout: 15_000 });
  const importedText = await page.getByTestId('viewport-import-generated-text').innerText();
  if (importedText.trim().length < 20) {
    throw new Error(`Expected verbatim imported section text, got fragment: "${importedText.trim()}"`);
  }

  const importedMapTile = page.locator(`[data-testid="map-section-${reviewSectionId}"]`);
  const importedMapState = await importedMapTile.getAttribute('data-generation-state');
  const importedMapStates = ['importedUnvalidated', 'needsReview', 'generated'];
  if (!importedMapStates.includes(importedMapState ?? '')) {
    throw new Error(`Expected imported MAP tile state in ${importedMapStates.join('|')}, got ${importedMapState}`);
  }
  const importedMapClass = await importedMapTile.getAttribute('class');
  if (importedMapState === 'importedUnvalidated' && importedMapClass?.includes('bg-muted/80')) {
    throw new Error('Imported MAP tile must not use neutral gray styling.');
  }

  const validateButton = page.getByTestId('viewport-validate-section');
  const shouldRunValidationUi =
    importedMapState === 'importedUnvalidated' ||
    (await validateButton.isVisible().catch(() => false));

  if (shouldRunValidationUi) {
    if (!(await validateButton.isVisible().catch(() => false))) {
      throw new Error('Validate button should appear for importedUnvalidated section.');
    }
    await validateButton.click();

    await page.waitForFunction(
      (sectionId) => {
        const mapState = document
          .querySelector(`[data-testid="map-section-${sectionId}"]`)
          ?.getAttribute('data-generation-state');
        const workflowBadge =
          document.querySelector('[data-testid="viewport-workflow-state-badge"]')?.textContent?.toLowerCase() ??
          '';
        return (
          !!document.querySelector('[data-testid="viewport-validation-running"]') ||
          !!document.querySelector('[data-testid="section-validation-review-panel"]') ||
          mapState === 'validated' ||
          mapState === 'reviewed' ||
          mapState === 'validationProposed' ||
          workflowBadge.includes('validated') ||
          workflowBadge.includes('reviewed') ||
          workflowBadge.includes('validation proposed')
        );
      },
      reviewSectionId,
      { timeout: 30_000 },
    );

    const reviewPanel = page.getByTestId('section-validation-review-panel');
    await page.waitForFunction(
      (sectionId) => {
        const mapState = document
          .querySelector(`[data-testid="map-section-${sectionId}"]`)
          ?.getAttribute('data-generation-state');
        const workflowBadge =
          document.querySelector('[data-testid="viewport-workflow-state-badge"]')?.textContent?.toLowerCase() ??
          '';
        return (
          !!document.querySelector('[data-testid="section-validation-review-panel"]') ||
          mapState === 'validated' ||
          mapState === 'reviewed' ||
          mapState === 'validationProposed' ||
          workflowBadge.includes('validated') ||
          workflowBadge.includes('reviewed') ||
          workflowBadge.includes('validation proposed')
        );
      },
      reviewSectionId,
      { timeout: 120_000 },
    );

    if (await reviewPanel.isVisible().catch(() => false)) {
    await page.getByTestId('validation-compact-summary').waitFor({ timeout: 15_000 });
    await page.getByTestId('validation-comparison-region').waitFor({ timeout: 15_000 });
    const findingsPanel = page.getByTestId('validation-findings-panel');
    if ((await findingsPanel.count()) === 0) {
      // Findings panel appears when validation produces structured findings.
    }
    const legacyTerminology = page.getByText(/narrative validation pending/i);
    if ((await legacyTerminology.count()) > 0) {
      throw new Error('Legacy controlled terminology pending message should not appear.');
    }
    await page.getByTestId('validation-run-llm-button').waitFor({ timeout: 15_000 });
    const llmUnavailable = page.getByTestId('validation-llm-unavailable-message');
    if ((await llmUnavailable.count()) === 0) {
      throw new Error('Expected helpful LLM unavailable message when fixture provider is active.');
    }

    const highlight = page.locator('[data-testid="validation-change-highlight"]').first();
    if ((await highlight.count()) > 0) {
      await highlight.hover();
      await page.getByTestId('validation-change-tooltip').waitFor({ timeout: 5_000 });
    }

    await page.getByTestId('validation-view-side-by-side').click();
    await page.getByTestId('validation-side-by-side-left').waitFor({ timeout: 15_000 });
    await page.getByTestId('validation-side-by-side-right').waitFor({ timeout: 15_000 });
    const comparisonHeight = await page.getByTestId('validation-comparison-region').evaluate((el) => el.clientHeight);
    if (comparisonHeight < 180) {
      throw new Error(`Side-by-Side comparison region should fill available height (got ${comparisonHeight}px).`);
    }
    const leftPaneHeight = await page.getByTestId('validation-side-by-side-left').evaluate((el) => el.clientHeight);
    if (leftPaneHeight < 120) {
      throw new Error(`Side-by-Side left pane should be scrollable with meaningful height (got ${leftPaneHeight}px).`);
    }
    const sideHighlightCount = await page.locator('[data-testid="validation-change-highlight"]').count();
    if (sideHighlightCount === 0) {
      throw new Error('Side-by-Side view should highlight differences.');
    }

    const scrollArea = page.getByTestId('validation-comparison-region');
    await scrollArea.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const actionBar = page.getByTestId('validation-action-bar');
    await actionBar.waitFor({ timeout: 5_000 });
    if (!(await actionBar.isVisible())) {
      throw new Error('Validation action bar should remain visible while scrolling.');
    }

    await page.getByTestId('validation-view-track-changes').click();
    await page.getByTestId('validation-track-changes-view').waitFor({ timeout: 15_000 });
    await page.getByTestId('validation-accept-button').click();
  } else {
    const validatedMapTile = page.locator(`[data-testid="map-section-${reviewSectionId}"]`);
    const validatedMapState = await validatedMapTile.getAttribute('data-generation-state');
    if (validatedMapState !== 'validated' && validatedMapState !== 'reviewed') {
      throw new Error(
        `Expected validation to complete without manual accept, got MAP state ${validatedMapState}`,
      );
    }
    const workflowBadge = await page.getByTestId('viewport-workflow-state-badge').textContent();
    const normalizedBadge = workflowBadge?.toLowerCase() ?? '';
    if (!normalizedBadge.includes('validated') && !normalizedBadge.includes('reviewed')) {
      throw new Error(`Expected validated workflow after validation no-op, got "${workflowBadge}"`);
    }
  }
  }

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

  buildConsoleText = await readBuildConsoleLog();
  if (
    !buildConsoleText.includes('First draft available') &&
    !buildConsoleText.includes('Priority generation complete') &&
    !buildConsoleText.includes('Hybrid import workspace ready')
  ) {
    throw new Error('Expected First draft available or generation completion in build console.');
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

  await page.getByTestId('header-autosave-status').waitFor({ timeout: 15_000 });
  const footerValidationIssues = page.getByText(/\d+ validation issues/i);
  if ((await footerValidationIssues.count()) > 0) {
    throw new Error('Footer should not show static mock validation issue counts.');
  }

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
