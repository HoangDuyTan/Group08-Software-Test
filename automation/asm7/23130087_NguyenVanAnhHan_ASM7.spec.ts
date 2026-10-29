import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * GROUP08 | Nguyễn Văn Anh Hàn | 23130087 | Assignment 7 | F10
 * Nguồn: Group08_23130087_NguyenVanAnhHan.xlsx, bản 1.2 (29/10/2026).
 * 40 ID tương ứng Excel: 31 ca online; 022–030 cần môi trường test.
 * Chạy riêng file này từ thư mục gốc repository:
 * npx playwright test 23130087_NguyenVanAnhHan_ASM7.spec.ts --project=chromium --headed --workers=1
 *
 * Mỗi ca online dùng browser context mới của Playwright và thao tác click thật.
 * Giá được đọc tại lúc chạy; các giá ngày khảo sát không phải giá cố định.
 * Dừng trước ĐĂNG KÝ NGAY / Gửi đăng ký; không tạo yêu cầu tư vấn thật.
 * 022–030 được báo Skipped (Excel: Blocked khi thiếu môi trường/oracle).
 * Không dùng API mock rồi báo Passed cho ca cần xác minh backend thật.
 * Script không sửa Excel, cấu hình nhóm hoặc file script của thành viên khác.
 * Quan sát 29/10/2026: 003 phát hiện Samsung Galaxy Tab S11 và HUAWEI MatePad
 * trong tab XIAOMI | OPPO | TECNO; assertion giữ đúng Expected của Excel.
 */

const TRADE_IN = 'https://didongviet.vn/trade-in.html';
const IPHONE = 'iPhone 17 Pro Max 1TB Cũ';
const IPHONE_2TB = 'iPhone 17 Pro Max 2TB Cũ (Fullbox)';
const IPHONE_PRO = 'iPhone 17 Pro 1TB Cũ';
const SAMSUNG = 'Samsung Galaxy Z Fold7 5G 256GB Cũ';
const UPGRADE = 'iPhone 18 Pro 256GB Chính Hãng';
const EMPTY = 'Không tìm thấy sản phẩm nào phù hợp.';
const ACTIVE_TAB = /(?:^|\s)border-blue-600(?:\s|$)/;

const CATEGORIES = [
  { id: 'DDV_F10_001', title: 'Chọn danh mục IPHONE', tab: 'IPHONE',
    family: /^iPhone\b/i, sample: IPHONE },
  { id: 'DDV_F10_002', title: 'Chọn danh mục SAMSUNG', tab: 'SAMSUNG',
    family: /^Samsung\b/i, sample: SAMSUNG },
  { id: 'DDV_F10_003', title: 'Chọn danh mục XIAOMI | OPPO | TECNO', tab: 'XIAOMI | OPPO | TECNO',
    family: /^(?:Xiaomi|Redmi|POCO|OPPO|TECNO)\b/i, sample: 'OPPO Find N5 16GB/512GB Cũ' },
  { id: 'DDV_F10_004', title: 'Chọn danh mục ĐỒNG HỒ | TAI NGHE', tab: 'ĐỒNG HỒ | TAI NGHE',
    family: /(?:\bWatch\b|\bAirPods?\b|\bBuds\b|tai nghe|đồng hồ)/i,
    sample: 'Apple Watch Ultra 2 2023 49mm (LTE) Viền Titan Cũ' },
  { id: 'DDV_F10_005', title: 'Chọn danh mục MACBOOK | IPAD', tab: 'MACBOOK | IPAD',
    family: /\b(?:MacBook|iPad)\b/i, sample: 'iPad Pro M5 13 inch 256GB Wi-Fi & 5G Cũ' },
] as const;

const GRADES = [
  { id: 'DDV_F10_031', grade: 1, label: 'Loại 1: Máy đẹp không lỗi, không trầy xước, pin trên 85%' },
  { id: 'DDV_F10_032', grade: 2, label: 'Loại 2: Máy không lỗi, trầy xước nhẹ' },
  { id: 'DDV_F10_033', grade: 3, label: 'Loại 3: Máy không lỗi, trầy cấn rõ' },
  { id: 'DDV_F10_034', grade: 4, label: 'Loại 4: Máy hư màn hoặc lỗi nặng mất Face ID, mất IMEI' },
  { id: 'DDV_F10_035', grade: 5, label: 'Loại 5: Máy lỗi nhiều, còn lên nguồn, thoát được tài khoản' },
  { id: 'DDV_F10_036', grade: 6, label: 'Loại 6: Máy mất nguồn, hư hỏng nặng, không thoát được tài khoản' },
] as const;

test.use({ viewport: { width: 1440, height: 950 } });
test.describe.configure({ timeout: 120_000, mode: 'default' });

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function named(text: string): RegExp {
  // Một số nhãn danh mục có khoảng trắng cuối trong DOM.
  return new RegExp(`^\\s*${escaped(text)}\\s*$`, 'i');
}

