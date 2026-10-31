import { expect, test, type Locator, type Page } from '@playwright/test';

/** Shared F07-proven *guest checkout* navigation. Do not submit a real purchase. */
export const HOME = 'https://didongviet.vn/';
const PRODUCTS = [
  { label: 'iPhone 17 256GB', slug: 'iphone-17-256gb' },
  { label: 'iPhone 16 128GB', slug: 'iphone-16-128gb' },
] as const;

export function safeRequiredFixture(name: string): string {
  const value = (process.env[name] ?? '').trim();
  test.skip(!value, `BLOCKED – Thiếu dữ liệu được phép sử dụng: ${name}. Không tự tạo dữ liệu đơn/tồn kho.`);
  return value;
}

export async function dismissCookies(page: Page) {
  const cookie = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /Cookie & trải nghiệm Di Động Việt/i }),
  });
  await cookie.waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {});
  if (await cookie.isVisible().catch(() => false)) {
    const reject = cookie.getByRole('button', { name: 'Từ chối', exact: true });
    if (await reject.isVisible().catch(() => false)) await reject.click();
  }
}

export async function openCheckout(page: Page): Promise<Page> {
  const resp = await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 40_000 });
  expect(resp?.status(), 'Trang chủ không mở được').toBeLessThan(400);
  const errors: string[] = [];
  for (const product of PRODUCTS) {
    await dismissCookies(page);
    const anchor = page.locator(`a[href*="/dien-thoai/${product.slug}.html"]:visible`).first();
    if (!(await anchor.isVisible().catch(() => false))) {
      errors.push(`${product.label}: không thấy liên kết trên trang chủ`); continue;
    }
    const href = await anchor.getAttribute('href');
    if (!href) { errors.push(`${product.label}: thiếu href`); continue; }
    const target = new URL(href, HOME);
    if (target.origin !== new URL(HOME).origin || target.pathname !== `/dien-thoai/${product.slug}.html`) {
      errors.push(`${product.label}: href không hợp lệ ${target}`); continue;
    }
    const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
    await anchor.scrollIntoViewIfNeeded();
    try { await anchor.click({ timeout: 10_000 }); } catch { /* verified link fallback below */ }
    const popup = await popupPromise;
    let current = popup ?? page;
    await current.waitForURL(u => u.pathname === target.pathname, { timeout: 5_000 }).catch(() => {});
    if (new URL(current.url()).pathname !== target.pathname) {
      // Recovery from homepage SPA click failure (known from F07 traces).
      if (popup) { await popup.close(); current = page; }
      const result = await current.goto(target.href, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!result || result.status() >= 400) { errors.push(`${product.label}: không mở được URL đọc từ trang chủ`); continue; }
    }
    if (new URL(current.url()).pathname !== target.pathname) {
      errors.push(`${product.label}: trang sai ${current.url()}`); continue;
    }
    const buy = current.getByRole('button', { name: /^MUA NGAY$/i }).first();
    if (!(await buy.isVisible().catch(() => false))) { errors.push(`${product.label}: không có MUA NGAY`); continue; }
    await dismissCookies(current);
    await buy.click();
    await expect(current.getByRole('button', { name: /^ĐẶT HÀNG\s*(?:\(\d+\))?$/i }).first())
      .toBeVisible({ timeout: 30_000 });
    await expect(current).toHaveURL(/\/checkout(?:[/?#]|$)/);
    return current;
  }
  throw new Error(`Không thể mở checkout từ trang chủ:\n${errors.join('\n')}`);
}

export async function openDeliveryPanel(page: Page) {
  const fullName = page.getByPlaceholder('Họ và tên', { exact: true });
  if (await fullName.isVisible().catch(() => false)) return;
  const edit = page.getByRole('button', { name: 'Chỉnh sửa địa chỉ nhận hàng' }).first();
  await expect(edit, 'Thiếu nút sửa người nhận (checkout)').toBeVisible({ timeout: 18_000 });
  await edit.click();
  await expect(fullName).toBeVisible({ timeout: 15_000 });
}

export function deliveryButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Giao hàng tận nơi$/i }).first();
}
export function pickupButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Nhận tại cửa hàng$/i }).first();
}
export function addressOpenButton(page: Page): Locator {
  return page.getByRole('button', {
    name: /Thêm Tỉnh\/Thành Phố|Chọn địa chỉ từ sổ địa chỉ|Chọn địa chỉ giao hàng/i,
  }).first().or(page.locator('button').filter({ hasText: /Thêm Tỉnh\/Thành Phố|Chọn địa chỉ từ sổ địa chỉ/i }).first()).first();
}
export async function chooseDelivery(page: Page) {
  await expect(deliveryButton(page)).toBeVisible();
  await deliveryButton(page).click();
  await expect(addressOpenButton(page), 'Chọn giao hàng phải cho nhập địa chỉ').toBeVisible();
}
export async function choosePickup(page: Page) {
  await expect(pickupButton(page)).toBeVisible();
  await pickupButton(page).click();
  // Pickup should no longer demand a delivery-to-home address.
  await expect(page.getByText(/chọn cửa hàng|chọn chi nhánh|điểm nhận|cửa hàng nhận|chọn tỉnh|chọn khu vực/i).first(),
    'Chế độ nhận tại cửa hàng không hiển thị lựa chọn điểm nhận').toBeVisible({ timeout: 12_000 });
}

