import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * GROUP08 / TRAN THI MINH THU / 23130318
 * ASSIGNMENT 7 – F13: Lựa chọn phương án trả góp (30 test cases ASM06)
 * Website: https://didongviet.vn
 * Đối chiếu tên case theo Group08_23130318_TranThiMinhThu.xlsx.
 */

const BASE = 'https://didongviet.vn';
const SKU_A = `${BASE}/dien-thoai/iphone-16-128gb.html`;
const SKU_B = `${BASE}/dien-thoai/iphone-16-256gb.html`;
const SKU_HIGHER = `${BASE}/dien-thoai/iphone-16-512gb.html`;
const COMPANY = 'Trả góp qua công ty tài chính';
const CREDIT = 'Trả góp qua thẻ tín dụng';

// Không ghi số thẻ, số điện thoại, tên khách hàng vào log/test report.
test.use({ viewport: { width: 1500, height: 950 } });
test.describe.configure({ timeout: 120_000, mode: 'default' });

async function gotoChecked(page: Page, url: string) {
  const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  expect(r, `Không nhận response từ ${url}`).not.toBeNull();
  expect(r!.status(), `HTTP lỗi ${url}`).toBeLessThan(400);
}

async function dismissCookies(page: Page) {
  // Bắt tất cả dạng nút cookie banner thực tế trên didongviet.vn:
  // - "Từ chối" / "Đồng ý tất cả" (banner "Cookie & trải nghiệm")
  // - Các dạng khác
  const patterns = [
    /^(Từ chối|Không đồng ý)$/i,
    /^(Đồng ý tất cả|Chấp nhận|Accept|OK|Đồng ý)$/i,
  ];
  for (const pat of patterns) {
    const btn = page.getByRole('button', { name: pat }).first();
    if (await btn.isVisible({ timeout: 2_500 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => { });
      await page.waitForTimeout(400);
      break;
    }
  }
  // Fallback: tìm theo class/id
  for (const sel of ['[class*="cookie"] button', '[id*="cookie"] button']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => { });
      break;
    }
  }
  await page.waitForTimeout(300);
}

async function openProductModal(page: Page, url = SKU_A) {
  await gotoChecked(page, url);
  await dismissCookies(page);
  // Scroll về đầu trang trước khi tìm nút (để không bị stuck ở cuối trang từ test trước)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const btn = page.getByRole('button', { name: /^\s*Trả góp 0%\s*$/i }).first();
  await expect(btn, 'Không có nút Trả góp 0% trên sản phẩm').toBeVisible({ timeout: 20_000 });
  // Scroll vào view và đợi element ổn định trước khi click
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await btn.click({ force: true });
  await expect(page.getByText('Chọn hình thức trả góp', { exact: true }))
    .toBeVisible({ timeout: 20_000 });
}

async function chooseMode(page: Page, mode: 'company' | 'credit', url = SKU_A) {
  await test.step(`Mở trả góp ${mode} từ trang sản phẩm`, async () => {
    await openProductModal(page, url);
    const name = mode === 'company' ? COMPANY : CREDIT;
    const card = page.getByText(name, { exact: true }).first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page, 'Không chuyển sang màn hình thanh toán trả góp')
      .toHaveURL(/\/installment(?:\?|\/|$)/, { timeout: 25_000 });
    // Dismiss cookie banner có thể xuất hiện lại trên trang installment
    await dismissCookies(page);
    await expect(page.getByText(name, { exact: true }).first())
      .toBeVisible({ timeout: 20_000 });
  });
  // Cố ý dừng ở bước xem phương án, không bấm nút xác nhận hồ sơ.
}

async function companyPage(page: Page, url = SKU_A) {
  await chooseMode(page, 'company', url);
  // Dismiss cookie banner lần nữa nếu vẫn còn sau khi load xong installment
  await dismissCookies(page);
  // exact:true KHÔNG dùng được vì CSS text-transform:uppercase làm Playwright mismatch
  const companyHeading = page.getByText(/chọn công ty tài chính/i).first();
  await companyHeading.scrollIntoViewIfNeeded();
  await expect(companyHeading).toBeVisible({ timeout: 20_000 });
  // Scroll đến ô Số tháng & Trả trước để element luôn hiển thị trong viewport
  const soThang = page.getByText('Số tháng', { exact: true });
  await soThang.scrollIntoViewIfNeeded();
  await expect(soThang).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Trả trước', { exact: true }).first()).toBeVisible();
}

