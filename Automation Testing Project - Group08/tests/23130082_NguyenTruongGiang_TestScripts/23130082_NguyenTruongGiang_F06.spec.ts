import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Group08 - Nguyen Truong Giang (23130082)
 * ASM7 / F06 / D06 - 30 TEST CASES from ASM06.
 * Source: docs/individual/Group08_23130082_NguyenTruongGiang.xlsx, F06 - Buy Now.
 * Bắt đầu từ Samsung Galaxy S25 Ultra 256GB; mua thường bằng MUA NGAY.
 * Mỗi ca dùng context sạch; không nhập thông tin khách hàng, không xác nhận đơn.
 */
const ORIGIN = 'https://didongviet.vn';
const PRODUCT_PATH = '/dien-thoai/samsung-galaxy-s25-ultra-5g-';
const CAPACITIES = ['256GB', '512GB', '1TB'] as const;
type Capacity = (typeof CAPACITIES)[number];
const COLORS = ['Titan Xanh', 'Titan Đen', 'Bạc', 'Xám Titan', 'Titan Bạc'] as const;
type Color = (typeof COLORS)[number];
const MONEY = /^\d{1,3}(?:[.,]\d{3})+\s*[đ₫]$/;
const SUCCESS = /đặt hàng thành công|thanh toán thành công|đặt hàng hoàn tất|cảm ơn bạn đã đặt hàng/i;
const CHECKOUT_TIMEOUT_MS = 45_000;
interface ProductSnapshot {
  capacity: Capacity; color: Color; title: string; sku: string; url: string;
  sale: number; crossed?: number; imagePath: string; promotions: string;
}
interface RunEvidence { forbidden: string[]; finalClicks: number; addCalls: number; checkoutEntries: number; }
const evidence = new WeakMap<Page, RunEvidence>();

