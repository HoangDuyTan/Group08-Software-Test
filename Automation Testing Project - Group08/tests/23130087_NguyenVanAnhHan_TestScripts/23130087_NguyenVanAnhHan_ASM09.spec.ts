import { test as base, expect, type Page, type Locator } from '@playwright/test';

/**
 * Assignment 9 | Nguyễn Văn Anh Hàn – 23130087 | F10 / F11 / F12.
 * Các assertion kiểm tra hành vi mong đợi, KHÔNG cố ý đảo assertion để báo Pass.
 * Failed chỉ trở thành defect sau khi đọc observation / screenshot / video / trace,
 * loại lỗi môi trường, tái hiện độc lập và đối chiếu Expected trong workbook.
 * Chạy: npx playwright test 23130087_NguyenVanAnhHan_ASM09.spec.ts --project=chromium --workers=1 --retries=0 --repeat-each=3
 * Toàn bộ request không phải GET/HEAD/OPTIONS bị abort trước backend.
 * Không mock phản hồi website; không gửi lead/đơn thật; không vượt CAPTCHA/403.
 * GPS của HAN_07 được cấp bằng browser test context và công khai trong evidence.
 */
const ORIGIN = 'https://didongviet.vn';
const URLS = {
  F10: `${ORIGIN}/trade-in.html`,
  F11: `${ORIGIN}/cua-hang-gan-ban.html`,
  F12: `${ORIGIN}/dich-vu-khach-hang-doanh-nghiep.html`,
};
const MODEL = 'iPhone 17 Pro Max 1TB Cũ';
const STORE = 'Cửa hàng Di Động Việt Trần Não';
const B2B = `${ORIGIN}/api/fe/wp-landings/b2b`;
type Captured = { url: string; method: string; body: unknown; action: 'abort-before-backend' };
type Evidence = {
  defectId: string; startedAt: string; repeatIndex: number;
  scope: string; blockedWrites: Captured[]; b2bResponses: number; thirdPartyMutationsBlocked: number;
  observations: Record<string, any>;
};
const test = base.extend<{ evidence: Evidence }>({
  evidence: [async ({ context, page }, use, info) => {
    const id = info.title.match(/DDV-HAN-\d+/)?.[0] ?? 'UNKNOWN';
    const evidence: Evidence = {
      defectId: id, startedAt: new Date().toISOString(), repeatIndex: info.repeatEachIndex,
      scope: 'Real online UI; all mutations aborted; no backend registration success asserted.',
      blockedWrites: [], b2bResponses: 0, thirdPartyMutationsBlocked: 0, observations: {},
    };
    await context.route('**/*', async route => {
      const request = route.request();
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.continue();
      let body: unknown = request.postData();
      try { body = request.postDataJSON(); } catch { /* Preserve non-JSON request body. */ }
      if (new URL(request.url()).origin === ORIGIN) evidence.blockedWrites.push({ url: request.url(), method: request.method(), body, action: 'abort-before-backend' });
      else evidence.thirdPartyMutationsBlocked++;
      await route.abort('blockedbyclient');
    });
    page.on('response', response => {
      if (response.url() === B2B && response.request().method() === 'POST') evidence.b2bResponses++;
    });
    try { await use(evidence); }
    finally {
      await info.attach('observation.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
      console.log(`[ASM09_OBSERVATION] ${JSON.stringify(evidence)}`);
    }
  }, { auto: true }],
});

test.use({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
test.describe.configure({ mode: 'default', timeout: 100_000 });

function blocked(reason: string): never {
  test.info().annotations.push({ type: 'Blocked', description: reason });
  test.skip(true, reason);
  throw new Error(reason);
}
async function photo(page: Page, label: string) {
  await test.info().attach(`${label}.png`, { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
}
async function open(page: Page, module: keyof typeof URLS) {
  const response = await page.goto(URLS[module], { waitUntil: 'domcontentloaded' });
  if (!response || response.status() >= 400) blocked(`Environment: ${module} HTTP ${response?.status() ?? 'no response'}; not a functional defect.`);
  const challenge = page.getByRole('heading', { name: /Verifying that you are not a robot/i });
  const content = module === 'F10' ? page.locator('[data-tradein-product-id]').first()
    : module === 'F11' ? storeCards(page).first() : page.locator('#b2b-name');
  await content.or(challenge).first().waitFor({ state: 'visible', timeout: 25_000 });
  if (await challenge.isVisible()) blocked('CAPTCHA challenge; no bypass, no mock website.');
  // Let initial hydration finish before dismissing the cookie UI through a real click.
  await page.waitForTimeout(1800);
  const cookie = page.getByRole('dialog').filter({ hasText: 'Cookie & trải nghiệm Di Động Việt' });
  await cookie.waitFor({ state: 'visible', timeout: 2500 }).catch(() => {});
  if (await cookie.isVisible()) {
    await cookie.getByRole('button', { name: 'Từ chối', exact: true }).click();
    await expect(cookie).toBeHidden();
  }
  await expect(content).toBeVisible();
  // Read-only hydration check: do not fill or submit the SSR form before React
  // attaches its real handler. This avoids native navigation and lost inputs.
  const readinessTarget = module === 'F12' ? page.locator('form').filter({ has: page.locator('#b2b-name') })
    : module === 'F11' ? page.getByPlaceholder('Tìm bằng tên đường/Tỉnh thành', { exact: true })
      : page.locator('[data-tradein-product-id] button').first();
  const handler = module === 'F12' ? 'onSubmit' : module === 'F11' ? 'onChange' : 'onClick';
  await expect.poll(() => readinessTarget.evaluate((el, eventName) =>
    Object.keys(el).some(key => key.startsWith('__reactProps$') &&
      typeof (el as any)[key]?.[eventName] === 'function'), handler), {
    timeout: 30_000, intervals: [300, 500, 1000],
    message: `${module} UI handler must be attached before entering test data`,
  }).toBe(true);
}
function productNames(page: Page) {
  return page.locator('[data-tradein-product-id] > p').allTextContents().then(xs => xs.map(x => x.trim()));
}
async function category(page: Page, name: string, firstFamily: RegExp) {
  const button = page.getByRole('button', { name: new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') });
  const link = button.locator('xpath=ancestor::a[1]');
  await link.click();
  await expect(button).toHaveClass(/border-blue-600/);
  await expect.poll(async () => firstFamily.test((await productNames(page))[0] ?? ''), { timeout: 15_000 }).toBe(true);
}
function assessment(page: Page) {
  return page.getByRole('dialog').filter({ hasText: 'Xác định tình trạng máy' });
}
async function openAssessment(page: Page): Promise<Locator> {
  const card = page.locator('[data-tradein-product-id]').filter({ has: page.getByText(MODEL, { exact: true }) });
  if (!(await card.count())) blocked(`Fixture missing: ${MODEL}; do not substitute another device.`);
  await card.getByRole('button', { name: `Chọn ${MODEL}`, exact: true }).click();
  const dialog = assessment(page);
  await dialog.getByText('Giá thu sau đánh giá', { exact: true }).waitFor();
  await expect(dialog.getByRole('radio')).toHaveCount(6);
  return dialog;
}
function grade(dialog: Locator, value: number) {
  return dialog.getByRole('radio', { name: new RegExp(`^(?:Máy\\s+)?Loại ${value}:`, 'i') });
}
async function money(scope: Locator, label: string) {
  const raw = await scope.getByText(label, { exact: true }).evaluate(el => el.nextElementSibling?.textContent ?? '');
  const value = Number(raw.replace(/[^\d-]/g, ''));
  expect(Number.isSafeInteger(value) && /\d/.test(raw), `Missing price for ${label}: ${raw}`).toBe(true);
  return value;
}
function storeCards(page: Page) {
  return page.locator('main [role="button"]').filter({ has: page.locator('h3') });
}
async function storeNames(page: Page) {
  return (await storeCards(page).locator('h3').allTextContents()).map(s => s.trim());
}
async function searchStores(page: Page, query: string) {
  const input = page.getByPlaceholder('Tìm bằng tên đường/Tỉnh thành', { exact: true });
  await input.fill(query);
  await expect(input).toHaveValue(query);
  // UI search has no submit button/loading marker; observe the settled filter.
  await page.waitForTimeout(400);
  return { query, codePoints: [...query].map(c => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`), names: await storeNames(page) };
}
const DATA = { name: 'ASM9 QA Han', phone: '0901234567', email: 'asm9-23130087@example.com',
  company: 'ASM9 QA', product: 'iPhone 15', quantity: '1', note: 'ASM9 - khong lien he' };
async function submitB2B(page: Page, evidence: Evidence, data: typeof DATA) {
  for (const [key, value] of Object.entries(data)) await page.locator(`#b2b-${key}`).fill(value);
  const before = evidence.blockedWrites.length;
  await page.getByRole('button', { name: 'Hoàn tất đăng ký', exact: true }).click();
  await expect.poll(async () => (await page.locator('form [role="alert"]').count()) > 0 ||
    evidence.blockedWrites.slice(before).some(r => r.url === B2B), { timeout: 10_000 }).toBe(true);
  await expect(page.getByRole('button', { name: 'Hoàn tất đăng ký', exact: true })).toBeEnabled();
  const values: Record<string, string> = {};
  for (const key of Object.keys(data)) values[key] = await page.locator(`#b2b-${key}`).inputValue();
  expect(evidence.b2bResponses, 'Guard must prevent every real backend response').toBe(0);
  return { values, alerts: await page.locator('form [role="alert"]').allTextContents(),
    requests: evidence.blockedWrites.slice(before).filter(r => r.url === B2B) };
}

test.describe('ASM09 | 23130087 | F10 / F11 / F12', () => {
  test('DDV-HAN-01 | F10 | Nhóm XIAOMI-OPPO-TECNO chứa thương hiệu ngoài nhãn', async ({ page, evidence }) => {
    await open(page, 'F10');
    await test.step('Chọn nhóm trên UI thật, chờ sản phẩm của nhóm xuất hiện', async () => {
      await category(page, 'XIAOMI | OPPO | TECNO', /^(?:OPPO|Xiaomi|Redmi|POCO|TECNO)\b/i);
    });
    const names = await productNames(page);
    evidence.observations = { group: 'XIAOMI | OPPO | TECNO', names,
      outsideLabel: names.filter(n => !/^(?:OPPO|Xiaomi|Redmi|POCO|TECNO)\b/i.test(n)) };
    await photo(page, 'HAN01-category-actual');
    expect(evidence.observations.outsideLabel, 'Products must belong to the brands named by the selected group').toEqual([]);
  });

  test('DDV-HAN-02 | F10 | Truy vấn không đồng bộ sau khi chuyển danh mục', async ({ page, evidence }) => {
    await open(page, 'F10');
    await category(page, 'SAMSUNG', /^Samsung\b/i);
    await category(page, 'IPHONE', /^iPhone\b/i);
    const query = 'iPhone 17 Pro Max 1TB';
    const input = page.getByRole('searchbox', { name: 'Tìm kiếm thiết bị thu cũ', exact: true });
    await input.fill(query); await input.press('Enter');
    await expect(page).toHaveURL(u => u.searchParams.get('tiq') === query);
    try {
      await expect.poll(async () => {
        const names = await productNames(page);
        evidence.observations = { query, input: await input.inputValue(), url: page.url(), names,
          unmatched: names.filter(n => !/^iPhone 17 Pro Max 1TB\b/i.test(n)) };
        return names.length > 0 && evidence.observations.unmatched.length === 0;
      }, { timeout: 12_000, message: 'Settled result set must match the current exact model query' }).toBe(true);
    } finally { await photo(page, 'HAN02-query-actual'); }
  });

  test('DDV-HAN-03 | F10 | Trợ giá vẫn cộng cho máy loại 4-6 trái điều kiện hiển thị', async ({ page, evidence }) => {
    await open(page, 'F10'); const dialog = await openAssessment(page);
    await expect(dialog.getByText('Trợ giá cộng thêm, áp dụng cho máy phân loại 1, 2, 3', { exact: true })).toBeVisible();
    const observations = [];
    for (const value of [1, 4, 5, 6]) {
      await grade(dialog, value).check(); await expect(grade(dialog, value)).toBeChecked();
      const adjusted = await money(dialog, 'Giá thu sau đánh giá');
      const maximum = await money(dialog, 'Giá thu tối đa dự kiến');
      observations.push({ grade: value, adjusted, maximum, addedSubsidy: maximum - adjusted });
      if (value === 1 || value === 4) await photo(page, `HAN03-grade-${value}`);
    }
    evidence.observations = { model: MODEL, displayedRule: 'Trợ giá cộng thêm, áp dụng cho máy phân loại 1, 2, 3', observations };
    expect(observations[0].addedSubsidy, 'Positive control: eligible grade receives additional subsidy').toBeGreaterThan(0);
    expect(observations.filter(o => o.grade >= 4).map(o => o.addedSubsidy), 'Ineligible grades must not be added to the stated grade-1/2/3 subsidy').toEqual([0, 0, 0]);
  });

  test('DDV-HAN-04 | F10 | Quay lại bước đánh giá làm mất màu và loại máy đã chọn', async ({ page, evidence }) => {
    await open(page, 'F10'); const dialog = await openAssessment(page);
    await dialog.getByRole('button', { name: 'Cam Vũ Trụ', exact: true }).click();
    await grade(dialog, 4).check();
    const before = { adjusted: await money(dialog, 'Giá thu sau đánh giá'), grade: 4, color: 'Cam Vũ Trụ' };
    await photo(page, 'HAN04-before-step-back');
    await dialog.getByRole('button', { name: 'Chỉ thu cũ', exact: true }).click();
    await dialog.locator('#trade-in-full-name').waitFor();
    const summaryBefore = await dialog.innerText();
    await dialog.getByRole('button', { name: '2. Xác định tình trạng máy', exact: true }).click();
    await dialog.getByText('Giá thu sau đánh giá', { exact: true }).waitFor();
    await expect(dialog.getByRole('radio')).toHaveCount(6);
    await page.waitForTimeout(600);
    const after = { adjusted: await money(dialog, 'Giá thu sau đánh giá'),
      grade4Checked: await grade(dialog, 4).isChecked(), color: await dialog.locator('button[aria-pressed="true"]').allTextContents() };
    await photo(page, 'HAN04-after-step-back');
    evidence.observations = { before, after, summaryBefore, action: 'Click the step-2 navigation button; do not edit grade or color.' };
    expect(after, 'Returning to edit the same assessment must retain prior inputs and quote until changed by the user')
      .toEqual({ adjusted: before.adjusted, grade4Checked: true, color: ['Cam Vũ Trụ'] });
  });

  test('DDV-HAN-12 | F12 | Banner tư vấn dẫn tới tên miền beta yêu cầu xác thực', async ({ page, context, evidence }) => {
    await open(page, 'F12');
    const banner = page.locator('main a[href="https://beta.didongviet.vn/dich-vu-khach-hang-doanh-nghiep.html#scrollspy-137"]');
    await expect(banner).toHaveCount(1);
    await banner.scrollIntoViewIfNeeded();
    await photo(page, 'HAN12-b2b-banner-before-click');
    const href = await banner.getAttribute('href');
    const targetResponse = await context.request.get(href!, { failOnStatusCode: false });
    const authHeader = targetResponse.headers()['www-authenticate'] ?? null;
    const contentType = targetResponse.headers()['content-type'] ?? null;
    const targetBody = (await targetResponse.text()).slice(0, 2000);
    const navigations: string[] = [];
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); });
    let clickError: string | null = null;
    try { await banner.click({ timeout: 12_000 }); await page.waitForLoadState('domcontentloaded'); }
    catch (error) { clickError = String(error).slice(0, 1200); }
    await photo(page, 'HAN12-b2b-banner-after-click');
    evidence.observations = { sourceUrl: URLS.F12, sourceFormVisible: true, href,
      targetStatus: targetResponse.status(), authHeader, contentType, targetBody,
      navigations, urlAfterClick: page.url(), clickError,
      scope: 'Public CTA navigation and HTTP response only. No login attempts or authentication bypass.' };
    expect(targetResponse.status(), 'A public B2B registration banner must not lead customers to a protected 401 destination').not.toBe(401);
  });

  test('DDV-HAN-06 | F11 | Hai chuỗi tiếng Việt tương đương NFC-NFD cho kết quả khác nhau', async ({ page, evidence }) => {
    await open(page, 'F11'); const nfc = 'Trần Não', nfd = nfc.normalize('NFD');
    expect(nfd.normalize('NFC')).toBe(nfc);
    const control = await searchStores(page, nfc); expect(control.names).toContain(STORE);
    const actual = await searchStores(page, nfd); await photo(page, 'HAN06-canonical-query');
    const restored = await searchStores(page, nfc); expect(restored.names).toContain(STORE);
    await searchStores(page, nfd);
    evidence.observations = { control, actual, restored, normalizedEqual: nfd.normalize('NFC') === nfc,
      reference: 'https://www.unicode.org/reports/tr15/', distinction: 'Both queries include the same Vietnamese accents; this is not accent-insensitive search.' };
    expect(actual.names, 'Canonical-equivalent Vietnamese input should find the same store').toEqual(control.names);
  });

  test('DDV-HAN-07 | F11 | Tọa độ không hợp lệ làm sai thứ tự Tìm cửa hàng gần tôi', async ({ page, context, evidence }) => {
    const position = { latitude: 21.0116988, longitude: 105.8189429 };
    await context.grantPermissions(['geolocation'], { origin: ORIGIN });
    await context.setGeolocation(position);
    await open(page, 'F11');
    const html = await page.content();
    const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)].map(m => JSON.parse(m[1]));
    const records = [...chunks.join('').matchAll(/\{"id":\d+,"createdAt":.*?"newAddress":(?:"(?:\\.|[^"\\])*"|null)\}/g)]
      .map(m => JSON.parse(m[0])).filter(r => 'latitude' in r);
    if (!records.length) blocked('Cannot read the current public store props; update observer before claiming a defect.');
    const invalid = records.filter(r => typeof r.latitude !== 'number' || typeof r.longitude !== 'number' || Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180)
      .map(r => ({ id: r.id, name: r.displayName, latitude: r.latitude, longitude: r.longitude }));
    await page.getByRole('button', { name: 'Tìm cửa hàng gần tôi', exact: true }).click();
    await expect(storeCards(page).first()).toContainText('Thái Hà');
    await expect(storeCards(page).first()).toContainText(/\d+\s*(?:m|km)\b/);
    const list = await storeCards(page).allInnerTexts();
    const names = await storeNames(page);
    const leThaiTo = names.findIndex(n => n.includes('Lê Thái Tổ'));
    const hcm = list.findIndex(t => t.includes('Thành phố Hồ Chí Minh'));
    evidence.observations = { position, positionSource: 'Controlled browser geolocation; exact public coordinates of Thái Hà, not a real user GPS reading.',
      rawStoreCount: records.length, invalid, orderedNames: names, leThaiToIndex: leThaiTo, firstHcmIndex: hcm,
      targetCard: list[leThaiTo], firstCards: list.slice(0,6) };
    await photo(page, 'HAN07-nearest-store-order');
    expect(invalid, 'Public store coordinates must be valid geographic degrees for nearest-store ranking').toEqual([]);
    expect(leThaiTo, 'The other Hanoi store must precede Ho Chi Minh City stores at a Hanoi location').toBeLessThan(hcm);
  });

  test('DDV-HAN-08 | F12 | Phân số sát số nguyên vượt validation và bị đổi thành quantity=1', async ({ page, evidence }) => {
    await open(page, 'F12');
    const invalidControl = await submitB2B(page, evidence, { ...DATA, quantity: '1.5' });
    expect(invalidControl.requests).toHaveLength(0); expect(invalidControl.alerts).toContain('Số lượng phải là số nguyên');
    const fractions = [];
    for (const quantity of ['1.0000000000000001', '0.99999999999999999']) {
      const observation = await submitB2B(page, evidence, { ...DATA, quantity });
      fractions.push({ input: quantity, ...observation });
      await photo(page, `HAN08-fraction-${fractions.length}`);
    }
    evidence.observations = { invalidControl, fractions, backendScope: 'Payload intercepted and aborted; no saved lead asserted.' };
    expect(fractions.map(f => f.requests.length), 'Non-integer quantities must be rejected before a B2B request, without rounding into accepted integers').toEqual([0, 0]);
  });

  test('DDV-HAN-09 | F12 | Trường bắt buộc chỉ có ký tự vô hình vẫn tạo payload', async ({ page, evidence }) => {
    await open(page, 'F12');
    const validControl = await submitB2B(page, evidence, { ...DATA, name: 'Nguyễn Văn A' });
    expect(validControl.requests).toHaveLength(1); expect(validControl.alerts).toEqual([]);
    const emptyControl = await submitB2B(page, evidence, { ...DATA, name: '', company: '', product: '' });
    expect(emptyControl.requests).toHaveLength(0); expect(emptyControl.alerts).toHaveLength(3);
    const actual = await submitB2B(page, evidence, { ...DATA, name: '\u200b\u200b', company: '\u200b', product: '\u200b' });
    evidence.observations = { validControl, emptyControl, actual, injectedInput: 'U+200B ZERO WIDTH SPACE entered into actual inputs; no DOM/schema modification.',
      expectedBasis: 'Semantic required-field check: a name/company/product consisting solely of Unicode layout controls supplies no customer, company or product information. Basis: required UI labels, empty/visible controls, Unicode format-character semantics and OWASP semantic input validation. Frontend scope only.',
      backendScope: 'Frontend validation/payload only; no lead persisted.' };
    await photo(page, 'HAN09-invisible-required-fields');
    expect(actual.requests, 'Visually empty mandatory text fields must be rejected at the client').toHaveLength(0);
  });

  test('DDV-HAN-10 | F12 | Cùng một tên Á vượt ngưỡng tối thiểu khi đổi NFC sang NFD', async ({ page, evidence }) => {
    await open(page, 'F12'); const nfc = 'Á', nfd = 'A\u0301'; expect(nfd.normalize('NFC')).toBe(nfc);
    const control = await submitB2B(page, evidence, { ...DATA, name: nfc });
    expect(control.requests).toHaveLength(0); expect(control.alerts).toContain('Họ và tên tối thiểu 2 ký tự');
    await photo(page, 'HAN10-name-NFC-rejected');
    const actual = await submitB2B(page, evidence, { ...DATA, name: nfd });
    evidence.observations = { nfc, nfd, nfcCodePoints: [193], nfdCodePoints: [65,769], normalizedEqual: nfd.normalize('NFC') === nfc,
      control, actual, reference: 'https://www.unicode.org/reports/tr15/',
      scope: 'Same displayed name, different encoding; inconsistent frontend minimum-length validation. No backend success asserted.' };
    await photo(page, 'HAN10-name-NFD-accepted');
    expect(actual.requests.length, 'Canonical-equivalent names must receive the same minimum-length validation').toBe(control.requests.length);
  });
  test('DDV-HAN-11 | F12 | Số quốc tế +84 giữ thêm tiền tố nội địa 0 trong payload', async ({ page, evidence }) => {
    await open(page, 'F12');
    const national = await submitB2B(page, evidence, { ...DATA, phone: '0901234567' });
    expect(national.requests, 'Positive control: ordinary national format reaches the guarded frontend request').toHaveLength(1);
    const international = await submitB2B(page, evidence, { ...DATA, phone: '+84901234567' });
    expect(international.requests, 'Positive control: international format without trunk zero').toHaveLength(1);
    const actual = await submitB2B(page, evidence, { ...DATA, phone: '+840901234567' });
    const payload = actual.requests[0]?.body as { phone?: string } | undefined;
    evidence.observations = { national, international, actual,
      source: 'https://didongviet.vn/dchannel/cach-dang-ky-wechat/',
      expectedBasis: 'Vietnam +84 international notation omits national trunk 0; reject malformed +840... or normalize to +849... before creating a request.',
      distinction: 'Not TAN-08 all-zero national tracking phone; this is the +84/national-trunk combination in a separate B2B validator.',
      scope: 'Only frontend validation/normalization and blocked payload. No claim about backend acceptance or an actual phone call.' };
    await photo(page, 'HAN11-international-trunk-zero');
    const rejectedOrNormalized = actual.requests.length === 0 || payload?.phone === '+84901234567';
    expect(rejectedOrNormalized, 'International +84 notation must not keep the domestic trunk 0 unchanged in the contact payload').toBe(true);
  });

});
