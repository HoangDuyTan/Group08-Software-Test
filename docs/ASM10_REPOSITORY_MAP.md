# Group08 - Repository map (Assignment 10)

This document indexes the actual repository. It does not replace older reports.

## Test source / scripts

- Main Playwright project: `Automation Testing Project - Group08/`
- Config: `playwright.config.ts`; tests are discovered under `tests/`
- Individual member folders: `tests/<MaSV_HoTen>_TestScripts/` after that member's migration
- Each existing member has Fxx `.spec.ts` files, possible ASM09 `.spec.ts`, and local helpers
- To migrate other members, obtain their agreement and rerun the organizer with `-AllMembers`

## Test data

Synthetic input values are currently defined inside test files and through environment
variables. See `Automation Testing Project - Group08/test-data/README.md`.
Do not commit real customer order IDs, phone numbers or credentials.

## Reports and evidence (original locations retained on purpose)

- `Test Report - Group08/`: group summaries, JSON/XML, HTML and prior evidence
- `Automation Testing Project - Group08/Test Report - Group08/`: prior member report files
- `Automation Testing Project - Group08/playwright-report/`: prior HTML report
- `playwright-report/`: earlier per-function HTML reports (historical)
- `Envidence - Group08/`: historical screenshots and execution logs

The report folder name `Envidence - Group08` is intentionally NOT renamed to
preserve existing references and evidence. Do not present separate historical
runs as if they were one final full-suite run.

## Assignment delivery

- `../group08.txt`: links to repository, shared Sheets, Slides, Drive, website, members
- `README.md`: setup, member scripts, full suite, reports, screenshots
- `Automation Testing Project - Group08/Group08_AutomationPlan.md`: original plan (unchanged)
- `docs/`: historical work and supporting files

Run from inside `Automation Testing Project - Group08`:

```powershell
npm ci
npx playwright install chromium
npm run test:list
npm run test:f07
npm run test:f08
npm run test:f09
npm test
npm run report:summary
```

Before using the `npm run test:f07/f08/f09` commands, confirm that the package
scripts reference the currently active folder names. `npm test` collects all
spec files under the Playwright `testDir`.

This organizer deliberately DOES NOT rewrite or fake `../group08.txt` missing links,
modify old Test Reports, change the plan contents, or move other members' files
without `-AllMembers`.