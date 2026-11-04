import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Group08 - Nguyen Truong Giang (23130082)
 * ASM7 / F05 / D05 - 30 TEST CASES from ASM06.
 * Source: docs/individual/Group08_23130082_NguyenTruongGiang.xlsx, F05 - Cart.
 * Thêm hàng qua biểu tượng xe đẩy cạnh MUA NGAY; không gửi đơn/thanh toán.
 * Mỗi test dùng browser context riêng của Playwright, không phụ thuộc ca trước.
 */
const ORIGIN = 'https://didongviet.vn';
const PRODUCT_URL = `${ORIGIN}/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html`;
const TITLE = /Samsung Galaxy S25 Ultra\s+(?:5G\s+)?256GB/i;
const COLORS = ['Titan Xanh', 'Titan Đen', 'Bạc', 'Xám Titan'] as const;
type Color = (typeof COLORS)[number];
const MONEY = /^\d{1,3}(?:[.,]\d{3})+\s*[đ₫]$/;
interface ProductSnapshot { color: Color; sale: number; crossed?: number; imagePath: string; }

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parseVnd(value: string) { return Number(value.replace(/\D/g, '')); }
function main(page: Page) { return page.getByRole('main'); }
function colorOption(page: Page, color: Color) {
  return main(page).getByRole('button', { name: new RegExp(`^${escapeRegex(color)}\\s+\\d`) });
}
function addButton(page: Page) {
  // Đúng cụm CTA chính: loại trừ thanh mua nhanh và mục Thường mua kèm.
  return main(page).getByRole('button', { name: 'MUA NGAY', exact: true }).first()
    .locator('xpath=..').getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true });
}
function cartRows(page: Page) {
  // Card có ảnh trực tiếp và điều khiển số lượng, không chọn wrapper của cả giỏ.
  return main(page).locator('div:has(> a > img):has(button[aria-label="Tăng số lượng"])');
}
function cartRow(page: Page, color: Color) {
  return cartRows(page).filter({ has: page.getByRole('button', { name: color, exact: true }) });
}
function increase(row: Locator) { return row.getByRole('button', { name: 'Tăng số lượng', exact: true }); }
function decrease(row: Locator) { return row.getByRole('button', { name: 'Giảm số lượng', exact: true }); }
function quantity(row: Locator) { return increase(row).locator('xpath=../span'); }
function unitPrice(row: Locator) { return row.locator('span.text-primary-500').filter({ hasText: MONEY }).first(); }
function productLink(row: Locator) {
  // Link ảnh cũng lấy accessible name từ alt; chỉ link tiêu đề có text thật.
  return row.getByRole('link', { name: TITLE }).filter({ hasText: TITLE });
}
function summary(page: Page) {
  return main(page).getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).filter({ visible: true })
    .locator('xpath=../..');
}
function summaryTotal(page: Page) {
  return summary(page).locator('span.font-bold.text-primary-500').filter({ hasText: MONEY });
}

