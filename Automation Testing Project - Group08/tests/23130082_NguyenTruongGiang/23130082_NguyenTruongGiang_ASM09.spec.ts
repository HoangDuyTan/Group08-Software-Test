import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * Assignment 9 – Nguyễn Trường Giang (23130082) – F04 / F05 / F06.
 * Cùng cách tổ chức với 23130291_HoangDuyTan_ASM09.spec.ts: một file độc lập,
 * dữ liệu khách vãng lai, thao tác UI thật, ảnh/trace/Actual cho từng ca.
 *
 * Các kịch bản tìm lỗi không đồng nghĩa số defect đã được xác nhận.
 * Passed = chưa quan sát lỗi; Failed tại assertion = candidate cần tái hiện.
 * Lỗi setup/locator/mạng và thiếu tồn kho không được đếm thành defect.
 * Không mock API, sửa DOM/state hoặc gửi đơn, thanh toán, form đăng ký nhận hàng.
 * Không chia một lỗi thành nhiều defect chỉ vì khác màu/dữ liệu đầu vào.
 * Chỉ ghi nhận defect có thể tái hiện bằng thao tác tay, không giữ/đảo request.
 * Chạy 1 worker, không retry. Gặp HTTP 403 thì dừng các ca còn lại.
 */

const ORIGIN = 'https://didongviet.vn';
const IPHONE = `${ORIGIN}/dien-thoai/iphone-16-plus-256gb.html`;
const SAMSUNG = `${ORIGIN}/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html`;
const IPHONE17 = `${ORIGIN}/dien-thoai/iphone-17-256gb.html`;
const IPHONE17_PROMAX = `${ORIGIN}/dien-thoai/iphone-17-pro-max-256gb.html`;
const TIMEOUT = 15_000;
const MONEY = /^\d{1,3}(?:[.,]\d{3})+\s*[đ₫]$/;
const COLOR_NAMES = ['Hồng', 'Xanh Lá', 'Xanh Dương', 'Đen', 'Trắng', 'Titan Xanh', 'Titan Đen', 'Bạc', 'Xám Titan', 'Titan Bạc', 'Xanh Lá Xô Thơm', 'Tím Oải Hương', 'Xanh Lam Khói', 'Cam Vũ Trụ', 'Xanh Đậm'];
// Mỗi nhóm là một vấn đề độc lập. Ca 05 kiểm tra bảo toàn số lượng/tiền;
// nhiều dòng cùng SKU tự nó chưa phải defect. Ca 11/39 đã loại sau audit.
const DEFECT_GROUPS: Record<string, string> = {
  '30': 'DDV-GIANG-01', '46': 'DDV-GIANG-12',
  '19': 'DDV-GIANG-03', '21': 'DDV-GIANG-04', '26': 'DDV-GIANG-05',
  '31': 'DDV-GIANG-05', '32': 'DDV-GIANG-06', '37': 'DDV-GIANG-08',
  '38': 'DDV-GIANG-08', '45': 'DDV-GIANG-11',
};
let accessDenied = false;

interface Product { url: string; sku: string; color: string; price: number; image: string; }
interface CartItem { productSku: string; quantity: number; isMaxQuantity: boolean; }
interface Run {
  phase: 'setup' | 'probe' | 'assertion';
  expected: string;
  observations: { label: string; value: unknown }[];
  network: unknown[];
  forbidden: string[];
  pending: Promise<void>[];
  cartWrites: number;
  activeWrites: number;
  lastCartEvent: number;
}
const runs = new WeakMap<BrowserContext, Run>();
const main = (page: Page) => page.getByRole('main');
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const money = (value: string) => Number(value.replace(/\D/g, ''));
const imagePath = (value: string) => new URL(value, ORIGIN).pathname;
const cards = (page: Page) => main(page).getByRole('button', {
  name: new RegExp(`^(?:${COLOR_NAMES.map(escapeRegex).join('|')})\\s+\\d`),
});
const colorCard = (page: Page, color: string) => main(page).getByRole('button', { name: new RegExp(`^${escapeRegex(color)}\\s+\\d`) });
const buyNow = (page: Page) => main(page).getByRole('button', { name: 'MUA NGAY', exact: true }).first();
const addButton = (page: Page) => buyNow(page).locator('..').getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true });
const rows = (page: Page) => main(page).locator('div:has(> a > img):has(button[aria-label="Tăng số lượng"])');
const rowFor = (page: Page, color: string) => rows(page).filter({ has: page.getByRole('button', { name: color, exact: true }) });
const plus = (row: Locator) => row.getByRole('button', { name: 'Tăng số lượng', exact: true });
const quantity = (row: Locator) => plus(row).locator('../span');
const checkoutRows = (page: Page) => main(page).locator('div:has(> a > img)').filter({ hasText: /Số lượng:/ });
const runFor = (page: Page) => runs.get(page.context())!;