function main(page: Page) { return page.getByRole('main'); }
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parseVnd(value: string) { return Number(value.replace(/\D/g, '')); }
function urlFor(capacity: Capacity = '256GB') { return `${ORIGIN}${PRODUCT_PATH}${capacity.toLowerCase()}.html`; }
function titlePattern(capacity: Capacity) { return new RegExp(`Samsung Galaxy S25 Ultra\\s+(?:5G\\s+)?${capacity}`, 'i'); }
function buyNow(page: Page) { return main(page).getByRole('button', { name: 'MUA NGAY', exact: true }).first(); }
function addButton(page: Page) { return buyNow(page).locator('xpath=..').getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }); }
function colorCards(page: Page) {
  return main(page).getByRole('button', { name: /^(?:Titan Xanh|Titan Đen|Bạc|Xám Titan|Titan Bạc)\s+\d/ });
}
function colorOption(page: Page, color: Color) {
  return main(page).getByRole('button', { name: new RegExp(`^${escapeRegex(color)}\\s+\\d`) });
}
function finalOrder(page: Page) {
  // Chỉ dùng để đọc/assert. Không có helper nào click nút này.
  return main(page).getByRole('button', { name: /^ĐẶT HÀNG\s*\(\d+\)$/ }).filter({ visible: true });
}
function checkoutRows(page: Page) {
  return main(page).locator('div:has(> a > img)').filter({ hasText: /Số lượng:/ });
}
function cartRows(page: Page) {
  return main(page).locator('div:has(> a > img):has(button[aria-label="Tăng số lượng"])');
}
function orderAmount(page: Page, label: string) {
  // Nhãn Tổng tiền còn có ở thanh mobile (kèm Tiết kiệm). Vùng Thông tin
  // đơn hàng có số tiền là span trực tiếp cạnh nhãn, không lấy span giảm giá.
  return main(page).getByText(label, { exact: true }).locator('xpath=..')
    .locator(':scope > span').filter({ hasText: MONEY });
}
async function note(page: Page, message: string) {
  await test.info().attach('F06_observation.txt', {
    body: `${new Date().toISOString()} | ${page.url()}\n${message}\n`, contentType: 'text/plain; charset=utf-8',
  });
}
async function showAction(page: Page, action: string) {
  await test.step(`Thao tác trên web: ${action}`, async () => {
    await test.info().attach(`F06_action_${Date.now()}.png`, {
      body: await page.screenshot({ fullPage: false, mask: [page.locator('input,textarea')] }), contentType: 'image/png',
    });
  });
}
async function captureBlocked(page: Page, reason: string): Promise<never> {
  await note(page, `BLOCKED: ${reason}`);
  await showAction(page, `BLOCKED: ${reason}`);
  test.info().annotations.push({ type: 'BLOCKED', description: reason });
  test.skip(true, `BLOCKED: ${reason}`);
  throw new Error(`BLOCKED: ${reason}`);
}
async function closeCookieNotice(page: Page) {
  const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
  try { await reject.waitFor({ state: 'visible', timeout: 2500 }); }
  catch { return; } // Chỉ cookie là tùy chọn; lỗi thao tác/assertion vẫn Failed.
  await reject.click(); await expect(reject).toBeHidden();
}
async function expectHydrated(control: Locator) {
  // Chờ handler React của nút SSR, chỉ đọc DOM; không sửa state hoặc mô phỏng thành công.
  await expect.poll(() => control.evaluate(element => {
    const props = element as unknown as Record<string, { onClick?: unknown }>;
    return Object.keys(element).some(key => key.startsWith('__reactProps$') && typeof props[key]?.onClick === 'function');
  }), { message: 'Chờ React gắn onClick trước khi thao tác thật' }).toBe(true);
}
async function expectProduct(page: Page, capacity: Capacity) {
  await expect(page).toHaveURL(new RegExp(`${PRODUCT_PATH}${capacity.toLowerCase()}\\.html(?:[?#].*)?$`));
  await expect(main(page).getByRole('heading', { level: 1, name: titlePattern(capacity) })).toBeVisible();
  await expect(colorCards(page)).toHaveCount(4);
}
async function visit(page: Page) {
  const response = await page.goto(urlFor(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  expect(response, 'Phải nhận được HTTP response').not.toBeNull();
  expect(response!.status(), 'Trang Samsung 256GB phải truy cập được').toBeLessThan(400);
  await closeCookieNotice(page); await expectProduct(page, '256GB');
}
async function selectCapacity(page: Page, capacity: Capacity) {
  const versionGroup = main(page).getByText('Phiên bản', { exact: true }).first().locator('xpath=..');
  const option = versionGroup.getByText(capacity, { exact: true });
  await expect(option).toBeVisible();
  if (await option.getAttribute('aria-disabled') === 'true') return captureBlocked(page,
    `Phiên bản ${capacity} hiển thị aria-disabled=true, không có liên kết chọn được; thiếu tiền điều kiện còn hàng của Excel.`);
  const link = versionGroup.getByRole('link', { name: capacity, exact: true });
  await expect(link, `Liên kết ${capacity} trong vùng Phiên bản`).toBeVisible();
  await expect(link).toHaveAttribute('href', new RegExp(`${PRODUCT_PATH}${capacity.toLowerCase()}\\.html$`));
  await link.click(); await expectProduct(page, capacity); await closeCookieNotice(page);
}
async function requireStock(page: Page, capacity: Capacity) {
  const cards = colorCards(page);
  await expect(cards).toHaveCount(4);
  const states = await cards.evaluateAll(elements => elements.map(element => ({
    color: element.textContent?.trim(), disabled: (element as HTMLButtonElement).disabled,
  })));
  if (states.every(state => state.disabled)) return captureBlocked(page,
    `Excel yêu cầu ${capacity} còn hàng. Cả bốn thẻ màu đều disabled: ${JSON.stringify(states)}; không thay dung lượng để ép Passed.`);
}
async function selectColor(page: Page, color: Color, capacity: Capacity = '256GB'): Promise<ProductSnapshot> {
  await expectProduct(page, capacity); await requireStock(page, capacity);
  const option = colorOption(page, color);
  await expect(option, `Đúng thẻ màu ${color}`).toHaveCount(1); await expect(option).toBeVisible();
  if (await option.isDisabled()) return captureBlocked(page, `Màu ${color} của ${capacity} đang disabled/hết hàng theo UI.`);
  await expectHydrated(option); await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
  await expect(colorCards(page).locator('xpath=self::button[@aria-pressed="true"]')).toHaveCount(1);
  await expect(page).toHaveURL(/[?&]sku=[^&]+/);
  const sku = new URL(page.url()).searchParams.get('sku'); expect(sku).toBeTruthy();
  await expect(buyNow(page), 'Nút MUA NGAY của khối mua chính').toBeVisible();
  if (await buyNow(page).isDisabled()) return captureBlocked(page, `SKU ${sku} không cho MUA NGAY (CTA disabled).`);
  await expectHydrated(buyNow(page));
  const body = await main(page).innerText();
  const start = body.indexOf('Màu sắc sản phẩm'); const end = body.indexOf('Hoặc', start);
  expect(start).toBeGreaterThanOrEqual(0); expect(end).toBeGreaterThan(start);
  const prices = [...body.slice(start, end).matchAll(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/g)].map(match => parseVnd(match[0]));
  expect(prices.length, 'Bốn giá màu và giá bán chính').toBeGreaterThanOrEqual(5);
  const sale = prices[4];
  expect(sale).toBe(parseVnd((await option.innerText()).match(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/)![0]));
  const src = await option.locator('img').getAttribute('src'); expect(src).toBeTruthy();
  const result: ProductSnapshot = {
    capacity, color, title: await main(page).getByRole('heading', { level: 1 }).innerText(),
    sku: sku!, url: page.url(), sale, crossed: prices[5], imagePath: new URL(src!, ORIGIN).pathname,
    promotions: body.slice(body.indexOf('Khuyến mãi'), body.indexOf('ƯU ĐÃI THANH TOÁN')),
  };
  await note(page, `Snapshot trước MUA NGAY:\n${JSON.stringify(result, null, 2)}`);
  return result;
}
async function availableColor(page: Page, capacity: Capacity, preferred: Color): Promise<ProductSnapshot> {
  // Chỉ dùng khi Input Excel cho phép "màu ... nếu khả dụng" hoặc "màu có hàng".
  await requireStock(page, capacity);
  const preferredOption = colorOption(page, preferred);
  if (await preferredOption.count() === 1 && await preferredOption.isEnabled()) return selectColor(page, preferred, capacity);
  for (const color of COLORS) {
    const option = colorOption(page, color);
    if (await option.count() === 1 && await option.isEnabled()) {
      await note(page, `Excel cho phép màu khả dụng: ${preferred} không mua được trên ${capacity}; chọn ${color} còn hàng.`);
      return selectColor(page, color, capacity);
    }
  }
  return captureBlocked(page, `Không có màu nào còn hàng trên ${capacity}.`);
}
async function expectCheckoutReady(page: Page) {
  // Chạy từ IDE/root có thể không nạp config ở thư mục con và chỉ chờ mặc
  // định 5 giây. Chờ chuyển trang và nội dung checkout bằng timeout rõ ràng.
  await expect(page, 'Ứng dụng phải tự chuyển sang checkout')
    .toHaveURL(/\/checkout(?:[?#].*)?$/, { timeout: CHECKOUT_TIMEOUT_MS });
  await expect(main(page).getByRole('heading', { name: 'Thanh toán', exact: true }))
    .toBeVisible({ timeout: CHECKOUT_TIMEOUT_MS });
  await expect(finalOrder(page)).toBeVisible({ timeout: CHECKOUT_TIMEOUT_MS });
}
async function openBuyNow(page: Page) {
  const button = buyNow(page);
  const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
  // Cookie có thể xuất hiện muộn hơn lần kiểm tra lúc mở trang.
  if (await reject.isVisible()) {
    await reject.click();
    await expect(reject).toBeHidden();
  }
  await expectHydrated(button);
  await expect(button).toBeEnabled();
  const started = Date.now();
  // MUA NGAY phải đợi POST thêm đúng một máy rồi ứng dụng mới chuyển checkout.
  // Cài listener trước click để không bỏ lỡ response nhanh. Chỉ click một lần,
  // không tự goto checkout hoặc thử lại thao tác mua khi mạng chậm.
  const [response] = await Promise.all([
    page.waitForResponse(result => result.request().method() === 'POST' &&
      new URL(result.url()).pathname === '/api/fe/carts/add', { timeout: CHECKOUT_TIMEOUT_MS }),
    button.click(),
  ]);
  const payload = await response.json() as { success?: boolean; data?: { success?: boolean }; message?: string };
  await test.info().attach('F06_buy_now_response.json', {
    body: JSON.stringify({ path: new URL(response.url()).pathname, status: response.status(),
      success: payload.success, cartSuccess: payload.data?.success, elapsedMs: Date.now() - started }, null, 2),
    contentType: 'application/json',
  });
  expect(response.ok(), `MUA NGAY: API giỏ trả HTTP ${response.status()}`).toBe(true);
  expect(payload.success, `MUA NGAY không được server chấp nhận: ${payload.message ?? 'không có thông báo'}`).toBe(true);
  if (payload.data?.success !== undefined) expect(payload.data.success, 'Server phải thêm giỏ thành công trước khi mua').toBe(true);
  await expectCheckoutReady(page);
}
async function assertSafe(page: Page) {
  expect(evidence.get(page)?.forbidden, 'Không gửi yêu cầu tạo đơn, thanh toán hoặc đăng ký trả góp').toEqual([]);
  expect(evidence.get(page)?.finalClicks, 'Không được click nút xác nhận đơn').toBe(0);
  await expect(main(page).getByText(SUCCESS)).toHaveCount(0);
  expect(new URL(page.url()).pathname).not.toMatch(/order-success|payment-success|thank-you|installment/i);
}
async function assertCheckout(page: Page, product: ProductSnapshot) {
  await expectCheckoutReady(page);
  await expect(checkoutRows(page), 'Chỉ một dòng sản phẩm đang mua').toHaveCount(1);
  const row = checkoutRows(page);
  const title = row.getByRole('link').filter({ hasText: new RegExp(`^${escapeRegex(product.title)}$`) });
  await expect(title).toHaveText(product.title);
  const href = await title.getAttribute('href'); expect(href).toBeTruthy();
  const target = new URL(href!, ORIGIN);
  expect(target.pathname).toBe(new URL(product.url).pathname); expect(target.searchParams.get('sku')).toBe(product.sku);
  await expect(row.getByText(product.color, { exact: true })).toBeVisible();
  await expect(row.getByText(/^Số lượng:\s*1$/), 'MUA NGAY một máy, không nhân đôi').toBeVisible();
  await expect.poll(async () => parseVnd(await row.locator('span.font-semibold.text-primary-500').innerText()),
    { message: 'Đơn giá checkout khớp giá bán đúng SKU trước MUA NGAY' }).toBe(product.sale);
  await expect.poll(async () => new URL((await row.locator('img').getAttribute('src'))!, ORIGIN).pathname,
    { message: 'Ảnh checkout khớp ảnh thẻ màu đã chọn' }).toBe(product.imagePath);
  for (const label of ['Tạm tính', 'Tổng tiền']) {
    const amount = orderAmount(page, label);
    await expect(amount).toHaveCount(1);
    await expect(amount).toBeVisible();
    await expect.poll(async () => parseVnd(await amount.innerText()), { message: `${label} cho một máy, không cộng nhầm giỏ hoặc trừ giảm hai lần` }).toBe(product.sale);
  }
  await expect(finalOrder(page)).toHaveText('ĐẶT HÀNG (1)');
  await expect(page.getByRole('dialog').filter({ hasText: /đăng ký trả góp|hồ sơ trả góp/i })).toHaveCount(0);
  await assertSafe(page);
}
async function openCart(page: Page) {
  await page.getByRole('link', { name: 'Giỏ hàng', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(main(page).getByRole('heading', { name: 'Giỏ hàng của bạn', exact: true })).toBeVisible();
}
async function prepareCart(page: Page, color: Color): Promise<ProductSnapshot> {
  await visit(page); const product = await selectColor(page, color);
  await expect(addButton(page).locator('svg.lucide-shopping-cart')).toHaveCount(1);
  await addButton(page).click();
  await expect(page.getByText('Sản phẩm đã được thêm vào giỏ', { exact: true })).toBeVisible();
  await openCart(page); await expect(cartRows(page)).toHaveCount(1);
  const row = cartRows(page);
  await expect(row.getByRole('button', { name: color, exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Tăng số lượng' }).locator('xpath=../span')).toHaveText('1');
  const link = row.getByRole('link').filter({ hasText: product.title });
  await link.click(); await expectProduct(page, '256GB');
  return product;
}

test.describe('ASM07 | F06 | D06 | 30 test cases from Assignment 6', () => {
  test.describe.configure({ timeout: 150_000 });
  test.beforeEach(async ({ page }) => {
    const run: RunEvidence = { forbidden: [], finalClicks: 0, addCalls: 0, checkoutEntries: 0 };
    evidence.set(page, run);
    // Chặn giao dịch thật nếu ứng dụng có lỗi tự gửi; mọi request bị chặn vẫn
    // làm test Failed qua assertSafe, tuyệt đối không trả response thành công giả.
    await page.route(/\/api\/.*\/(?:orders?|payments?|checkout|installment-applications)(?:\/|\?|$)/i, async route => {
      const request = route.request();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
        run.forbidden.push(`${request.method()} ${new URL(request.url()).pathname}`);
        await route.abort('blockedbyclient');
      } else { await route.continue(); }
    });
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/fe/carts/add') run.addCalls++;
    });
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/checkout') run.checkoutEntries++;
    });
    page.on('console', message => { if (message.text() === '__F06_FINAL_ORDER_CLICK__') run.finalClicks++; });
    await page.addInitScript(() => {
      document.addEventListener('click', event => {
        const button = (event.target as Element | null)?.closest('button');
        if (location.pathname === '/checkout' && /^ĐẶT HÀNG|^Xác nhận đặt hàng/i.test(button?.textContent?.trim() ?? '')) {
          console.log('__F06_FINAL_ORDER_CLICK__');
        }
      }, true);
    });
  });
  test.afterEach(async ({ page }, testInfo) => {
    await assertSafe(page);
    await testInfo.attach('F06_run_metadata.json', {
      body: JSON.stringify({ test: testInfo.title, status: testInfo.status, expectedStatus: testInfo.expectedStatus,
        time: new Date().toISOString(), url: page.url(), annotations: testInfo.annotations, evidence: evidence.get(page) }, null, 2),
      contentType: 'application/json',
    });
    const image = await page.screenshot({ fullPage: false, mask: [page.locator('input,textarea')], timeout: 8000 }).catch(() => null);
    if (image) await testInfo.attach('F06_snapshot.png', { body: image, contentType: 'image/png' });
  });

  /** Expected Output from ASM06 [DDV_F06_001]:
   * 1. Đi đến bước mua hàng có liên quan đúng Galaxy S25 Ultra 256GB Titan Xanh; không tạo đơn thực tế.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Từ trang mới, chọn 256GB và màu Titan Xanh; đảm bảo nút MUA NGAY khả dụng.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Ghi nhận tên, màu, dung lượng rồi bấm MUA NGAY đúng một lần.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_001 - Mở luồng MUA NGAY cho Titan Xanh 256GB', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái CTA', async () => {
      await showAction(page, 'Trước MUA NGAY: SKU và giá hiện hành');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_002]:
   * 1. Không tự chuyển thành màu Titan Xanh/Bạc; màu được chọn phải giữ đúng nếu có phần tóm tắt.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chọn màu Titan Đen, phiên bản 256GB đang bán.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY và đối chiếu màu sản phẩm ở luồng mua.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_002 - Mở luồng MUA NGAY cho Titan Đen 256GB', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Đen');
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái CTA', async () => {
      await showAction(page, 'Trước MUA NGAY: SKU và giá hiện hành');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_003]:
   * 1. Đi đúng luồng mua của màu Bạc, không lấy biến thể khác.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chọn màu Bạc, 256GB đang có thể mua.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY, đối chiếu sản phẩm/màu trên màn hình kế tiếp.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_003 - Mở luồng MUA NGAY cho màu Bạc 256GB', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Bạc');
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái CTA', async () => {
      await showAction(page, 'Trước MUA NGAY: SKU và giá hiện hành');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_004]:
   * 1. Biến thể Xám Titan được bảo toàn; luồng mua hiển thị hợp lệ.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chọn Xám Titan và 256GB; kiểm tra nút đang bật.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY, đọc tên sản phẩm và thông tin được mang sang.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_004 - Mở luồng MUA NGAY cho Xám Titan 256GB', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Xám Titan');
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái CTA', async () => {
      await showAction(page, 'Trước MUA NGAY: SKU và giá hiện hành');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_005]:
   * 1. Nhấn MUA NGAY đưa vào luồng mua, không chỉ hiển thị thông báo thêm giỏ như nút xe đẩy.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Có trang chi tiết với cả nút MUA NGAY và biểu tượng xe đẩy viền đỏ.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Ghi lại hai điều khiển; bấm riêng nút MUA NGAY, quan sát màn hình chuyển đến.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_005 - Nút MUA NGAY và biểu tượng giỏ là hai hành động khác nhau', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở trang có hai điều khiển mua và xe đẩy', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn 256GB Titan Xanh', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Xác minh MUA NGAY và xe đẩy là hai nút khác nhau', async () => {
      await expect(buyNow(page)).toBeVisible();
      await expect(addButton(page)).toBeVisible();
      await expect(addButton(page).locator('svg.lucide-shopping-cart')).toHaveCount(1);
      await expect(buyNow(page)).toHaveText('MUA NGAY');
      await expect(buyNow(page)).not.toHaveAttribute('aria-label', 'Thêm vào giỏ hàng');
      await showAction(page, 'Hai CTA riêng biệt trên khối mua chính');
    });
    await test.step('04 - Chỉ bấm MUA NGAY, không bấm xe đẩy', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Phải tới checkout có SKU, không chỉ hiện toast thêm giỏ', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.checkoutEntries).toBe(1);
      expect(evidence.get(page)!.addCalls).toBe(1);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_006]:
   * 1. Luồng mua sử dụng Titan Đen mới nhất, không giữ màu trước đó.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chọn 256GB Titan Xanh rồi chuyển sang Titan Đen.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Sau khi UI cập nhật xong, nhấn MUA NGAY và so sánh biến thể cuối.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_006 - Đổi Titan Xanh sang Titan Đen trước MUA NGAY', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở trang 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn màu ban đầu rồi đổi sang màu cuối theo Excel', async () => {
      previous = await selectColor(page, 'Titan Xanh');
      product = await selectColor(page, 'Titan Đen');
    });
    await test.step('03 - Xác minh UI cập nhật đúng SKU cuối', async () => {
      expect(product.sku).not.toBe(previous.sku);
      await expect(colorOption(page, previous.color)).toHaveAttribute('aria-pressed', 'false');
      await expect(colorOption(page, product.color)).toHaveAttribute('aria-pressed', 'true');
      await showAction(page, 'Màu cuối đã được chọn duy nhất');
    });
    await test.step('04 - Bấm MUA NGAY sau khi UI cập nhật', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Checkout dùng SKU mới, không giữ dữ liệu màu cũ', async () => {
      await assertCheckout(page, product);
      await expect(checkoutRows(page).getByText(previous.color, { exact: true })).toHaveCount(0);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_007]:
   * 1. Giữ đúng Bạc là màu cuối cùng; không xảy ra dữ liệu cũ.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chọn 256GB Titan Đen rồi chuyển màu Bạc.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Nhấn MUA NGAY và đối chiếu tên/màu trên màn hình kế tiếp.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_007 - Đổi Titan Đen sang màu Bạc trước MUA NGAY', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở trang 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn màu ban đầu rồi đổi sang màu cuối theo Excel', async () => {
      previous = await selectColor(page, 'Titan Đen');
      product = await selectColor(page, 'Bạc');
    });
    await test.step('03 - Xác minh UI cập nhật đúng SKU cuối', async () => {
      expect(product.sku).not.toBe(previous.sku);
      await expect(colorOption(page, previous.color)).toHaveAttribute('aria-pressed', 'false');
      await expect(colorOption(page, product.color)).toHaveAttribute('aria-pressed', 'true');
      await showAction(page, 'Màu cuối đã được chọn duy nhất');
    });
    await test.step('04 - Bấm MUA NGAY sau khi UI cập nhật', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Checkout dùng SKU mới, không giữ dữ liệu màu cũ', async () => {
      await assertCheckout(page, product);
      await expect(checkoutRows(page).getByText(previous.color, { exact: true })).toHaveCount(0);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_008]:
   * 1. Thông tin mua là Xám Titan chứ không phải màu Bạc ban đầu.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Đang ở 256GB Bạc, chuyển sang Xám Titan.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Nhấn MUA NGAY khi giá và biến thể đã tải xong.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_008 - Đổi Bạc sang Xám Titan trước MUA NGAY', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở trang 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn màu ban đầu rồi đổi sang màu cuối theo Excel', async () => {
      previous = await selectColor(page, 'Bạc');
      product = await selectColor(page, 'Xám Titan');
    });
    await test.step('03 - Xác minh UI cập nhật đúng SKU cuối', async () => {
      expect(product.sku).not.toBe(previous.sku);
      await expect(colorOption(page, previous.color)).toHaveAttribute('aria-pressed', 'false');
      await expect(colorOption(page, product.color)).toHaveAttribute('aria-pressed', 'true');
      await showAction(page, 'Màu cuối đã được chọn duy nhất');
    });
    await test.step('04 - Bấm MUA NGAY sau khi UI cập nhật', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Checkout dùng SKU mới, không giữ dữ liệu màu cũ', async () => {
      await assertCheckout(page, product);
      await expect(checkoutRows(page).getByText(previous.color, { exact: true })).toHaveCount(0);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_009]:
   * 1. Luồng mua là 512GB; không tự quay về 256GB. Nếu SKU không mua được thì ghi Blocked.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Trên trang có tùy chọn 512GB; biến thể này còn hàng và có nút MUA NGAY.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Chọn 512GB, ghi tên SKU/giá, sau đó nhấn MUA NGAY.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_009 - Chuyển từ 256GB sang 512GB rồi MUA NGAY', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở trang mẫu 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Xác minh có liên kết 512GB', async () => {
      await expect(main(page).getByText('Phiên bản', { exact: true }).first().locator('xpath=..').getByRole('link', { name: '512GB', exact: true })).toBeVisible();
    });
    await test.step('03 - Ghi SKU và giá của trang nguồn', async () => {
      await selectColor(page, 'Titan Xanh');
    });
    await test.step('04 - Click 512GB, chọn màu khả dụng theo Input Excel rồi MUA NGAY', async () => {
      await selectCapacity(page, '512GB');
      product = await availableColor(page, '512GB', 'Titan Xanh');
      await openBuyNow(page);
    });
    await test.step('05 - Luồng mua giữ 512GB, không quay về 256GB', async () => {
      expect(product.capacity).toBe('512GB');
      await assertCheckout(page, product);
      await expect(checkoutRows(page)).not.toContainText(/256GB/);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_010]:
   * 1. Luồng mua đúng 256GB, không mang thông tin 512GB còn lưu trong phiên.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Đã điều hướng sang bản 512GB còn hàng, sau đó chọn lại 256GB.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY sau khi 256GB xuất hiện ổn định.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_010 - Từ 512GB quay về 256GB trước MUA NGAY', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Click sang 512GB còn hàng và ghi SKU/giá', async () => {
      await selectCapacity(page, '512GB');
      previous = await availableColor(page, '512GB', 'Bạc');
    });
    await test.step('03 - Click quay về 256GB, chọn Bạc theo Excel và ghi thông tin', async () => {
      await selectCapacity(page, '256GB');
      product = await availableColor(page, '256GB', 'Bạc');
      expect(product.sku).not.toBe(previous.sku);
    });
    await test.step('04 - MUA NGAY sau khi 256GB ổn định', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Checkout đúng 256GB, không dùng dữ liệu 512GB', async () => {
      await assertCheckout(page, product);
      await expect(checkoutRows(page)).not.toContainText(/512GB/);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_011]:
   * 1. Nhánh 1TB bị khóa: tùy chọn có aria-disabled=true và con trỏ not-allowed, không có href/liên kết chọn; sau một lần nhấp bình thường, URL, SKU, màu và giá bán 256GB giữ nguyên; không phát sinh request thêm giỏ hoặc điều hướng checkout.
   * 2. Nhánh 1TB khả dụng: có liên kết chọn; sau MUA NGAY, checkout giữ đúng Galaxy S25 Ultra 1TB, SKU/màu đã chọn, số lượng 1 và giá bán hiện hành.
   * 3. Cả hai nhánh: không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hoặc dữ liệu khách hàng thật; dừng trước submit.
   * 4. Chỉ ghi Passed khi tất cả assertion của nhánh thực tế đạt; ghi rõ nhánh đã chạy. Việc đạt nhánh bị khóa không chứng minh đã mua được 1TB còn hàng. Lỗi assertion vẫn Failed; thiếu tiền điều kiện khác vẫn Blocked có lý do.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Xác minh có tùy chọn 1TB và đọc aria-disabled để xác định nhánh kiểm thử thực tế.
   * 3. Chọn Titan Xanh trên 256GB; ghi URL, SKU, màu, giá bán và bộ đếm request thêm giỏ/điều hướng checkout trước thao tác.
   * 4. Nếu 1TB bị khóa: kiểm tra aria-disabled=true, con trỏ not-allowed, không có href và không có liên kết chọn 1TB; nhấp ô 1TB một lần bình thường (không force) để xác minh trang vẫn giữ URL/phiên bản 256GB. Nếu 1TB khả dụng: chọn 1TB, chọn màu còn hàng rồi bấm MUA NGAY đúng một lần.
   * 5. Đối chiếu Expected Output của nhánh đã chạy, lưu rõ nhánh cùng ảnh/bằng chứng; KHÔNG xác nhận đặt hàng hoặc thanh toán.
   */
  test('DDV_F06_011 - Kiểm tra trạng thái 1TB và luồng MUA NGAY theo khả dụng', async ({ page }) => {
    let product!: ProductSnapshot;
    let source!: ProductSnapshot;
    let option!: Locator;
    let disabled = false;
    await test.step('01 - Mở trang mẫu 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Đọc trạng thái 1TB để chọn đúng nhánh của bảng quyết định', async () => {
      option = main(page).getByText('Phiên bản', { exact: true }).first().locator('xpath=..').getByText('1TB', { exact: true });
      await expect(option).toBeVisible();
      disabled = await option.getAttribute('aria-disabled') === 'true';
      await note(page, `F06_011: Nhánh thực tế = ${disabled ? '1TB bị khóa' : '1TB khả dụng'}. Tiêu chí hai nhánh đã được cập nhật trong Excel theo yêu cầu người dùng.`);
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái trang 256GB trước thao tác', async () => {
      source = await selectColor(page, 'Titan Xanh');
      expect(evidence.get(page)!.addCalls).toBe(0);
      expect(evidence.get(page)!.checkoutEntries).toBe(0);
    });
    await test.step('04 - 1TB bị khóa: kiểm tra không thể chọn; khả dụng: mở luồng mua đúng 1TB', async () => {
      const group = main(page).getByText('Phiên bản', { exact: true }).first().locator('xpath=..');
      if (disabled) {
        await expect(option).toHaveAttribute('aria-disabled', 'true');
        // Ô khóa là div, không phải button/input native. Xác minh aria + CSS
        // và click UI thật để kiểm tra hành vi thay vì matcher native disabled.
        await expect(option).toHaveCSS('cursor', 'not-allowed');
        await expect(option).not.toHaveAttribute('href', /.+/);
        await expect(group.getByRole('link', { name: '1TB', exact: true })).toHaveCount(0);
        await option.click();
        await expect(page).toHaveURL(source.url);
        await expectProduct(page, '256GB');
        await showAction(page, '1TB bị khóa: có aria-disabled, không có href hoặc liên kết chọn');
      } else {
        await expect(group.getByRole('link', { name: '1TB', exact: true })).toBeEnabled();
        await selectCapacity(page, '1TB');
        await expect(colorCards(page).and(main(page).locator('button:not(:disabled)')),
          'Nhánh 1TB khả dụng phải có ít nhất một màu mua được').not.toHaveCount(0);
        product = await availableColor(page, '1TB', 'Titan Xanh');
        await openBuyNow(page);
      }
    });
    await test.step('05 - Đối chiếu kết quả của nhánh thực tế, dừng trước xác nhận đơn', async () => {
      if (disabled) {
        await expect(page).toHaveURL(source.url);
        await expect(colorOption(page, source.color)).toHaveAttribute('aria-pressed', 'true');
        expect(new URL(page.url()).searchParams.get('sku')).toBe(source.sku);
        const body = await main(page).innerText();
        const region = body.slice(body.indexOf('Màu sắc sản phẩm'), body.indexOf('Hoặc'));
        const prices = [...region.matchAll(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/g)].map(match => parseVnd(match[0]));
        expect(prices[4], 'Giá bán trang nguồn giữ nguyên khi 1TB bị khóa').toBe(source.sale);
        expect(evidence.get(page)!.addCalls, 'Không thêm giỏ khi kiểm tra tùy chọn bị khóa').toBe(0);
        expect(evidence.get(page)!.checkoutEntries, 'Không mở checkout khi 1TB bị khóa').toBe(0);
        await expect(checkoutRows(page)).toHaveCount(0);
        await note(page, 'Đạt nhánh 1TB bị khóa: disabled, không có liên kết chọn, giữ SKU/giá 256GB và không phát sinh mua hàng. Nhánh mua 1TB còn hàng chưa được thực thi trong lần chạy này.');
      } else {
        expect(product.capacity).toBe('1TB');
        await assertCheckout(page, product);
        await note(page, 'Đạt nhánh 1TB khả dụng: checkout giữ đúng SKU 1TB, một máy và giá hiện hành.');
      }
      await assertSafe(page);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_012]:
   * 1. Không bị reset sang màu khác, không tạo hai dòng sản phẩm vì bấm lại màu.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chọn 256GB Titan Xanh rồi bấm lại chính màu Titan Xanh.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY, so sánh SKU với giá trị trước và sau thao tác lặp.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_012 - Chọn lại cùng màu trước khi MUA NGAY', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn Titan Xanh lần đầu', async () => {
      previous = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Bấm lại Titan Xanh; SKU/giá/ảnh không đổi', async () => {
      product = await selectColor(page, 'Titan Xanh');
      expect(product.sku).toBe(previous.sku);
      expect(product.sale).toBe(previous.sale);
      expect(product.imagePath).toBe(previous.imagePath);
    });
    await test.step('04 - MUA NGAY một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Không reset màu hoặc phát sinh hai dòng', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.addCalls).toBe(1);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_013]:
   * 1. Giá đơn vị/tạm tính phù hợp với giá hiện hành và điều kiện ưu đãi công bố; không dùng giá cố định.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Mở 256GB Titan Xanh đang bán; ghi giá thực tế tại thời điểm chạy.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY, kiểm tra giá hiển thị ở phần thông tin mua nếu trang có.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_013 - Đối chiếu giá Titan Xanh trước và sau MUA NGAY', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái CTA', async () => {
      expect(product.sale).toBeGreaterThan(0);
      await note(page, `Đơn giá hiện hành của ${product.color}: ${product.sale}đ; SKU=${product.sku}`);
      await showAction(page, 'Ghi giá đúng biến thể trước khi mua');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_014]:
   * 1. Không lấy nhầm giá Titan Xanh cho Titan Đen; không tự nhân đôi số lượng.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Mở 256GB Titan Đen; ghi giá bên cạnh màu/giá bán.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY và đối chiếu giá tại bước tiếp theo.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_014 - Đối chiếu giá Titan Đen trước và sau MUA NGAY', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Đen');
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái CTA', async () => {
      expect(product.sale).toBeGreaterThan(0);
      await note(page, `Đơn giá hiện hành của ${product.color}: ${product.sale}đ; SKU=${product.sku}`);
      await showAction(page, 'Ghi giá đúng biến thể trước khi mua');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_015]:
   * 1. Số tiền mua không sử dụng nhầm giá gạch; ưu đãi chỉ tính khi có điều kiện hợp lệ.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Trang sản phẩm có thể hiển thị giá bán và giá gốc gạch ngang.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Ghi cả hai loại giá, bấm MUA NGAY và kiểm tra số tiền có tính trên đơn.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_015 - Phân biệt giá bán hiện tại với giá gạch', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Ghi giá bán và giá gạch, phân biệt trước MUA NGAY', async () => {
      expect(product.sale).toBeGreaterThan(0);
      if (product.crossed !== undefined) expect(product.crossed).toBeGreaterThanOrEqual(product.sale);
      await note(page, `Giá bán=${product.sale}đ; giá gạch=${product.crossed ?? 'không hiển thị'}. Không lấy giá gạch làm tiền mua.`);
      await showAction(page, 'Giá bán và giá gạch tại lúc chạy');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Số tiền checkout dùng giá bán, không dùng nhầm giá gạch', async () => {
      await assertCheckout(page, product);
      if (product.crossed !== undefined && product.crossed > product.sale) {
        const total = orderAmount(page, 'Tổng tiền');
        expect(parseVnd(await total.innerText())).not.toBe(product.crossed);
      }
    });
  });

  /** Expected Output from ASM06 [DDV_F06_016]:
   * 1. Chỉ một máy theo thao tác MUA NGAY một lần; không tự phát sinh số lượng 2 hoặc nhiều dòng giống nhau.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Phiên làm việc mới, chưa có thao tác thay số lượng ở luồng mua.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Chọn 256GB màu Bạc; bấm MUA NGAY rồi đọc số lượng hiển thị nếu có.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_016 - Kiểm tra số lượng mặc định trong luồng MUA NGAY', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Bạc');
    });
    await test.step('03 - Ghi SKU, màu, giá và trạng thái CTA', async () => {
      await showAction(page, 'Trước MUA NGAY: SKU và giá hiện hành');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Mặc định một máy Bạc, không tự thành x2 hoặc hai dòng', async () => {
      await assertCheckout(page, product);
      await expect(checkoutRows(page)).toHaveCount(1);
      expect(evidence.get(page)!.addCalls).toBe(1);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_017]:
   * 1. Không chuyển sang sản phẩm Samsung khác; thông tin sản phẩm phải nhất quán.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Trang chi tiết hiển thị Galaxy S25 Ultra 256GB Chính Hãng.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY, tìm tên sản phẩm ở tóm tắt/trạng thái được chuyển đến.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_017 - Kiểm tra thông tin tên sản phẩm trước đặt hàng', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Ghi đầy đủ tên sản phẩm trước MUA NGAY', async () => {
      expect(product.title).toMatch(/Samsung Galaxy S25 Ultra 256GB Chính Hãng/i);
      await note(page, `Tên phải giữ nguyên: ${product.title}`);
      await showAction(page, 'Tên sản phẩm trước điều hướng');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_018]:
   * 1. Giá và SKU nhất quán, không cam kết giữ giá cũ nếu chương trình đã hết hạn; chỉ yêu cầu minh bạch chênh lệch.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Giá/ưu đãi có thể thay đổi; ghi nhận giá tại thời điểm chạy trước khi bấm.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Chọn Titan Xanh, bấm MUA NGAY, đối chiếu giá cuối với điều kiện ưu đãi đang áp dụng.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_018 - Ưu đãi thay đổi theo ngày không làm sai thông tin SKU', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Ghi ưu đãi đang công bố và giá tại ngày chạy', async () => {
      expect(product.promotions).toContain('Khuyến mãi');
      await note(page, `SKU=${product.sku}; giá thực tế=${product.sale}đ.
      ${product.promotions}`);
      await showAction(page, 'Giá/ưu đãi hiện hành, không dùng giá lịch sử');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_019]:
   * 1. Không bắt người dùng nhấn biểu tượng xe đẩy trước mới được MUA NGAY; luồng mua xuất hiện hợp lệ.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Khởi tạo phiên sạch; xác minh giỏ chưa chứa sản phẩm.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Mở S25 Ultra 256GB Titan Xanh, bấm MUA NGAY và quan sát luồng tiếp theo.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_019 - MUA NGAY khi giỏ hiện đang trống', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở trang mẫu trong context mới', async () => {
      await visit(page);
    });
    await test.step('02 - Mở giỏ xác minh trống, không bấm xe đẩy', async () => {
      await openCart(page);
      await expect(cartRows(page)).toHaveCount(0);
      await expect(main(page).getByText('Giỏ hàng trống', { exact: true })).toBeVisible();
      await visit(page);
    });
    await test.step('03 - Chọn Titan Xanh và ghi SKU/giá', async () => {
      product = await selectColor(page, 'Titan Xanh');
      expect(evidence.get(page)!.addCalls).toBe(0);
    });
    await test.step('04 - MUA NGAY trực tiếp khi giỏ trống', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Luồng mua xuất hiện mà không cần thêm giỏ trước', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.addCalls).toBe(1);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_020]:
   * 1. Sản phẩm đang MUA NGAY là Titan Xanh; không tự chuyển thành Titan Đen do giỏ đã có hàng.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chuẩn bị giỏ có 1 S25 Ultra 256GB Titan Đen bằng nút xe đẩy.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Quay lại trang sản phẩm, chọn Titan Xanh và nhấn MUA NGAY; so sánh thông tin đang mua.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_020 - MUA NGAY khi giỏ đã chứa S25 Ultra màu khác', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở trang Samsung 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chuẩn bị giỏ x1 bằng xe đẩy, kiểm tra rồi quay lại sản phẩm', async () => {
      previous = await prepareCart(page, 'Titan Đen');
      expect(evidence.get(page)!.addCalls).toBe(1);
    });
    await test.step('03 - Chọn SKU đang MUA NGAY theo Excel, ghi giá hiện hành', async () => {
      product = await selectColor(page, 'Titan Xanh');
      expect(product.sku).not.toBe(previous.sku);
    });
    await test.step('04 - Chỉ bấm MUA NGAY một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Checkout dùng SKU hiện tại x1, không nhân đôi hay vào trả góp', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.addCalls).toBe(2);
      await expect(checkoutRows(page).getByText(previous.color, { exact: true })).toHaveCount(0);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_021]:
   * 1. Màn hình chuyển tiếp phản ánh thao tác mua hiện tại; không tự phát sinh đơn hàng thành công hoặc nhân đôi không chủ đích.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chuẩn bị giỏ có S25 Ultra 256GB Titan Xanh x1.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Quay lại trang chi tiết, bấm MUA NGAY đúng một lần; theo dõi bước tiếp.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_021 - MUA NGAY khi giỏ có cùng SKU', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở trang Samsung 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chuẩn bị giỏ x1 bằng xe đẩy, kiểm tra rồi quay lại sản phẩm', async () => {
      previous = await prepareCart(page, 'Titan Xanh');
      expect(evidence.get(page)!.addCalls).toBe(1);
    });
    await test.step('03 - Chọn SKU đang MUA NGAY theo Excel, ghi giá hiện hành', async () => {
      product = await selectColor(page, 'Titan Xanh');
      expect(product.sku).toBe(previous.sku);
    });
    await test.step('04 - Chỉ bấm MUA NGAY một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Checkout dùng SKU hiện tại x1, không nhân đôi hay vào trả góp', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.addCalls).toBe(2);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_022]:
   * 1. MUA NGAY hoạt động độc lập với thao tác mở giỏ; dẫn đến bước mua hợp lệ, không kích hoạt nút trả góp.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Đã thêm S25 Ultra 256GB màu Bạc vào giỏ, tiếp đó quay về sản phẩm.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Bấm MUA NGAY trên màu Bạc và quan sát điều hướng.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_022 - MUA NGAY sau khi đã thêm vào giỏ rồi quay lại sản phẩm', async ({ page }) => {
    let previous!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở trang Samsung 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chuẩn bị giỏ x1 bằng xe đẩy, kiểm tra rồi quay lại sản phẩm', async () => {
      previous = await prepareCart(page, 'Bạc');
      expect(evidence.get(page)!.addCalls).toBe(1);
    });
    await test.step('03 - Chọn SKU đang MUA NGAY theo Excel, ghi giá hiện hành', async () => {
      product = await selectColor(page, 'Bạc');
      expect(product.sku).toBe(previous.sku);
    });
    await test.step('04 - Chỉ bấm MUA NGAY một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Checkout dùng SKU hiện tại x1, không nhân đôi hay vào trả góp', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.addCalls).toBe(2);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_023]:
   * 1. Không vào mặc định biểu mẫu đăng ký trả góp do nhầm vị trí CTA; hiển thị luồng mua thường.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Trang có hai nút Trả góp 0% và MUA NGAY cạnh nhau.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Chọn Titan Xanh, chỉ nhấn MUA NGAY, theo dõi giao diện điều hướng.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_023 - MUA NGAY không tự kích hoạt trả góp 0%', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở Samsung Galaxy S25 Ultra 256GB theo URL Excel', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn đúng màu và kiểm tra MUA NGAY khả dụng', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Xác minh hai nút Trả góp 0% và MUA NGAY, chỉ chọn mua thường', async () => {
      await expect(main(page).getByRole('button', { name: 'Trả góp 0%', exact: true }).first()).toBeVisible();
      await expect(buyNow(page)).toBeVisible();
      await showAction(page, 'Hai hành động trả góp và MUA NGAY riêng biệt');
    });
    await test.step('04 - Bấm MUA NGAY đúng một lần', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Đối chiếu tóm tắt sản phẩm, SL, giá; không xác nhận đơn', async () => {
      await assertCheckout(page, product);
      await showAction(page, 'Đã vào luồng mua đúng SKU, dừng trước ĐẶT HÀNG');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_024]:
   * 1. Có thể trở về trang chi tiết an toàn; không có đơn đặt hàng được tạo chỉ từ thao tác Back.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html và chọn 256GB màu Bạc.
   * 2. Nhấn MUA NGAY đúng một lần, đợi trang/bước mua xuất hiện.
   * 3. Nhấn Back để quay về trang chi tiết sản phẩm.
   * 4. Kiểm tra tên sản phẩm/phiên bản, trạng thái an toàn và URL; KHÔNG đặt hàng.
   */
  test('DDV_F06_024 - Quay lại trang sản phẩm từ luồng MUA NGAY', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở 256GB và chọn Bạc', async () => {
      await visit(page);
      product = await selectColor(page, 'Bạc');
    });
    await test.step('02 - MUA NGAY một lần, chờ luồng mua đúng SKU', async () => {
      await openBuyNow(page);
      await assertCheckout(page, product);
    });
    await test.step('03 - Back bằng trình duyệt về trang chi tiết', async () => {
      await page.goBack({ waitUntil: 'domcontentloaded' });
    });
    await test.step('04 - Đúng URL/H1 256GB và không tạo đơn từ Back', async () => {
      await expectProduct(page, '256GB');
      await assertSafe(page);
      expect(evidence.get(page)!.addCalls).toBe(1);
      await showAction(page, 'Back về sản phẩm an toàn');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_025]:
   * 1. Lịch sử điều hướng hợp lệ, không báo đặt hàng thành công hoặc tự xác nhận đơn.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html; chọn 256GB Titan Xanh.
   * 2. Nhấn MUA NGAY và chờ màn hình mua mở.
   * 3. Bấm Back để về sản phẩm, sau đó bấm Forward.
   * 4. Kiểm tra URL, SKU đang mua và không có xác nhận đơn; KHÔNG đặt hàng.
   */
  test('DDV_F06_025 - Tiếp tục bằng Forward sau khi Back', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở 256GB và chọn Titan Xanh', async () => {
      await visit(page);
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('02 - MUA NGAY và xác minh checkout', async () => {
      await openBuyNow(page);
      await assertCheckout(page, product);
    });
    await test.step('03 - Back rồi Forward theo lịch sử thật', async () => {
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expectProduct(page, '256GB');
      await page.goForward({ waitUntil: 'domcontentloaded' });
    });
    await test.step('04 - URL/SKU vẫn đúng, không submit hoặc thêm hàng lần nữa', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.addCalls).toBe(1);
      await showAction(page, 'Forward trở lại luồng mua đúng SKU');
    });
  });

  /** Expected Output from ASM06 [DDV_F06_026]:
   * 1. Luồng mua có đúng Titan Đen được chọn sau refresh; không mua nhầm SKU mặc định.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Đang xem S25 Ultra 256GB Titan Đen, chưa bắt đầu mua.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Refresh trang chi tiết; chọn lại Titan Đen nếu UI reset rồi nhấn MUA NGAY.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_026 - Tải lại trang sản phẩm trước khi nhấn MUA NGAY', async ({ page }) => {
    let before!: ProductSnapshot; let product!: ProductSnapshot;
    await test.step('01 - Mở trang mẫu 256GB', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn Titan Đen trước refresh', async () => {
      before = await selectColor(page, 'Titan Đen');
    });
    await test.step('03 - Ghi SKU/giá và tải lại trang chi tiết', async () => {
      await showAction(page, 'Titan Đen trước Refresh');
      const response = await page.reload({ waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(400);
      await closeCookieNotice(page);
    });
    await test.step('04 - Chọn lại Titan Đen sau refresh rồi MUA NGAY', async () => {
      product = await selectColor(page, 'Titan Đen');
      expect(product.sku).toBe(before.sku);
      await openBuyNow(page);
    });
    await test.step('05 - Luồng mua đúng Titan Đen, không phải SKU mặc định', async () => {
      await assertCheckout(page, product);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_027]:
   * 1. Không tạo đơn/luồng trùng lặp không chủ đích; nút có thể chặn nhấn lặp hoặc chuyển trang một lần.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Có sản phẩm khả dụng; trình duyệt chưa vào luồng mua.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Nhấn MUA NGAY hai lần nhanh trong UI nếu nút vẫn nhận; quan sát số lần mở luồng.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_027 - Chỉ một lần chuyển luồng khi nhấn nhanh hai lần', async ({ page }) => {
    let product!: ProductSnapshot; let attemptedClicks = 0;
    await test.step('01 - Mở trang mẫu, chưa vào luồng mua', async () => {
      await visit(page);
    });
    await test.step('02 - Chọn Titan Xanh đang mua được', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Ghi SKU và bộ đếm trước thao tác lặp', async () => {
      expect(evidence.get(page)!.checkoutEntries).toBe(0);
      expect(evidence.get(page)!.addCalls).toBe(0);
      await showAction(page, 'Trước hai click nhanh nếu nút vẫn nhận');
    });
    await test.step('04 - Click nhanh lần hai chỉ khi nút cũ còn nhận thao tác', async () => {
      await buyNow(page).click({ noWaitAfter: true });
      attemptedClicks++;
      if (new URL(page.url()).pathname === new URL(product.url).pathname && await buyNow(page).isVisible() && await buyNow(page).isEnabled()) {
        try {
          await buyNow(page).click({ noWaitAfter: true, timeout: 750 });
          attemptedClicks++;
        } catch (error) {
          // Excel cho phép nút biến mất/khóa khi lần đầu đã chuyển trang.
          // Chỉ chấp nhận trường hợp chính URL checkout chứng minh việc chuyển luồng.
          if (new URL(page.url()).pathname !== '/checkout') throw error;
          await note(page, 'Nút MUA NGAY đã rời DOM khi lần một chuyển checkout; không ép click tọa độ lên nút xác nhận đơn.');
        }
      }
      await expectCheckoutReady(page);
    });
    await test.step('05 - Chỉ một luồng mua, một máy, không có trang/đơn trùng', async () => {
      await assertCheckout(page, product);
      expect(evidence.get(page)!.checkoutEntries).toBe(1);
      expect(evidence.get(page)!.addCalls).toBe(1);
      expect(page.context().pages()).toHaveLength(1);
      await note(page, `Số click được UI nhận=${attemptedClicks}; số lần vào checkout=${evidence.get(page)!.checkoutEntries}; POST thêm hàng=${evidence.get(page)!.addCalls}`);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_028]:
   * 1. Nút hiển thị, bấm được, không bị che bởi lớp phủ; vào luồng mua đúng SKU.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Trình duyệt desktop viewport 1366 x 768; sản phẩm 256GB có thể mua.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Cuộn đến khối mua, nhấn MUA NGAY và quan sát điều hướng.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_028 - Kiểm tra nút MUA NGAY ở kích thước desktop', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Dùng viewport 1366×768 và mở trang mẫu', async () => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await visit(page);
    });
    await test.step('02 - Chọn màu đúng Input Excel', async () => {
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('03 - Cuộn đến CTA, kiểm tra không tràn khỏi viewport', async () => {
      await buyNow(page).scrollIntoViewIfNeeded();
      await expect(buyNow(page)).toBeVisible();
      const box = await buyNow(page).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
      await showAction(page, 'CTA trong viewport, Playwright click kiểm tra lớp phủ thật');
    });
    await test.step('04 - Click MUA NGAY thật trên UI, không force', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Luồng mua truy cập được và giữ đúng SKU/giá', async () => {
      await assertCheckout(page, product);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_029]:
   * 1. Giao diện mua trên mobile truy cập được, CTA không tràn; luồng chuyển đến vẫn đúng SKU.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Dùng viewport 390 x 844, không tạo đơn thật.
   * 3. Ghi nhận SKU, màu, giá và trạng thái nút MUA NGAY trên trang chi tiết.
   * 4. Mở trang S25 Ultra 256GB, chọn màu khả dụng và nhấn MUA NGAY.
   * 5. Đối chiếu thông tin trên giao diện mua theo Expected Output; KHÔNG nhấn xác nhận đặt hàng.
   */
  test('DDV_F06_029 - Kiểm tra nút MUA NGAY ở kích thước điện thoại', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Dùng viewport 390×844 và mở trang mẫu', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await visit(page);
    });
    await test.step('02 - Chọn màu đúng Input Excel', async () => {
      product = await selectColor(page, 'Bạc');
    });
    await test.step('03 - Cuộn đến CTA, kiểm tra không tràn khỏi viewport', async () => {
      await buyNow(page).scrollIntoViewIfNeeded();
      await expect(buyNow(page)).toBeVisible();
      const box = await buyNow(page).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
      await showAction(page, 'CTA trong viewport, Playwright click kiểm tra lớp phủ thật');
    });
    await test.step('04 - Click MUA NGAY thật trên UI, không force', async () => {
      await openBuyNow(page);
    });
    await test.step('05 - Luồng mua truy cập được và giữ đúng SKU/giá', async () => {
      await assertCheckout(page, product);
    });
  });

  /** Expected Output from ASM06 [DDV_F06_030]:
   * 1. Không có màn hình báo tạo đơn hoặc giao dịch thành công do chỉ nhấn MUA NGAY; dừng trước submit.
   * 2. Không phát sinh đơn hàng, thanh toán, yêu cầu trả góp hay thông tin khách hàng thật. Trường hợp nút/SKU không khả dụng hoặc màn hình khác phạm vi: ghi Blocked/Skipped theo lý do thực tế, không tự gán Passed.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html và chọn 256GB Titan Xanh.
   * 2. Đọc giá và SKU trước khi nhấn.
   * 3. Nhấn MUA NGAY một lần, quan sát giao diện mua hoặc tóm tắt sản phẩm.
   * 4. Dừng trước mọi nút xác nhận đặt hàng/thanh toán; đối chiếu thông tin đang mua.
   */
  test('DDV_F06_030 - Dừng ở bước trước xác nhận đơn hàng', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở 256GB và chọn Titan Xanh', async () => {
      await visit(page);
      product = await selectColor(page, 'Titan Xanh');
    });
    await test.step('02 - Đọc giá, SKU và trạng thái trước khi nhấn', async () => {
      await note(page, `SKU=${product.sku}; giá=${product.sale}đ; không nhập dữ liệu người mua.`);
      await showAction(page, 'Sản phẩm trước khi bắt đầu mua');
    });
    await test.step('03 - MUA NGAY đúng một lần và chờ màn hình mua', async () => {
      await openBuyNow(page);
    });
    await test.step('04 - Đối chiếu rồi dừng trước mọi nút xác nhận/thanh toán', async () => {
      await assertCheckout(page, product);
      await expect(main(page).getByText('Vui lòng thêm địa chỉ nhận hàng', { exact: true })).toBeVisible();
      await expect(finalOrder(page)).toBeVisible();
      expect(evidence.get(page)!.finalClicks).toBe(0);
      expect(evidence.get(page)!.forbidden).toEqual([]);
      await showAction(page, 'Dừng tại checkout, không click ĐẶT HÀNG hoặc điền thông tin thật');
    });
  });

});