function compact(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cards(page: Page): Locator {
  return page.locator('[data-tradein-product-id]');
}

async function cardNames(page: Page): Promise<string[]> {
  return (await page.locator('[data-tradein-product-id] > p').allTextContents())
    .map(name => name.trim());
}

function cardNamed(page: Page, model: string): Locator {
  return cards(page).filter({ has: page.getByText(model, { exact: true }) });
}

function searchInput(page: Page): Locator {
  return page.getByRole('searchbox', { name: 'Tìm kiếm thiết bị thu cũ', exact: true });
}

async function clickControl(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}

function observation(value: unknown) {
  const description = typeof value === 'string' ? value : JSON.stringify(value);
  console.log(`[${test.info().title.split(' - ')[0]}] ${description}`);
  test.info().annotations.push({ type: 'Actual observation', description });
}

async function dismissCookies(page: Page) {
  const cookie = page.getByRole('dialog').filter({ hasText: 'Cookie & trải nghiệm Di Động Việt' });
  // Cookie là hộp thoại tùy chọn; chỉ timeout ở bước chờ này được bỏ qua.
  await cookie.waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {});
  if (await cookie.isVisible()) {
    await cookie.getByRole('button', { name: 'Từ chối', exact: true }).click();
    await expect(cookie).toBeHidden();
  }
}

async function openTradeIn(page: Page) {
  await test.step('01 - Mở website Trade-in và đóng bảng cookie', async () => {
    const response = await page.goto(TRADE_IN, { waitUntil: 'domcontentloaded' });
    expect(response, 'Trang Trade-in không trả HTTP response').not.toBeNull();
    expect(response!.status(), 'Trang Trade-in trả HTTP lỗi').toBeLessThan(400);
    await dismissCookies(page);
    await expect(page).toHaveURL(TRADE_IN);
    await expect(searchInput(page)).toBeVisible();
    await expect(searchInput(page)).toHaveValue('');
    for (const category of CATEGORIES) {
      await expect(page.getByRole('button', { name: named(category.tab) })).toBeVisible();
    }
    await expect(cards(page).first()).toBeVisible();
  });
}

async function selectCategory(page: Page, category: (typeof CATEGORIES)[number]) {
  await test.step(`Chọn danh mục ${category.tab} và chờ đúng danh sách`, async () => {
    const tab = page.getByRole('button', { name: named(category.tab) });
    // Button bên trong có pointer-events:none; người dùng bấm thẻ <a> bao nó.
    // Không force-click button hoặc dùng JavaScript để giả lập click.
    const link = tab.locator('xpath=ancestor::a[1]');
    const href = await link.getAttribute('href');
    expect(href, 'Tab không có liên kết điều hướng').toBeTruthy();
    const target = new URL(href!, TRADE_IN);
    expect(target.origin).toBe(new URL(TRADE_IN).origin);
    await clickControl(link);
    await expect(page).toHaveURL(target.href);
    await expect(tab).toHaveClass(ACTIVE_TAB);
    await expect.poll(async () => {
      const names = await cardNames(page);
      return names.length > 0 || await page.getByText(EMPTY, { exact: true }).isVisible();
    }, { message: 'Danh sách không hoàn tất tải', timeout: 20_000 }).toBe(true);
    if (await page.getByText(EMPTY, { exact: true }).isVisible()) {
      test.skip(true, `BLOCKED: danh mục ${category.tab} không còn dữ liệu để kiểm tra thẻ theo Excel`);
    }
    await expect.poll(async () => {
      const names = await cardNames(page);
      return { loaded: names.length > 0, wrongGroup: names.filter(name => !category.family.test(name)) };
    }, { message: `Danh sách không thuộc nhóm ${category.tab}`, timeout: 20_000 })
      .toEqual({ loaded: true, wrongGroup: [] });
  });
}

async function requireCard(page: Page, model: string): Promise<Locator> {
  // Fixture không được thay bằng một sản phẩm khác chỉ để test xanh.
  for (let attempt = 0; attempt < 15; attempt++) {
    if (await cardNamed(page, model).count()) break;
    const more = page.getByRole('button', { name: /^Còn lại \d+ sản phẩm$/i });
    if (!(await more.isVisible())) break;
    const before = await cards(page).count();
    await clickControl(more);
    await expect.poll(() => cards(page).count(), {
      message: 'Nhấn xem thêm nhưng danh sách không tăng', timeout: 15_000,
    }).toBeGreaterThan(before);
  }
  test.skip(!(await cardNamed(page, model).count()), `BLOCKED: fixture trong Excel không còn niêm yết: ${model}`);
  const card = cardNamed(page, model);
  await expect(card).toHaveCount(1);
  return card;
}

function parseVnd(raw: string): number {
  const amount = raw.replace(/^Giá thu dự kiến:\s*/i, '').trim();
  const match = amount.match(/^(-?\d+(?:[.,]\d{3})*)\s*[đ₫]$/i);
  expect(match, `Cần một giá VND có định dạng đầy đủ, nhận: ${raw}`).not.toBeNull();
  const value = Number(match![1].replace(/[.,]/g, ''));
  expect(Number.isSafeInteger(value), `Giá VND không hợp lệ: ${raw}`).toBe(true);
  return value;
}

async function moneyAt(scope: Locator, label: string): Promise<number> {
  const key = scope.getByText(label, { exact: true });
  await expect(key).toBeVisible();
  const raw = await key.evaluate(element => {
    let labelElement = element;
    // D-Member có span con cho nhãn desktop/mobile; giá là sibling của span ngoài.
    while (labelElement.parentElement?.tagName === 'SPAN') labelElement = labelElement.parentElement;
    return labelElement.nextElementSibling?.textContent ?? '';
  });
  return parseVnd(raw);
}

