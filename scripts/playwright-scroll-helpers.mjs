/**
 * Shared Playwright helpers for vertical scroll assertions in M11 Studio panes.
 */

/**
 * Assert that a pane's scroll container can scroll vertically.
 */
export async function assertPaneScrolls(page, { panelTestId, scrollTestId = null, label, minScrollTop = 1 }) {
  const panel = page.getByTestId(panelTestId);
  await panel.waitFor({ timeout: 30_000 });

  const result = await panel.evaluate(
    (panelEl, args) => {
      if (!(panelEl instanceof HTMLElement)) {
        return { ok: false, reason: 'panel not found' };
      }

      const targetScrollTestId = args.targetScrollTestId;
      const minTop = args.minTop;

      let scrollEl = null;
      if (targetScrollTestId) {
        const explicit = panelEl.querySelector(`[data-testid="${targetScrollTestId}"]`);
        if (explicit instanceof HTMLElement) {
          const viewport = explicit.querySelector('[data-slot="scroll-area-viewport"]');
          scrollEl = viewport instanceof HTMLElement ? viewport : explicit;
        }
      } else {
        const viewport = panelEl.querySelector('[data-slot="scroll-area-viewport"]');
        if (viewport instanceof HTMLElement) {
          scrollEl = viewport;
        } else {
          const tagged = panelEl.querySelector('[data-testid$="-scroll"]');
          scrollEl = tagged instanceof HTMLElement ? tagged : panelEl;
        }
      }

      if (!(scrollEl instanceof HTMLElement)) {
        return { ok: false, reason: 'scroll container not found' };
      }

      const scrollHeight = scrollEl.scrollHeight;
      const clientHeight = scrollEl.clientHeight;
      if (scrollHeight <= clientHeight + 1) {
        return {
          ok: false,
          reason: `content does not overflow (scrollHeight=${scrollHeight}, clientHeight=${clientHeight})`,
        };
      }

      scrollEl.scrollTop = Math.min(240, scrollHeight - clientHeight);
      return {
        ok: scrollEl.scrollTop >= minTop,
        reason: scrollEl.scrollTop >= minTop ? 'ok' : `scrollTop stayed at ${scrollEl.scrollTop}`,
      };
    },
    { targetScrollTestId: scrollTestId, minTop: minScrollTop },
  );

  if (!result.ok) {
    throw new Error(`${label}: ${result.reason}`);
  }
}

/**
 * Assert scroll works on a direct scroll container test id.
 */
export async function assertScrollContainerScrolls(page, { scrollTestId, label, minScrollTop = 1 }) {
  const container = page.getByTestId(scrollTestId);
  await container.waitFor({ timeout: 30_000 });
  const metrics = await container.evaluate((el, minTop) => {
    if (!(el instanceof HTMLElement)) {
      return { ok: false, reason: 'scroll container not found' };
    }
    if (el.scrollHeight <= el.clientHeight + 1) {
      return {
        ok: false,
        reason: `content does not overflow (scrollHeight=${el.scrollHeight}, clientHeight=${el.clientHeight})`,
      };
    }
    el.scrollTop = Math.min(240, el.scrollHeight - el.clientHeight);
    return {
      ok: el.scrollTop >= minTop,
      reason: el.scrollTop >= minTop ? 'ok' : `scrollTop stayed at ${el.scrollTop}`,
    };
  }, minScrollTop);
  if (!metrics.ok) {
    throw new Error(`${label}: ${metrics.reason}`);
  }
}

/**
 * Run workspace pane scroll checks on the default authoring layout.
 */
export async function assertWorkspacePaneScrolling(page) {
  await assertPaneScrolls(page, {
    panelTestId: 'protocol-explorer-panel',
    scrollTestId: 'protocol-explorer-scroll',
    label: 'Protocol Explorer',
  });

  const templateToggle = page.locator('#m11-template-reference-toggle');
  if (!(await templateToggle.isChecked())) {
    await templateToggle.click();
  }
  if (!(await page.getByTestId('study-model-toggle').isChecked())) {
    await page.getByTestId('study-model-toggle').click();
  }
  await page.getByTestId('m11-template-reference-panel').waitFor({ timeout: 15_000 });

  await assertPaneScrolls(page, {
    panelTestId: 'm11-template-reference-panel',
    scrollTestId: 'm11-template-reference-scroll',
    label: 'Template Reference panel',
  });

  await page.getByTestId('study-model-panel').waitFor({ timeout: 15_000 });
  await page.getByTestId('study-model-scroll').evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    const viewport = el.querySelector('[data-slot="scroll-area-viewport"]');
    const target = viewport instanceof HTMLElement ? viewport : el;
    const filler = document.createElement('div');
    filler.style.height = '1800px';
    target.appendChild(filler);
  });
  await assertPaneScrolls(page, {
    panelTestId: 'study-model-panel',
    scrollTestId: 'study-model-scroll',
    label: 'Study Model panel',
  });

  await page.getByTestId('detail-inspector-scroll').evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    const viewport = el.querySelector('[data-slot="scroll-area-viewport"]');
    const target = viewport instanceof HTMLElement ? viewport : el;
    const filler = document.createElement('div');
    filler.style.height = '1600px';
    target.appendChild(filler);
  });
  await assertPaneScrolls(page, {
    panelTestId: 'detail-inspector-panel',
    scrollTestId: 'detail-inspector-scroll',
    label: 'Detail Inspector',
  });

  await page.getByTestId('protocol-copilot-scroll').evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    const viewport = el.querySelector('[data-slot="scroll-area-viewport"]');
    const target = viewport instanceof HTMLElement ? viewport : el;
    for (let index = 0; index < 12; index += 1) {
      const block = document.createElement('div');
      block.textContent = `Scroll coverage block ${index + 1}`;
      block.style.height = '180px';
      block.style.marginBottom = '12px';
      target.appendChild(block);
    }
  });

  await assertPaneScrolls(page, {
    panelTestId: 'protocol-copilot-panel',
    scrollTestId: 'protocol-copilot-scroll',
    label: 'Protocol Copilot',
  });

  await page.getByTestId('document-viewport-scroll').evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    const viewport = el.querySelector('[data-slot="scroll-area-viewport"]');
    const target = viewport instanceof HTMLElement ? viewport : el;
    const filler = document.createElement('div');
    filler.setAttribute('data-testid', 'scroll-smoke-filler');
    filler.style.height = '2400px';
    target.appendChild(filler);
  });

  await assertPaneScrolls(page, {
    panelTestId: 'document-viewport-scroll',
    label: 'Document viewport',
  });
}
