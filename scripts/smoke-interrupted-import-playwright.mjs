/**
 * Smoke: interrupted / partial GPT-5 import localStorage must not white-screen the app.
 * Run: M11_BASE_URL=http://localhost:5173/ node scripts/smoke-interrupted-import-playwright.mjs
 */
import { chromium } from 'playwright';

const baseUrl = process.env.M11_BASE_URL ?? 'http://localhost:5173/';

const SCENARIOS = [
  {
    name: 'partial-gpt5-with-failed-sections',
    init: () => {
      const failedDraft = {
        sectionId: '2',
        title: '2 Introduction',
        generatedText: '',
        sourceUploadId: 'import-1',
        sourceExtractionId: 'import-1',
        generationStatus: 'failed',
        generationProvider: 'openai',
        state: 'validationFailed',
        generatedAt: new Date().toISOString(),
        validationStatus: 'failed',
        validationMessages: ['The M11 section generation request timed out after 120 seconds.'],
      };
      const okDraft = {
        sectionId: '3',
        title: '3 Objectives',
        generatedText: 'Objectives text',
        sourceUploadId: 'import-1',
        sourceExtractionId: 'import-1',
        generationStatus: 'generated',
        generationProvider: 'openai',
        state: 'pendingReview',
        generatedAt: new Date().toISOString(),
        validationStatus: 'not-run',
      };
      localStorage.setItem(
        'm11-protocol-import-v3',
        JSON.stringify({
          artifact: {
            id: 'import-1',
            filename: 'interrupted.docx',
            uploadedAt: new Date().toISOString(),
            fileSize: 1,
            fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sourceType: 'user-uploaded-protocol',
            status: 'processed',
            storagePath: 'x',
          },
          importedSourceSummary: {
            uploadId: 'import-1',
            filename: 'interrupted.docx',
            extractedAt: new Date().toISOString(),
            paragraphCount: 1,
            headingCount: 0,
            sectionCandidateCount: 1,
            tableCount: 0,
            fullTextLength: 100,
          },
          protocolKnowledgeModelId: 'knowledge-import-1',
          protocolKnowledgeModel: {
            id: 'knowledge-import-1',
            sourceUploadId: 'import-1',
            extractedAt: new Date().toISOString(),
            knowledgeProvider: 'openai',
            understandingModel: 'gpt-5',
            confidence: 0.8,
          },
          sectionDrafts: { '2': failedDraft, '3': okDraft },
          lastImportCompletedAt: new Date().toISOString(),
          protocolId: 'PROTO-XYZ-301',
        }),
      );
      localStorage.setItem('m11-protocol-llm-provider', 'openai');
      localStorage.setItem(
        'm11-protocol-openai-config-v1',
        JSON.stringify({
          enabled: true,
          apiKey: 'sk-test',
          model: 'gpt-5',
          updatedAt: new Date().toISOString(),
        }),
      );
    },
  },
  {
    name: 'mid-import-artifact-only',
    expectRecoveryBanner: true,
    init: () => {
      localStorage.setItem(
        'm11-protocol-import-v3',
        JSON.stringify({
          artifact: {
            id: 'import-mid',
            filename: 'mid.docx',
            uploadedAt: new Date().toISOString(),
            fileSize: 1,
            fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sourceType: 'user-uploaded-protocol',
            status: 'processing',
            storagePath: 'x',
          },
          sectionDrafts: {},
          protocolId: 'PROTO-XYZ-301',
        }),
      );
      localStorage.setItem('m11-protocol-llm-provider', 'openai');
    },
  },
  {
    name: 'legacy-pr3-minimal',
    init: () => {
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
          protocolKnowledgeModel: {
            id: 'knowledge-x',
            sourceUploadId: 'x',
            extractedAt: new Date().toISOString(),
            knowledgeProvider: 'local-deterministic',
            understandingModel: 'legacy',
            confidence: 0.5,
            studyTitle: 'Legacy study',
          },
          sectionDrafts: {
            '1': {
              sectionId: '1',
              title: '1 Protocol Synopsis',
              generatedText: 'synopsis text',
              sourceUploadId: 'x',
              sourceExtractionId: 'x',
              generationStatus: 'generated',
              state: 'pendingReview',
              generatedAt: new Date().toISOString(),
              validationStatus: 'not-run',
            },
          },
          lastImportCompletedAt: new Date().toISOString(),
        }),
      );
    },
  },
];

async function assertScenario(browser, scenario) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript((initSource) => {
    localStorage.setItem('m11-studio-visited', 'true');
    localStorage.setItem('theme', 'dark');
    eval(initSource);
  }, `(${scenario.init.toString()})()`);

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'M11 Studio' }).waitFor({ timeout: 60_000 });

  const rootLen = (await page.locator('#root').innerHTML()).length;
  if (rootLen < 1000) {
    throw new Error(`${scenario.name}: #root empty (${rootLen} chars)`);
  }

  if (await page.getByTestId('app-review-import-button').isVisible().catch(() => false)) {
    await page.getByTestId('app-review-import-button').click();
    await page.getByTestId('protocol-import-review-workspace').waitFor({ timeout: 30_000 });
    await page.getByTestId('import-tab-source-extraction').click();
    await page.getByTestId('source-extraction-panel').waitFor({ timeout: 15_000 });
  } else if (scenario.expectRecoveryBanner) {
    await page.getByTestId('import-storage-recovery-banner').waitFor({ timeout: 15_000 });
  }

  if (pageErrors.length > 0) {
    throw new Error(`${scenario.name}: page errors: ${pageErrors.join(' | ')}`);
  }

  console.log(`${scenario.name}: PASS`);
  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const scenario of SCENARIOS) {
    await assertScenario(browser, scenario);
  }
  await browser.close();
  console.log('Interrupted import startup smoke: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