async function cardPrices(card: Locator) {
  const values = {
    old: await moneyAt(card, 'Giá thu cũ:'),
    subsidy: await moneyAt(card, 'Trợ giá lên đến:'),
    member: await moneyAt(card, 'Trợ giá D-Member:'),
    total: await moneyAt(card, 'Giá thu cuối:'),
  };
  for (const value of Object.values(values)) expect(value).toBeGreaterThanOrEqual(0);
  return values;
}

function tradeDialog(page: Page): Locator {
  return page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Đóng', exact: true }) });
}

async function forecast(dialog: Locator): Promise<number> {
  const text = await dialog.innerText();
  const match = text.match(/Giá thu dự kiến:\s*(-?\d+(?:[.,]\d{3})*)\s*[đ₫]/i);
  expect(match, 'Popup thiếu Giá thu dự kiến').not.toBeNull();
  return parseVnd(`${match![1]} đ`);
}

async function assertModel(dialog: Locator, model: 'iphone' | 'samsung', capacity = '1TB') {
  const expected = model === 'iphone' ? 'iphone17promax' : 'samsunggalaxyzfold7';
  await expect.poll(async () => compact((await dialog.innerText()).split('Giá thu dự kiến:')[0]), {
    message: 'Tên model trong popup chưa tải xong hoặc không khớp thẻ đã chọn', timeout: 20_000,
  }).toContain(expected);
  expect(compact((await dialog.innerText()).split('Giá thu dự kiến:')[0])).toContain(capacity.toLowerCase());
}