async function note(page: Page, message: string) {
  await test.info().attach('F05_observation.txt', {
    body: `${new Date().toISOString()} | ${page.url()}\n${message}\n`,
    contentType: 'text/plain; charset=utf-8',
  });
}
async function showAction(page: Page, action: string) {
  await test.step(`Thao tác trên web: ${action}`, async () => {
    await test.info().attach(`F05_action_${Date.now()}.png`, {
      body: await page.screenshot({ fullPage: false, mask: [page.locator('input,textarea')] }),
      contentType: 'image/png',
    });
  });
}
async function unavailable(page: Page, kind: 'N/A' | 'BLOCKED', reason: string): Promise<never> {
  await note(page, `${kind}: ${reason}`);
  await showAction(page, `${kind}: ${reason}`);
  test.info().annotations.push({ type: kind, description: reason });
  test.skip(true, `${kind}: ${reason}`);
  throw new Error(`${kind}: ${reason}`);
}
async function closeCookieNotice(page: Page) {
  const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
  try { await reject.waitFor({ state: 'visible', timeout: 2500 }); }
  catch { return; } // Chỉ popup cookie là tùy chọn; không nuốt lỗi thao tác test.
  await reject.click();
  await expect(reject).toBeHidden();
}
async function visit(page: Page) {
  const response = await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  expect(response, 'Trang sản phẩm phải trả HTTP response').not.toBeNull();
  expect(response!.status(), 'HTTP trang sản phẩm').toBeLessThan(400);
  await closeCookieNotice(page);
  await expect(page).toHaveURL(new RegExp('/samsung-galaxy-s25-ultra-5g-256gb\\.html(?:[?#].*)?$'));
  await expect(main(page).getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
}
async function selectColor(page: Page, color: Color): Promise<ProductSnapshot> {
  const option = colorOption(page, color);
  await expect(option, `Phải tìm đúng một thẻ màu ${color}`).toHaveCount(1);
  await expect(option).toBeVisible();
  // Next.js có thể đã vẽ nút SSR nhưng React chưa gắn onClick. Chỉ đọc dấu
  // hiệu handler, không sửa state/DOM và không click thêm lần nữa để bù mất lượt.
  await expect.poll(() => option.evaluate(element => {
    const props = element as unknown as Record<string, { onClick?: unknown }>;
    return Object.keys(element).some(key => key.startsWith('__reactProps$') && typeof props[key]?.onClick === 'function');
  }), { message: 'Chờ thẻ màu hydrate xong để thao tác được xử lý thật' }).toBe(true);
  if (await option.isDisabled()) return unavailable(page, 'BLOCKED', `Excel yêu cầu màu ${color}; thẻ màu bị vô hiệu hóa.`);
  await option.click();
  await expect(option, `Màu hiện hành phải là ${color}`).toHaveAttribute('aria-pressed', 'true');
  for (const other of COLORS.filter(c => c !== color)) {
    await expect(colorOption(page, other)).toHaveAttribute('aria-pressed', 'false');
  }
  const button = addButton(page);
  await expect(button, 'Phải có biểu tượng xe đẩy cạnh CTA chính').toBeVisible();
  if (await button.isDisabled()) return unavailable(page, 'BLOCKED', `SKU ${color} không cho thêm giỏ (hết hàng/CTA bị khóa).`);
  const body = await main(page).innerText();
  const priceRegion = body.slice(body.indexOf('Màu sắc sản phẩm'), body.indexOf('Hoặc'));
  const prices = [...priceRegion.matchAll(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/g)].map(m => parseVnd(m[0]));
  expect(prices.length, 'Đọc đủ giá bốn màu và giá bán chính').toBeGreaterThanOrEqual(COLORS.length + 1);
  const sale = prices[COLORS.length];
  expect(sale).toBe(parseVnd((await option.innerText()).match(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/)![0]));
  const src = await option.locator('img').getAttribute('src');
  expect(src, 'Thẻ màu có ảnh của SKU').toBeTruthy();
  return { color, sale, crossed: prices[COLORS.length + 1], imagePath: new URL(src!, ORIGIN).pathname };
}
async function addSelected(page: Page) {
  const button = addButton(page);
  await expect(button.locator('svg.lucide-shopping-cart')).toHaveCount(1);
  await button.click(); // Đúng một click, không retry việc thêm hàng.
  await expect(page.getByText('Sản phẩm đã được thêm vào giỏ', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/samsung-galaxy-s25-ultra-5g-256gb\.html/);
}
async function openCart(page: Page) {
  await page.getByRole('link', { name: 'Giỏ hàng', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/cart(?:[?#].*)?$/);
  await expect(main(page).getByRole('heading', { name: 'Giỏ hàng của bạn', exact: true })).toBeVisible();
}
async function addProduct(page: Page, color: Color = 'Titan Xanh') {
  await visit(page);
  const product = await selectColor(page, color);
  await addSelected(page);
  await openCart(page);
  await expect(cartRow(page, color)).toHaveCount(1);
  return product;
}
async function assertItem(page: Page, product: ProductSnapshot, count = 1) {
  const row = cartRow(page, product.color);
  await expect(row, `Đúng một dòng ${product.color}`).toHaveCount(1);
  await expect(productLink(row)).toBeVisible();
  await expect(productLink(row)).toHaveAttribute('href', /samsung-galaxy-s25-ultra-5g-256gb\.html\?sku=/);
  await expect(row.getByRole('button', { name: product.color, exact: true })).toBeVisible();
  await expect(quantity(row)).toHaveText(String(count));
  await expect.poll(async () => parseVnd(await unitPrice(row).innerText()), { message: `Giá ${product.color} phải khớp trang sản phẩm` }).toBe(product.sale);
  const image = row.locator('img');
  await expect(image).toHaveCount(1);
  await expect.poll(async () => new URL((await image.getAttribute('src'))!, ORIGIN).pathname,
    { message: `Ảnh giỏ phải khớp thẻ màu ${product.color}` }).toBe(product.imagePath);
}
async function assertTotals(page: Page, products: { product: ProductSnapshot; count: number }[]) {
  const expected = products.reduce((total, item) => total + item.product.sale * item.count, 0);
  await expect(summaryTotal(page)).toBeVisible();
  await expect.poll(async () => parseVnd(await summaryTotal(page).innerText()),
    { message: 'Tổng giỏ = tổng đơn giá hiện hành × số lượng; không trừ ưu đãi hai lần' }).toBe(expected);
  expect(expected).toBeGreaterThan(0);
  // Bộ đếm của giỏ là Chọn tất cả và MUA NGAY (số SKU, không phải số chiếc).
  // Header desktop có thể không render badge; không giả định badge luôn tồn tại.
  await expect(main(page).getByText(`Chọn tất cả (${products.length})`, { exact: true })).toBeVisible();
  await expect(summary(page).getByRole('button', { name: `MUA NGAY (${products.length})`, exact: true })).toBeVisible();
  const savings = products.reduce((sum, item) => sum + ((item.product.crossed ?? item.product.sale) - item.product.sale) * item.count, 0);
  const savingsLabel = summary(page).getByText('Tiết kiệm', { exact: true });
  if (savings > 0) {
    await expect(savingsLabel).toBeVisible();
    await expect.poll(async () => parseVnd(await savingsLabel.locator('xpath=..').innerText())).toBe(savings);
  }
}
interface CartItemState { productSku: string; quantity: number; isMaxQuantity: boolean; }
async function clickQuantity(page: Page, color: Color, direction: 1 | -1) {
  const row = cartRow(page, color);
  const before = Number(await quantity(row).innerText());
  const next = before + direction;
  const control = direction === 1 ? increase(row) : decrease(row);
  await expect(control).toBeEnabled();
  const sku = new URL((await productLink(row).getAttribute('href'))!, ORIGIN).searchParams.get('sku');
  // SL/giá trên React đổi lạc quan trước khi server xác nhận. Chờ cả PUT và
  // GET giỏ trả SKU/SL mới rồi mới click tiếp, đúng bước "chờ từng lần cập nhật".
  const refreshed = page.waitForResponse(async response => {
    if (response.request().method() !== 'GET' || new URL(response.url()).pathname !== '/api/fe/carts' || !response.ok()) return false;
    const payload = await response.json() as { success: boolean; data: CartItemState[] };
    const item = payload.data?.find(item => item.productSku === sku);
    return payload.success && !!item && (item.quantity === next ||
      (direction === 1 && item.isMaxQuantity && item.quantity >= before && item.quantity < next));
  });
  const [updated, cart] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === '/api/fe/carts/items/quantity' &&
      response.request().postDataJSON()?.quantity === next),
    refreshed,
    control.click(),
  ]);
  expect(updated.ok(), 'Server phải nhận cập nhật số lượng').toBe(true);
  const updatePayload = await updated.json();
  expect(updatePayload.success, 'API cập nhật giỏ thành công').toBe(true);
  const payload = await cart.json() as { data: CartItemState[] };
  const item = payload.data.find(item => item.productSku === sku)!;
  await expect(quantity(row), 'SL UI khớp kết quả server, không lấy SL lạc quan làm kết quả cuối').toHaveText(String(item.quantity));
  if (item.isMaxQuantity) await expect(increase(row)).toBeDisabled();
  await note(page, `Cập nhật ${color}: yêu cầu ${before} → ${next}; server=${item.quantity}; isMaxQuantity=${item.isMaxQuantity}`);
  return item;
}
async function changeQuantity(page: Page, color: Color, target: number) {
  const row = cartRow(page, color);
  const before = Number(await quantity(row).innerText());
  for (let count = before; count !== target;) {
    const next = count + (target > count ? 1 : -1);
    const item = await clickQuantity(page, color, target > count ? 1 : -1);
    expect(item.quantity, 'Mỗi click hợp lệ phải được server lưu đúng một chiếc').toBe(next);
    await expect(quantity(row), `Mỗi click đổi đúng một chiếc: ${count} → ${next}`).toHaveText(String(next));
    count = next;
  }
}
async function removeItem(page: Page, color: Color, cancel = false) {
  await cartRow(page, color).getByRole('button', { name: 'Xóa sản phẩm', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Xóa sản phẩm?' });
  if (cancel) {
    try { await dialog.waitFor({ state: 'visible', timeout: 3000 }); }
    catch {
      await expect(cartRow(page, color)).toHaveCount(0);
      return unavailable(page, 'N/A', 'F05_015: UI xóa ngay, không có hộp thoại Hủy/Xóa (Excel cho phép N/A).');
    }
  } else {
    await expect(dialog).toBeVisible();
  }
  await dialog.getByRole('button', { name: cancel ? 'Hủy' : 'Xóa', exact: true }).click();
  await expect(dialog).toBeHidden();
  if (!cancel) await expect(cartRow(page, color)).toHaveCount(0);
}
async function assertEmpty(page: Page) {
  await expect(cartRows(page)).toHaveCount(0);
  await expect(main(page).getByText('Giỏ hàng trống', { exact: true })).toBeVisible();
  await expect(main(page).getByText('Hãy thêm sản phẩm vào giỏ hàng', { exact: true })).toBeVisible();
  await expect(main(page).getByRole('button', { name: /^MUA NGAY/ })).toHaveCount(0);
  await expect(main(page).getByText(MONEY)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Giỏ hàng', exact: true }).filter({ visible: true }).locator('span.bg-orange-500')).toHaveCount(0);
}
async function twoColors(page: Page, second: Color = 'Titan Đen') {
  const blue = await addProduct(page, 'Titan Xanh');
  const other = await addProduct(page, second);
  await expect(cartRows(page)).toHaveCount(2);
  await assertItem(page, blue);
  await assertItem(page, other);
  return [blue, other] as const;
}
async function editableQuantity(page: Page, color: Color) {
  const row = cartRow(page, color);
  const input = row.locator('input:not([type="checkbox"]):not([type="hidden"])');
  if (await input.count() === 0) {
    await expect(quantity(row)).toHaveText('1');
    await expect(increase(row)).toBeVisible();
    await expect(decrease(row)).toBeVisible();
    return unavailable(page, 'N/A', 'Excel: ca nhập trực tiếp là N/A khi chỉ có +/−. DOM giỏ có span hiển thị SL và hai nút +/−, không có ô nhập SL.');
  }
  await expect(input).toHaveCount(1);
  if (!(await input.isEditable())) return unavailable(page, 'N/A', 'Ô số lượng không cho sửa bằng bàn phím; Excel cho phép N/A khi không hỗ trợ nhập.');
  return input;
}

test.describe('ASM07 | F05 | D05 | 30 test cases from Assignment 6', () => {
  test.describe.configure({ timeout: 150_000 });
  const orderRequests = new WeakMap<Page, string[]>();

  test.beforeEach(async ({ page }) => {
    const requests: string[] = [];
    orderRequests.set(page, requests);
    page.on('request', request => {
      if (!['POST', 'PUT', 'PATCH'].includes(request.method())) return;
      const path = new URL(request.url()).pathname;
      if (/(?:^|\/)(?:orders?|create-order|place-order|payments?|checkout)(?:\/|$)/i.test(path)) {
        requests.push(`${request.method()} ${path}`);
      }
    });
  });
  test.afterEach(async ({ page }, testInfo) => {
    await testInfo.attach('F05_run_metadata.json', {
      body: JSON.stringify({ test: testInfo.title, status: testInfo.status, expectedStatus: testInfo.expectedStatus,
        time: new Date().toISOString(), url: page.url(), annotations: testInfo.annotations,
        orderRequests: orderRequests.get(page) ?? [] }, null, 2),
      contentType: 'application/json',
    });
    const image = await page.screenshot({ fullPage: false, mask: [page.locator('input,textarea')], timeout: 8000 }).catch(() => null);
    if (image) await testInfo.attach('F05_snapshot.png', { body: image, contentType: 'image/png' });
    expect(orderRequests.get(page), 'Thao tác giỏ không được gửi request tạo đơn/thanh toán').toEqual([]);
    await expect(page.getByText(/đặt hàng thành công|thanh toán thành công|đặt hàng hoàn tất/i)).toHaveCount(0);
  });

  /** Expected Output from ASM06 [DDV_F05_001]:
   * 1. Giỏ có Samsung Galaxy S25 Ultra 5G 256GB màu Titan Xanh, số lượng 1.
   * 2. Tên, giá, biến thể khớp với lựa chọn; không phát sinh đơn hàng hoặc thanh toán.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
   * 2. Chọn phiên bản 256GB và màu Titan Xanh; ghi giá bán đang hiển thị.
   * 3. Nhấn biểu tượng xe đẩy viền đỏ ở bên phải nút 'MUA NGAY' đúng 1 lần.
   * 4. Mở giỏ hàng qua thông báo/đường dẫn giỏ trên giao diện và kiểm tra dòng Samsung S25 Ultra 256GB Titan Xanh.
   */
  test('DDV_F05_001 - Thêm Samsung Galaxy S25 Ultra 256GB Titan Xanh vào giỏ bằng biểu tượng xe đẩy', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở trang Samsung S25 Ultra 256GB', async () => { await visit(page); });
    await test.step('02 - Chọn Titan Xanh, ghi giá bán và ảnh biến thể', async () => { product = await selectColor(page, 'Titan Xanh'); });
    await test.step('03 - Click biểu tượng xe đẩy cạnh MUA NGAY đúng một lần', async () => { await addSelected(page); });
    await test.step('04 - Vào giỏ, đối chiếu SKU, SL 1, giá và tổng', async () => {
      await openCart(page); await expect(cartRows(page)).toHaveCount(1);
      await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]);
      await showAction(page, 'Titan Xanh x1 trong giỏ');
    });
  });

  /** Expected Output from ASM06 [DDV_F05_002]:
   * 1. Giỏ hiển thị Samsung Galaxy S25 Ultra 5G 256GB màu Titan Đen, số lượng 1.
   * 2. Giá của dòng hàng phù hợp với giá đã ghi khi chọn Titan Đen; không tự đổi sang màu khác.
   *
   * Test Case Procedure (Excel):
   * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html; chọn 256GB.
   * 2. Chọn màu Titan Đen; ghi nhận tên biến thể và giá đang hiển thị.
   * 3. Nhấn nút hình xe đẩy viền đỏ bên phải 'MUA NGAY' một lần.
   * 4. Vào giỏ hàng; đối chiếu màu Titan Đen x1 và giá của đúng biến thể.
   */
  test('DDV_F05_002 - Thêm phiên bản Titan Đen vào giỏ và kiểm tra đúng giá', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Mở đúng trang 256GB', async () => { await visit(page); });
    await test.step('02 - Chọn Titan Đen và ghi giá', async () => { product = await selectColor(page, 'Titan Đen'); });
    await test.step('03 - Thêm bằng biểu tượng xe đẩy đúng một lần', async () => { await addSelected(page); });
    await test.step('04 - Đối chiếu Titan Đen x1 và giá đúng biến thể', async () => {
      await openCart(page); await expect(cartRows(page)).toHaveCount(1);
      await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_003]:
   * 1. Giỏ có hai dòng/biến thể riêng: Titan Xanh x1 và Titan Đen x1.
   * 2. Tổng số lượng là 2; hệ thống không gộp hai màu thành một SKU.
   *
   * Test Case Procedure (Excel):
   * 1. Mở trang Samsung, chọn 256GB/Titan Xanh; nhấn biểu tượng xe đẩy để thêm x1.
   * 2. Quay về trang sản phẩm trong cùng phiên; đổi sang 256GB/Titan Đen, nhấn biểu tượng xe đẩy thêm x1.
   * 3. Mở giỏ hàng sau hai lần thêm; kiểm tra danh sách các dòng hàng.
   * 4. Đối chiếu màu Titan Xanh và Titan Đen đều có số lượng 1; không bị gộp sai SKU.
   */
  test('DDV_F05_003 - Thêm hai màu Titan Xanh và Titan Đen vào cùng một giỏ', async ({ page }) => {
    let blue!: ProductSnapshot; let black!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { blue = await addProduct(page); });
    await test.step('02 - Cùng phiên, về sản phẩm và thêm Titan Đen x1', async () => { black = await addProduct(page, 'Titan Đen'); });
    await test.step('03 - Kiểm tra hai SKU riêng, mỗi SKU x1', async () => {
      await expect(cartRows(page)).toHaveCount(2); await assertItem(page, blue); await assertItem(page, black);
    });
    await test.step('04 - Đối chiếu tổng số lượng 2 và tiền hai màu', async () => {
      expect(await quantity(cartRow(page, 'Titan Xanh')).innerText()).toBe('1');
      expect(await quantity(cartRow(page, 'Titan Đen')).innerText()).toBe('1');
      await assertTotals(page, [{ product: blue, count: 1 }, { product: black, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_004]:
   * 1. Tổng số lượng của SKU Titan Xanh đúng bằng 2 sau hai lần thêm, không nhân đôi quá mức.
   * 2. Giá và tổng tiền được cập nhật đúng theo số lượng/ưu đãi hiện hành.
   *
   * Test Case Procedure (Excel):
   * 1. Mở trang Samsung 256GB, chọn Titan Xanh; nhấn biểu tượng xe đẩy một lần.
   * 2. Quay lại trang sản phẩm nhưng vẫn giữ cùng phiên trình duyệt.
   * 3. Chọn lại Titan Xanh và nhấn biểu tượng xe đẩy lần thứ hai.
   * 4. Mở giỏ; kiểm tra tổng số lượng của đúng SKU Titan Xanh và tổng tiền, không tạo đơn hàng.
   */
  test('DDV_F05_004 - Nhấn biểu tượng xe đẩy hai lần với cùng SKU Titan Xanh', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh lần thứ nhất', async () => { product = await addProduct(page); await assertItem(page, product); });
    await test.step('02 - Quay lại trang sản phẩm trong cùng phiên', async () => { await visit(page); });
    await test.step('03 - Chọn lại Titan Xanh, click xe đẩy lần thứ hai', async () => { await selectColor(page, 'Titan Xanh'); await addSelected(page); });
    await test.step('04 - Giỏ có đúng một SKU x2, không nhân đôi quá mức', async () => {
      await openCart(page); await expect(cartRows(page)).toHaveCount(1);
      await assertItem(page, product, 2); await assertTotals(page, [{ product, count: 2 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_005]:
   * 1. Hai màu Titan Xanh và Bạc hiển thị đúng từng dòng trong giỏ.
   * 2. Tên biến thể, hình ảnh và giá không bị hoán đổi giữa hai dòng.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Samsung S25 Ultra 256GB/Titan Xanh; nhấn nút hình xe đẩy để thêm x1.
   * 2. Quay lại trang sản phẩm, chọn bản 256GB màu Bạc; nhấn nút hình xe đẩy để thêm x1.
   * 3. Mở giỏ; ghi lại tên, màu, ảnh, đơn giá của từng dòng.
   * 4. So sánh hai dòng với hai màu đã chọn và xác minh không bị tráo thông tin.
   */
  test('DDV_F05_005 - Thêm Titan Xanh và Bạc; kiểm tra giỏ không nhầm biến thể', async ({ page }) => {
    let blue!: ProductSnapshot; let silver!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1', async () => { blue = await addProduct(page); });
    await test.step('02 - Quay về sản phẩm và thêm Bạc x1', async () => { silver = await addProduct(page, 'Bạc'); });
    await test.step('03 - Đọc từng dòng giỏ, tên, màu, ảnh, đơn giá', async () => {
      await expect(cartRows(page)).toHaveCount(2); await assertItem(page, blue); await assertItem(page, silver);
    });
    await test.step('04 - Kiểm tra ảnh không tráo và tổng hai dòng', async () => {
      expect(blue.imagePath).not.toBe(silver.imagePath);
      await assertTotals(page, [{ product: blue, count: 1 }, { product: silver, count: 1 }]);
      await showAction(page, 'Titan Xanh và Bạc, đúng ảnh từng SKU');
    });
  });

  /** Expected Output from ASM06 [DDV_F05_006]:
   * 1. Số lượng là 2, không tăng thành 3 hoặc thêm dòng khác.
   * 2. Thành tiền và tạm tính cập nhật theo chính sách giá/khuyến mãi hiển thị.
   *
   * Test Case Procedure (Excel):
   * 1. Chuẩn bị giỏ bằng cách chọn Samsung S25 Ultra 256GB/Titan Xanh rồi nhấn biểu tượng xe đẩy một lần.
   * 2. Mở giỏ, xác nhận SKU có số lượng 1 và ghi đơn giá P.
   * 3. Nhấn nút '+' ở dòng Titan Xanh đúng một lần, chờ hệ thống cập nhật.
   * 4. Kiểm tra số lượng 2 và thành tiền sau thay đổi; ghi chú ưu đãi nếu có.
   */
  test('DDV_F05_006 - Tăng số lượng S25 Ultra từ 1 lên 2 trong giỏ', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Chuẩn bị giỏ Titan Xanh qua xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác nhận SL 1 và đơn giá P', async () => { await assertItem(page, product); });
    await test.step('03 - Click + đúng một lần, đợi SL 2', async () => { await changeQuantity(page, 'Titan Xanh', 2); });
    await test.step('04 - Đối chiếu SL và tổng 2 × P', async () => {
      await expect(cartRows(page)).toHaveCount(1); await assertItem(page, product, 2); await assertTotals(page, [{ product, count: 2 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_007]:
   * 1. Dòng máy vẫn có SL 1; không bị xóa toàn bộ.
   * 2. Tổng tiền không còn tính chiếc thứ hai nếu không có ưu đãi phụ thuộc số lượng.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh vào giỏ qua biểu tượng xe đẩy.
   * 2. Tại giỏ, dùng '+' (hoặc thêm tiếp cùng SKU) để chuẩn bị số lượng 2.
   * 3. Nhấn nút '-' tại dòng Titan Xanh một lần.
   * 4. Đối chiếu số lượng còn 1 và thành tiền; bảo đảm không xóa hẳn SKU.
   */
  test('DDV_F05_007 - Giảm số lượng S25 Ultra từ 2 xuống 1', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Dùng + chuẩn bị SL 2', async () => { await changeQuantity(page, 'Titan Xanh', 2); });
    await test.step('03 - Click − một lần', async () => { await changeQuantity(page, 'Titan Xanh', 1); });
    await test.step('04 - Dòng máy còn x1 và chỉ tính tiền một máy', async () => {
      await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_008]:
   * 1. Không chấp nhận số lượng vượt mức M/tồn kho hợp lệ.
   * 2. Thông báo hoặc trạng thái nút chỉnh số lượng nhất quán với giới hạn.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh vào giỏ bằng biểu tượng xe đẩy.
   * 2. Mở giỏ; xác định mức mua tối đa M qua thông báo/điều kiện hiện có, không tự đặt M.
   * 3. Tăng số lượng tới mức M nếu hệ thống và tồn kho cho phép; thử tăng thêm 1.
   * 4. Kiểm tra số lượng cuối không vượt M và thông báo/khóa nút theo giới hạn.
   */
  test('DDV_F05_008 - Kiểm tra giới hạn số lượng tối đa trong giỏ', async ({ page }) => {
    let product!: ProductSnapshot; let maximum!: number;
    await test.step('01 - Thêm Titan Xanh qua xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác định M từ thông báo hoặc thuộc tính UI, không tự đặt M', async () => {
      const row = cartRow(page, 'Titan Xanh');
      const limits = await row.locator('[max], [aria-valuemax], [data-max]').evaluateAll(elements => elements.map(el =>
        Number(el.getAttribute('max') ?? el.getAttribute('aria-valuemax') ?? el.getAttribute('data-max'))).filter(n => Number.isInteger(n) && n > 0));
      const text = await main(page).innerText();
      const match = text.match(/(?:tối đa|giới hạn|còn lại)\s*[:=]?\s*(\d+)\s*(?:sản phẩm|máy|chiếc)/i);
      maximum = limits[0] ?? (match ? Number(match[1]) : NaN);
      if (!Number.isInteger(maximum)) {
        // Không mặc định M. Tìm giới hạn thực qua từng click và phản hồi server;
        // 20 chỉ là ngân sách thăm dò, tuyệt đối không được coi là M.
        for (let probe = 0; probe < 20; probe++) {
          if (await increase(row).isDisabled()) { maximum = Number(await quantity(row).innerText()); break; }
          const item = await clickQuantity(page, 'Titan Xanh', 1);
          if (item.isMaxQuantity) { maximum = item.quantity; break; }
        }
        if (!Number.isInteger(maximum)) return unavailable(page, 'BLOCKED',
          'F05_008: UI không công bố M; đã thăm dò 20 lượt tăng có chờ server nhưng chưa thấy giới hạn/khóa nút. Không suy ra M từ ngân sách thăm dò.');
      }
      await note(page, `Giới hạn M quan sát được trên UI = ${maximum}`);
    });
    await test.step('03 - Tăng đến M và thử M+1', async () => {
      await changeQuantity(page, 'Titan Xanh', maximum);
      const plus = increase(cartRow(page, 'Titan Xanh'));
      if (await plus.isEnabled()) {
        await plus.click();
        await expect(main(page).getByText(/tối đa|giới hạn|không đủ|vượt quá/i).first()).toBeVisible();
      } else { await expect(plus).toBeDisabled(); }
    });
    await test.step('04 - Số lượng không vượt M và tổng đúng M máy', async () => {
      await assertItem(page, product, maximum); await assertTotals(page, [{ product, count: maximum }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_009]:
   * 1. Không tồn tại số lượng 0/âm đang bị tính tiền.
   * 2. Nếu website chuyển sang xóa, phải có trạng thái/confirmation theo thiết kế.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh x1 bằng biểu tượng xe đẩy.
   * 2. Mở giỏ, xác nhận số lượng đang là 1.
   * 3. Nhấn nút '-' một lần; quan sát hệ thống giữ nguyên, cảnh báo hoặc chuyển sang bước xóa.
   * 4. Kiểm tra không lưu số lượng âm; nếu có bước xác nhận xóa thì hủy để giữ dữ liệu test.
   */
  test('DDV_F05_009 - Giảm số lượng tại mốc tối thiểu là 1', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác nhận SL tối thiểu là 1', async () => { await assertItem(page, product); });
    await test.step('03 - Click −; hủy nếu mở xác nhận xóa', async () => {
      const minus = decrease(cartRow(page, 'Titan Xanh'));
      if (await minus.isDisabled()) { await expect(minus).toBeDisabled(); return; }
      await minus.click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Xóa sản phẩm?' });
      if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    });
    await test.step('04 - Không lưu 0/âm và không tính tiền sai', async () => {
      await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_010]:
   * 1. Nếu chức năng nhập được hỗ trợ, lưu SL = 3 và tính tiền đúng.
   * 2. Không đổi nhầm màu hoặc nhân đôi dòng; không có ô nhập thì N/A.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh x1 từ trang sản phẩm qua nút hình xe đẩy.
   * 2. Mở giỏ; xác nhận dòng hàng có ô nhập số lượng trực tiếp và tồn kho cho phép mua 3 máy.
   * 3. Chọn ô số lượng, nhập '3', nhấn Enter hoặc rời ô để lưu.
   * 4. Kiểm tra số lượng 3 và thành tiền; tải lại trang để kiểm tra dữ liệu được giữ.
   */
  test('DDV_F05_010 - Nhập trực tiếp số lượng 3 cho S25 Ultra', async ({ page }) => {
    let product!: ProductSnapshot; let input!: Locator;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác minh có ô nhập SL, nếu không có ghi N/A theo Excel', async () => { input = await editableQuantity(page, 'Titan Xanh'); });
    await test.step('03 - Nhập 3 và rời ô để lưu', async () => { await input.fill('3'); await input.blur(); });
    await test.step('04 - Đối chiếu SL 3, tổng tiền và dữ liệu sau reload', async () => {
      await expect(input).toHaveValue('3'); await assertTotals(page, [{ product, count: 3 }]);
      await page.reload({ waitUntil: 'domcontentloaded' }); await expect(cartRows(page)).toHaveCount(1);
      await expect(cartRow(page, 'Titan Xanh').locator('input:not([type="checkbox"]):not([type="hidden"])')).toHaveValue('3');
      await assertTotals(page, [{ product, count: 3 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_011]:
   * 1. Chỉ xóa Titan Đen, không xóa nhầm Titan Xanh.
   * 2. Số lượng bộ đếm giỏ và tổng tiền cập nhật nhất quán.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Titan Xanh x1 và Titan Đen x1; lần lượt nhấn biểu tượng xe đẩy để thêm vào cùng một giỏ.
   * 2. Mở giỏ, xác nhận có hai dòng đúng màu.
   * 3. Nhấn Xóa ở dòng Titan Đen và xác nhận xóa nếu giao diện yêu cầu.
   * 4. Kiểm tra giỏ chỉ còn Titan Xanh x1, tổng tiền cập nhật chính xác.
   */
  test('DDV_F05_011 - Xóa Titan Đen nhưng giữ nguyên Titan Xanh', async ({ page }) => {
    let blue!: ProductSnapshot; let black!: ProductSnapshot;
    await test.step('01 - Thêm hai SKU qua xe đẩy trong cùng phiên', async () => { [blue, black] = await twoColors(page); });
    await test.step('02 - Xác nhận đúng hai màu x1', async () => { await assertItem(page, blue); await assertItem(page, black); });
    await test.step('03 - Xóa đúng dòng Titan Đen và xác nhận', async () => { await removeItem(page, 'Titan Đen'); });
    await test.step('04 - Chỉ còn Titan Xanh x1, bộ đếm và tổng cập nhật', async () => {
      await expect(cartRows(page)).toHaveCount(1); await assertItem(page, blue); await assertTotals(page, [{ product: blue, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_012]:
   * 1. Chỉ xóa SKU trên dòng đầu tại thời điểm thao tác.
   * 2. Dòng còn lại không đổi màu, giá hay số lượng.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Titan Xanh x1 và Titan Đen x1 vào giỏ bằng biểu tượng xe đẩy trên trang Samsung.
   * 2. Mở giỏ, xác định chính xác SKU ở dòng đầu hiện tại.
   * 3. Nhấn Xóa tại dòng đầu và xác nhận nếu có hộp thoại.
   * 4. Kiểm tra chỉ dòng đầu bị xóa; dòng còn lại không đổi SKU, giá và số lượng.
   */
  test('DDV_F05_012 - Xóa dòng đầu tiên trong giỏ hai sản phẩm', async ({ page }) => {
    let products!: readonly [ProductSnapshot, ProductSnapshot]; let first!: ProductSnapshot; let remaining!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh và Titan Đen bằng xe đẩy', async () => { products = await twoColors(page); });
    await test.step('02 - Xác định chính xác SKU dòng đầu hiện tại', async () => {
      const color = await cartRows(page).first().locator('button[aria-haspopup="dialog"]').innerText();
      first = products.find(p => p.color === color)!; expect(first).toBeDefined();
      remaining = products.find(p => p.color !== color)!;
      await note(page, `Dòng đầu hiện tại=${first.color}; dòng phải giữ=${remaining.color}`);
    });
    await test.step('03 - Xóa dòng đầu, xác nhận', async () => { await removeItem(page, first.color); });
    await test.step('04 - Dòng còn lại giữ SKU, ảnh, giá, số lượng', async () => {
      await expect(cartRows(page)).toHaveCount(1); await assertItem(page, remaining); await assertTotals(page, [{ product: remaining, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_013]:
   * 1. Chỉ dòng Titan Đen bị xóa.
   * 2. Không làm mất biến thể Titan Xanh ở dòng còn lại.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Titan Xanh x1 và Titan Đen x1 bằng nút hình xe đẩy trong cùng phiên.
   * 2. Mở giỏ, kiểm tra thứ tự hiện tại và xác định dòng cuối cùng.
   * 3. Nhấn Xóa ở dòng cuối; xác nhận xóa nếu hệ thống hỏi.
   * 4. Kiểm tra dòng cuối đã biến mất, dòng còn lại và tổng tiền vẫn đúng.
   */
  test('DDV_F05_013 - Xóa dòng cuối cùng trong giỏ hai sản phẩm', async ({ page }) => {
    let blue!: ProductSnapshot; let black!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1 và Titan Đen x1', async () => { [blue, black] = await twoColors(page); });
    await test.step('02 - Chuẩn bị/xác minh dòng cuối Titan Đen theo Excel', async () => {
      // UI sắp SKU thêm mới lên đầu. Đổi thứ tự thêm qua UI nếu cần để đáp ứng dữ liệu Excel.
      if (await cartRows(page).last().getByRole('button', { name: 'Titan Đen', exact: true }).count() === 0) {
        await removeItem(page, 'Titan Xanh'); blue = await addProduct(page, 'Titan Xanh');
      }
      await expect(cartRows(page).last().getByRole('button', { name: 'Titan Đen', exact: true })).toBeVisible();
      await assertItem(page, blue); await assertItem(page, black);
    });
    await test.step('03 - Xóa dòng cuối Titan Đen', async () => { await removeItem(page, 'Titan Đen'); });
    await test.step('04 - Titan Xanh x1 còn nguyên, tổng tiền đúng', async () => {
      await expect(cartRows(page)).toHaveCount(1); await assertItem(page, blue); await assertTotals(page, [{ product: blue, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_014]:
   * 1. Không còn mặt hàng tính tiền và không xuất hiện đơn đặt hàng.
   * 2. Bộ đếm/tạm tính về 0 hoặc hiển thị trạng thái trống hợp lệ.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Titan Xanh x1 rồi nhấn biểu tượng xe đẩy; mở giỏ và kiểm tra đây là mặt hàng duy nhất.
   * 2. Nhấn nút Xóa của dòng Samsung S25 Ultra 256GB Titan Xanh.
   * 3. Xác nhận xóa nếu giao diện yêu cầu.
   * 4. Kiểm tra trạng thái giỏ trống, số lượng/bộ đếm và tổng tiền về trạng thái trống hợp lệ.
   */
  test('DDV_F05_014 - Xóa S25 Ultra duy nhất để hiển thị giỏ trống', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm duy nhất Titan Xanh x1', async () => { product = await addProduct(page); await assertItem(page, product); await expect(cartRows(page)).toHaveCount(1); });
    await test.step('02 - Nhấn Xóa sản phẩm ở dòng duy nhất', async () => { await cartRow(page, 'Titan Xanh').getByRole('button', { name: 'Xóa sản phẩm', exact: true }).click(); });
    await test.step('03 - Xác nhận Xóa trong hộp thoại', async () => {
      await page.getByRole('dialog').filter({ hasText: 'Xóa sản phẩm?' }).getByRole('button', { name: 'Xóa', exact: true }).click();
    });
    await test.step('04 - Giỏ trống, không còn bộ đếm và tiền cũ', async () => { await assertEmpty(page); await showAction(page, 'Giỏ trống sau xóa máy duy nhất'); });
  });

  /** Expected Output from ASM06 [DDV_F05_015]:
   * 1. Sản phẩm không bị xóa khi chọn Hủy.
   * 2. Nếu giao diện xóa ngay không có xác nhận, đánh dấu N/A, không giả định có popup.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Titan Xanh x1 vào giỏ bằng biểu tượng xe đẩy.
   * 2. Mở giỏ và nhấn nút Xóa tại dòng Titan Xanh.
   * 3. Nếu xuất hiện hộp thoại xác nhận xóa, chọn 'Hủy'.
   * 4. Kiểm tra Titan Xanh x1 vẫn có trong giỏ và thành tiền không thay đổi.
   */
  test('DDV_F05_015 - Hủy xác nhận xóa S25 Ultra', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Ghi SL và tổng tiền trước thao tác xóa', async () => { await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]); });
    await test.step('03 - Nhấn Xóa rồi Hủy xác nhận', async () => { await removeItem(page, 'Titan Xanh', true); });
    await test.step('04 - SKU, số lượng và tổng giữ nguyên', async () => {
      await expect(cartRows(page)).toHaveCount(1); await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_016]:
   * 1. Đúng SKU Titan Xanh x1 và giá phải trả được diễn giải nhất quán.
   * 2. Không lấy giá gạch bỏ làm giá thanh toán hoặc tự trừ khuyến mãi hai lần.
   *
   * Test Case Procedure (Excel):
   * 1. Mở trang Samsung, chọn Titan Xanh 256GB, ghi giá bán hiện hành P.
   * 2. Nhấn biểu tượng xe đẩy bên phải 'MUA NGAY' để thêm đúng một máy.
   * 3. Vào giỏ và đọc tên phiên bản, đơn giá, số lượng, thành tiền.
   * 4. Đối chiếu giá 1 máy với P và các khoản điều chỉnh (nếu được hiển thị).
   */
  test('DDV_F05_016 - Đối chiếu giá của một S25 Ultra 256GB Titan Xanh', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Chọn Titan Xanh, ghi giá bán P', async () => { await visit(page); product = await selectColor(page, 'Titan Xanh'); await note(page, `Giá bán P=${product.sale}; giá gạch=${product.crossed}`); });
    await test.step('02 - Click xe đẩy đúng một lần', async () => { await addSelected(page); });
    await test.step('03 - Vào giỏ, đọc SKU, đơn giá, SL', async () => { await openCart(page); await assertItem(page, product); });
    await test.step('04 - Giá trả bằng P, không dùng giá gạch hoặc trừ giảm giá hai lần', async () => {
      await expect(cartRows(page)).toHaveCount(1); await assertTotals(page, [{ product, count: 1 }]);
      if (product.crossed !== undefined) expect(product.sale).toBeLessThanOrEqual(product.crossed);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_017]:
   * 1. Dòng máy hiển thị SL 2 và thành tiền được tính nhất quán.
   * 2. Mọi chênh lệch phải có dòng giảm/điều kiện giải thích rõ.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Titan Xanh 256GB, ghi đơn giá P và thêm máy vào giỏ bằng biểu tượng xe đẩy.
   * 2. Mở giỏ; tăng số lượng từ 1 lên 2 bằng nút '+'.
   * 3. Ghi số lượng, thành tiền của dòng và các khoản ưu đãi hiển thị.
   * 4. Đối chiếu công thức 2 × P trước ưu đãi áp dụng cho số lượng (nếu có).
   */
  test('DDV_F05_017 - Đối chiếu thành tiền S25 Ultra Titan Xanh x2', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Ghi P và thêm Titan Xanh bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Tăng SL 1 → 2 bằng +', async () => { await changeQuantity(page, 'Titan Xanh', 2); });
    await test.step('03 - Ghi số lượng, giá và ưu đãi đang hiển thị', async () => { await assertItem(page, product, 2); await note(page, await main(page).innerText()); });
    await test.step('04 - Đối chiếu 2 × P và tiền tiết kiệm theo giá gạch', async () => { await assertTotals(page, [{ product, count: 2 }]); });
  });

  /** Expected Output from ASM06 [DDV_F05_018]:
   * 1. Hai màu được giữ riêng, không lấy giá một màu cho cả hai.
   * 2. Tạm tính hàng hóa = P_X + P_Đ trước các điều chỉnh hợp lệ.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Titan Xanh 256GB, ghi đơn giá P_X và thêm vào giỏ bằng biểu tượng xe đẩy.
   * 2. Quay lại trang sản phẩm, chọn Titan Đen 256GB, ghi P_Đ và thêm vào giỏ.
   * 3. Mở giỏ và kiểm tra số lượng hai dòng đều là 1.
   * 4. Đối chiếu tạm tính P_X + P_Đ trước các khoản ưu đãi hợp lệ, không dùng lẫn giá của hai màu.
   */
  test('DDV_F05_018 - Cộng tổng hai màu S25 Ultra có giá khác nhau', async ({ page }) => {
    let blue!: ProductSnapshot; let black!: ProductSnapshot;
    await test.step('01 - Ghi P_X và thêm Titan Xanh x1', async () => { blue = await addProduct(page); });
    await test.step('02 - Ghi P_Đ và thêm Titan Đen x1', async () => { black = await addProduct(page, 'Titan Đen'); });
    await test.step('03 - Kiểm tra hai SKU và điều kiện P_X khác P_Đ', async () => {
      await expect(cartRows(page)).toHaveCount(2); await assertItem(page, blue); await assertItem(page, black);
      if (blue.sale === black.sale) return unavailable(page, 'BLOCKED',
        `F05_018 yêu cầu hai màu khác giá. Tại lúc chạy Titan Xanh=${blue.sale}đ và Titan Đen=${black.sale}đ; không đổi dữ liệu/màu Excel để ép Passed.`);
    });
    await test.step('04 - Tạm tính bằng P_X + P_Đ', async () => { await assertTotals(page, [{ product: blue, count: 1 }, { product: black, count: 1 }]); });
  });

  /** Expected Output from ASM06 [DDV_F05_019]:
   * 1. Giỏ hoặc màn tóm tắt đơn hàng dùng giá hiện hành theo điều kiện công bố.
   * 2. Nếu khuyến mãi hết hạn, ghi bằng chứng; không cố so với giá cũ.
   *
   * Test Case Procedure (Excel):
   * 1. Mở trang Samsung, chọn Titan Xanh 256GB; ghi giá bán và điều kiện khuyến mãi hiện tại.
   * 2. Nhấn nút hình xe đẩy để thêm máy vào giỏ.
   * 3. Mở giỏ, đọc đơn giá, giảm giá (nếu có) và thành tiền.
   * 4. Đối chiếu giá theo điều kiện ưu đãi còn hiệu lực; lưu ảnh nếu trang báo giá đã thay đổi.
   */
  test('DDV_F05_019 - Kiểm tra giá đang khuyến mãi của S25 Ultra trong giỏ', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Ghi giá hiện hành và điều kiện khuyến mãi', async () => {
      await visit(page); product = await selectColor(page, 'Titan Xanh');
      await note(page, `Giá bán=${product.sale}; giá gạch=${product.crossed ?? 'không có'}; không dùng giá flash sale lịch sử.`);
      await showAction(page, 'Giá và điều kiện khuyến mãi tại thời điểm chạy');
    });
    await test.step('02 - Thêm bằng xe đẩy', async () => { await addSelected(page); });
    await test.step('03 - Vào giỏ, đọc đơn giá và SL', async () => { await openCart(page); await assertItem(page, product); });
    await test.step('04 - Giỏ dùng giá hiện hành, tiền tiết kiệm không bị trừ lần nữa', async () => { await assertTotals(page, [{ product, count: 1 }]); });
  });

  /** Expected Output from ASM06 [DDV_F05_020]:
   * 1. Mỗi ưu đãi xuất hiện/tính đúng số lần và đúng điều kiện.
   * 2. Tổng tiền không âm, không sử dụng đồng thời các ưu đãi không được kết hợp.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh vào giỏ bằng biểu tượng xe đẩy.
   * 2. Ở giỏ, đọc và ghi từng khoản ưu đãi được áp dụng thực tế.
   * 3. Đối chiếu tạm tính trước ưu đãi, tổng giảm giá và số tiền phải trả.
   * 4. Xác nhận không có ưu đãi bị trừ hai lần hoặc tổng tiền âm.
   */
  test('DDV_F05_020 - Kiểm tra khoản giảm giá không bị trừ lặp trong tổng giỏ', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Đọc giá bán và từng khoản giảm đang áp dụng', async () => {
      await assertItem(page, product);
      await note(page, `Giá bán đang áp dụng=${product.sale}, giá gạch=${product.crossed}.\n${await main(page).innerText()}`);
      // Tiết kiệm so với giá gạch là ưu đãi đang có thật; không tự trừ thành khoản K thêm lần nữa.
      if (product.crossed === undefined || product.crossed <= product.sale) return unavailable(page, 'BLOCKED', 'F05_020: Không có ưu đãi đang áp dụng/đủ dữ liệu điều kiện để kiểm tra trừ lặp.');
    });
    await test.step('03 - Đối chiếu tiền tiết kiệm và tiền phải trả', async () => {
      await assertTotals(page, [{ product, count: 1 }]);
      expect(product.crossed! - product.sale).toBeGreaterThan(0);
    });
    await test.step('04 - Không trừ ưu đãi hai lần, không xuất hiện số tiền âm', async () => {
      const total = parseVnd(await summaryTotal(page).innerText());
      expect(total).toBe(product.sale); expect(total).toBeGreaterThan(0);
      await expect(summary(page)).not.toContainText(/-\s*\d[\d.,]*\s*[đ₫]/);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_021]:
   * 1. Dữ liệu giỏ hợp lệ được giữ nguyên sau reload.
   * 2. Không thêm trùng hay xóa mất SKU chỉ vì tải lại.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh x1 bằng biểu tượng xe đẩy.
   * 2. Mở giỏ, xác nhận đúng SKU và số lượng 1.
   * 3. Tải lại trang giỏ bằng Reload và đợi hoàn thành.
   * 4. Kiểm tra dữ liệu SKU, số lượng và tiền hàng giữ nguyên, không tự thêm lần nữa.
   */
  test('DDV_F05_021 - Duy trì giỏ S25 Ultra sau khi tải lại', async ({ page }) => {
    let blue!: ProductSnapshot; let black!: ProductSnapshot;
    await test.step('01 - Chuẩn bị Titan Xanh và Titan Đen theo Input Excel', async () => { [blue, black] = await twoColors(page); });
    await test.step('02 - Xác nhận hai SKU x1 và tiền trước reload', async () => { await assertTotals(page, [{ product: blue, count: 1 }, { product: black, count: 1 }]); });
    await test.step('03 - Reload trang giỏ đúng một lần', async () => {
      const response = await page.reload({ waitUntil: 'domcontentloaded' }); expect(response?.status()).toBeLessThan(400);
    });
    await test.step('04 - Dữ liệu giữ nguyên, không thêm trùng hoặc mất SKU', async () => {
      await expect(cartRows(page)).toHaveCount(2); await assertItem(page, blue); await assertItem(page, black);
      await assertTotals(page, [{ product: blue, count: 1 }, { product: black, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_022]:
   * 1. Giỏ còn Titan Xanh x1, không tự biến thành x2.
   * 2. Điều hướng không tự làm mất mặt hàng.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Titan Xanh x1 và nhấn biểu tượng xe đẩy để thêm vào giỏ.
   * 2. Mở giỏ, kiểm tra sản phẩm đã có.
   * 3. Điều hướng về trang Samsung Galaxy S25 Ultra 256GB bằng nút quay lại/đường dẫn sản phẩm.
   * 4. Quay vào giỏ, kiểm tra vẫn là Titan Xanh x1, không bị mất hoặc nhân đôi.
   */
  test('DDV_F05_022 - Giữ dữ liệu giỏ khi quay về trang Samsung', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Kiểm tra sản phẩm đã có trong giỏ', async () => { await assertItem(page, product); });
    await test.step('03 - Click liên kết sản phẩm để quay về Samsung', async () => {
      await productLink(cartRow(page, 'Titan Xanh')).click();
      await expect(main(page).getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    });
    await test.step('04 - Vào lại giỏ, vẫn x1 và tiền không đổi', async () => {
      await openCart(page); await expect(cartRows(page)).toHaveCount(1); await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_023]:
   * 1. Nhấn đúng nút hình xe đẩy thêm sản phẩm vào giỏ; không kích hoạt đặt hàng/thanh toán.
   * 2. Giỏ ghi nhận đúng một máy Titan Xanh 256GB và không tự tạo đơn hàng.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Samsung S25 Ultra 256GB/Titan Xanh và ghi nhận thông tin sản phẩm.
   * 2. Chỉ nhấn biểu tượng xe đẩy viền đỏ ở bên phải 'MUA NGAY', KHÔNG nhấn nút 'MUA NGAY'.
   * 3. Quan sát phản hồi sau khi nhấn; vào giỏ để đọc sản phẩm mới thêm.
   * 4. Xác minh thao tác giỏ không tự gửi đơn, không yêu cầu thanh toán và không thêm sai SKU.
   */
  test('DDV_F05_023 - Nút hình xe đẩy thêm vào giỏ mà không kích hoạt MUA NGAY', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Chọn Titan Xanh 256GB và ghi SKU/giá', async () => { await visit(page); product = await selectColor(page, 'Titan Xanh'); });
    await test.step('02 - Chỉ click biểu tượng xe đẩy cạnh MUA NGAY', async () => {
      const buy = main(page).getByRole('button', { name: 'MUA NGAY', exact: true }).first();
      const [buyBox, cartBox] = await Promise.all([buy.boundingBox(), addButton(page).boundingBox()]);
      expect(buyBox).not.toBeNull(); expect(cartBox).not.toBeNull();
      expect(cartBox!.x, 'Biểu tượng xe đẩy nằm bên phải MUA NGAY').toBeGreaterThan(buyBox!.x);
      await addSelected(page);
    });
    await test.step('03 - Xác nhận phản hồi thêm giỏ, đọc sản phẩm mới thêm', async () => { await openCart(page); await assertItem(page, product); });
    await test.step('04 - Đúng một SKU x1, ở trang giỏ, không kích hoạt thanh toán', async () => {
      await expect(page).toHaveURL(/\/cart$/); await expect(cartRows(page)).toHaveCount(1);
      await assertTotals(page, [{ product, count: 1 }]);
      await expect(main(page).locator('input[name="phone"], input[name="customerName"]')).toHaveCount(0);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_024]:
   * 1. Giỏ không nhân đôi hoặc xóa sản phẩm do điều hướng.
   * 2. Màu Titan Xanh và lượng x1 vẫn đúng.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh x1 bằng nút hình xe đẩy.
   * 2. Mở giỏ và xác nhận SKU đã có.
   * 3. Nhấn Back để về trang trước rồi Forward để trở lại trang giỏ.
   * 4. Đọc lại SKU, số lượng và thành tiền; xác minh không phát sinh thêm/xóa do điều hướng.
   */
  test('DDV_F05_024 - Giỏ không bị thay đổi sau Back và Forward', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác nhận SKU và tổng trước điều hướng', async () => { await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]); });
    await test.step('03 - Back về sản phẩm rồi Forward trở lại giỏ', async () => {
      await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(main(page).getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
      await page.goForward({ waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL(/\/cart$/);
    });
    await test.step('04 - Không mất/nhân đôi SKU, SL hoặc giá', async () => {
      await expect(cartRows(page)).toHaveCount(1); await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_025]:
   * 1. Giỏ không còn máy nào tính tiền.
   * 2. Trạng thái giỏ trống đúng sau khi xóa hết, không còn tổng giá cũ.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Titan Xanh x1 và Titan Đen x1 bằng nút hình xe đẩy, bảo đảm giỏ có hai SKU.
   * 2. Mở giỏ và xóa một dòng, xác nhận nếu cần.
   * 3. Tiếp tục xóa dòng còn lại.
   * 4. Kiểm tra giỏ trống, bộ đếm và tiền hàng không còn giữ số cũ.
   */
  test('DDV_F05_025 - Xóa tất cả mặt hàng S25 Ultra để giỏ trống', async ({ page }) => {
    await test.step('01 - Chuẩn bị hai SKU Titan Xanh x1, Titan Đen x1 bằng xe đẩy', async () => { await twoColors(page); });
    await test.step('02 - Xóa Titan Đen và xác nhận', async () => { await removeItem(page, 'Titan Đen'); await expect(cartRows(page)).toHaveCount(1); });
    await test.step('03 - Xóa dòng Titan Xanh còn lại và xác nhận', async () => { await removeItem(page, 'Titan Xanh'); });
    await test.step('04 - Không còn SKU tính tiền, bộ đếm/tổng cũ biến mất', async () => { await assertEmpty(page); });
  });

  /** Expected Output from ASM06 [DDV_F05_026]:
   * 1. Nếu đủ hàng, đạt SL 4; nếu có giới hạn thì dừng đúng giới hạn.
   * 2. Không bị bỏ lượt hoặc nhân đôi số lượng ngoài ý muốn.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh x1 bằng biểu tượng xe đẩy.
   * 2. Mở giỏ và ghi số lượng ban đầu 1.
   * 3. Nhấn nút '+' liên tiếp ba lần, chờ từng lần cập nhật.
   * 4. Kiểm tra số lượng 4 nếu tồn kho cho phép; nếu có giới hạn thì ghi mức chặn và phản hồi.
   */
  test('DDV_F05_026 - Nhấn tăng số lượng ba lần từ 1', async ({ page }) => {
    let product!: ProductSnapshot; let finalQuantity = 1; let limited = false;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Ghi nhận số lượng ban đầu 1', async () => { await assertItem(page, product); });
    await test.step('03 - Click + ba lần, chờ server từng lượt; ghi mức chặn nếu có', async () => {
      for (let click = 0; click < 3; click++) {
        const plus = increase(cartRow(page, 'Titan Xanh'));
        if (await plus.isDisabled()) { limited = true; break; }
        const item = await clickQuantity(page, 'Titan Xanh', 1);
        expect(item.quantity).toBe(finalQuantity + 1);
        finalQuantity = item.quantity;
        if (item.isMaxQuantity) { limited = true; break; }
      }
      if (limited) await note(page, `F05_026: server xác nhận giới hạn ${finalQuantity}; nút + bị khóa. Expected Excel cho phép dừng đúng giới hạn.`);
    });
    await test.step('04 - x4 nếu đủ hàng; nếu bị giới hạn phải khóa + và tính đúng số máy đã lưu', async () => {
      if (limited) {
        expect(finalQuantity).toBeGreaterThan(1); expect(finalQuantity).toBeLessThanOrEqual(4);
        await expect(increase(cartRow(page, 'Titan Xanh'))).toBeDisabled();
      } else { expect(finalQuantity).toBe(4); }
      await expect(cartRows(page)).toHaveCount(1); await assertItem(page, product, finalQuantity);
      await assertTotals(page, [{ product, count: finalQuantity }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_027]:
   * 1. SL cuối cùng = 1 và mặt hàng không bị xóa.
   * 2. Tiền hàng đúng cho 1 máy sau thao tác.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh bằng nút hình xe đẩy.
   * 2. Tại giỏ, chuẩn bị số lượng 4 bằng nút '+' nếu số lượng được cho phép.
   * 3. Nhấn nút '-' ba lần, chờ mỗi lần cập nhật.
   * 4. Xác minh số lượng còn 1 và thành tiền không còn tính các máy đã giảm.
   */
  test('DDV_F05_027 - Giảm liên tiếp số lượng từ 4 về 1', async ({ page }) => {
    let product!: ProductSnapshot;
    await test.step('01 - Thêm Titan Xanh qua xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Chuẩn bị x4 bằng nút +, chờ server xác nhận mỗi lần', async () => {
      for (let count = 1; count < 4; count++) {
        if (await increase(cartRow(page, 'Titan Xanh')).isDisabled()) return unavailable(page, 'BLOCKED',
          `F05_027: Không chuẩn bị được x4; giỏ khóa + tại ${count}, thiếu tiền điều kiện x4 của Excel.`);
        const item = await clickQuantity(page, 'Titan Xanh', 1);
        expect(item.quantity).toBe(count + 1);
        if (item.isMaxQuantity && item.quantity < 4) return unavailable(page, 'BLOCKED',
          `F05_027: Server xác nhận giới hạn ${item.quantity} và UI khóa +; không đủ điều kiện x4 để giảm ba lần.`);
      }
      await assertItem(page, product, 4); await assertTotals(page, [{ product, count: 4 }]);
    });
    await test.step('03 - Click − ba lần, đợi mỗi lần cập nhật', async () => { await changeQuantity(page, 'Titan Xanh', 1); });
    await test.step('04 - Dòng còn x1, tiền không tính ba máy đã giảm', async () => { await assertItem(page, product); await assertTotals(page, [{ product, count: 1 }]); });
  });

  /** Expected Output from ASM06 [DDV_F05_028]:
   * 1. Không lưu số lượng 0 rồi vẫn tính tiền máy.
   * 2. Nếu hệ thống hỗ trợ xóa qua 0, phải cập nhật trạng thái và tổng rõ ràng.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Samsung S25 Ultra 256GB/Titan Xanh x1 bằng biểu tượng xe đẩy.
   * 2. Mở giỏ; xác nhận có ô nhập số lượng trực tiếp.
   * 3. Nhập '0', nhấn Enter hoặc rời ô để kích hoạt kiểm tra.
   * 4. Xác minh không lưu số lượng 0 đang tính tiền; kiểm tra phản hồi/luồng xóa nếu có.
   */
  test('DDV_F05_028 - Nhập số lượng 0 cho S25 Ultra', async ({ page }) => {
    let product!: ProductSnapshot; let input!: Locator;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác minh có ô nhập SL theo điều kiện Excel', async () => { input = await editableQuantity(page, 'Titan Xanh'); });
    await test.step('03 - Nhập 0, rời ô để kiểm tra', async () => { await input.fill('0'); await input.blur(); });
    await test.step('04 - Không lưu 0 đang tính tiền; xóa thì tổng cập nhật rõ', async () => {
      const dialog = page.getByRole('dialog').filter({ hasText: 'Xóa sản phẩm?' });
      if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
      if (await cartRows(page).count() === 0) { await assertEmpty(page); return; }
      await expect.poll(async () => Number(await input.inputValue())).toBeGreaterThan(0);
      const count = Number(await input.inputValue()); await assertTotals(page, [{ product, count }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_029]:
   * 1. Không lưu ký tự abc làm SL và không xuất hiện NaN.
   * 2. Giỏ giữ SL hợp lệ hoặc thông báo lỗi, không làm mất SKU.
   *
   * Test Case Procedure (Excel):
   * 1. Chọn Titan Xanh x1, nhấn biểu tượng xe đẩy để thêm vào giỏ.
   * 2. Mở giỏ; xác nhận có ô nhập số lượng.
   * 3. Nhập 'abc' và nhấn Enter hoặc rời ô.
   * 4. Kiểm tra hệ thống không nhận 'abc' thành số lượng hợp lệ, không xuất hiện NaN.
   */
  test('DDV_F05_029 - Từ chối nhập số lượng chữ abc', async ({ page }) => {
    let product!: ProductSnapshot; let input!: Locator;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác minh trường SL nhận bàn phím', async () => { input = await editableQuantity(page, 'Titan Xanh'); });
    await test.step('03 - Nhập abc bằng bàn phím và rời ô', async () => {
      await input.focus(); await input.press('ControlOrMeta+A'); await input.pressSequentially('abc'); await input.blur();
    });
    await test.step('04 - Không nhận abc/NaN, vẫn còn SKU với SL hợp lệ', async () => {
      await expect(input).not.toHaveValue(/abc|NaN/i); await expect(cartRows(page)).toHaveCount(1);
      await expect.poll(async () => Number(await input.inputValue())).toBeGreaterThan(0);
      await expect(main(page)).not.toContainText('NaN'); await assertTotals(page, [{ product, count: Number(await input.inputValue()) }]);
    });
  });

  /** Expected Output from ASM06 [DDV_F05_030]:
   * 1. Giá trị âm không được lưu, không tạo thành tiền âm.
   * 2. Các SKU khác (nếu có) không bị ảnh hưởng.
   *
   * Test Case Procedure (Excel):
   * 1. Thêm Titan Xanh x1 bằng nút hình xe đẩy trên trang Samsung.
   * 2. Mở giỏ; xác nhận có ô nhập số lượng trực tiếp.
   * 3. Nhập '-2' và nhấn Enter hoặc rời ô.
   * 4. Kiểm tra không lưu số âm hoặc tính tiền âm; SKU khác không bị ảnh hưởng.
   */
  test('DDV_F05_030 - Từ chối nhập số lượng âm -2', async ({ page }) => {
    let product!: ProductSnapshot; let input!: Locator;
    await test.step('01 - Thêm Titan Xanh x1 bằng xe đẩy', async () => { product = await addProduct(page); });
    await test.step('02 - Xác minh có ô nhập SL trực tiếp', async () => { input = await editableQuantity(page, 'Titan Xanh'); });
    await test.step('03 - Nhập -2 và rời ô', async () => { await input.fill('-2'); await input.blur(); });
    await test.step('04 - Không lưu số âm hoặc tính tiền âm, giữ đúng SKU', async () => {
      await expect.poll(async () => Number(await input.inputValue())).toBeGreaterThan(0);
      await expect(cartRows(page)).toHaveCount(1); await expect(cartRow(page, 'Titan Xanh')).toBeVisible();
      await assertTotals(page, [{ product, count: Number(await input.inputValue()) }]);
      await expect(summary(page)).not.toContainText(/-\s*\d[\d.,]*\s*[đ₫]/);
    });
  });
});
