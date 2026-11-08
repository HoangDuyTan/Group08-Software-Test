import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Group08 ASM08: all functions in one suite; no retry to conceal failures.
const reportDir = path.resolve(__dirname, '..', 'Test Report - Group08');

export default defineConfig({
  testDir: './tests',
  timeout: 180_000, // 3-minute upper bound per test (some checkout flows are long).
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: './test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(reportDir, 'html-report'), open: 'never' }],
    ['json', { outputFile: path.join(reportDir, 'group08-results.json') }],
    ['junit', { outputFile: path.join(reportDir, 'group08-junit.xml') }],
  ],
  use: {
    baseURL: 'https://didongviet.vn/',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