async function openAssessment(page: Page, model = IPHONE): Promise<Locator> {
  const card = await requireCard(page, model);
  await test.step(`Nhấn Chọn ngay trong thẻ ${model}`, async () => {
    await clickControl(card.getByRole('button', { name: named(`Chọn ${model}`) }));
    await expect(tradeDialog(page)).toBeVisible();
    await expect(tradeDialog(page).getByRole('heading', { name: 'Xác định tình trạng máy', exact: true })).toBeVisible();
    // Tiêu đề xuất hiện trước nội dung máy: chờ dữ liệu, không kiểm tra skeleton.
    await expect(tradeDialog(page).getByText('Giá thu sau đánh giá', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(tradeDialog(page).getByRole('radio')).toHaveCount(6);
  });
  return tradeDialog(page);
}

function gradeRadio(dialog: Locator, grade: number): Locator {
  return dialog.getByRole('radio', { name: new RegExp(`^(?:Máy\\s+)?Loại ${grade}:`, 'i') });
}

async function chooseGrade(dialog: Locator, grade: number) {
  const radio = gradeRadio(dialog, grade);
  await radio.check();
  await expect(radio).toBeChecked();
  await expect(dialog.locator('input[type="radio"]:checked')).toHaveCount(1);
}

async function chooseColor(dialog: Locator, color: string) {
  const button = dialog.getByRole('button', { name: color, exact: true });
  await clickControl(button);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('button[aria-pressed="true"]')).toHaveCount(1);
}

async function closeAssessment(page: Page, dialog: Locator) {
  await clickControl(dialog.getByRole('button', { name: 'Đóng', exact: true }));
  await expect(dialog).toBeHidden();
  await expect(cards(page).first()).toBeVisible();
}

async function assertAssessment(dialog: Locator, model: 'iphone' | 'samsung', base: number, capacity = '1TB') {
  await assertModel(dialog, model, capacity);
  await expect(dialog.getByRole('radio')).toHaveCount(6);
  await expect(gradeRadio(dialog, 1)).toBeChecked();
  await expect(dialog.locator('button[aria-pressed="true"]')).toHaveCount(1);
  expect(await forecast(dialog)).toBe(base);
  expect(await moneyAt(dialog, 'Giá thu sau đánh giá')).toBe(base);
  await expect(dialog.getByRole('button', { name: 'Chỉ thu cũ', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Thu cũ và lên đời', exact: true })).toBeVisible();
}

async function searchFor(page: Page, query: string, expectedFamily?: RegExp) {
  const input = searchInput(page);
  await input.fill(query);
  await input.press('Enter');
  await expect(input).toHaveValue(query);
  await expect(page).toHaveURL(url => url.pathname === '/trade-in.html'
    && (url.searchParams.get('tiq') ?? '') === query);
  if (expectedFamily) {
    await expect.poll(async () => {
      const names = await cardNames(page);
      return names.length > 0 && names.every(name => expectedFamily.test(name));
    }, { message: `Kết quả chưa khớp truy vấn ${query}`, timeout: 25_000 }).toBe(true);
  }
}

async function customForm(page: Page): Promise<Locator> {
  const form = page.locator('#custom-trade-in-full-name').locator('xpath=ancestor::form[1]');
  await page.getByText('Bạn không tìm thấy sản phẩm cần định giá?', { exact: true }).scrollIntoViewIfNeeded();
  await expect(form).toBeVisible();
  for (const id of ['full-name', 'phone', 'device-name', 'device-condition', 'upgrade-product', 'consent']) {
    await expect(form.locator(`#custom-trade-in-${id}`)).toBeVisible();
  }
  await expect(form.getByRole('button', { name: 'ĐĂNG KÝ NGAY', exact: true })).toBeVisible();
  return form;
}

async function assertReferenceNotice(dialog: Locator) {
  await expect(dialog.getByText(/Giá thu mua chỉ mang tính tham khảo/)).toBeVisible();
  await expect(dialog.getByText(/Giá chính xác được xác định khi kỹ thuật viên kiểm tra máy tại cửa hàng/)).toBeVisible();
}

test.describe('ASM7 | F10 | Nguyễn Văn Anh Hàn | 31 ca online theo Excel', () => {
  test.beforeEach(async ({ page }) => {
    await openTradeIn(page);
  });

  for (const category of CATEGORIES) {
    test(`${category.id} - ${category.title}`, async ({ page }) => {
      await selectCategory(page, category);
      const sample = await requireCard(page, category.sample);
      const names = await cardNames(page);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(name).toMatch(category.family);
      await expect(sample).toBeVisible();
      await page.getByRole('button', { name: named(category.tab) }).scrollIntoViewIfNeeded();
      await test.info().attach('danh-muc-thu-cu.png', {
        body: await page.screenshot(), contentType: 'image/png',
      });
      observation({ category: category.tab, sample: category.sample, names, url: page.url() });
    });
  }

  test('DDV_F10_006 - Chuyển danh mục IPHONE → SAMSUNG → IPHONE', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const first = (await cardNames(page)).slice(0, 3);
    test.skip(first.length < 3, 'BLOCKED: Excel cần ít nhất 3 thẻ iPhone để đối chiếu tập A');
    await selectCategory(page, CATEGORIES[1]);
    const samsung = (await cardNames(page)).slice(0, 3);
    test.skip(samsung.length < 3, 'BLOCKED: Excel cần ít nhất 3 thẻ Samsung');
    expect(samsung.every(name => /^Samsung\b/i.test(name))).toBe(true);
    await selectCategory(page, CATEGORIES[0]);
    expect((await cardNames(page)).slice(0, 3)).toEqual(first);
    observation({ before: first, samsung, restored: (await cardNames(page)).slice(0, 3) });
  });

  test('DDV_F10_007 - Kiểm tra đủ thông tin trên một thẻ thu cũ', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const card = await requireCard(page, IPHONE);
    await expect(card.getByText(IPHONE, { exact: true })).toBeVisible();
    const prices = await cardPrices(card);
    const image = card.getByRole('img', { name: IPHONE, exact: true });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0), {
      message: 'Ảnh thẻ sản phẩm không tải thành công', timeout: 15_000,
    }).toBe(true);
    await expect(card.getByRole('button', { name: named(`Chọn ${IPHONE}`) })).toBeEnabled();
    observation({ model: IPHONE, prices });
  });

  test('DDV_F10_008 - Chọn iPhone và mở đúng popup đánh giá máy', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const prices = await cardPrices(await requireCard(page, IPHONE));
    const dialog = await openAssessment(page);
    await assertAssessment(dialog, 'iphone', prices.old);
    observation({ model: IPHONE, base: prices.old, forecast: await forecast(dialog) });
    await closeAssessment(page, dialog);
  });

  test('DDV_F10_009 - Chọn Samsung và mở đúng popup đánh giá máy', async ({ page }) => {
    await selectCategory(page, CATEGORIES[1]);
    const prices = await cardPrices(await requireCard(page, SAMSUNG));
    const dialog = await openAssessment(page, SAMSUNG);
    await assertAssessment(dialog, 'samsung', prices.old, '256GB');
    observation({ model: SAMSUNG, base: prices.old, forecast: await forecast(dialog) });
    await closeAssessment(page, dialog);
  });

  test('DDV_F10_010 - Phân biệt hai phiên bản iPhone 17 Pro Max 1TB và 2TB', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const a = await cardPrices(await requireCard(page, IPHONE));
    const b = await cardPrices(await requireCard(page, IPHONE_2TB));
    const first = await openAssessment(page, IPHONE);
    await assertModel(first, 'iphone', '1TB');
    expect(await forecast(first)).toBe(a.old);
    await closeAssessment(page, first);
    const second = await openAssessment(page, IPHONE_2TB);
    await assertModel(second, 'iphone', '2TB');
    expect(await forecast(second)).toBe(b.old);
    observation({ '1TB': a.old, '2TB': b.old, note: 'Không áp đặt giá 2TB phải lớn hơn 1TB.' });
    await closeAssessment(page, second);
  });

  for (const fixture of [
    { id: 'DDV_F10_011', model: IPHONE_2TB },
    { id: 'DDV_F10_012', model: IPHONE },
    { id: 'DDV_F10_013', model: IPHONE_PRO },
  ]) {
    test(`${fixture.id} - Đối chiếu phép cộng giá – ${fixture.model}`, async ({ page }) => {
      await selectCategory(page, CATEGORIES[0]);
      const prices = await cardPrices(await requireCard(page, fixture.model));
      const sum = prices.old + prices.subsidy + prices.member;
      expect(prices.total, 'Giá thu cuối khác tổng ba thành phần trên cùng thẻ').toBe(sum);
      observation({ model: fixture.model, ...prices, sum, difference: prices.total - sum,
        note: 'Tổng tối đa niêm yết; không xác nhận khách được hưởng đủ mọi trợ giá.' });
    });
  }

  test('DDV_F10_014 - Kiểm tra định dạng tiền trên 3 thẻ iPhone', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const actual = [];
    for (const model of [IPHONE_2TB, IPHONE, IPHONE_PRO]) {
      const prices = await cardPrices(await requireCard(page, model));
      for (const price of Object.values(prices)) {
        expect(Number.isSafeInteger(price)).toBe(true);
        expect(price).toBeGreaterThanOrEqual(0);
      }
      actual.push({ model, ...prices });
    }
    expect(actual.flatMap(item => [item.old, item.subsidy, item.member, item.total])).toHaveLength(12);
    observation(actual);
  });

  test('DDV_F10_015 - Tìm thiết bị bằng tên đầy đủ và nhấn Enter', async ({ page }) => {
    await requireCard(page, IPHONE);
    await searchFor(page, 'iPhone 17 Pro Max 1TB', /^iPhone 17 Pro Max 1TB\b/i);
    await expect(cardNamed(page, IPHONE)).toHaveCount(1);
    expect((await cardNames(page)).some(name => /(?:2TB|512GB)/i.test(name))).toBe(false);
    observation({ query: await searchInput(page).inputValue(), results: await cardNames(page), url: page.url() });
  });

  test('DDV_F10_016 - Tìm thiết bị bằng một phần tên', async ({ page }) => {
    await searchFor(page, 'iPhone 17 Pro', /^iPhone 17 Pro/i);
    const names = await cardNames(page);
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    observation({ query: 'iPhone 17 Pro', results: names.slice(0, 5) });
  });

  test('DDV_F10_017 - Tìm thiết bị không tồn tại', async ({ page }) => {
    await searchFor(page, 'ZZZ_NO_TRADEIN_9102026');
    await expect(page.getByText(EMPTY, { exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Xem tất cả sản phẩm', exact: true })).toBeVisible();
    await expect(tradeDialog(page)).toHaveCount(0);
    observation({ query: 'ZZZ_NO_TRADEIN_9102026', count: 0, message: EMPTY });
  });

  test('DDV_F10_018 - Xóa từ khóa rồi khôi phục danh sách', async ({ page }) => {
    await requireCard(page, IPHONE);
    await searchFor(page, 'iPhone 17 Pro Max 1TB', /^iPhone 17 Pro Max 1TB\b/i);
    await searchInput(page).press('ControlOrMeta+A');
    await searchInput(page).press('Backspace');
    await searchInput(page).press('Enter');
    await expect(searchInput(page)).toHaveValue('');
    await expect(page).toHaveURL(url => !url.searchParams.get('tiq') && url.pathname === '/trade-in.html');
    for (const category of CATEGORIES) {
      await expect(page.getByRole('button', { name: named(category.tab) })).toBeVisible();
    }
    await expect.poll(async () => (await cardNames(page)).some(name => !/^iPhone 17 Pro Max 1TB\b/i.test(name))).toBe(true);
    await expect(page.getByText(EMPTY, { exact: true })).toHaveCount(0);
    observation({ restored: (await cardNames(page)).slice(0, 5), url: page.url() });
  });

  test('DDV_F10_019 - Đổi truy vấn từ iPhone sang Samsung', async ({ page }) => {
    await selectCategory(page, CATEGORIES[1]);
    await requireCard(page, SAMSUNG);
    await selectCategory(page, CATEGORIES[0]);
    await requireCard(page, IPHONE);
    await searchFor(page, 'iPhone 17 Pro Max 1TB', /^iPhone 17 Pro Max 1TB\b/i);
    await searchFor(page, 'Samsung Galaxy Z Fold7', /^Samsung Galaxy Z Fold7\b/i);
    await expect(page.getByRole('button', { name: named('SAMSUNG') })).toBeVisible();
    expect((await cardNames(page)).some(name => /^iPhone\b/i.test(name))).toBe(false);
    observation({ query: 'Samsung Galaxy Z Fold7', results: await cardNames(page), url: page.url() });
  });

  test('DDV_F10_020 - Đổi lựa chọn giới tính Anh → Chị → Anh', async ({ page }) => {
    const form = await customForm(page);
    const male = form.locator('#custom-trade-in-gender-male');
    const female = form.locator('#custom-trade-in-gender-female');
    await expect(male).toBeChecked();
    await expect(female).not.toBeChecked();
    await female.check();
    await expect(female).toBeChecked();
    await expect(male).not.toBeChecked();
    await male.check();
    await expect(male).toBeChecked();
    await expect(female).not.toBeChecked();
    await expect(form.locator('input[name="gender"]:checked')).toHaveCount(1);
    observation('Anh mặc định → Chị → Anh; một lựa chọn ở mỗi thời điểm; không nhấn ĐĂNG KÝ NGAY.');
  });

  test('DDV_F10_021 - Giới hạn 200 ký tự ô mô tả tình trạng thiết bị', async ({ page }) => {
    const form = await customForm(page);
    const condition = form.locator('#custom-trade-in-device-condition');
    await expect(condition).toHaveAttribute('maxlength', '200');
    await condition.fill('');
    await expect(form.getByText('0/200', { exact: true })).toBeVisible();
    await condition.fill('A'.repeat(199));
    await expect(condition).toHaveValue('A'.repeat(199));
    await expect(form.getByText('199/200', { exact: true })).toBeVisible();
    await condition.pressSequentially('A');
    await expect(condition).toHaveValue('A'.repeat(200));
    await expect(form.getByText('200/200', { exact: true })).toBeVisible();
    await condition.pressSequentially('A');
    await expect(condition).toHaveValue('A'.repeat(200));
    await expect(form.getByText('200/200', { exact: true })).toBeVisible();
    await condition.fill('');
    await condition.fill('A'.repeat(201));
    await expect(condition).toHaveValue('A'.repeat(200));
    await expect(form.getByText('200/200', { exact: true })).toBeVisible();
    await condition.fill('');
    await expect(form.getByText('0/200', { exact: true })).toBeVisible();
    observation('Textarea tình trạng: 0 → 199 → 200; gõ/dán ký tự 201 bị giới hạn; xóa trở về 0/200.');
  });

  for (const fixture of GRADES) {
    test(`${fixture.id} - Đánh giá tình trạng máy – Loại ${fixture.grade}`, async ({ page }) => {
      await selectCategory(page, CATEGORIES[0]);
      const dialog = await openAssessment(page);
      await assertModel(dialog, 'iphone');
      await chooseColor(dialog, 'Bạc');
      const previousGrade = fixture.grade === 1 ? 2 : 1;
      await chooseGrade(dialog, previousGrade);
      const before = await moneyAt(dialog, 'Giá thu sau đánh giá');
      await expect(dialog.getByText(fixture.label, { exact: true })).toBeVisible();
      await chooseGrade(dialog, fixture.grade);
      const after = await moneyAt(dialog, 'Giá thu sau đánh giá');
      expect(after).toBeGreaterThanOrEqual(0);
      expect(await forecast(dialog)).toBe(after);
      await assertModel(dialog, 'iphone');
      await expect(dialog.getByRole('button', { name: 'Bạc', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByText('Trợ giá cộng thêm, áp dụng cho máy phân loại 1, 2, 3', { exact: true })).toBeVisible();
      await assertReferenceNotice(dialog);
      observation({ model: IPHONE, color: 'Bạc', previousGrade, grade: fixture.grade, before, after,
        scope: 'Kiểm tra radio và đồng bộ UI; không xác nhận tỷ lệ khấu hao hoặc trợ giá thực nhận Loại 4–6.' });
      await closeAssessment(page, dialog);
    });
  }

  test('DDV_F10_037 - Đổi màu máy trong popup định giá', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const dialog = await openAssessment(page);
    await chooseColor(dialog, 'Bạc');
    await chooseGrade(dialog, 1);
    const before = await forecast(dialog);
    await chooseColor(dialog, 'Cam Vũ Trụ');
    await assertModel(dialog, 'iphone');
    expect(compact((await dialog.innerText()).split('Giá thu dự kiến:')[0])).toContain('camvutru');
    const after = await forecast(dialog);
    await chooseColor(dialog, 'Bạc');
    await expect(dialog.getByRole('button', { name: 'Cam Vũ Trụ', exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect(compact((await dialog.innerText()).split('Giá thu dự kiến:')[0])).toContain('bac');
    observation({ model: IPHONE, colors: ['Bạc', 'Cam Vũ Trụ', 'Bạc'], before, after,
      note: 'Không áp đặt giá hai màu phải khác nhau.' });
    await closeAssessment(page, dialog);
  });

  test('DDV_F10_038 - Chọn luồng Chỉ thu cũ', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const dialog = await openAssessment(page);
    await chooseColor(dialog, 'Bạc');
    await chooseGrade(dialog, 1);
    const base = await moneyAt(dialog, 'Giá thu sau đánh giá');
    await clickControl(dialog.getByRole('button', { name: 'Chỉ thu cũ', exact: true }));
    await expect(dialog.getByRole('heading', { name: 'Xác nhận thông tin đăng ký', exact: true })).toBeVisible();
    await expect(dialog.getByText('Máy muốn được thu lại', { exact: true })).toBeVisible();
    await expect.poll(async () => compact((await dialog.innerText()).split('Máy muốn được thu lại')[1]?.split('Sản phẩm muốn lên đời')[0] ?? ''), {
      message: 'Tóm tắt máy cũ chưa tải xong hoặc sai máy', timeout: 20_000,
    }).toContain('iphone17promax1tb');
    const text = await dialog.innerText();
    const oldSummary = text.split('Máy muốn được thu lại')[1]?.split('Sản phẩm muốn lên đời')[0] ?? '';
    expect(compact(oldSummary)).toContain('iphone17promax1tb');
    expect(compact(oldSummary)).toContain('bac');
    expect(parseVnd(oldSummary.match(/Giá thu dự kiến:[^\n]*/)?.[0] ?? '')).toBe(base);
    await expect(dialog.getByText(/Chọn thêm sản phẩm lên đời để hưởng thêm ưu đãi/)).toBeVisible();
    for (const label of [/^Họ và tên/, /^Số điện thoại/, /^Email\b/, /^Nội dung khác\b/, /^Chọn cửa hàng định giá gần nhất/]) {
      await expect(dialog.getByText(label).first()).toBeVisible();
    }
    await expect(dialog.getByText(/^Email\b/).first()).toContainText('(Tùy chọn)');
    await expect(dialog.getByText(/^Nội dung khác\b/).first()).toContainText('(Tùy chọn)');
    await expect(dialog.getByRole('button', { name: 'Gửi đăng ký', exact: true })).toBeVisible();
    await assertReferenceNotice(dialog);
    observation({ branch: 'Chỉ thu cũ', model: IPHONE, base, stop: 'Trước Gửi đăng ký' });
  });

  test('DDV_F10_039 - Chọn luồng Thu cũ và lên đời', async ({ page }) => {
    await selectCategory(page, CATEGORIES[0]);
    const dialog = await openAssessment(page);
    await chooseColor(dialog, 'Bạc');
    await chooseGrade(dialog, 1);
    const maximum = await moneyAt(dialog, 'Giá thu tối đa dự kiến');
    await clickControl(dialog.getByRole('button', { name: 'Thu cũ và lên đời', exact: true }));
    await expect(dialog.getByRole('heading', { name: 'Chọn máy lên đời', exact: true })).toBeVisible();
    await expect(dialog.locator('button').filter({ hasText: named('Lên đời ngay') }).first()).toBeVisible({ timeout: 25_000 });
    const product = dialog.getByText(UPGRADE, { exact: true });
    // Chờ danh sách sau chuyển bước; không coi skeleton là thiếu fixture.
    await product.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
    for (let attempt = 0; !(await product.count()) && attempt < 10; attempt++) {
      const more = dialog.getByRole('button', { name: /^Còn lại \d+ sản phẩm$/i });
      if (!(await more.isVisible())) break;
      const before = await dialog.locator('button').filter({ hasText: named('Lên đời ngay') }).count();
      await clickControl(more);
      await expect.poll(() => dialog.locator('button').filter({ hasText: named('Lên đời ngay') }).count()).toBeGreaterThan(before);
    }
    if (!(await product.count())) observation({ missingUpgrade: UPGRADE, currentDialog: await dialog.innerText() });
    test.skip(!(await product.count()), `BLOCKED: Excel cần sản phẩm lên đời ${UPGRADE}; không tự đổi model`);
    const upgradeCard = product.locator('xpath=ancestor::*[.//button[normalize-space(.)="Lên đời ngay"]][1]');
    const sale = await moneyAt(upgradeCard, 'Giá bán:');
    await clickControl(upgradeCard.locator('button').filter({ hasText: named('Lên đời ngay') }));
    await expect(dialog.getByText('Máy thu cũ', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Máy lên đời', { exact: true })).toBeVisible();
    await expect(dialog.locator('button[aria-pressed]').first()).toBeVisible({ timeout: 20_000 });
    const black = dialog.getByRole('button', { name: 'Đen', exact: true });
    let selectedColor: string;
    if (await black.count() && await black.isEnabled()) {
      selectedColor = 'Đen';
    } else {
      const available = dialog.locator('button[aria-pressed]:enabled');
      test.skip(!(await available.count()), 'BLOCKED: máy lên đời không có màu khả dụng');
      selectedColor = (await available.first().innerText()).trim();
      observation(`Màu Đen không khả dụng; theo điều kiện Excel, chọn màu hiện có: ${selectedColor}`);
    }
    await chooseColor(dialog, selectedColor!);
    const config = await dialog.innerText();
    const newSummary = config.split('Máy lên đời')[1]?.split('Thay đổi')[0] ?? '';
    expect(compact(newSummary)).toContain('iphone18pro256gb');
    expect(compact(newSummary)).toContain(compact(selectedColor!));
    const price = await moneyAt(dialog, 'Giá máy lên đời');
    const credit = Math.abs(await moneyAt(dialog, 'Giá thu máy cũ (đã gồm trợ giá)'));
    const topUp = await moneyAt(dialog, 'Tiền bù dự kiến');
    expect(price).toBe(sale);
    expect(credit).toBe(maximum);
    expect(topUp).toBe(Math.max(0, price - credit));
    await clickControl(dialog.getByRole('button', { name: 'Tiếp tục', exact: true }));
    await expect(dialog.getByRole('heading', { name: 'Xác nhận thông tin đăng ký', exact: true })).toBeVisible();
    await expect(dialog.getByText('Máy muốn được thu lại', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Sản phẩm muốn lên đời', { exact: true })).toBeVisible();
    await expect.poll(async () => compact((await dialog.innerText()).split('Sản phẩm muốn lên đời')[1]?.split('Giá máy lên đời')[0] ?? ''), {
      message: 'Tóm tắt máy lên đời chưa tải xong hoặc sai model', timeout: 20_000,
    }).toContain('iphone18pro256gb');
    const confirmation = await dialog.innerText();
    const old = confirmation.split('Máy muốn được thu lại')[1]?.split('Sản phẩm muốn lên đời')[0] ?? '';
    const next = confirmation.split('Sản phẩm muốn lên đời')[1]?.split('Giá máy lên đời')[0] ?? '';
    expect(compact(old)).toContain('iphone17promax1tb');
    expect(compact(old)).toContain('bac');
    expect(compact(next)).toContain('iphone18pro256gb');
    expect(compact(next)).toContain(compact(selectedColor!));
    expect(await moneyAt(dialog, 'Tiền bù dự kiến')).toBe(topUp);
    await expect(dialog.getByRole('button', { name: 'Gửi đăng ký', exact: true })).toBeVisible();
    observation({ branch: 'Thu cũ và lên đời', old: IPHONE, new: UPGRADE, color: selectedColor!, price, credit, topUp,
      stop: 'Trước Gửi đăng ký' });
  });

  test('DDV_F10_040 - Chọn rồi đổi cửa hàng trong form tư vấn', async ({ page }) => {
    const form = await customForm(page);
    const trigger = form.locator('button[type="button"]');
    await expect(trigger).toHaveCount(1);
    await clickControl(trigger);
    const picker = page.getByRole('dialog').last();
    await expect(picker).toBeVisible();
    const options = picker.locator('button').filter({ hasText: /^\s*DDV\s/ });
    await expect(options.first()).toBeVisible();
    test.skip((await options.count()) < 2, 'BLOCKED: Excel cần ít nhất hai cửa hàng khác nhau');
    const firstText = await options.nth(0).innerText();
    const secondText = await options.nth(1).innerText();
    const firstName = firstText.split('\n')[0].trim();
    const secondName = secondText.split('\n')[0].trim();
    expect(firstName).not.toBe(secondName);
    expect(firstText.length).toBeGreaterThan(firstName.length);
    expect(secondText.length).toBeGreaterThan(secondName.length);
    await clickControl(options.nth(0));
    await expect(picker).toBeHidden();
    await expect(trigger).toContainText(firstName);
    await clickControl(trigger);
    const reopened = page.getByRole('dialog').last();
    const optionB = reopened.locator('button').filter({ hasText: secondName });
    await expect(optionB).toHaveCount(1);
    await expect.poll(async () => (await optionB.innerText()).replace(/\s+/g, ' ').trim())
      .toBe(secondText.replace(/\s+/g, ' ').trim());
    await clickControl(optionB);
    await expect(reopened).toBeHidden();
    await expect(trigger).toContainText(secondName);
    await expect(trigger).not.toContainText(firstName);
    observation({ before: firstText, after: secondText, stop: 'Trước ĐĂNG KÝ NGAY' });
  });
});

// Excel yêu cầu backend test / dữ liệu được cấp ở các ca dưới đây.
// Không có URL staging, SĐT_TEST, STORE_TEST, nhật ký/bản ghi backend hay
// đặc tả SĐT được duyệt trong repo. Giữ từng ID và báo lý do, không tạo PASS giả.
// Khi được cấp các điều kiện này, triển khai và kiểm chứng đầy đủ ca tương ứng
// trước khi bỏ test.skip; không trỏ các bước gửi sang production.
const BLOCKED_CASES = [
  { id: 'DDV_F10_022', title: 'Bỏ trống mô tả tình trạng thiết bị',
    reason: 'Cần staging/test: giữ các trường khác hợp lệ, xóa mô tả, submit và xác minh lỗi đúng trường + không tạo bản ghi.' },
  { id: 'DDV_F10_023', title: 'Bỏ trống họ tên',
    reason: 'Cần staging/test: xóa Họ tên, submit và đối chiếu lỗi + request/backend test không tạo bản đăng ký.' },
  { id: 'DDV_F10_024', title: 'Bỏ trống số điện thoại',
    reason: 'Cần staging/test: xóa Số điện thoại, submit và đối chiếu lỗi + không tạo bản ghi.' },
  { id: 'DDV_F10_025', title: 'Số điện thoại chứa chữ',
    reason: 'Cần staging/test: nhập 09ABCD1234, ghi giá trị ô giữ, kiểm tra validation và backend không ghi đăng ký.' },
  { id: 'DDV_F10_026', title: 'Số điện thoại chỉ có 9 chữ số',
    reason: 'Cần staging/test và quy tắc SĐT 10 chữ số được duyệt: nhập 090123456, kiểm tra lỗi và không tạo bản ghi.' },
  { id: 'DDV_F10_027', title: 'Số điện thoại có 11 chữ số',
    reason: 'Cần staging/test và quy tắc SĐT được duyệt: nhập 09012345678; nếu UI cắt còn 10 số thì dừng trước submit như Excel.' },
  { id: 'DDV_F10_028', title: 'Bỏ trống mẫu máy cần thu',
    reason: 'Cần staging/test: xóa mẫu máy, giữ mô tả hợp lệ, kiểm tra lỗi đúng trường và backend không tạo đăng ký.' },
  { id: 'DDV_F10_029', title: 'Không đồng ý thu thập thông tin',
    reason: 'Cần staging/test và yêu cầu consent được duyệt: bỏ consent, kiểm tra nút bị khóa/lỗi form và không tạo bản ghi.' },
  { id: 'DDV_F10_030', title: 'Đăng ký tư vấn thành công bằng dữ liệu test hợp lệ',
    reason: 'Cần staging/test, SĐT_TEST, STORE_TEST và backend kiểm tra N→N+1 với đúng payload; không gửi yêu cầu thật hoặc thay bằng mock rồi báo E2E Passed.' },
] as const;

test.describe('ASM7 | F10 | 9 ca cần môi trường test theo tiền điều kiện Excel', () => {
  for (const blocked of BLOCKED_CASES) {
    test(`${blocked.id} - ${blocked.title}`, async () => {
      test.skip(true, `BLOCKED theo Excel: ${blocked.reason}`);
    });
  }
});
