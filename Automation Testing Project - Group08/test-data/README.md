# Group08 - Test data

Existing tests mostly use synthetic constants inside the Playwright `.spec.ts`
files, plus optional environment variables for authorized fixture data. Do not
create real orders on the production website merely for testing.

Do not add customer PII, credentials, cookies, or production order records here.
A missing authorized fixture should remain a justified Skipped/Blocked test.
See the actual files under `../tests/` for inputs and their assertions.