// Đọc tiền VNĐ của một dòng trong bảng (không đọc giá từ banner quảng cáo).
function vnMoney(s: string): number | null {
  const m = s.match(/(\d{1,3}(?:[.,]\d{3})+)\s*(?:đ|₫)/i);
  return m ? Number(m[1].replace(/\D/g, '')) : null;
}
function moneyInRow(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).last().locator('xpath=..');
}
async function paymentAmount(page: Page): Promise<number> {
  const row = moneyInRow(page, 'Góp mỗi tháng');
  await expect(row).toBeVisible();
  const value = vnMoney(await row.innerText());
  expect(value, 'Dòng Góp mỗi tháng thiếu tiền VNĐ').not.toBeNull();
  expect(value!).toBeGreaterThan(0);
  return value!;
}
async function installmentPrice(page: Page): Promise<number> {
  const row = moneyInRow(page, 'Giá mua trả góp');
  await expect(row).toBeVisible();
  const val = vnMoney(await row.innerText());
  expect(val, 'Không đọc được giá trả góp').not.toBeNull();
  return val!;
}
async function detailRow(page: Page, label: string): Promise<string> {
  const row = moneyInRow(page, label);
  await expect(row).toBeVisible();
  return (await row.innerText()).replace(/\s+/g, ' ').trim();
}

// Dropdown thực tế 28/10/2026: collapsed "20%", expanded "50% (12.345.000 đ)".
// Không dựa vào runScript Katalon hoặc biến window.__F13 xuyên lệnh.
// Dropdown thực tế 28/10/2026: trigger button hiển thị "20%", popover options "50% (12.345.000 đ)".
async function currentDown(page: Page): Promise<number> {
  const label = page.getByText('Trả trước', { exact: true }).first();
  await label.scrollIntoViewIfNeeded();
  await expect(label).toBeVisible();
  const trigger = label.locator('xpath=..').locator('button').first();
  await expect(trigger, 'Không tìm thấy trigger dropdown Trả trước').toBeVisible({ timeout: 10_000 });
  const raw = (await trigger.innerText()).trim();
  const m = raw.match(/(\d{1,3})%/);
  if (m) return Number(m[1]);
  throw new Error(`Không đọc được phần trăm trả trước từ button: "${raw}"`);
}
async function openDown(page: Page): Promise<number[]> {
  const label = page.getByText('Trả trước', { exact: true }).first();
  await label.scrollIntoViewIfNeeded();
  await expect(label).toBeVisible();
  const trigger = label.locator('xpath=..').locator('button').first();
  await expect(trigger).toBeVisible();

  const isExpanded = (await trigger.getAttribute('aria-expanded')) === 'true' ||
    (await trigger.getAttribute('data-state')) === 'open';
  if (!isExpanded) {
    await trigger.click();
    await page.waitForTimeout(400);
  }
  const popupOptions = page.locator('[data-radix-popper-content-wrapper] button, div[data-side] button')
    .filter({ hasText: /^\s*\d{1,3}%\s*\([\d.,]+\s*(?:đ|₫)\)\s*$/i });
  await expect(popupOptions.first(), 'Dropdown trả trước không mở hoặc giao diện đã đổi')
    .toBeVisible({ timeout: 8_000 });
  const labels = await popupOptions.allTextContents();
  const unique = [...new Set(labels.map(x => Number(x.match(/(\d{1,3})%/)?.[1])).filter(Number.isFinite))];
  expect(unique.length, 'Không đọc được phần trăm trả trước').toBeGreaterThan(0);
  return unique.sort((a, b) => a - b);
}
async function selectDown(page: Page, percent: number) {
  if ((await currentDown(page)) === percent) return percent;
  const list = await openDown(page);
  expect(list, `Mức ${percent}% không được hỗ trợ trên UI`).toContain(percent);

  const opt = page.locator('[data-radix-popper-content-wrapper] button, div[data-side] button')
    .filter({ hasText: new RegExp(`^\\s*${percent}%\\s*\\([\\d.,]+\\s*(?:đ|₫)\\)\\s*$`, 'i') }).first();
  await expect(opt).toBeVisible();
  await opt.click();
  await page.waitForTimeout(500);
  await expect.poll(() => currentDown(page), {
    message: `UI không đổi sang ${percent}%`,
    timeout: 8_000,
  }).toBe(percent);
  return percent;
}

