import { defineConfig } from '@playwright/test';
import path from 'node:path';

const runId = process.env.ASM09_RUN_ID || 'default-run';

const reportRoot = path.resolve(
  __dirname,
  '..',
  'Test Report - Group08',
  '23130067_PhamMinhDuc_ASM09'
);

const resultDir = path.join(
  reportRoot,
  'test-results',
  runId
);

export default defineConfig({
  testDir: './tests',
  outputDir: resultDir,
  workers: 1,
  retries: 0,
  timeout: 120000,

  use: {
    browserName: 'chromium',
    headless: false,
    video: 'on',
    screenshot: 'on',
    trace: 'on',
  },

  reporter: [
    ['list'],
    ['json', {
      outputFile: path.join(resultDir, 'results.json')
    }],
    ['html', {
      outputFolder: path.join(resultDir, 'html-report'),
      open: 'never'
    }]
  ],
});
