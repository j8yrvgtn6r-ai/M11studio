/**
 * UI smoke: M11 Studio app startup — shell renders, no page errors.
 * Also verifies legacy malformed import localStorage does not white-screen the app.
 *
 * Run: M11_BASE_URL=http://localhost:5177/ npm run smoke:app-startup
 */
import { chromium } from 'playwright';
import { assertWorkspacePaneScrolling } from './playwright-scroll-helpers.mjs';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:5173/';

async function assertStartup(page, label, options = {}) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'M11 Studio' }).waitFor({ timeout: 60_000 });

  const rootLen = (await page.locator('#root').innerHTML()).length;
  if (rootLen < 1000) {
    throw new Error(`${label}: #root is empty (${rootLen} chars)`);
  }

  const explorerPanel = page.getByTestId('protocol-explorer-panel');
  await explorerPanel.waitFor({ timeout: 15_000 });
  const forewordInExplorer = explorerPanel.getByText(/^0(\.| Foreword)/);
  if ((await forewordInExplorer.count()) > 0) {
    throw new Error(`${label}: Foreword / template instruction nodes must not appear in Protocol Explorer`);
  }

  if (!options.openReviewImport) {
    await assertWorkspacePaneScrolling(page);
  }

  if (options.openReviewImport) {
    await page.getByTestId('app-review-import-button').click();
    await page.getByTestId('protocol-import-review-workspace').waitFor({ timeout: 30_000 });
    await page.getByTestId('import-tab-source-extraction').click();
    await page.getByTestId('source-extraction-panel').waitFor({ timeout: 15_000 });
  }

  if (pageErrors.length > 0) {
    throw new Error(`${label}: page errors: ${pageErrors.join(' | ')}`);
  }

  console.log(`${label}: PASS (root ${rootLen} chars, 0 page errors, no foreword in explorer, pane scrolling ok)`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const cleanContext = await browser.newContext();
  const cleanPage = await cleanContext.newPage();
  await cleanPage.addInitScript(() => {
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
  });
  await assertStartup(cleanPage, 'Clean startup');

  const legacyContext = await browser.newContext();
  const legacyPage = await legacyContext.newPage();
  await legacyPage.addInitScript(() => {
    const legacyDraft = {
      sectionId: '1',
      title: '1 Protocol Synopsis',
      generatedText: 'synopsis text',
      sourceUploadId: 'x',
      sourceExtractionId: 'x',
      matchedSourceCandidateIds: [],
      extractionStatus: 'real-docx-parsed',
      generationStatus: 'generated',
      state: 'pendingReview',
      generatedAt: new Date().toISOString(),
      validationStatus: 'not-run',
    };
    const legacyKnowledge = {
      id: 'knowledge-x',
      sourceUploadId: 'x',
      extractedAt: new Date().toISOString(),
      knowledgeProvider: 'local-deterministic',
      understandingModel: 'legacy',
      understandingPromptVersion: '1',
      confidence: 0.5,
      studyTitle: 'Legacy study',
    };
    localStorage.setItem(
      'm11-protocol-import-v3',
      JSON.stringify({
        importedSourceSummary: {
          uploadId: 'x',
          filename: 'legacy.docx',
          extractedAt: '',
          paragraphCount: 1,
          headingCount: 0,
          sectionCandidateCount: 1,
          tableCount: 0,
          fullTextLength: 100,
        },
        protocolKnowledgeModelId: 'knowledge-x',
        protocolKnowledgeModel: legacyKnowledge,
        sectionDrafts: { '1': legacyDraft },
        lastImportCompletedAt: new Date().toISOString(),
      }),
    );
    localStorage.setItem('m11-protocol-llm-provider', 'openai');
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
  });
  await assertStartup(legacyPage, 'Legacy import startup', { openReviewImport: true });

  await browser.close();
  console.log('Playwright app startup smoke: PASS');
}

main().catch((error) => {
  console.error('Playwright app startup smoke: FAIL');
  console.error(error);
  process.exit(1);
});