async function currentTerm(page: Page): Promise<number> {
  const label = page.getByText('Số tháng', { exact: true });
  await label.scrollIntoViewIfNeeded();
  await expect(label).toBeVisible();
  const trigger = label.locator('xpath=..').locator('button').first();
  await expect(trigger).toBeVisible();
  const text = (await trigger.innerText()).trim();
  const match = text.match(/(\d+)\s*tháng/i);
  if (match) return Number(match[1]);
  throw new Error(`Không đọc được kỳ hạn từ button: "${text}"`);
}
async function openTerms(page: Page): Promise<number[]> {
  const label = page.getByText('Số tháng', { exact: true });
  await label.scrollIntoViewIfNeeded();
  await expect(label).toBeVisible();
  const trigger = label.locator('xpath=..').locator('button').first();
  await expect(trigger).toBeVisible();

  const isExpanded = (await trigger.getAttribute('aria-expanded')) === 'true' ||
    (await trigger.getAttribute('data-state')) === 'open';
  if (!isExpanded) {
    await trigger.click();
    await page.waitForTimeout(400);
  }
  const popupOptions = page.locator('[data-radix-popper-content-wrapper] button, div[data-side] button')
    .filter({ hasText: /^\s*\d+\s*tháng\s*$/i });
  await expect(popupOptions.first(), 'Dropdown Số tháng không mở').toBeVisible({ timeout: 6_000 });
  const allTexts = await popupOptions.allTextContents();
  const opts = [...new Set(allTexts.map(x => {
    const m = x.match(/(\d+)\s*tháng/i);
    return m ? Number(m[1]) : NaN;
  }).filter(Number.isFinite))];
  expect(opts.length, 'Không tìm được danh sách kỳ hạn').toBeGreaterThan(0);
  return opts.sort((a, b) => a - b);
}
async function selectTerm(page: Page, months: number) {
  const label = page.getByText('Số tháng', { exact: true });
  await label.scrollIntoViewIfNeeded();
  if ((await currentTerm(page)) === months) return;

  const all = await openTerms(page);
  expect(all, `Kỳ hạn ${months} tháng không hỗ trợ`).toContain(months);

  const opt = page.locator('[data-radix-popper-content-wrapper] button, div[data-side] button')
    .filter({ hasText: new RegExp(`^\\s*${months}\\s*tháng\\s*$`, 'i') }).first();
  await expect(opt).toBeVisible();
  await opt.click();
  await page.waitForTimeout(500);

  await expect.poll(() => currentTerm(page), {
    message: `Chưa đổi sang ${months} tháng`,
    timeout: 8_000,
  }).toBe(months);
}

