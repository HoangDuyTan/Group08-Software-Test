import { expect, type Locator, type Page } from '@playwright/test';

export const BASE = 'https://didongviet.vn';
export const BANK = 'Chuyển khoản ngân hàng';
export const COD = 'Thanh toán khi nhận hàng';
export const VNPAY = 'VNPay';
export const PRODUCT = process.env.F14_PRODUCT_URL ?? `${BASE}/dien-thoai/samsung-galaxy-a07.html`;
export const HIGH_PRODUCT = process.env.F14_HIGH_VALUE_PRODUCT_URL ?? `${BASE}/dien-thoai/iphone-18-pro-max.html`;
export const QUANTITY_PRODUCT = process.env.F14_QUANTITY_PRODUCT_URL ?? `${BASE}/dien-thoai/samsung-galaxy-a07-5g.html`;
export const METHODS = [BANK, COD, 'Apple Pay', 'Kim Ngân Pay', 'EVO TPBank', 'Zalopay', VNPAY, 'MoMo'];

export async function waitForHydration(control: Locator) {
  // CTA có thể xuất hiện từ SSR trước khi handler được gắn. Đợi rồi click một lần.
  await expect.poll(() => control.evaluate(
    element => Object.keys(element).some(key => key.startsWith('__reactProps$'))
  ), { timeout: 15_000 }).toBe(true);
}

export async function dismissCookies(page: Page) {
  if ((await page.context().cookies(BASE)).some(cookie => cookie.name === 'ddv_consent')) return;
  const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
  await expect(reject).toBeVisible({ timeout: 15_000 });
  await waitForHydration(reject);
  await reject.click();
  await expect(reject).toBeHidden();
  await expect.poll(async () => (await page.context().cookies(BASE))
    .some(cookie => cookie.name === 'ddv_consent')).toBe(true);
}
export async function openCheckout(page: Page, product = PRODUCT) {
  const url = new URL(product);
  expect(url.origin).toBe(BASE);
  expect(url.pathname).toMatch(/^\/dien-thoai\/.+\.html$/);
  const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), 'Không mở được sản phẩm test').toBeLessThan(400);
  await dismissCookies(page);
  const buy = page.getByRole('button', { name: /^MUA NGAY$/i }).first();
  await waitForHydration(buy);
  await buy.click();
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
  await dismissCookies(page);
  await expect(page.locator('#payment-change-btn')).toBeVisible();
}
export function paymentDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Chọn phương thức thanh toán', exact: true });
}
export function method(page: Page, name: string): Locator {
  return paymentDialog(page).locator('[role="radio"]').filter({ has: page.getByText(name, { exact: true }) });
}
export async function openMethods(page: Page) {
  if (!(await paymentDialog(page).isVisible())) {
    const change = page.locator('#payment-change-btn');
    await waitForHydration(change);
    await change.click();
  }
  await expect(paymentDialog(page)).toBeVisible();
}
export async function closeMethods(page: Page) {
  await paymentDialog(page).getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(paymentDialog(page)).toBeHidden();
}
export async function assertExclusive(page: Page, name: string) {
  await openMethods(page);
  await expect(method(page, name)).toHaveAttribute('aria-checked', 'true');
  await expect(paymentDialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
  await expect(method(page, name).locator('input[type="radio"]')).toBeChecked();
  await closeMethods(page);
}
export async function selectMethod(page: Page, name: string) {
  await openMethods(page);
  const radio = method(page, name);
  await expect(radio).toBeVisible();
  // Thiếu tồn kho/hạn mức là lỗi dữ liệu cần sửa, không tự skip để làm xanh bộ test.
  await expect(radio.locator('input[type="radio"]'), `${name} phải khả dụng với fixture hiện tại`).toBeEnabled();
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  await expect(paymentDialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
  // Chỉ xác nhận PHƯƠNG THỨC. Không bấm ĐẶT HÀNG hoặc xác nhận người nhận.
  await paymentDialog(page).getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(paymentDialog(page)).toBeHidden();
  await expect(page.locator('#payment-change-btn')).toContainText(name);
}
export function money(text: string): number {
  const match = text.match(/(?:đ\s*)?(\d{1,3}(?:[.,]\d{3})+)(?:\s*[đ₫])?/i);
  expect(match, `Không đọc được tiền VNĐ: ${text}`).not.toBeNull();
  return Number(match![1].replace(/\D/g, ''));
}
export function summaryRow(page: Page, label: string) {
  return page.getByRole('region', { name: 'Thông tin đơn hàng', exact: true }).getByText(label, { exact: true }).locator('xpath=..');
}
export async function total(page: Page) {
  const row = summaryRow(page, 'Tổng tiền');
  await expect(row).toBeVisible();
  const amount = money(await row.innerText());
  expect(amount).toBeGreaterThan(0);
  return amount;
}
export async function orderSnapshot(page: Page) {
  const region = page.getByRole('region', { name: 'Sản phẩm trong đơn hàng', exact: true });
  const productLinks = region.locator('a').filter({ hasText: /\S/ });
  const quantityLabels = region.getByText(/^Số lượng:\s*\d+$/);
  await expect(productLinks.first()).toBeVisible();
  await expect(quantityLabels.first()).toBeVisible();
  const products = await productLinks.allTextContents();
  const quantities = await quantityLabels.allTextContents();
  expect(products.length).toBeGreaterThan(0);
  expect(quantities.length).toBeGreaterThan(0);
  return { total: await total(page), products, quantities };
}
export async function assertNoPurchase(page: Page) {
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
  await expect(page.getByText(/đặt hàng thành công|thanh toán thành công|giao dịch thành công/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^ĐẶT HÀNG\s*(?:\(\d+\))?$/i })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
}
export async function assertNoCardInputs(page: Page) {
  await expect(page.locator('input[autocomplete="cc-number"], input[autocomplete="cc-csc"], input[autocomplete="one-time-code"]')).toHaveCount(0);
  await expect(page.getByPlaceholder(/số thẻ|card number|CVV|CVC|OTP/i)).toHaveCount(0);
}
export function deliveryDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Thông tin giao hàng', exact: true });
}
export function addressDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Thêm địa chỉ nhận hàng', exact: true });
}
export async function openDeliveryDraft(page: Page) {
  await page.getByRole('button', { name: 'Chỉnh sửa địa chỉ nhận hàng', exact: true }).click();
  const dialog = deliveryDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Giao hàng tận nơi', exact: true }).click();
  await expect(dialog.getByPlaceholder('Họ và tên', { exact: true })).toBeEmpty();
  await expect(dialog.getByPlaceholder('Số điện thoại', { exact: true })).toBeEmpty();
  await expect(dialog.getByRole('button', { name: /Thêm Tỉnh\/Thành Phố/i })).toBeVisible();
  return dialog;
}
export async function closeDeliveryDraft(page: Page) {
  // Hủy panel địa chỉ nháp, sau đó hủy panel giao hàng. Không lưu người nhận.
  if (await addressDialog(page).isVisible()) {
    await addressDialog(page).getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(addressDialog(page)).toBeHidden();
  }
  if (await deliveryDialog(page).isVisible()) {
    await deliveryDialog(page).getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(deliveryDialog(page)).toBeHidden();
  }
  await expect(page.locator('#payment-change-btn')).toBeVisible();
}