function record(page: Page, label: string, value: unknown) {
  runFor(page).observations.push({ label, value });
}
function blocked(page: Page, reason: string): never {
  record(page, 'BLOCKED', reason);
  test.info().annotations.push({ type: 'BLOCKED', description: reason });
  test.skip(true, reason);
  throw new Error(reason);
}
async function hydrated(control: Locator) {
  // Chỉ đọc dấu hiệu handler React; không gọi handler hoặc thay đổi state.
  await expect.poll(() => control.evaluate(element => {
    const props = element as unknown as Record<string, { onClick?: unknown }>;
    return Object.keys(element).some(key => key.startsWith('__reactProps$') && typeof props[key]?.onClick === 'function');
  }), { timeout: TIMEOUT, message: 'SETUP: chờ React hydrate' }).toBe(true);
}
async function cookies(page: Page) {
  const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
  try { await reject.waitFor({ state: 'visible', timeout: 2500 }); }
  catch { return; }
  await reject.click();
  await expect(reject).toBeHidden();
}
async function accessible(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (response?.status() === 403) {
    accessDenied = true;
    return blocked(page, 'ENVIRONMENT: website trả HTTP 403; dừng thăm dò, không phải defect chức năng.');
  }
  expect(response?.status(), 'SETUP: trang phải truy cập được').toBeLessThan(400);
  await cookies(page);
}
async function productPage(page: Page, url = SAMSUNG) {
  await accessible(page, url);
  await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible({ timeout: TIMEOUT });
  await expect(cards(page).first()).toBeVisible({ timeout: TIMEOUT });
  await hydrated(cards(page).first());
}
async function productSnapshot(page: Page): Promise<Product> {
  const option = cards(page).and(main(page).locator('button[aria-pressed="true"]'));
  await expect(option).toHaveCount(1);
  const text = await option.innerText();
  const color = text.split(/\r?\n/)[0].trim();
  const price = money(text.match(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/)![0]);
  const src = await option.locator('img').getAttribute('src');
  const sku = new URL(page.url()).searchParams.get('sku') ?? '';
  return { url: page.url(), sku, color, price, image: imagePath(src!) };
}
async function choose(page: Page, color: string): Promise<Product> {
  const option = colorCard(page, color);
  await expect(option).toHaveCount(1);
  if (await option.isDisabled()) return blocked(page, `Thiếu fixture: màu ${color} không chọn được.`);
  await hydrated(option);
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true', { timeout: TIMEOUT });
  await expect(page).toHaveURL(/[?&]sku=[^&]+/, { timeout: TIMEOUT });
  const product = await productSnapshot(page);
  record(page, 'SKU đã chọn', product);
  return product;
}
async function add(page: Page, color: string, url = SAMSUNG): Promise<Product> {
  await productPage(page, url);
  const product = await choose(page, color);
  await addCurrent(page);
  return product;
}
async function addCurrent(page: Page) {
  // Khi SKU đã chạm giới hạn flash sale, website có thể thay CTA mua bằng
  // đăng ký nhận thông tin. Đây là thiếu tiền điều kiện, không phải lỗi locator.
  await expect.poll(async () => await addButton(page).count() > 0 ||
    await main(page).getByText(/ĐĂNG KÝ NHẬN THÔNG TIN KHI CÓ HÀNG/i).count() > 0 ||
    await main(page).getByRole('button', { name: 'Sản phẩm flash sale đã có trong giỏ', exact: true }).count() > 0,
  { timeout: TIMEOUT, message: 'SETUP: chờ CTA mua hoặc trạng thái không mua được' }).toBe(true);
  if (await addButton(page).count() === 0) return blocked(page, 'SKU không còn CTA thêm giỏ (hết hàng/giới hạn khuyến mại); không tính lỗi chức năng.');
  if (await addButton(page).isDisabled()) return blocked(page, 'Thiếu fixture: SKU không thêm giỏ được.');
  await hydrated(addButton(page));
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/fe/carts/add');
  await addButton(page).click();
  const added = await response;
  expect(added.ok(), 'SETUP: API thêm giỏ phải thành công').toBe(true);
  expect((await added.json()).success, 'SETUP: server chấp nhận fixture giỏ').toBe(true);
  await expect(page.getByText('Sản phẩm đã được thêm vào giỏ', { exact: true })).toBeVisible({ timeout: TIMEOUT });
}
const warrantyButton = (page: Page) => main(page).getByRole('button', { name: /^D\.TradePlus - Thu Cũ Vượt Trội/ });
async function warrantyQuote(page: Page) {
  const button = warrantyButton(page);
  if (await button.count() !== 1) return blocked(page, 'Fixture không có gói dịch vụ bảo hành để kiểm tra.');
  const text = await button.innerText();
  const prices = [...text.matchAll(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/g)].map(m => money(m[0]));
  expect(prices.length, 'SETUP: có giá dịch vụ và giá gốc').toBeGreaterThanOrEqual(2);
  return { price: prices[0], original: prices[1], text };
}
async function withWarranty(page: Page, color = 'Đen', url = IPHONE17) {
  await productPage(page, url);
  const product = await choose(page, color);
  const warranty = await warrantyQuote(page);
  await warrantyButton(page).click();
  await expect(warrantyButton(page)).toHaveAttribute('aria-pressed', 'true');
  return { product, warranty };
}
async function ownCart(page: Page) {
  const response = await page.request.get(`${ORIGIN}/api/fe/carts`);
  expect(response.ok(), 'SETUP: đọc giỏ của context guest hiện tại').toBe(true);
  const payload = await response.json();
  record(page, 'GET giỏ guest (kiểm chứng server)', payload);
  return payload.data as Array<{ id: number; productId: string; productSku: string; productVariantId: string;
    quantity: number; price: string; listedPrice: string; isMaxQuantity: boolean; quantityAdjusted: boolean;
    accessories: Array<{ id: number; quantity: number; type: string; productId: string; productVariantId: string;
      price: string; productPrice: string; discountAmount?: string; listedPrice?: string; productName: string }> }>;
}
async function changeCartColor(page: Page, from: string, to: string) {
  await rowFor(page, from).getByRole('button', { name: from, exact: true }).click();
  const option = page.getByRole('dialog').getByRole('button', { name: new RegExp(`^${escapeRegex(to)}\\s+\\d`) });
  await expect(option).toBeVisible();
  if (await option.isDisabled()) return blocked(page, `Không đổi được biến thể ${to} theo UI.`);
  await option.click();
  await expect(page.getByRole('dialog')).toBeHidden();
}
async function summarySaving(page: Page) {
  const summary = main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).locator('../..');
  const label = summary.getByText('Tiết kiệm', { exact: true });
  return money(await label.locator('..').innerText());
}
async function checkoutAmount(page: Page, label = 'Tổng tiền') {
  const value = main(page).getByText(label, { exact: true }).locator('..').locator(':scope > span').filter({ hasText: MONEY });
  await expect(value).toHaveCount(1);
  return money(await value.innerText());
}
async function openCart(page: Page, expectedRows?: number) {
  await accessible(page, `${ORIGIN}/cart`);
  await expect(main(page).getByRole('heading', { name: 'Giỏ hàng của bạn', exact: true })).toBeVisible({ timeout: TIMEOUT });
  await expect(main(page).getByRole('status', { name: 'Đang tải giỏ hàng' })).toHaveCount(0, { timeout: TIMEOUT });
  if (expectedRows !== undefined) await expect(rows(page)).toHaveCount(expectedRows, { timeout: TIMEOUT });
}
async function cartSnapshot(page: Page) {
  return rows(page).evaluateAll(elements => elements.map(element => ({
    sku: new URL(element.querySelector('a')!.href).searchParams.get('sku'),
    quantity: Number(element.querySelector('[aria-label="Tăng số lượng"]')!.parentElement!.querySelector('span')!.textContent),
    selected: element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked,
    text: (element as HTMLElement).innerText,
  })));
}
async function setSelected(row: Locator, selected: boolean) {
  const checkbox = row.locator('input[type="checkbox"]');
  if (await checkbox.isChecked() !== selected) await checkbox.locator('..').click();
  await expect(checkbox).toBeChecked({ checked: selected });
}
async function updateQuantity(page: Page, color: string, target: number) {
  const row = rowFor(page, color);
  const sku = new URL((await row.locator('a').first().getAttribute('href'))!, ORIGIN).searchParams.get('sku');
  for (let current = Number(await quantity(row).innerText()); current !== target;) {
    const next = current + (target > current ? 1 : -1);
    const control = row.getByRole('button', { name: target > current ? 'Tăng số lượng' : 'Giảm số lượng', exact: true });
    if (await control.isDisabled()) return blocked(page, `Thiếu fixture ${color}: không chuẩn bị được x${target}; giới hạn tại ${current}.`);
    const refreshed = page.waitForResponse(async response => {
      if (response.request().method() !== 'GET' || new URL(response.url()).pathname !== '/api/fe/carts' || !response.ok()) return false;
      const payload = await response.json();
      return payload.data?.some((item: CartItem) => item.productSku === sku && item.quantity === next);
    });
    await control.click();
    await refreshed;
    await expect(quantity(row)).toHaveText(String(next), { timeout: TIMEOUT });
    current = next;
  }
}
async function remove(page: Page, color: string) {
  await rowFor(page, color).getByRole('button', { name: 'Xóa sản phẩm', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Xóa sản phẩm?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(rowFor(page, color)).toHaveCount(0);
}
async function amount(page: Page) {
  const summary = main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).locator('../..');
  return money(await summary.locator('span.font-bold.text-primary-500').filter({ hasText: MONEY }).innerText());
}
async function startProbe(page: Page, expected: string) {
  const run = runFor(page);
  run.phase = 'probe'; run.expected = expected;
  test.info().annotations.push({ type: 'expected', description: expected });
  await test.info().attach('ASM09_before.png', { body: await page.screenshot({ mask: [page.locator('input,textarea')] }), contentType: 'image/png' });
}
async function verify(page: Page, label: string, actual: unknown, expected: unknown) {
  record(page, label, { actual, expected });
  runFor(page).phase = 'assertion';
  expect(actual, `DEFECT CANDIDATE: ${label}`).toEqual(expected);
  runFor(page).phase = 'probe';
}
async function enterBuyNow(page: Page) {
  await hydrated(buyNow(page));
  if (await buyNow(page).isDisabled()) return blocked(page, 'Thiếu fixture: nút MUA NGAY bị khóa.');
  await buyNow(page).click();
  await expect(page).toHaveURL(/\/checkout(?:[?#].*)?$/, { timeout: 45_000 });
  await expect(checkoutRows(page).first()).toBeVisible({ timeout: TIMEOUT });
}
async function checkoutSnapshot(page: Page) {
  return checkoutRows(page).evaluateAll(elements => elements.map(element => {
    const text = (element as HTMLElement).innerText;
    return { sku: new URL(element.querySelector('a')!.href).searchParams.get('sku'),
      quantity: Number(text.match(/Số lượng:\s*(\d+)/)?.[1]), text };
  }));
}
async function reloadWithCartData(page: Page) {
  const loaded = page.waitForResponse(response => response.request().method() === 'GET' &&
    new URL(response.url()).pathname === '/api/fe/carts' && response.ok());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await (await loaded).json();
  // Cho redirect sau khi GET giỏ hoàn tất thời gian kết thúc; không kết luận
  // từ một frame checkout cũ trước khi ứng dụng điều hướng sang cart.
  await expect.poll(() => Date.now() - runFor(page).lastCartEvent, { timeout: TIMEOUT }).toBeGreaterThan(1000);
}

test.use({ trace: 'on', video: 'on', screenshot: 'only-on-failure', actionTimeout: TIMEOUT, navigationTimeout: 45_000 });

test.describe('ASM09 TV2 | F04 F05 F06 | Defect hunting', () => {
  test.describe.configure({ timeout: 150_000, retries: 0, mode: 'default' });

  test.beforeEach(async ({ context }, info) => {
    test.skip(accessDenied, 'ENVIRONMENT: dừng sau HTTP 403; không thử vượt chặn.');
    const number = info.title.match(/ASM09_TV2_(\d+)/)?.[1];
    if (number && DEFECT_GROUPS[number]) info.annotations.push({ type: 'defect-group', description: DEFECT_GROUPS[number] });
    const run: Run = { phase: 'setup', expected: '', observations: [], network: [], forbidden: [], pending: [],
      cartWrites: 0, activeWrites: 0, lastCartEvent: 0 };
    runs.set(context, run);
    const isCartWrite = (request: { url(): string; method(): string }) =>
      /^\/api\/fe\/(?:carts|cart-accessories)/.test(new URL(request.url()).pathname) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method());
    context.on('request', request => {
      if (isCartWrite(request)) { run.activeWrites++; run.cartWrites++; run.lastCartEvent = Date.now(); }
    });
    for (const event of ['requestfinished', 'requestfailed'] as const) context.on(event, request => {
      if (isCartWrite(request)) { run.activeWrites--; run.lastCartEvent = Date.now(); }
    });
    await context.route(/\/api\/.*\/(?:orders?|payments?|checkout|installment-applications|subscribe|leads)(?:\/|\?|$)/i, async route => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method())) {
        run.forbidden.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        await route.abort('blockedbyclient');
      } else { await route.continue(); }
    });
    context.on('response', response => {
      const request = response.request();
      if (!/^\/api\/fe\/(?:carts|cart-accessories)/.test(new URL(response.url()).pathname)) return;
      run.lastCartEvent = Date.now();
      run.pending.push((async () => {
        const payload = await response.json().catch(() => null);
        run.network.push({ method: request.method(), path: new URL(response.url()).pathname, status: response.status(),
          // Chỉ log dữ liệu giỏ của phiên guest được tạo riêng trong ca này.
          request: request.postDataJSON(), response: payload });
      })());
    });
  });

  test.afterEach(async ({ context }, info) => {
    const run = runs.get(context);
    if (!run) return;
    await Promise.allSettled(run.pending);
    const classification = info.status === 'skipped' ? 'BLOCKED / ENVIRONMENT'
      : info.status === 'passed' ? 'NOT OBSERVED'
      : run.phase === 'assertion' ? 'CANDIDATE – cần chạy lại và loại trùng'
      : 'REVIEW – setup / locator / network / probe chưa hoàn tất';
    for (const [index, page] of context.pages().entries()) {
      if (page.isClosed()) continue;
      record(page, `Tab ${index + 1}`, { url: page.url(), cart: await cartSnapshot(page).catch(() => []),
        checkout: await checkoutSnapshot(page).catch(() => []) });
      await info.attach(`ASM09_after_tab${index + 1}.png`, {
        body: await page.screenshot({ fullPage: false, mask: [page.locator('input,textarea')], timeout: 8000 }), contentType: 'image/png',
      }).catch(() => {});
    }
    info.annotations.push({ type: 'classification', description: classification });
    await info.attach('ASM09_evidence.json', {
      body: JSON.stringify({ test: info.title, status: info.status, classification,
        defectGroup: DEFECT_GROUPS[info.title.match(/ASM09_TV2_(\d+)/)?.[1] ?? ''] ?? null,
        time: new Date().toISOString(), expected: run.expected, observations: run.observations,
        cartNetwork: run.network, forbidden: run.forbidden, errors: info.errors.map(e => e.message) }, null, 2),
      contentType: 'application/json; charset=utf-8',
    });
    expect(run.forbidden, 'Không được phát sinh request đặt hàng/thanh toán/đăng ký').toEqual([]);
  });

  test('ASM09_TV2_01 | F04 | Refresh URL có SKU phải giữ đúng màu, giá và ảnh', async ({ page }) => {
    await productPage(page, IPHONE);
    const before = await choose(page, 'Xanh Dương');
    await startProbe(page, 'Refresh deep link giữ SKU, màu, giá và ảnh đã chọn; không reset về màu mặc định.');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(cards(page).first()).toBeVisible({ timeout: TIMEOUT });
    await hydrated(cards(page).first());
    await verify(page, 'Deep link phải khôi phục đúng SKU', await productSnapshot(page), before);
  });

  test('ASM09_TV2_02 | F04 | Back/Forward giữa dung lượng phải khôi phục SKU tương ứng', async ({ page }) => {
    await productPage(page, IPHONE);
    const before = await choose(page, 'Xanh Lá');
    const group = main(page).getByText('Phiên bản', { exact: true }).first().locator('..');
    const target = group.getByRole('link', { name: '128GB', exact: true });
    if (await target.count() !== 1) return blocked(page, 'Không có liên kết 128GB; thiếu fixture chuyển dung lượng.');
    await target.click();
    await expect(page).toHaveURL(/iphone-16-plus-128gb\.html/);
    await hydrated(cards(page).first());
    const after = await choose(page, 'Đen');
    await startProbe(page, 'Back khôi phục 256GB/Xanh Lá, Forward khôi phục 128GB/Đen; URL và UI đồng nhất.');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/iphone-16-plus-256gb\.html/);
    await hydrated(cards(page).first());
    await verify(page, 'Back không giữ state của dung lượng mới', await productSnapshot(page), before);
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await hydrated(cards(page).first());
    await verify(page, 'Forward khôi phục SKU mới', await productSnapshot(page), after);
  });

  test('ASM09_TV2_03 | F04 | SKU của dung lượng khác không làm sai cấu hình trên URL 256GB', async ({ page }) => {
    await productPage(page, IPHONE.replace('256gb', '128gb'));
    const foreign = await choose(page, 'Đen');
    await startProbe(page, 'SKU của 128GB trên đường dẫn 256GB không được làm CTA/giá khác cấu hình đang hiển thị. Cho phép website bỏ qua query không hợp lệ.');
    await accessible(page, `${IPHONE}?sku=${encodeURIComponent(foreign.sku)}`);
    await expect(cards(page).first()).toBeVisible({ timeout: TIMEOUT });
    await hydrated(cards(page).first());
    const current = await productSnapshot(page);
    const heading = await main(page).getByRole('heading', { level: 1 }).innerText();
    record(page, 'SKU từ dung lượng khác', { foreign, current, heading });
    // Query không hợp lệ còn nguyên trong URL chưa đủ chứng minh defect.
    // Kiểm tra phần người dùng thật sự chọn/đăng ký và giá bán chính.
    const body = await main(page).innerText();
    const capacity = /128GB/i.test(heading) ? '128GB' : '256GB';
    if (body.includes('ĐĂNG KÝ NHẬN THÔNG TIN KHI CÓ HÀNG')) {
      const label = new RegExp(`Sản phẩm iPhone 16 Plus ${capacity}[^\\n]*- ${escapeRegex(current.color)}`);
      await verify(page, 'CTA dùng dung lượng/màu đang hiển thị, không dùng SKU ngoại lai', label.test(body), true);
    }
    const region = body.slice(body.indexOf('Màu sắc sản phẩm'), body.indexOf('Hoặc', body.indexOf('Màu sắc sản phẩm')));
    const prices = [...region.matchAll(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/g)].map(match => money(match[0]));
    await verify(page, 'Giá chính phải khớp thẻ màu hiện hành', prices[await cards(page).count()], current.price);
  });

  test('ASM09_TV2_04 | F04 | Đổi nhiều màu liên tiếp phải chốt đúng lựa chọn cuối', async ({ page }) => {
    await productPage(page, IPHONE);
    const expected = await choose(page, 'Trắng');
    await choose(page, 'Hồng');
    await startProbe(page, 'Sau chuỗi đổi màu nhanh, SKU, màu, ảnh và giá phải khớp lựa chọn cuối Trắng.');
    for (const color of ['Xanh Dương', 'Đen', 'Xanh Lá', 'Trắng']) await colorCard(page, color).click();
    await expect(colorCard(page, 'Trắng')).toHaveAttribute('aria-pressed', 'true');
    await verify(page, 'Lựa chọn cuối không bị response cũ ghi đè', await productSnapshot(page), expected);
    const text = await main(page).innerText();
    if (text.includes('ĐĂNG KÝ NHẬN THÔNG TIN KHI CÓ HÀNG')) {
      await verify(page, 'CTA hết hàng phải chỉ đúng màu cuối', /Sản phẩm iPhone 16 Plus 256GB[^\n]*- Trắng/.test(text), true);
    }
  });

  test('ASM09_TV2_05 | F05 | Đổi màu sang SKU đã có phải bảo toàn tổng số lượng', async ({ page }) => {
    await add(page, 'Titan Đen'); const silver = await add(page, 'Bạc');
    await openCart(page, 2);
    if (await plus(rowFor(page, 'Bạc')).isDisabled()) return blocked(page, 'Bạc bị giới hạn x1; không đủ tồn kho để kiểm tra gộp x2.');
    await startProbe(page, 'Đổi Titan Đen x1 sang Bạc đã có x1: bảo toàn tổng hai máy và tính đúng tiền; không bắt buộc website phải gộp thành một dòng.');
    await rowFor(page, 'Titan Đen').getByRole('button', { name: 'Titan Đen', exact: true }).click();
    const option = page.getByRole('dialog').getByRole('button', { name: /^Bạc\s+\d/ });
    await expect(option).toBeVisible();
    if (await option.isDisabled()) return blocked(page, 'Website khóa đổi sang SKU đã có; không coi thiết kế chặn trùng là defect.');
    await option.click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await openCart(page);
    const actual = await cartSnapshot(page);
    record(page, 'Các dòng sau đổi màu (nhiều dòng cùng SKU chưa đủ là defect)', actual);
    await verify(page, 'Mọi máy sau đổi đều đúng SKU Bạc', actual.every(r => r.sku === silver.sku), true);
    await verify(page, 'Đổi biến thể bảo toàn tổng hai máy', actual.reduce((n, r) => n + r.quantity, 0), 2);
    await verify(page, 'Tổng tiền sau gộp đúng x2', await amount(page), silver.price * 2);
  });

  test('ASM09_TV2_06 | F05 | Tăng SKU bỏ chọn không được cộng vào tiền cần thanh toán', async ({ page }) => {
    const black = await add(page, 'Titan Đen'); await add(page, 'Bạc');
    await openCart(page, 2);
    await setSelected(rowFor(page, 'Bạc'), false);
    await startProbe(page, 'Chỉ chọn Titan Đen x1; tăng Bạc lên x2 phải giữ tiền thanh toán bằng một máy Titan Đen.');
    await updateQuantity(page, 'Bạc', 2);
    await verify(page, 'Dòng bỏ chọn vẫn phải giữ trạng thái bỏ chọn', await rowFor(page, 'Bạc').locator('input[type="checkbox"]').isChecked(), false);
    await verify(page, 'Tổng chỉ cộng các SKU được chọn', await amount(page), black.price);
    record(page, 'Giỏ sau thay đổi', await cartSnapshot(page));
  });

  test('ASM09_TV2_07 | F05 | Hai lượt tăng nhanh được chấp nhận không bị mất cập nhật', async ({ page }) => {
    await add(page, 'Titan Đen'); await openCart(page, 1);
    const control = plus(rowFor(page, 'Titan Đen'));
    if (await control.isDisabled()) return blocked(page, 'SKU chỉ mua được 1; không đủ fixture kiểm tra tăng nhanh.');
    await startProbe(page, 'Mỗi click thực sự nhận khi nút đang enabled phải tăng một máy; trạng thái sau reload khớp UI.');
    // Observer chỉ đếm click người dùng được nhận, không sửa DOM/state hay gọi API.
    const accepted: number[] = [];
    await page.exposeFunction('__asm09QuantityClick', () => accepted.push(Date.now()));
    await control.evaluate(element => element.addEventListener('click', () => {
      if (!(element as HTMLButtonElement).disabled) {
        (window as unknown as { __asm09QuantityClick: () => void }).__asm09QuantityClick();
      }
    }, { capture: true }));
    const writesBefore = runFor(page).cartWrites;
    await control.dblclick({ delay: 80 });
    await expect.poll(() => {
      const run = runFor(page);
      return run.cartWrites > writesBefore && run.activeWrites === 0 && Date.now() - run.lastCartEvent > 1000;
    }, { timeout: TIMEOUT, message: 'Chờ các cập nhật giỏ thật và refresh kết thúc trước reload' }).toBe(true);
    await expect(plus(rowFor(page, 'Titan Đen'))).toBeVisible();
    // Fresh GET qua reload là kết quả đã lưu, không đọc optimistic state để kết luận.
    await openCart(page, 1);
    if (accepted.length < 2) return blocked(page, 'UI chỉ nhận một click và đã khóa/debounce lượt còn lại; chưa tái hiện hai click hợp lệ.');
    record(page, 'Số click tăng thực sự nhận', accepted.length);
    await verify(page, 'Hai click tăng hợp lệ phải được server lưu', Number(await quantity(rowFor(page, 'Titan Đen')).innerText()), 1 + accepted.length);
  });

  test('ASM09_TV2_08 | F05 | Sửa SKU ở tab cũ không làm sống lại SKU đã xóa ở tab khác', async ({ page, context }) => {
    await add(page, 'Titan Đen'); const silver = await add(page, 'Bạc'); await openCart(page, 2);
    const other = await context.newPage(); await openCart(other, 2);
    await startProbe(page, 'Xóa Titan Đen ở tab B, tăng Bạc ở tab A rồi reload: chỉ còn Bạc x2, không hồi sinh sản phẩm đã xóa.');
    await remove(other, 'Titan Đen');
    await page.bringToFront();
    await updateQuantity(page, 'Bạc', 2);
    await openCart(page);
    await verify(page, 'Cập nhật từ tab cũ không ghi đè giỏ mới', (await cartSnapshot(page)).map(r => ({ sku: r.sku, quantity: r.quantity })), [{ sku: silver.sku, quantity: 2 }]);
  });

  test('ASM09_TV2_09 | F06 | MUA NGAY không mua nhầm SKU từng được chọn trong giỏ', async ({ page }) => {
    await add(page, 'Titan Đen'); await openCart(page, 1); await updateQuantity(page, 'Titan Đen', 2);
    await setSelected(rowFor(page, 'Titan Đen'), false);
    await productPage(page); const target = await choose(page, 'Bạc');
    await startProbe(page, 'Giỏ cũ chứa Titan Đen x2 đã bỏ chọn; MUA NGAY Bạc phải mở checkout chỉ có Bạc x1.');
    await enterBuyNow(page);
    await verify(page, 'Checkout dùng SKU đang MUA NGAY thay vì lựa chọn cũ', (await checkoutSnapshot(page)).map(r => ({ sku: r.sku, quantity: r.quantity })), [{ sku: target.sku, quantity: 1 }]);
    const other = await page.context().newPage(); await openCart(other);
    await verify(page, 'MUA NGAY không làm mất SKU cũ trong giỏ', Number(await quantity(rowFor(other, 'Titan Đen')).innerText()), 2);
  });

  test('ASM09_TV2_10 | F06 | MUA NGAY khi SKU đã chạm tồn kho phải phản hồi rõ ràng', async ({ page }) => {
    const product = await add(page, 'Titan Đen'); await openCart(page, 1);
    for (let attempt = 0; attempt < 5 && await plus(rowFor(page, 'Titan Đen')).isEnabled(); attempt++) {
      const current = Number(await quantity(rowFor(page, 'Titan Đen')).innerText());
      await updateQuantity(page, 'Titan Đen', current + 1);
    }
    if (await plus(rowFor(page, 'Titan Đen')).isEnabled()) return blocked(page, 'Chưa tìm thấy giới hạn trong 5 lượt; không tự giả định tồn kho tối đa.');
    const maximum = Number(await quantity(rowFor(page, 'Titan Đen')).innerText());
    await productPage(page, product.url);
    await choose(page, 'Titan Đen');
    await startProbe(page, 'MUA NGAY SKU đã chạm tồn kho: vào checkout với SL hợp lệ hoặc hiển thị cảnh báo rõ; không treo im lặng.');
    await hydrated(buyNow(page));
    if (await buyNow(page).isDisabled()) {
      await verify(page, 'UI chặn MUA NGAY tại giới hạn thay vì gửi thêm hàng', await buyNow(page).isDisabled(), true);
      return;
    }
    await buyNow(page).click();
    const outcome = async () => {
      if (/\/checkout(?:[?#]|$)/.test(page.url()) && await checkoutRows(page).count()) return 'checkout';
      if (await page.getByText(/tối đa|giới hạn|không đủ|vượt quá|hết hàng|không thể thêm/i).filter({ visible: true }).count()) return 'feedback';
      return 'pending';
    };
    // Chờ phản hồi có điều kiện, không coi trạng thái loading ban đầu là lỗi.
    runFor(page).phase = 'assertion';
    await expect.poll(outcome, { timeout: 30_000, message: 'DEFECT CANDIDATE: MUA NGAY tại giới hạn phải có phản hồi' }).not.toBe('pending');
    runFor(page).phase = 'probe';
    record(page, 'Giới hạn tồn kho và kết quả', { maximum, outcome: await outcome() });
    if (await outcome() === 'checkout') {
      const actual = await checkoutSnapshot(page);
      await verify(page, 'Checkout không vượt số máy được phép', actual.length === 1 && actual[0].sku === product.sku && actual[0].quantity >= 1 && actual[0].quantity <= maximum, true);
    }
  });

  test('ASM09_TV2_12 | F06 | Xóa SKU đang mua ở tab khác không để checkout giữ sản phẩm ma', async ({ page, context }) => {
    await productPage(page); await choose(page, 'Titan Đen'); await enterBuyNow(page);
    const other = await context.newPage(); await openCart(other, 1);
    await startProbe(page, 'Xóa SKU duy nhất ở tab giỏ, refresh checkout: chuyển khỏi luồng mua hoặc không còn sản phẩm/nút đặt hàng khả dụng.');
    await remove(other, 'Titan Đen');
    await reloadWithCartData(page);
    const ghost = await checkoutSnapshot(page);
    await verify(page, 'Checkout phải loại SKU đã bị xóa khỏi server', ghost, []);
    const order = main(page).getByRole('button', { name: /^ĐẶT HÀNG\s*\(/ }).filter({ visible: true });
    await verify(page, 'Không đặt hàng được khi không còn sản phẩm', await order.count() === 0 || await order.isDisabled(), true);
  });

  test('ASM09_TV2_13 | F04 | Đổi màu khác giá không giữ giá hoặc gói dịch vụ ẩn của màu cũ', async ({ page }) => {
    const { warranty } = await withWarranty(page);
    await startProbe(page, 'Chuyển Đen sang Trắng có giá khác; giá chính khớp Trắng, dịch vụ chỉ được tính nếu vẫn hiển thị đang chọn.');
    const target = await choose(page, 'Trắng');
    const text = await main(page).innerText();
    const region = text.slice(text.indexOf('Màu sắc sản phẩm'), text.indexOf('Hoặc', text.indexOf('Màu sắc sản phẩm')));
    const prices = [...region.matchAll(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/g)].map(m => money(m[0]));
    await verify(page, 'Giá chính khớp màu mới', prices[await cards(page).count()], target.price);
    const selected = await warrantyButton(page).getAttribute('aria-pressed') === 'true';
    await enterBuyNow(page);
    await verify(page, 'Không tính gói dịch vụ đã bị bỏ chọn khi đổi màu', await checkoutAmount(page), target.price + (selected ? warranty.price : 0));
  });

  test('ASM09_TV2_14 | F05 | Thêm máy kèm dịch vụ phải giữ giá đã báo trên trang sản phẩm', async ({ page }) => {
    const { product, warranty } = await withWarranty(page);
    await startProbe(page, 'Giỏ có một máy và đúng một gói dịch vụ, tổng = giá máy + giá dịch vụ đã chọn.');
    await addCurrent(page); await openCart(page, 1);
    const server = await ownCart(page);
    record(page, 'Giá đã báo', { product, warranty });
    await verify(page, 'Có đúng một gói dịch vụ đã chọn', server[0].accessories.filter(a => a.type === 'WARRANTY').reduce((n, a) => n + a.quantity, 0), 1);
    await verify(page, 'Tổng giỏ không tính lại dịch vụ theo giá gốc', await amount(page), product.price + warranty.price);
  });

  test('ASM09_TV2_15 | F05 | Tiền tiết kiệm của giỏ phải gồm ưu đãi dịch vụ đang hiển thị', async ({ page }) => {
    const { warranty } = await withWarranty(page);
    await addCurrent(page); await openCart(page, 1);
    const server = await ownCart(page);
    const expected = Number(server[0].listedPrice) - Number(server[0].price) + warranty.original - warranty.price;
    await startProbe(page, 'Tiết kiệm = chênh lệch giá gốc/giá bán của máy và gói dịch vụ, không bỏ sót/trừ hai lần.');
    await verify(page, 'Tiết kiệm giỏ khớp các dòng giá đã báo', await summarySaving(page), expected);
  });

  test('ASM09_TV2_16 | F05 | Tăng số lượng máy không tính nhầm số lượng dịch vụ', async ({ page }) => {
    const { product, warranty } = await withWarranty(page);
    await addCurrent(page); await openCart(page, 1);
    await startProbe(page, 'Sau tăng lên hai máy, tổng dùng đúng số lượng máy và số lượng dịch vụ server lưu.');
    await updateQuantity(page, 'Đen', 2);
    const server = await ownCart(page);
    const serviceCount = server[0].accessories.filter(a => a.type === 'WARRANTY').reduce((n, a) => n + a.quantity, 0);
    await verify(page, 'Tổng giỏ tính đúng số gói dịch vụ thực tế', await amount(page), product.price * 2 + warranty.price * serviceCount);
  });

  test('ASM09_TV2_17 | F05 | Xóa riêng dịch vụ phải cập nhật tiền và giữ nguyên máy', async ({ page }) => {
    const { product } = await withWarranty(page);
    await addCurrent(page); await openCart(page, 1);
    const service = main(page).getByText(/^D\.TradePlus - Thu Cũ Vượt Trội/).first();
    await expect(service).toBeVisible();
    const removeService = service.locator('xpath=ancestor::div[.//button[@aria-label]][1]').getByRole('button', { name: /xóa|xoá/i });
    if (await removeService.count() !== 1) return blocked(page, 'Chưa xác định duy nhất nút xóa dịch vụ; cần kiểm tra DOM, không tính là defect.');
    await startProbe(page, 'Xóa riêng gói dịch vụ: còn máy x1, tổng bằng giá máy, reload không phục hồi dịch vụ.');
    await removeService.click();
    const dialog = page.getByRole('dialog').filter({ hasText: /Xóa|Xoá/ });
    if (await dialog.isVisible()) await dialog.getByRole('button', { name: /^(Xóa|Xoá)$/ }).click();
    await openCart(page, 1);
    const server = await ownCart(page);
    await verify(page, 'Dịch vụ bị xóa trên server', server[0].accessories.filter(a => a.type === 'WARRANTY'), []);
    await verify(page, 'Máy không bị xóa hoặc tính tiền dư', await amount(page), product.price);
  });

  test('ASM09_TV2_18 | F05 | Đổi sang màu khác giá phải cập nhật cả dòng máy và tổng', async ({ page }) => {
    const black = await add(page, 'Đen', IPHONE17); await openCart(page, 1);
    await startProbe(page, 'Đổi Đen sang Trắng: giá giỏ phải khớp báo giá của chính lựa chọn Trắng; hai màu có thể cùng giá khuyến mại.');
    await rowFor(page, 'Đen').getByRole('button', { name: 'Đen', exact: true }).click();
    const option = page.getByRole('dialog').getByRole('button', { name: /^Trắng\s+\d/ });
    await expect(option).toBeVisible();
    const quote = money((await option.innerText()).match(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/)![0]);
    await option.click(); await expect(page.getByRole('dialog')).toBeHidden(); await openCart(page, 1);
    const server = await ownCart(page);
    record(page, 'Giá cũ và báo giá màu mới', { old: black.price, quote });
    await verify(page, 'Giá máy khớp báo giá màu Trắng đã chọn', Number(server[0].price), quote);
    await verify(page, 'Tổng khớp giá SKU sau đổi', await amount(page), Number(server[0].price));
  });

  test('ASM09_TV2_19 | F05 | Đổi sang màu tồn kho thấp không giữ số lượng vượt giới hạn', async ({ page }) => {
    await add(page, 'Titan Đen'); await openCart(page, 1); await updateQuantity(page, 'Titan Đen', 3);
    await startProbe(page, 'Đổi Titan Đen x3 sang Titan Xanh: số lượng server và UI phải hợp lệ, tổng dùng số lượng đã điều chỉnh.');
    await rowFor(page, 'Titan Đen').getByRole('button', { name: 'Titan Đen', exact: true }).click();
    const blueOption = page.getByRole('dialog').getByRole('button', { name: /^Titan Xanh\s+\d/ });
    await expect(blueOption).toBeVisible();
    const changed = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/fe/carts/items/variant');
    await blueOption.click();
    const response = await changed;
    record(page, 'Kết quả đổi sang SKU tồn kho thấp', { status: response.status(), body: await response.json() });
    if (!response.ok()) {
      await expect.poll(() => Date.now() - runFor(page).lastCartEvent).toBeGreaterThan(1000);
      const feedback = await page.getByText(/không đủ|tối đa|giới hạn|vượt quá|không thể|không thành công|thất bại|hết hàng|vui lòng giảm/i).filter({ visible: true }).allTextContents();
      record(page, 'Phản hồi lỗi thấy được trên UI', feedback);
      await verify(page, 'API từ chối đổi biến thể phải giải thích cho người dùng thay vì chỉ ghi console', feedback.length > 0, true);
      return;
    }
    await expect(page.getByRole('dialog')).toBeHidden(); await openCart(page, 1);
    const server = await ownCart(page);
    record(page, 'Sau đổi SKU giới hạn khác', server);
    await verify(page, 'Số lượng hiển thị khớp server sau đổi màu', Number(await quantity(rows(page).first()).innerText()), server[0].quantity);
    await verify(page, 'Tổng giỏ dùng số máy server đã xác nhận', await amount(page), Number(server[0].price) * server[0].quantity);
  });

  test('ASM09_TV2_20 | F06 | MUA NGAY với gói dịch vụ phải giữ nguyên báo giá', async ({ page }) => {
    const { product, warranty } = await withWarranty(page);
    await startProbe(page, 'MUA NGAY một máy và một gói dịch vụ: checkout khớp báo giá trên trang sản phẩm.');
    await enterBuyNow(page);
    await verify(page, 'Tạm tính gồm đúng giá dịch vụ ưu đãi', await checkoutAmount(page, 'Tạm tính'), product.price + warranty.price);
    await verify(page, 'Tổng tiền không áp lại giá gốc dịch vụ', await checkoutAmount(page), product.price + warranty.price);
  });

  test('ASM09_TV2_21 | F06 | Tiền tiết kiệm checkout phải gồm ưu đãi gói dịch vụ', async ({ page }) => {
    const { warranty } = await withWarranty(page);
    await startProbe(page, 'Tiết kiệm checkout phải bằng tổng chênh lệch giá gốc/giá bán của máy và dịch vụ.');
    await enterBuyNow(page);
    const server = await ownCart(page);
    const expected = Number(server[0].listedPrice) - Number(server[0].price) + warranty.original - warranty.price;
    const label = main(page).getByText('Tiết kiệm', { exact: true }).filter({ visible: true });
    await expect(label).toHaveCount(1);
    await verify(page, 'Checkout không bỏ sót ưu đãi dịch vụ', money(await label.locator('..').innerText()), expected);
  });

  test('ASM09_TV2_22 | F06 | Bỏ chọn dịch vụ trên PDP trước MUA NGAY phải bỏ phí dịch vụ cũ', async ({ page }) => {
    const { product } = await withWarranty(page);
    await addCurrent(page); await openCart(page, 1);
    await productPage(page, product.url); await choose(page, 'Đen');
    // Thực hiện chọn rồi bỏ chọn rõ ràng, không suy diễn ý định từ mặc định.
    if (await warrantyButton(page).getAttribute('aria-pressed') !== 'true') await warrantyButton(page).click();
    await warrantyButton(page).click(); await expect(warrantyButton(page)).toHaveAttribute('aria-pressed', 'false');
    await startProbe(page, 'Người dùng chủ động bỏ chọn dịch vụ rồi MUA NGAY: checkout không tự thêm phí gói cũ trong giỏ.');
    await enterBuyNow(page);
    await verify(page, 'Tôn trọng thao tác bỏ chọn dịch vụ cuối cùng', await checkoutAmount(page), product.price);
  });

  test('ASM09_TV2_23 | F06 | MUA NGAY lần hai không nhân đôi gói dịch vụ cho một máy', async ({ page }) => {
    const { product, warranty } = await withWarranty(page); await enterBuyNow(page);
    await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(cards(page).first()).toBeVisible();
    await choose(page, 'Đen');
    if (await warrantyButton(page).getAttribute('aria-pressed') !== 'true') await warrantyButton(page).click();
    await startProbe(page, 'Quay lại và MUA NGAY cùng máy/gói một lần nữa: mua ngay vẫn x1 và đúng một gói dịch vụ.');
    await enterBuyNow(page);
    const server = await ownCart(page);
    await verify(page, 'MUA NGAY không nhân đôi số gói ở server', server[0].accessories.filter(a => a.type === 'WARRANTY').reduce((n, a) => n + a.quantity, 0), 1);
    await verify(page, 'Báo giá lần hai không bị tăng ngoài lựa chọn', await checkoutAmount(page), product.price + warranty.price);
  });

  test('ASM09_TV2_24 | F06 | Mua từ giỏ nhiều máy kèm dịch vụ phải bảo toàn tổng trước checkout', async ({ page }) => {
    await withWarranty(page); await addCurrent(page); await openCart(page, 1); await updateQuantity(page, 'Đen', 2);
    const before = await amount(page);
    await startProbe(page, 'MUA NGAY từ giỏ hai máy và gói dịch vụ: tổng checkout phải đúng tổng giỏ, không mất dòng hoặc áp lại giảm giá.');
    await main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 45_000 }); await expect(checkoutRows(page).first()).toBeVisible();
    await verify(page, 'Tổng tiền nhất quán giữa giỏ và checkout', await checkoutAmount(page), before);
  });

  test('ASM09_TV2_25 | F06 | Chọn SKU khác trong giỏ sau MUA NGAY phải mua đúng lựa chọn mới', async ({ page }) => {
    await add(page, 'Bạc'); await choose(page, 'Titan Đen'); await enterBuyNow(page);
    await page.getByRole('link', { name: 'Giỏ hàng', exact: true }).filter({ visible: true }).click();
    await expect(rows(page)).toHaveCount(2, { timeout: TIMEOUT });
    await setSelected(rowFor(page, 'Titan Đen'), false); await setSelected(rowFor(page, 'Bạc'), true);
    const server = await ownCart(page); const silver = server.find(i => i.productSku.includes('TitanBac'))!;
    await startProbe(page, 'Sau một lượt MUA NGAY Titan Đen, bỏ chọn Đen/chọn Bạc ở giỏ; checkout phải theo Bạc đang chọn trên UI.');
    await verify(page, 'Fixture UI chỉ chọn Bạc trước khi chuyển checkout', (await cartSnapshot(page)).filter(i => i.selected).map(i => i.sku), [silver.productSku]);
    await main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 45_000 }); await expect(checkoutRows(page).first()).toBeVisible();
    await verify(page, 'Lựa chọn MUA NGAY cũ không được ghi đè SKU mới chọn trong giỏ', (await checkoutSnapshot(page)).map(i => i.sku), [silver.productSku]);
  });

  test('ASM09_TV2_26 | F06 | Vào checkout từ tab giỏ cũ phải đọc số lượng mới của server', async ({ page, context }) => {
    await add(page, 'Titan Đen'); await openCart(page, 1);
    const other = await context.newPage(); await openCart(other, 1); await updateQuantity(other, 'Titan Đen', 2);
    await page.bringToFront();
    await startProbe(page, 'Tab B đã lưu x2. Tab A bấm MUA NGAY từ giỏ cũ phải đối chiếu server trước khi hiển thị tiền thanh toán.');
    await main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 45_000 }); await expect(checkoutRows(page).first()).toBeVisible();
    const server = await ownCart(page);
    await verify(page, 'Checkout không lấy số lượng cache cũ sau cập nhật từ tab khác', (await checkoutSnapshot(page)).map(i => i.quantity), [server[0].quantity]);
  });

  test('ASM09_TV2_27 | F06 | Không chuyển checkout với số lượng cũ khi cập nhật đang gửi qua mạng chậm', async ({ page, context }) => {
    await add(page, 'Titan Đen'); await openCart(page, 1);
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    // Mô phỏng độ trễ thật của kết nối di động; không thay nội dung/status API.
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 900, downloadThroughput: 200_000, uploadThroughput: 100_000 });
    try {
      await startProbe(page, 'Khi tăng lên x2 trên mạng chậm rồi bấm mua ngay, checkout chờ cập nhật hoặc hiển thị đúng x2.');
      await plus(rowFor(page, 'Titan Đen')).click();
      await expect(quantity(rowFor(page, 'Titan Đen'))).toHaveText('2');
      await main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).click();
      await expect(page).toHaveURL(/\/checkout$/, { timeout: 45_000 }); await expect(checkoutRows(page).first()).toBeVisible({ timeout: TIMEOUT });
      await expect.poll(() => runFor(page).activeWrites, { timeout: TIMEOUT }).toBe(0);
      await verify(page, 'Lượt tăng đã hiển thị không bị mất khi chuyển luồng', (await checkoutSnapshot(page)).map(i => i.quantity), [2]);
      record(page, 'Server sau chuyển checkout', await ownCart(page));
    } finally {
      await session.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await session.detach();
    }
  });

  test('ASM09_TV2_28 | F05 | Giỏ phải khôi phục trạng thái xác nhận sau mất mạng lúc tăng số lượng', async ({ page, context }) => {
    await add(page, 'Titan Đen'); await openCart(page, 1);
    await startProbe(page, 'Mất mạng khi tăng số lượng, sau kết nối lại UI phải khôi phục giỏ server hoặc có thao tác thử lại rõ ràng.');
    await context.setOffline(true);
    try {
      await plus(rowFor(page, 'Titan Đen')).click();
      await expect.poll(() => runFor(page).activeWrites).toBe(0);
    } finally { await context.setOffline(false); }
    await expect.poll(() => Date.now() - runFor(page).lastCartEvent).toBeGreaterThan(1500);
    const server = await ownCart(page);
    runFor(page).phase = 'assertion';
    await expect.poll(async () => {
      const actual = await cartSnapshot(page);
      const recovery = await main(page).getByRole('button', { name: /thử lại|tải lại|kết nối lại/i }).filter({ visible: true }).count();
      record(page, 'UI trong thời gian khôi phục online', { actual, recovery });
      return actual.length === 1 && actual[0].quantity === server[0].quantity || recovery > 0;
    }, { timeout: 15_000, message: 'DEFECT CANDIDATE: Sau 15 giây online vẫn không khôi phục SL server hoặc có đường thử lại' }).toBe(true);
    runFor(page).phase = 'probe';
  });

  test('ASM09_TV2_29 | F04 | Gallery phải khớp ảnh SKU sau đổi màu và Back dung lượng', async ({ page }) => {
    await productPage(page, IPHONE17); const black = await choose(page, 'Đen');
    const white = await choose(page, 'Trắng');
    await startProbe(page, 'Sau đổi màu, ảnh sản phẩm chính phải dùng bộ ảnh của SKU hiện tại, không giữ màu cũ.');
    const images = await main(page).locator('img').evaluateAll(es => es.filter(e => e.getBoundingClientRect().width >= 250 && e.getBoundingClientRect().height >= 200).map(e => new URL(e.currentSrc || e.src).pathname));
    record(page, 'Ảnh lớn sau đổi màu', { black, white, images });
    const product = (await (await page.request.get(`${ORIGIN}/api/fe/products?slug=dien-thoai%2Fiphone-17-256gb`)).json()).data;
    const variant = product.variants.find((v: { sku: string }) => v.sku === white.sku);
    const expectedPaths = variant.images.map((i: { imageUrl: string }) => imagePath(i.imageUrl.startsWith('http') ? i.imageUrl : `https://cdn-v2.didongviet.vn/${i.imageUrl.replace(/^\//, '')}`));
    if (!expectedPaths.length) return blocked(page, 'SKU không công bố ảnh riêng, gallery chung là hợp lệ.');
    await verify(page, 'Gallery lớn có ảnh của màu đang chọn', images.some(p => expectedPaths.includes(p)), true);
  });

  test('ASM09_TV2_30 | F05 | Gộp SKU trùng không được vượt tồn kho chung của cùng biến thể', async ({ page }) => {
    await add(page, 'Bạc'); await openCart(page, 1);
    expect(Number(await quantity(rowFor(page, 'Bạc')).innerText()), 'SETUP: Bạc x1 theo DDV-GIANG-01 trong Excel').toBe(1);
    if (await plus(rowFor(page, 'Bạc')).isEnabled()) return blocked(page, 'Excel yêu cầu Bạc bị khóa tại x1; hiện nút + chưa khóa nên không đủ tiền điều kiện.');
    const cap = Number(await quantity(rowFor(page, 'Bạc')).innerText());
    await add(page, 'Titan Đen'); await openCart(page, 2);
    await startProbe(page, 'Bạc x1 đã bị khóa tăng. Đổi Titan Đen x1 sang Bạc không được tạo tổng Bạc x2 vượt giới hạn mua 1 vừa quan sát.');
    await changeCartColor(page, 'Titan Đen', 'Bạc'); await openCart(page);
    const server = await ownCart(page);
    const total = server.filter(i => i.productSku.includes('TitanBac')).reduce((n, i) => n + i.quantity, 0);
    record(page, 'Tổng tồn kho theo SKU sau đổi', { cap, total, server });
    await verify(page, 'Giới hạn tồn kho phải áp cho tổng cùng SKU, không chỉ từng dòng', total <= cap, true);
  });

  test('ASM09_TV2_31 | F05 | DDV-GIANG-05 nhấn tăng ở tab cũ không được làm giảm số lượng đã lưu', async ({ page, context }) => {
    await add(page, 'Titan Đen'); await openCart(page, 1);
    const old = await context.newPage(); await openCart(old, 1);
    await page.bringToFront(); await updateQuantity(page, 'Titan Đen', 3);
    const before = await ownCart(page);
    expect(before[0].quantity, 'SETUP: server đã lưu ba máy hợp lệ').toBe(3);
    record(page, 'Trước thao tác ở tab cũ', { tabA: await cartSnapshot(page), tabB: await cartSnapshot(old), server: before });
    await test.info().attach('ASM09_tabA_quantity3.png', { body: await page.screenshot(), contentType: 'image/png' });
    await old.bringToFront();
    expect(Number(await quantity(rowFor(old, 'Titan Đen')).innerText()), 'SETUP: tab B còn số lượng cũ').toBe(1);
    await startProbe(old, 'Tab A đã lưu Titan Đen x3; tab B còn x1. Nhấn Tăng ở B phải đồng bộ hoặc báo xung đột/giới hạn, không được ghi đè từ ba xuống hai máy.');
    await plus(rowFor(old, 'Titan Đen')).click();
    await expect.poll(() => runFor(old).activeWrites, { timeout: TIMEOUT }).toBe(0);
    await expect.poll(() => Date.now() - runFor(old).lastCartEvent, { timeout: TIMEOUT }).toBeGreaterThan(1000);
    await openCart(old, 1); const after = await ownCart(old);
    record(old, 'Sau khi nhấn Tăng ở tab B và tải lại', { before, after, tabB: await cartSnapshot(old) });
    await verify(old, 'Nhấn Tăng không được làm giảm số lượng thực đã lưu', after[0].quantity >= before[0].quantity, true);
  });

  test('ASM09_TV2_32 | F04 | DDV-GIANG-06 chọn màu Hồng phải cập nhật ảnh xem trước điện thoại', async ({ page }) => {
    await accessible(page, `${ORIGIN}/dien-thoai/oppo-a6-256gb.html`);
    await expect(main(page).getByRole('heading', { level: 1, name: /OPPO A6 256GB/ })).toBeVisible();
    const blue = main(page).getByRole('button', { name: /^Xanh\s+\d/ });
    const pink = main(page).getByRole('button', { name: /^Hồng\s+\d/ });
    await expect(blue).toBeVisible(); await hydrated(blue); await blue.click();
    await expect(blue).toHaveAttribute('aria-pressed', 'true');
    const hero = main(page).locator('img').filter({ visible: true }).first();
    const blueImage = await hero.getAttribute('src');
    await test.info().attach('ASM09_blue_preview.png', { body: await page.screenshot(), contentType: 'image/png' });
    await pink.click(); await expect(pink).toHaveAttribute('aria-pressed', 'true');
    await expect(blue).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => new URL(page.url()).searchParams.get('sku')).toBe('CMH280OP375-PK-DDVNew');
    const pinkThumbnail = imagePath((await pink.locator('img').getAttribute('src'))!);
    expect(pinkThumbnail, 'SETUP: ô chọn có ảnh riêng màu Hồng của fixture').toContain('oppo-a6-hong');
    // Chờ cập nhật giao diện bình thường; không chặn/sửa response hoặc DOM.
    await expect.poll(() => hero.getAttribute('src'), { timeout: 8000 }).not.toBe(blueImage)
      .catch(() => record(page, 'Chờ đổi ảnh', 'Sau tám giây ảnh chính vẫn như khi chọn Xanh.'));
    await startProbe(page, 'Chọn Hồng phải xem trước đúng màu Hồng, nhất quán với ảnh riêng trong ô màu và SKU Hồng trên URL. Không giữ duy nhất ảnh màu Xanh của lựa chọn trước.');
    const actualImage = imagePath((await hero.getAttribute('src'))!);
    record(page, 'Ảnh sau chọn Hồng', { url: page.url(), blueImage, pinkThumbnail, actualImage,
      selected: await pink.getAttribute('aria-pressed'), imageLoaded: await hero.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0) });
    await test.info().attach('ASM09_pink_selection_blue_preview.png', { body: await page.screenshot(), contentType: 'image/png' });
    await verify(page, 'Ảnh chính phải đổi sang màu Hồng đang chọn', actualImage.includes('oppo-a6-hong'), true);
  });

  test('ASM09_TV2_33 | F06 | Nút MUA NGAY sticky trên mobile phải dùng SKU và giá cuối', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await productPage(page, IPHONE17); await choose(page, 'Đen'); const target = await choose(page, 'Trắng');
    await main(page).getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
    const sticky = page.locator('[data-sticky="bottom-stack"]').getByRole('button', { name: /^MUA NGAY$/i }).filter({ visible: true });
    if (await sticky.count() !== 1) return blocked(page, 'Viewport hiện tại không có duy nhất CTA sticky khả dụng; không đoán nút desktop thành mobile.');
    await startProbe(page, 'Mobile: đã chọn Trắng đắt hơn Đen; nhấn CTA sticky phải mua Trắng và giá Trắng.');
    await sticky.click(); await expect(page).toHaveURL(/\/checkout$/, { timeout: 45_000 }); await expect(checkoutRows(page).first()).toBeVisible();
    await verify(page, 'Sticky CTA không giữ SKU cũ', (await checkoutSnapshot(page)).map(i => i.sku), [target.sku]);
    await verify(page, 'Sticky CTA không giữ giá màu cũ', await checkoutAmount(page), target.price);
  });

  test('ASM09_TV2_34 | F04 | Đổi bố cục desktop sang mobile không làm mất SKU đã chọn', async ({ page }) => {
    await productPage(page, IPHONE17); const before = await choose(page, 'Trắng');
    await startProbe(page, 'Thay đổi kích thước cửa sổ sau chọn màu phải giữ cấu hình, giá và ảnh của SKU.');
    await page.setViewportSize({ width: 375, height: 667 });
    await verify(page, 'Chuyển bố cục không reset SKU', await productSnapshot(page), before);
    await page.setViewportSize({ width: 1440, height: 900 });
    await verify(page, 'Quay lại desktop không khôi phục màu cũ', await productSnapshot(page), before);
  });

  test('ASM09_TV2_35 | F05 | Điều khiển SL của dòng cuối ở mobile phải thao tác được và tính đúng', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await add(page, 'Titan Đen'); const silver = await add(page, 'Bạc'); await openCart(page, 2);
    const last = rows(page).last(); const color = await last.locator('button[aria-haspopup="dialog"]').innerText();
    await startProbe(page, 'Ở mobile màn hình nhỏ, thanh tổng tiền không được che kín điều khiển dòng cuối; tăng một máy phải được server lưu.');
    await last.scrollIntoViewIfNeeded();
    await updateQuantity(page, color.trim(), 2);
    const server = await ownCart(page);
    await verify(page, 'Dòng cuối tăng đúng một máy trên mobile', server.find(i => i.productSku.includes(color.includes('Bạc') ? 'TitanBac' : 'TitanDen'))?.quantity, 2);
    await verify(page, 'Tổng mobile cập nhật đúng ba máy', await amount(page), silver.price * 3);
  });

  test('ASM09_TV2_36 | F06 | Lỗi mạng khi MUA NGAY phải cho thử lại và không tự nhân đôi máy', async ({ page, context }) => {
    await productPage(page); const product = await choose(page, 'Titan Đen');
    await startProbe(page, 'Mất mạng đúng lúc MUA NGAY: báo lỗi/khôi phục nút; sau online mua lại đúng một máy.');
    await context.setOffline(true);
    try {
      await buyNow(page).click();
      await expect.poll(() => runFor(page).activeWrites).toBe(0);
    } finally { await context.setOffline(false); }
    await expect(buyNow(page)).toBeEnabled({ timeout: TIMEOUT });
    await enterBuyNow(page);
    await verify(page, 'Thử lại MUA NGAY không tạo máy thừa', (await checkoutSnapshot(page)).map(i => ({ sku: i.sku, quantity: i.quantity })), [{ sku: product.sku, quantity: 1 }]);
  });

  test('ASM09_TV2_37 | F06 | Checkout không làm mất gói dịch vụ khi hợp nhất các dòng cùng SKU', async ({ page }) => {
    // iPhone 17 256GB đang flash sale giới hạn một máy. Dùng Pro Max/Bạc và xác minh
    // bằng UI rằng hai máy hợp lệ, không tận dụng lỗi vượt giới hạn để tạo fixture.
    await withWarranty(page, 'Bạc', IPHONE17_PROMAX); await addCurrent(page); await openCart(page, 1);
    await updateQuantity(page, 'Bạc', 2);
    record(page, 'Tiền điều kiện hai máy cùng SKU được UI chấp nhận', { cart: await cartSnapshot(page), server: await ownCart(page) });
    await updateQuantity(page, 'Bạc', 1);
    await withWarranty(page, 'Cam Vũ Trụ', IPHONE17_PROMAX); await addCurrent(page); await openCart(page, 2);
    await changeCartColor(page, 'Cam Vũ Trụ', 'Bạc'); await openCart(page, 2);
    let server = await ownCart(page);
    let serviceCount = server.reduce((n, item) => n + item.accessories.filter(a => a.type === 'WARRANTY').reduce((m, a) => m + a.quantity, 0), 0);
    if (serviceCount < 2) {
      // Đổi màu có thể xóa dịch vụ của dòng vừa đổi; chọn lại qua UI thật
      // trước khi đánh giá việc hợp nhất dữ liệu tại checkout.
      const select = main(page).getByRole('button', { name: 'Chọn gói', exact: true });
      await expect(select).toHaveCount(1); await select.click();
      const dialog = page.getByRole('dialog');
      const option = dialog.getByRole('button', { name: /^D\.TradePlus/ });
      await expect(option).toBeVisible(); await option.click();
      await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(dialog).toBeHidden(); await openCart(page, 2);
      server = await ownCart(page);
      serviceCount = server.reduce((n, item) => n + item.accessories.filter(a => a.type === 'WARRANTY').reduce((m, a) => m + a.quantity, 0), 0);
    }
    expect(serviceCount, 'SETUP: hai máy, mỗi máy đã chọn một gói').toBe(2);
    const before = await amount(page);
    await startProbe(page, 'Hai dòng cùng SKU, mỗi dòng có một gói dịch vụ. Nếu checkout gộp máy, vẫn phải giữ cả hai gói và nguyên tổng tiền.');
    record(page, 'Giá và dịch vụ trước checkout', { before, serviceCount, server });
    await main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 45_000 }); await expect(checkoutRows(page).first()).toBeVisible();
    await verify(page, 'Hợp nhất dòng máy không được bỏ mất dịch vụ đã chọn của dòng khác', await checkoutAmount(page), before);
  });

  test('ASM09_TV2_38 | F05 | DDV-GIANG-08 xóa SKU ở tab giỏ phải mở lại nút thêm tại tab sản phẩm', async ({ page, context }) => {
    await add(page, 'Bạc');
    const control = buyNow(page).locator('..').getByRole('button').last();
    await expect(control).toHaveAttribute('aria-label', 'Sản phẩm flash sale đã có trong giỏ');
    await expect(control).toBeDisabled();
    const other = await context.newPage(); await openCart(other, 1); await remove(other, 'Bạc');
    await expect(rows(other)).toHaveCount(0);
    const empty = await ownCart(other); expect(empty, 'SETUP: giỏ đã xóa thành công ở server').toHaveLength(0);
    await test.info().attach('ASM09_tabB_empty_cart.png', { body: await other.screenshot(), contentType: 'image/png' });
    await page.bringToFront();
    await startProbe(page, 'Giỏ đã xóa S25 Ultra/Bạc ở tab B. Khi quay lại tab sản phẩm A, nút thêm phải đồng bộ với giỏ trống để cho thêm lại cùng SKU.');
    await expect(control).toBeEnabled({ timeout: 15_000 })
      .catch(() => record(page, 'Chờ đồng bộ nút thêm', 'Sau 15 giây tab sản phẩm vẫn khóa vì trạng thái giỏ cũ.'));
    const remainedDisabled = await control.isDisabled();
    record(page, 'Trạng thái khóa sau khi server đã xóa', { empty, remainedDisabled, label: await control.getAttribute('aria-label'), url: page.url() });
    await test.info().attach('ASM09_stale_disabled_add.png', { body: await page.screenshot(), contentType: 'image/png' });
    // Đối chứng cùng phiên/SKU: tải lại trang làm nút mở và thêm lại thành công.
    await productPage(page, page.url()); await choose(page, 'Bạc');
    await expect(addButton(page)).toBeEnabled(); await addCurrent(page);
    const recovered = await ownCart(page);
    expect(recovered).toHaveLength(1); expect(recovered[0].quantity).toBe(1);
    record(page, 'Đối chứng sau tải lại và thêm lại', { recovered, selectedSku: new URL(page.url()).searchParams.get('sku') });
    await test.info().attach('ASM09_after_refresh_add_succeeds.png', { body: await page.screenshot(), contentType: 'image/png' });
    await verify(page, 'Giỏ đã trống không được giữ khóa thêm của SKU cũ', remainedDisabled, false);
  });

  test('ASM09_TV2_40 | F05 | Thêm cùng máy và dịch vụ hai lần phải tính đủ số gói', async ({ page }) => {
    const {product,warranty} = await withWarranty(page, 'Đen'); await addCurrent(page);
    await withWarranty(page, 'Đen'); await addCurrent(page); await openCart(page, 1);
    const server=await ownCart(page); const before=await amount(page);
    record(page, 'Hai lần thêm cùng gói', {server,before,warranty,product});
    const serviceCount=server.reduce((n,i)=>n+i.accessories.filter(a=>a.type==='WARRANTY').reduce((m,a)=>m+a.quantity,0),0);
    await startProbe(page, 'Tổng giỏ phải tính đủ mọi gói đã lưu, và giảm máy không giữ số gói vượt số máy.');
    await verify(page, 'Giá giỏ có đủ mọi gói đã chọn', before, product.price*2+warranty.price*serviceCount);
    await updateQuantity(page,'Đen',1); const after=await ownCart(page);
    const remaining=after.reduce((n,i)=>n+i.accessories.filter(a=>a.type==='WARRANTY').reduce((m,a)=>m+a.quantity,0),0);
    await verify(page, 'Sau giảm chỉ còn một máy, số gói không được vượt một', remaining<=1, true);
  });

  test('ASM09_TV2_41 | F05 | Đổi màu phải đồng bộ gói dịch vụ và tổng không cần refresh', async ({ page }) => {
    await withWarranty(page, 'Đen'); await addCurrent(page); await openCart(page,1);
    await startProbe(page,'Sau đổi màu, gói và tổng hiển thị phải đúng với giỏ đã lưu.');
    await changeCartColor(page,'Đen','Trắng');
    await expect.poll(()=>Date.now()-runFor(page).lastCartEvent).toBeGreaterThan(1000);
    const server=await ownCart(page); const services=server[0].accessories.filter(a=>a.type==='WARRANTY');
    record(page,'Sau đổi màu không reload',{server,text:await main(page).innerText()});
    await verify(page,'Gói hiển thị khớp server',await main(page).getByText('Đã chọn gói bảo hành mở rộng',{exact:true}).count(),services.length);
    await verify(page,'Tổng không giữ phí gói đã xóa',await amount(page),Number(server[0].price)+services.reduce((n,a)=>n+Number(a.price)*a.quantity,0));
  });
  test('ASM09_TV2_42 | F05 | Bỏ chọn máy có gói không được tính phí gói vào tổng', async ({ page }) => {
    await withWarranty(page,'Đen');await addCurrent(page);const white=await add(page,'Trắng',IPHONE17);await openCart(page,2);
    await startProbe(page,'Bỏ chọn cả máy có dịch vụ phải bỏ cả phí gói khỏi tổng mua.');
    await setSelected(rowFor(page,'Đen'),false);
    await verify(page,'Không tính phí gói máy bỏ chọn',await amount(page),white.price);
    await main(page).getByRole('button',{name:/^MUA NGAY \(\d+\)$/}).filter({visible:true}).click();
    await expect(page).toHaveURL(/\/checkout$/,{timeout:45000});await expect(checkoutRows(page).first()).toBeVisible();
    await verify(page,'Checkout không mua gói của máy bỏ chọn',await checkoutAmount(page),white.price);
  });
  test('ASM09_TV2_43 | F05 | Hủy xóa gói bảo hành phải giữ nguyên lựa chọn', async ({ page }) => {
    const {product,warranty}=await withWarranty(page,'Đen');await addCurrent(page);await openCart(page,1);
    await main(page).getByRole('button',{name:'Thay đổi',exact:true}).click();
    const d=page.getByRole('dialog');await expect(d).toBeVisible();const o=d.getByRole('button',{name:/^D.TradePlus/});await o.click();
    await d.getByRole('button').first().click();
    await main(page).getByRole('button',{name:'Thay đổi',exact:true}).click();await expect(d).toBeVisible();
    await startProbe(page,'Đóng hộp thoại chưa xác nhận không làm thay đổi gói hiện tại hoặc draft khi mở lại.');
    await verify(page,'Mở lại phải chọn gói đã lưu',await o.getAttribute('aria-pressed'),'true');
    await d.getByRole('button',{name:'Xác nhận',exact:true}).click();await expect(d).toBeHidden();await openCart(page,1);
    await verify(page,'Không mất gói sau hủy',await amount(page),product.price+warranty.price);
  });

  test('ASM09_TV2_45 | F05 | Đổi màu cùng model không được âm thầm xóa gói dịch vụ còn áp dụng', async ({ page }) => {
    const { warranty } = await withWarranty(page, 'Đen');
    await addCurrent(page); await openCart(page, 1);
    const before = await ownCart(page);
    const original = before[0].accessories.filter(a => a.type === 'WARRANTY');
    expect(original).toHaveLength(1);
    await startProbe(page, 'Chỉ đổi màu Đen sang Trắng của cùng iPhone 17 256GB: giữ gói D.TradePlus vẫn áp dụng, hoặc hỏi xác nhận trước khi xóa lựa chọn dịch vụ.');
    await changeCartColor(page, 'Đen', 'Trắng');
    await expect.poll(() => Date.now() - runFor(page).lastCartEvent).toBeGreaterThan(1000);
    const after = await ownCart(page);
    const remaining = after[0].accessories.filter(a => a.type === 'WARRANTY');
    record(page, 'Lựa chọn dịch vụ trước/sau khi chỉ đổi màu', { before, after, warranty,
      cartText: await main(page).innerText() });
    await test.info().attach('ASM09_lost_service.png', { body: await page.screenshot(), contentType: 'image/png' });
    // Kiểm tra bằng UI rằng chính gói vừa mất vẫn có thể chọn cho màu mới.
    if (remaining.length === 0) {
      await main(page).getByRole('button', { name: 'Chọn gói', exact: true }).click();
      const dialog = page.getByRole('dialog');
      const option = dialog.getByRole('button', { name: /^D\.TradePlus/ });
      await expect(option).toBeVisible(); await expect(option).toBeEnabled();
      record(page, 'Gói vẫn được cung cấp cho màu Trắng', await option.innerText());
      await test.info().attach('ASM09_service_still_available.png', { body: await page.screenshot(), contentType: 'image/png' });
      await dialog.getByRole('button').first().click();
      await expect(dialog).toBeHidden();
    }
    await verify(page, 'Đổi màu không làm mất gói còn áp dụng mà chưa hỏi xác nhận', remaining.length, original.length);
  });

  test('ASM09_TV2_46 | F06 | Chỉ mua một dòng trong hai dòng cùng SKU phải giữ đúng số lượng đã chọn', async ({ page }) => {
    await add(page, 'Titan Đen'); const silver = await add(page, 'Bạc');
    await openCart(page, 2); await changeCartColor(page, 'Titan Đen', 'Bạc'); await openCart(page, 2);
    await startProbe(page, 'Hai dòng Bạc x1; bỏ chọn dòng đầu, checkout chỉ được mua một máy của dòng còn chọn.');
    await setSelected(rows(page).nth(0), false);
    record(page, 'Lựa chọn ngay trước mua', await cartSnapshot(page));
    await test.info().attach('ASM09_selected_one.png', { body: await page.screenshot(), contentType: 'image/png' });
    expect((await cartSnapshot(page)).filter(r => r.selected)).toHaveLength(1);
    await verify(page, 'Giỏ chỉ tính tiền dòng được chọn', await amount(page), silver.price);
    await main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true }).click();
    const outcome = async () => {
      if (await checkoutRows(page).first().isVisible()) return 'checkout';
      if (new URL(page.url()).pathname === '/cart' && await rows(page).count() === 2 &&
          (await cartSnapshot(page)).every(r => !r.selected)) return 'returned-to-cart';
      return 'loading';
    };
    await expect.poll(outcome, { timeout: TIMEOUT, message: 'SETUP: chờ kết quả mua một dòng cùng SKU ổn định' }).not.toBe('loading');
    record(page, 'Kết quả mua dòng được chọn', { outcome: await outcome(), url: page.url(), cart: await cartSnapshot(page), server: await ownCart(page) });
    await verify(page, 'Một dòng hợp lệ đã chọn phải vào checkout thay vì quay về giỏ và mất lựa chọn', await outcome(), 'checkout');
    await verify(page, 'Không gộp số lượng của dòng cùng SKU đã bỏ chọn', (await checkoutSnapshot(page)).reduce((n, r) => n + r.quantity, 0), 1);
    await verify(page, 'Checkout không thu tiền dòng đã bỏ chọn', await checkoutAmount(page), silver.price);
  });

  test('ASM09_TV2_47 | F05 | Tăng riêng một dòng cùng SKU không được cập nhật nhầm dòng còn lại', async ({ page }) => {
    await add(page, 'Titan Đen'); const silver = await add(page, 'Bạc');
    await openCart(page, 2); await changeCartColor(page, 'Titan Đen', 'Bạc'); await openCart(page, 2);
    await startProbe(page, 'Hai dòng Bạc x1: tăng riêng dòng đầu lên 2. UI và server phải cùng có số lượng 2 và 1, tổng ba máy.');
    const response = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/fe/carts/items/quantity');
    await plus(rows(page).nth(0)).click(); const changed = await response;
    if (!changed.ok()) return blocked(page, 'Không đủ giới hạn để tăng tổng Bạc lên 3; không kết luận lỗi cập nhật nhầm dòng.');
    await expect.poll(() => runFor(page).activeWrites).toBe(0);
    await expect.poll(() => Date.now() - runFor(page).lastCartEvent).toBeGreaterThan(1000);
    const server = await ownCart(page); const actual = await cartSnapshot(page);
    record(page, 'Hai dòng sau tăng riêng một dòng', { actual, server });
    await verify(page, 'Không cập nhật nhầm dòng cùng SKU', actual.map(i => i.quantity).sort(), [1, 2]);
    await verify(page, 'Tổng đúng ba máy', await amount(page), silver.price * 3);
  });

  test('ASM09_TV2_48 | F05 | Xóa một dòng cùng SKU phải giữ máy còn lại và tổng tiền', async ({ page }) => {
    await add(page, 'Titan Đen'); const silver = await add(page, 'Bạc');
    await openCart(page, 2); await changeCartColor(page, 'Titan Đen', 'Bạc'); await openCart(page, 2);
    await startProbe(page, 'Xóa một trong hai dòng Bạc x1: giỏ phải còn đúng một máy và tính tiền một máy, kể cả sau F5.');
    await rows(page).nth(0).getByRole('button', { name: 'Xóa sản phẩm', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xóa', exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
    await verify(page, 'Giữ đúng máy còn lại sau xóa dòng trùng SKU', (await cartSnapshot(page)).map(r => ({ sku: r.sku, quantity: r.quantity })), [{ sku: silver.sku, quantity: 1 }]);
    await verify(page, 'Tổng đúng máy còn lại', await amount(page), silver.price);
    await openCart(page, 1);
    await verify(page, 'Xóa được lưu đúng sau tải lại', await amount(page), silver.price);
  });

  test('ASM09_TV2_44 | F05 | Xác nhận lại gói hiện tại không được tăng số gói hoặc tổng tiền', async ({ page }) => {
    await withWarranty(page,'Đen');await addCurrent(page);await openCart(page,1);await updateQuantity(page,'Đen',2);
    const before=await amount(page); const initial=await ownCart(page);
    await startProbe(page,'Đã chọn một gói cho dòng máy x2: mở Thay đổi, giữ nguyên gói và Xác nhận không được thêm gói hoặc đổi tổng tiền.');
    await main(page).getByRole('button',{name:'Thay đổi',exact:true}).click();const d=page.getByRole('dialog');
    await expect(d.getByRole('button',{name:/^D.TradePlus/})).toHaveAttribute('aria-pressed','true');
    await d.getByRole('button',{name:'Xác nhận',exact:true}).click();await expect(d).toBeHidden();
    await expect.poll(()=>Date.now()-runFor(page).lastCartEvent).toBeGreaterThan(1500);await openCart(page,1);
    const server=await ownCart(page); const after=await amount(page);
    record(page,'Giữ nguyên gói và xác nhận',{before,after,initial,server});
    await verify(page,'Giữ nguyên gói không đổi tổng tiền',after,before);
    await main(page).getByRole('button',{name:/^MUA NGAY \(\d+\)$/}).filter({visible:true}).click();
    await expect(page).toHaveURL(/\/checkout$/,{timeout:45000});await expect(checkoutRows(page).first()).toBeVisible();
    record(page,'Checkout sau xác nhận lại',{amount:await checkoutAmount(page),checkout:await checkoutSnapshot(page)});
    await verify(page,'Checkout không thêm phí khi giữ nguyên gói',await checkoutAmount(page),before);
    await verify(page,'Không tăng số gói đã lưu',server[0].accessories.filter(a=>a.type==='WARRANTY').reduce((n,a)=>n+a.quantity,0),1);
  });
});