async function availableTerms(page: Page): Promise<number[]> {
  const all = await openTerms(page);
  // Đóng popup bằng Escape mà không làm mất cấu hình đang chọn.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return all;
}
async function availableDown(page: Page): Promise<number[]> {
  const all = await openDown(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return all;
}
async function checkMonetarySummary(page: Page) {
  const price = await installmentPrice(page);
  const payment = await paymentAmount(page);
  expect(price).toBeGreaterThan(0);
  expect(payment).toBeGreaterThan(0);
  const downRow = await detailRow(page, 'Trả trước');
  expect(downRow, 'Tóm tắt thiếu khoản trả trước').toMatch(/\d+%/);
  // Label thực tế trên trang: 'Lãi suất', 'Tổng tiền' (không phải 'Tổng tiền phải trả')
  // 'Gốc + Lãi' không tồn tại trên didongviet.vn → bỏ
  for (const name of ['Lãi suất', 'Tổng tiền']) {
    const r = await detailRow(page, name).catch(() => '');
    if (r) {
      expect(r.length).toBeGreaterThan(name.length);
      expect(r).not.toMatch(/\bNaN\b|Infinity|undefined/i);
    }
  }
}


const PARTNERS = ['HOME CREDIT', 'HD SAISON', 'mcredit', 'Shinhan Finance', 'AEON Finance'] as const;
async function partnerNode(page: Page, name: string): Promise<Locator | null> {
  // Ảnh logo có thể có alt hoặc chỉ có src; tránh đoán tên phần tử cha.
  const byAlt = page.getByRole('img', { name: new RegExp(name.replace(/\s+/g, '\\s*'), 'i') });
  const token = name.toLowerCase().split(' ')[0]; // home, hd, mcredit, shinhan, aeon
  const bySrc = page.locator(`img[src*="${token}" i],img[alt*="${token}" i]`);
  const byText = page.getByText(new RegExp(name, 'i'));
  const tryThese = [byAlt, bySrc, byText];
  for (const loc of tryThese) {
    if (await loc.first().isVisible().catch(() => false)) return loc.first();
  }
  return null;
}
async function choosePartner(page: Page, name: string) {
  const node = await partnerNode(page, name);
  test.skip(node === null, `Logo/nhãn đối tác ${name} chưa xác nhận được trên UI`);
  await node!.click();
  await dismissCookies(page);
  const companyHeading = page.getByText(/chọn công ty tài chính/i).first();
  await companyHeading.scrollIntoViewIfNeeded();
  await expect(companyHeading).toBeVisible({ timeout: 20_000 });
  const soThang = page.getByText('Số tháng', { exact: true });
  await soThang.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await checkMonetarySummary(page);
}

async function observe(text: string) {
  console.log('[F13 observation]', text);
  await test.info().attach('actual-observation.txt', {
    body: text, contentType: 'text/plain; charset=utf-8',
  });
}
async function modelFromPage(page: Page) {
  return (await page.locator('body').innerText()).match(/iPhone 16\s+(128GB|256GB|512GB)/i)?.[1] ?? '';
}

// 30 testcase riêng, có liên hệ 1–1 với ASM06. Mỗi test có browser context mới.
test.describe('ASM7 | F13 | Tran Thi Minh Thu | 30 test cases', () => {
  test('DDV_F13_001 - Hiển thị trả góp qua công ty tài chính', async ({ page }) => {
    await companyPage(page);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_002 - Hiển thị trả góp qua thẻ tín dụng', async ({ page }) => {
    await chooseMode(page, 'credit');
    await expect(page.getByText(CREDIT, { exact: true })).toBeVisible();
    await expect(page.getByText(COMPANY, { exact: true }).first()).not.toBeVisible();
  });
  test('DDV_F13_003 - Chọn phương án có trả trước một phần', async ({ page }) => {
    await companyPage(page);
    const before = await paymentAmount(page);
    const options = await availableDown(page);
    test.skip(options.length < 2, 'Gói hiện tại không có mức trả trước thay thế');
    await selectDown(page, options[Math.floor(options.length / 2)]);
    const after = await paymentAmount(page);
    expect(after, 'Đổi trả trước phải cập nhật số tiền mỗi tháng').not.toBe(before);
  });
  test('DDV_F13_004 - Hiển thị chương trình trả góp 0%', async ({ page }) => {
    await openProductModal(page);
    await expect(page.getByRole('button', { name: /Trả góp 0%/i })).toBeVisible();
    await page.getByText(COMPANY, { exact: true }).click();
    await expect(page).toHaveURL(/\/installment/);
    await expect(page.getByText('Không lãi suất', { exact: true }).first(),
      'Không thấy gói ưu đãi Không lãi suất trên trang trả góp')
      .toBeVisible({ timeout: 10_000 });
    await observe('Nhãn Trả góp 0% KHÔNG chứng minh tổng phí bằng 0; xem Phí thu hộ/Phí bảo hiểm/Chênh lệch.');
  });
  test('DDV_F13_005 - Đổi giữa hai phương án trả góp', async ({ page }) => {
    await chooseMode(page, 'company');
    await expect(page.getByText(COMPANY, { exact: true })).toBeVisible();
    // Đi qua sản phẩm để chọn hình thức khác, không tạo đơn.
    await chooseMode(page, 'credit');
    await expect(page.getByText(CREDIT, { exact: true })).toBeVisible();
    await chooseMode(page, 'company');
    await expect(page.getByText(COMPANY, { exact: true })).toBeVisible();
  });
  test('DDV_F13_006 - Chọn kỳ hạn ngắn nhất', async ({ page }) => {
    await companyPage(page);
    const terms = await availableTerms(page);
    await selectTerm(page, terms[0]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_007 - Chọn kỳ hạn trung bình', async ({ page }) => {
    await companyPage(page);
    const terms = await availableTerms(page);
    test.skip(terms.length < 3, 'Không có kỳ hạn nằm giữa min và max');
    await selectTerm(page, terms[Math.floor(terms.length / 2)]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_008 - Chọn kỳ hạn dài nhất', async ({ page }) => {
    await companyPage(page);
    const terms = await availableTerms(page);
    await selectTerm(page, terms[terms.length - 1]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_009 - Chuyển từ kỳ hạn ngắn sang dài', async ({ page }) => {
    await companyPage(page);
    const terms = await availableTerms(page);
    test.skip(terms.length < 2, 'Đối tác hiện tại không có ít nhất 2 kỳ hạn');
    const d = await currentDown(page);
    await selectTerm(page, terms[0]); const a = await paymentAmount(page);
    await selectTerm(page, terms[terms.length - 1]); const b = await paymentAmount(page);
    expect(b).not.toBe(a);
    expect(await currentDown(page), 'Không được tự đổi mức trả trước').toBe(d);
  });
  test('DDV_F13_010 - Thay đổi kỳ hạn liên tiếp và quay về ban đầu', async ({ page }) => {
    await companyPage(page);
    const terms = await availableTerms(page);
    test.skip(terms.length < 2, 'Thiếu hai kỳ hạn để chuyển qua lại');
    const first = terms[terms.length - 1];
    await selectTerm(page, first); const a = await paymentAmount(page);
    await selectTerm(page, terms[0]);
    await selectTerm(page, first); const c = await paymentAmount(page);
    expect(c, 'Trở lại cùng kỳ hạn phải ra cùng tiền khi dữ liệu không đổi').toBe(a);
  });
  test('DDV_F13_011 - Chọn mức trả trước tối thiểu', async ({ page }) => {
    await companyPage(page);
    const downs = await availableDown(page);
    await selectDown(page, downs[0]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_012 - Chọn mức trả trước trung bình', async ({ page }) => {
    await companyPage(page);
    const downs = await availableDown(page);
    test.skip(downs.length < 3, 'UI không có mức trả trước nằm giữa');
    await selectDown(page, downs[Math.floor(downs.length / 2)]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_013 - Chọn mức trả trước tối đa', async ({ page }) => {
    await companyPage(page);
    const downs = await availableDown(page);
    await selectDown(page, downs[downs.length - 1]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_014 - Thay đổi hai mức trả trước liên tiếp', async ({ page }) => {
    await companyPage(page);
    const downs = await availableDown(page);
    test.skip(downs.length < 2, 'Không có hai mức trả trước để chuyển đổi');
    const t = await currentTerm(page);
    await selectDown(page, downs[0]); const a = await paymentAmount(page);
    await selectDown(page, downs[downs.length - 1]);
    await selectDown(page, downs[0]); const c = await paymentAmount(page);
    expect(c).toBe(a);
    expect(await currentTerm(page)).toBe(t);
  });
  test('DDV_F13_015 - Nhập số trả trước ngoài phạm vi', async ({ page }) => {
    await companyPage(page);
    const freeInput = page.locator('input[type="number"]:visible').first();
    test.skip(!(await freeInput.isVisible().catch(() => false)),
      'Ảnh thực tế chỉ có dropdown mức cố định 20–70%; không có ô nhập số tiền trả trước tự do');
    const min = Number(await freeInput.getAttribute('min') ?? 'NaN');
    const max = Number(await freeInput.getAttribute('max') ?? 'NaN');
    test.skip(!Number.isFinite(min) || !Number.isFinite(max), 'UI không khai báo min/max cho ô nhập tay');
    await freeInput.fill(String(min - 1)); await freeInput.press('Tab');
    expect(await freeInput.inputValue()).not.toBe(String(min - 1));
    await freeInput.fill(String(max + 1)); await freeInput.press('Tab');
    expect(await freeInput.inputValue()).not.toBe(String(max + 1));
  });
  test('DDV_F13_016 - Chọn đối tác tài chính A', async ({ page }) => {
    await companyPage(page);
    await choosePartner(page, PARTNERS[0]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_017 - Chuyển sang đối tác tài chính B', async ({ page }) => {
    await companyPage(page);
    await choosePartner(page, PARTNERS[0]);
    const a = await installmentPrice(page);
    await choosePartner(page, PARTNERS[1]);
    expect(await installmentPrice(page)).toBe(a);
    await choosePartner(page, PARTNERS[0]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_018 - Chọn thẻ tín dụng ngân hàng A', async ({ page }) => {
    await chooseMode(page, 'credit');
    const title = page.getByText(/Chọn ngân hàng|Ngân hàng phát hành|Ngân hàng/i).first();
    test.skip(!(await title.isVisible().catch(() => false)),
      'Chưa có ảnh/locator xác nhận danh sách ngân hàng trên màn hình thẻ tín dụng');
    const bank = page.getByRole('button', { name: /^(?!XÁC NHẬN|ĐĂNG KÝ).*(ACB|Vietcombank|VPBank|Techcombank|Sacombank)/i }).first();
    test.skip(!(await bank.isVisible().catch(() => false)), 'Không thấy ngân hàng hợp lệ trong danh sách');
    await bank.click();
    await expect(title).toBeVisible();
  });
  test('DDV_F13_019 - Đổi sang ngân hàng/thẻ khác', async ({ page }) => {
    await chooseMode(page, 'credit');
    const banks = page.getByRole('button', { name: /ACB|Vietcombank|VPBank|Techcombank|Sacombank/i });
    test.skip((await banks.count()) < 2, 'Chưa xác nhận ít nhất 2 ngân hàng hỗ trợ trên UI thẻ');
    const b1 = banks.nth(0), b2 = banks.nth(1);
    await b1.click(); await b2.click();
    await expect(page.getByText(CREDIT, { exact: true })).toBeVisible();
  });
  test('DDV_F13_020 - Đối tác không hỗ trợ sản phẩm', async ({ page }) => {
    await gotoChecked(page, SKU_B);
    test.skip(true,
      'ASM06 chưa cung cấp cặp SKU_B/đối tác K được xác nhận KHÔNG hỗ trợ; không thể tạo bằng chứng bằng suy đoán');
  });
  test('DDV_F13_021 - Đối chiếu tiền góp giá A - kỳ hạn ngắn', async ({ page }) => {
    await companyPage(page);
    const ts = await availableTerms(page); const ds = await availableDown(page);
    await selectDown(page, ds[0]); await selectTerm(page, ts[0]);
    await checkMonetarySummary(page);
    const price = await installmentPrice(page), down = ds[0];
    const row = await detailRow(page, 'Trả trước');
    const amount = vnMoney(row);
    expect(amount).not.toBeNull();
    expect(Math.abs(amount! - price * down / 100)).toBeLessThanOrEqual(1);
    await observe(`F13_021: Giá ${price}, trả trước ${down}%, kỳ hạn ${ts[0]} tháng, góp/kỳ ${await paymentAmount(page)}`);
  });
  test('DDV_F13_022 - Đối chiếu tiền góp giá A - kỳ hạn dài', async ({ page }) => {
    await companyPage(page);
    const ts = await availableTerms(page); const ds = await availableDown(page);
    await selectDown(page, ds[0]); await selectTerm(page, ts[ts.length - 1]);
    await checkMonetarySummary(page);
    await observe(`F13_022: Kỳ hạn ${await currentTerm(page)}; góp/kỳ ${await paymentAmount(page)}`);
  });
  test('DDV_F13_023 - Đối chiếu tiền góp trên sản phẩm B', async ({ page }) => {
    // Nếu trang B đang hết hàng và không có nút Trả góp, phải SKIP có lý do.
    await gotoChecked(page, SKU_B);
    const has = await page.getByRole('button', { name: /^\s*Trả góp 0%\s*$/i }).first().isVisible().catch(() => false);
    test.skip(!has, 'SKU_B không hiển thị nút trả góp (có thể hết hàng)');
    await companyPage(page, SKU_B);
    expect(await modelFromPage(page)).toBe('256GB');
    await checkMonetarySummary(page);
  });
  test('DDV_F13_024 - Đổi biến thể sang mức giá cao hơn', async ({ page }) => {
    await companyPage(page); const priceA = await installmentPrice(page);
    await gotoChecked(page, SKU_HIGHER);
    const has = await page.getByRole('button', { name: /^\s*Trả góp 0%\s*$/i }).first().isVisible().catch(() => false);
    test.skip(!has, 'Biến thể 512GB không cho mở trả góp tại thời điểm chạy');
    await companyPage(page, SKU_HIGHER);
    const priceHigh = await installmentPrice(page);
    expect(priceHigh, 'Bản dung lượng cao phải có giá cao hơn trong dữ liệu test').toBeGreaterThan(priceA);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_025 - Đổi biến thể sang mức giá thấp hơn', async ({ page }) => {
    await gotoChecked(page, SKU_HIGHER);
    const has = await page.getByRole('button', { name: /^\s*Trả góp 0%\s*$/i }).first().isVisible().catch(() => false);
    test.skip(!has, 'Biến thể 512GB không cho mở trả góp tại thời điểm chạy');
    await companyPage(page, SKU_HIGHER); const hi = await installmentPrice(page);
    await companyPage(page, SKU_A); const low = await installmentPrice(page);
    expect(low).toBeLessThan(hi);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_026 - Mở rồi đóng hộp thoại trả góp', async ({ page }) => {
    await openProductModal(page);
    const close = page.getByRole('button', { name: /^(Đóng|Close|×|X)$/i }).first();
    const modalHeader = page.getByText('Chọn hình thức trả góp', { exact: true }).locator('xpath=..');
    const headerClose = modalHeader.locator('button').last();
    if (await close.isVisible().catch(() => false)) await close.click();
    else if (await headerClose.isVisible().catch(() => false)) await headerClose.click();
    else await page.keyboard.press('Escape');
    await expect(page.getByText('Chọn hình thức trả góp', { exact: true }))
      .toBeHidden({ timeout: 10_000 });
    await openProductModal(page);
    await expect(page.getByText('Chọn hình thức trả góp', { exact: true })).toBeVisible();
  });
  test('DDV_F13_027 - Đổi đối tác rồi đổi kỳ hạn', async ({ page }) => {
    await companyPage(page);
    await choosePartner(page, PARTNERS[0]);
    await choosePartner(page, PARTNERS[1]);
    const terms = await availableTerms(page);
    await selectTerm(page, terms[terms.length - 1]);
    await checkMonetarySummary(page);
  });
  test('DDV_F13_028 - Quay lại trang chi tiết từ trả góp', async ({ page }) => {
    await companyPage(page);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dien-thoai\/iphone-16-128gb\.html/);
    // Dùng .first() vì trang sản phẩm có 2 nút “Trả góp 0%” (main + sidebar sticky)
    await expect(page.getByRole('button', { name: /^\s*Trả góp 0%\s*$/i }).first()).toBeVisible();
  });
  test('DDV_F13_029 - Làm mới trang đang chọn trả góp', async ({ page }) => {
    await companyPage(page);
    const before = await installmentPrice(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/installment/);
    await expect(page.getByText(COMPANY, { exact: true })).toBeVisible({ timeout: 15_000 });
    await checkMonetarySummary(page);
    expect(await installmentPrice(page)).toBe(before);
    await observe('Reload có thể reset kỳ hạn/trả trước; kiểm tra lại bảng, không giả định sẽ lưu cấu hình cũ.');
  });
  test('DDV_F13_030 - Đổi sang model khác khi xem trả góp', async ({ page }) => {
    await companyPage(page); const a = await installmentPrice(page);
    await gotoChecked(page, SKU_B);
    const has = await page.getByRole('button', { name: /^\s*Trả góp 0%\s*$/i }).first().isVisible().catch(() => false);
    test.skip(!has, 'SKU_B không khả dụng cho trả góp ở thời điểm chạy');
    await companyPage(page, SKU_B);
    const b = await installmentPrice(page);
    expect(await modelFromPage(page)).toBe('256GB');
    expect(b).not.toBe(a);
    await checkMonetarySummary(page);
  });
});
