# Group08 - All-Suite Guide (Assignment 10)

> Repository preparation performed: 2026-11-14 18:54:41.
> NO TEST RUN WAS EXECUTED by the organizer; NO FINAL REPORT WAS SELECTED.

## Test scope confirmed by the team

- All tests in `Automation Testing Project - Group08/tests/`, including F01-F15 and ASM09 defect-hunting scripts.
- Playwright discovery (`npm run test:list`): **630 tests / 20 files** (read-only discovery; may change with code).
- Do not describe the earlier 460 Function-only report as the final all-suite result.
- Keep `Group08_AutomationPlan.md` unchanged.

## Run from the NPM project (not the Git repository root)

```powershell
cd 'Automation Testing Project - Group08'
npm ci                      # only if dependencies are not installed
npx playwright install chromium
npm run test:list
npm run test:all             # executes Function tests AND ASM09; may take time
npm run report:summary      # only AFTER the test run; it overwrites summary files
npm run test:report
```

**WARNING:** `playwright.config.ts` currently writes HTML/JSON/XML to fixed paths under `../Test Report - Group08/` and may overwrite them on each run. Before a new run, back up those outputs and preserve its run-specific log/time. After running, archive the NEW matching HTML, JSON, XML and Summary together with a run ID. Never combine reports from different runs.

## Report source-of-truth

- `Test Report - Group08/REPORT_INDEX.md`: report index (the final report is NOT selected yet).
- `Test Report - Group08/history/asm10-pre-final-20261114-185435-548188/`: copy of files that existed BEFORE reorganizing (local archived copies ignored by Git; original paths remain available).
- Report counts observed BEFORE organizer: JSON 630; XML 630; Summary 460.
- Consistency: MISMATCH or incomplete files; DO NOT present as one run.
- Historical report (`TEST_REPORT_PENDING.md`) is historical planning text, not an accurate status of today's final suite.
- Defects are validated separately; a failed automation test is not automatically a unique verified defect.

## Required submission checks

1. README and `group08.txt` have all accurate links (no `CHUA_CAP_NHAT`).
2. All 5 member test folders have `_TestScripts` suffix.
3. Full-suite report has one run ID and internally consistent JSON/XML/HTML/Summary.
4. A member's 10 defect evidence folders are accessible by the teacher.
5. Git change review, commit, push and PR by each member; no automatic commits.
6. Google Sheets/Slides/Drive are updated online; the `.xlsx` copies alone are not the final shared docs.