export async function openAddressPicker(page: Page) {
  const button = addressOpenButton(page);
  await expect(button, 'Thiếu nút mở bộ chọn địa chỉ').toBeVisible({ timeout: 12_000 });
  await button.click();
  await expect(page.getByText('Thêm địa chỉ nhận hàng', { exact: true })).toBeVisible({ timeout: 12_000 });
}
export async function chooseCity(page: Page, city = process.env.F08_CITY_A ?? 'Thành phố Hồ Chí Minh') {
  const search = page.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i);
  await expect(search).toBeVisible({ timeout: 10_000 });
  await search.fill(city);
  const option = page.getByText(city, { exact: true }).last();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  await expect(page.getByPlaceholder(/Tìm kiếm Phường\/Xã/i)).toBeVisible({ timeout: 10_000 });
}
export async function chooseWard(page: Page, ward = process.env.F08_WARD_A ?? 'Phường Bến Thành') {
  const search = page.getByPlaceholder(/Tìm kiếm Phường\/Xã/i);
  await expect(search).toBeVisible();
  await search.fill(ward);
  const option = page.getByText(ward, { exact: true }).last();
  await expect(option).toBeVisible();
  await option.click();
  // On actual DDV, search input may remain mounted; check target step instead.
  await expect(page.getByPlaceholder('Nhập số nhà, tên đường', { exact: true })).toBeEditable();
}
export async function fillStreet(page: Page, street = '12A Đường Kiểm Thử') {
  const field = page.getByPlaceholder('Nhập số nhà, tên đường', { exact: true });
  await expect(field).toBeEditable();
  await field.fill(street);
  await field.press('Tab');
  await expect(field).toHaveValue(street);
}
export function addressConfirm(page: Page) {
  return page.getByRole('button', { name: 'Xác nhận', exact: true }).last();
}
export async function saveAddressOnly(page: Page) {
  // Verify the ADDRESS pane is open; this button is NOT the final purchase action.
  await expect(page.getByText('Thêm địa chỉ nhận hàng', { exact: true })).toBeVisible();
  const confirm = addressConfirm(page);
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(page.getByText('Thêm địa chỉ nhận hàng', { exact: true })).toBeHidden({ timeout: 12_000 });
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
}
export async function assertCheckoutSafe(page: Page) {
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
  await expect(page.getByText(/đặt hàng thành công|cảm ơn bạn đã đặt hàng/i)).toHaveCount(0);
}
export async function addTestNote(text: string) {
  test.info().annotations.push({ type: 'observation', description: text });
  await test.info().attach('observation.txt', { body: Buffer.from(text,'utf8'), contentType: 'text/plain' });
}
