import type { BrowserContext, Page, Response, Request, TestInfo } from '@playwright/test';

type Scenario = {
  id: string;
  title: string;
  group: string;
  steps: string[];
  expected: string[];
};
type NetworkEvent = {
  kind: 'response' | 'requestfailed' | 'pageerror';
  method?: string;
  path?: string;
  status?: number;
  message?: string;
};
type ReportState = {
  context?: BrowserContext;
  page?: Page;
  pathname: string | null;
  pageText: string | null;
  network: NetworkEvent[];
  screenshot?: Buffer;
  reportingErrors: string[];
  captured: boolean;
};
export type ResultReportingFixture = { _finalEvidence: void };

/** One result shape for all three suites, following Tan's FINAL EVIDENCE block. */
export function createResultReporting(feature: 'F13' | 'F14' | 'F15', cases: Scenario[]) {
  const states = new WeakMap<TestInfo, ReportState>();
  const getState = (info: TestInfo) => {
    let state = states.get(info);
    if (!state) {
      state = { pathname: null, pageText: null, network: [], reportingErrors: [], captured: false };
      states.set(info, state);
    }
    return state;
  };
  const scenarioFor = (info: TestInfo) => cases.find(item => info.title.startsWith(`${item.id} - `));

  async function capture(page: Page, state: ReportState) {
    state.captured = true;
    if (page.isClosed()) {
      state.reportingErrors.push('Page closed before final evidence could be captured.');
      return;
    }
    try { state.pathname = new URL(page.url()).pathname; } catch { state.pathname = null; }
    state.pageText = await page.locator('main').innerText({ timeout: 1500 })
      .catch(() => page.locator('body').innerText({ timeout: 1500 }))
      .then(text => text.slice(0, 4000))
      .catch(() => null);
    try {
      state.screenshot = await page.screenshot({ fullPage: false, animations: 'disabled', timeout: 5000 });
    } catch (error) {
      state.reportingErrors.push(`Screenshot unavailable: ${String(error)}`);
    }
  }

  return {
    capturePage: (page: Page, info: TestInfo) => capture(page, getState(info)),
    // No page/context dependency: emit the real failure even when fixture setup fails.
    resultFixture: async ({}, use: () => Promise<void>, info: TestInfo) => {
      const state = getState(info);
      try {
        await use();
      } finally {
        const scenario = scenarioFor(info);
        const result = {
          id: scenario?.id ?? null,
          feature,
          title: info.title,
          group: scenario?.group ?? null,
          status: info.status,
          expectedStatus: info.expectedStatus,
          durationMs: info.duration,
          pathname: state.pathname,
          steps: scenario?.steps ?? [],
          expected: scenario?.expected ?? [],
          assertionError: info.error?.message ?? null,
          observations: info.annotations.filter(item => item.type === 'observation').map(item => item.description),
          network: state.network,
          pageText: state.pageText,
          reportingErrors: state.reportingErrors,
          warning: 'Failed test is a defect candidate only. Check setup, actual behavior and duplicates.',
        };
        const json = JSON.stringify(result, null, 2);
        console.log(`\n===== ${feature} FINAL EVIDENCE =====\n${json}\n===== END FINAL EVIDENCE =====\n`);
        await info.attach(`${feature}_FINAL_RESULT.json`, {
          body: Buffer.from(json, 'utf8'), contentType: 'application/json',
        });
        if (state.screenshot) await info.attach(`${feature}_FINAL_SCREENSHOT.png`, {
          body: state.screenshot, contentType: 'image/png',
        });
      }
    },
    contextFixture: async ({ context }: { context: BrowserContext }, use: (context: BrowserContext) => Promise<void>, info: TestInfo) => {
      const state = getState(info);
      state.context = context;
      const add = (event: NetworkEvent) => { if (state.network.length < 120) state.network.push(event); };
      const relevantPath = (url: string) => {
        try {
          const parsed = new URL(url);
          return parsed.origin === 'https://didongviet.vn' && parsed.pathname.startsWith('/api/fe/') ? parsed.pathname : null;
        } catch { return null; }
      };
      const response = (item: Response) => {
        const path = relevantPath(item.url());
        if (path) add({ kind: 'response', method: item.request().method(), path, status: item.status() });
      };
      const failed = (request: Request) => {
        const path = relevantPath(request.url());
        if (path) add({ kind: 'requestfailed', method: request.method(), path, message: request.failure()?.errorText });
      };
      const pageOpened = (page: Page) => {
        state.page = page;
        page.on('pageerror', error => add({ kind: 'pageerror', message: error.message }));
      };
      context.on('response', response);
      context.on('requestfailed', failed);
      context.on('page', pageOpened);
      context.pages().forEach(pageOpened);
      try {
        await use(context);
      } finally {
        if (!state.captured && state.page) await capture(state.page, state);
        context.off('response', response);
        context.off('requestfailed', failed);
        context.off('page', pageOpened);
      }
    },
    pageFixture: async ({ page }: { page: Page }, use: (page: Page) => Promise<void>, info: TestInfo) => {
      const state = getState(info);
      state.page = page;
      try {
        await use(page);
      } finally {
        const active = page.context().pages().filter(item => !item.isClosed());
        const current = active.find(item => /\/(?:installment|checkout|cart)(?:[/?#]|$)/.test(item.url())) ?? active.at(-1) ?? page;
        await capture(current, state);
      }
    },
  };
}
