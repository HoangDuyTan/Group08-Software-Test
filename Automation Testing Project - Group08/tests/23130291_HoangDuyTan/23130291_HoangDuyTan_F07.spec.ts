import { test, expect, type Page } from '@playwright/test';

/**
 * Group08 - Hoang Duy Tan (23130291)
 * ASM7 / F07 - 30 TEST CASES from ASM06 (guest checkout)
 * Starting page: https://didongviet.vn/; verified V3 navigation PASS on 2026-10-24
 * No login and NO final order submission.
 * ASM06-driven assertions. Address-picker selectors updated from user's
 * 2026-10-24 City/Ward/Street screenshots; verify them on the live page.
 * Green does not prove server-side validation or completed order placement.
 *
 * Why V3: homepage product anchors have genuine href, but clicking left URL
 * unchanged on the reporter's browser. Try a genuine click, then use the href
 * obtained from the homepage as a transparent navigation fallback.
 */

const HOME = 'https://didongviet.vn/';
const PRODUCTS = [
  { label: 'iPhone 17 256GB', slug: 'iphone-17-256gb' },
  { label: 'iPhone 16 128GB', slug: 'iphone-16-128gb' },
] as const;

function buyNow(page: Page) {
  return page.getByRole('button', { name: /^MUA NGAY$/i }).first();
}

function onProduct(page: Page, slug: string): boolean {
  try {
    const url = new URL(page.url());
    return url.origin === new URL(HOME).origin &&
      url.pathname === `/dien-thoai/${slug}.html`;
  } catch {
    return false;
  }
}

async function dismissCookieDialog(page: Page) {
  // This dialog is visible in the user's failed screenshot and error-context.
  const cookie = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /Cookie & trải nghiệm Di Động Việt/i }),
  });
  await cookie.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (!(await cookie.isVisible())) return;

  const reject = cookie.getByRole('button', { name: 'Từ chối', exact: true });
  if (await reject.isVisible()) {
    await reject.click();
    await expect(cookie).toBeHidden({ timeout: 7_000 });
    console.log('[F07] Dismissed the cookie banner using TU CHOI.');
  } else {
    console.log('[F07] Cookie dialog appeared, but TU CHOI was not visible.');
  }
}

async function openProductFromHomepage(home: Page): Promise<Page> {
  const issues: string[] = [];

  for (const product of PRODUCTS) {
    if (home.url() !== HOME) {
      await home.goto(HOME, { waitUntil: 'domcontentloaded' });
    }
    await dismissCookieDialog(home);

    const selector = `a[href*="/dien-thoai/${product.slug}.html"]:visible`;
    const link = home.locator(selector).first();
    try {
      await link.waitFor({ state: 'visible', timeout: 12_000 });
    } catch {
      issues.push(`${product.label}: no visible product anchor on homepage`);
      continue;
    }

    // Read the real href from the homepage; do not hardcode a product URL.
    const rawHref = await link.getAttribute('href');
    if (!rawHref) {
      issues.push(`${product.label}: anchor has no href`);
      continue;
    }
    const target = new URL(rawHref, HOME);
    if (target.origin !== new URL(HOME).origin ||
        target.pathname !== `/dien-thoai/${product.slug}.html`) {
      issues.push(`${product.label}: unexpected href ${target.href}`);
      continue;
    }
    console.log(`[F07] Product from homepage: ${product.label} -> ${target.href}`);

    await link.scrollIntoViewIfNeeded();
    let current: Page = home;
    const popupPromise = home.waitForEvent('popup', { timeout: 2_000 }).catch(() => null);
    try {
      await link.click({ timeout: 10_000 });
    } catch (error) {
      console.log(`[F07] Homepage click failed: ${String(error).slice(0, 220)}`);
    }
    const popup = await popupPromise;
    if (popup) current = popup;

    // SPA navigation may occur AFTER Playwright click resolves.
    await current.waitForURL(url => url.pathname === target.pathname, {
      timeout: 6_000,
    }).catch(() => {});
    console.log(`[F07] URL after homepage click: ${current.url()}`);

    if (!onProduct(current, product.slug)) {
      // Genuine homepage click did not navigate (confirmed in user trace).
      // Navigating to a DISCOVERED href is different from guessing a static URL.
      if (popup) {
        await popup.close();
        current = home;
      }
      console.log(`[F07] Click did not navigate; opening verified homepage href: ${target.href}`);
      const response = await current.goto(target.href, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      }).catch(error => {
        issues.push(`${product.label}: goto href failed: ${String(error).slice(0, 200)}`);
        return null;
      });
      if (!response || response.status() >= 400) {
        issues.push(`${product.label}: HTTP ${response?.status() ?? '(no response)'}`);
        continue;
      }
    }

    console.log(`[F07] Product URL: ${current.url()}`);
    if (!onProduct(current, product.slug)) {
      issues.push(`${product.label}: unexpected final URL ${current.url()}`);
      continue;
    }

    try {
      await expect(buyNow(current), `No MUA NGAY on ${product.label}`).toBeVisible({
        timeout: 15_000,
      });
      console.log(`[F07] Product verified and MUA NGAY visible: ${product.label}`);
      return current;
    } catch {
      issues.push(`${product.label}: no visible MUA NGAY on ${current.url()}`);
    }
  }

  throw new Error(
    'Cannot reach a purchasable product from the homepage.\n' +
    issues.join('\n') +
    '\nPlease send the URL/HTTP status from the console and failure screenshot.',
  );
}

async function openOrderInfoFromHomepage(page: Page): Promise<Page> {
  await test.step('01 - Mo trang chu', async () => {
    const response = await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    expect(response, 'Homepage returned no HTTP response').not.toBeNull();
    expect(response!.status(), 'Homepage HTTP error').toBeLessThan(400);
  });

  const productPage = await test.step('02 - Tu chon san pham tu trang chu', async () => {
    return openProductFromHomepage(page);
  });

  await test.step('03 - Bam MUA NGAY', async () => {
    await dismissCookieDialog(productPage);
    await buyNow(productPage).click();
  });

  await test.step('04 - Cho trang Thanh toan', async () => {
    const placeOrder = productPage.getByRole('button', {
      name: /^ĐẶT HÀNG\s*(?:\(\d+\))?$/i,
    }).first();
    await expect(placeOrder, 'MUA NGAY did not reach Checkout').toBeVisible({
      timeout: 35_000,
    });
    console.log(`[F07] Checkout reached: ${productPage.url()}`);
  });

  await test.step('05 - Mo panel Thong tin giao hang', async () => {
    const name = productPage.getByPlaceholder('Họ và tên', { exact: true });
    if (await name.isVisible()) return;

    // Clicking DAT HANG with valid user data could create a real order.
    // Use the verified recipient-edit action instead.
    const editRecipient = productPage.getByRole('button', {
      name: 'Chỉnh sửa địa chỉ nhận hàng',
    }).first();
    await expect(editRecipient, 'No safe recipient-edit action on checkout').toBeVisible({
      timeout: 15_000,
    });
    await editRecipient.click();
    await expect(name, 'Shipping form did not open').toBeVisible({ timeout: 15_000 });
  });

  return productPage;
}


/**
 * F07_030: A reload may discard the checkout's temporary recipient state.
 * Do not assume the recipient card will exist after hydration. Inspect the
 * post-reload UI before attempting to click anything. No purchase submission.
 * If the panel can no longer be reached, preserve evidence rather than
 * silently marking the test passed or force-clicking ĐẶT HÀNG.
 */
async function refreshUiMetadata(page: Page) {
  return page.evaluate(() => {
    const isVisible = (element: Element) =>
      !!(element as HTMLElement).getClientRects().length;
    const visibleInputs = Array.from(document.querySelectorAll('input, textarea'))
      .filter(isVisible)
      .map(input => ({
        tag: input.tagName.toLowerCase(),
        type: input.getAttribute('type'),
        placeholder: input.getAttribute('placeholder'),
        disabled: (input as HTMLInputElement).disabled,
        readOnly: (input as HTMLInputElement).readOnly,
        // Intentionally DO NOT read .value: protect user test data.
      }));
    const visibleButtonMetadata = Array.from(document.querySelectorAll('button'))
      .filter(isVisible)
      .map(button => ({
        id: button.id,
        ariaLabel: button.getAttribute('aria-label'),
        // Do not record innerText: recipient cards can contain phone numbers.
      }));
    return {
      path: window.location.pathname,
      readyState: document.readyState,
      visibleInputs,
      relevantButtons: visibleButtonMetadata.filter(button =>
        button.id === 'delivery-address-card' ||
        button.id === 'addr-confirm-btn' ||
        /chỉnh sửa địa chỉ nhận hàng/i.test(button.ariaLabel ?? '')
      ),
      visibleButtonCount: visibleButtonMetadata.length,
    };
  });
}

async function attachRefreshEvidence(page: Page, message: string) {
  const metadata = {
    message,
    url: page.url(),
    title: await page.title(),
    ui: await refreshUiMetadata(page),
  };
  console.log('[F07_030] ' + JSON.stringify(metadata));
  await test.info().attach('F07_030_post_reload_metadata.json', {
    body: Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'),
    contentType: 'application/json',
  });
  // Mask text inputs; inspect the screenshot locally before sharing a trace.
  await test.info().attach('F07_030_post_reload_masked.png', {
    body: await page.screenshot({ fullPage: true, mask: page.locator('input,textarea') }),
    contentType: 'image/png',
  });
}

/**
 * Recover F07_030 after a browser refresh.
 * The user's trace (24/10/2026) confirms /checkout -> /cart on reload.
 * The CART's MUA NGAY (1) is a checkout navigation control; it is NOT
 * the CHECKOUT's ĐẶT HÀNG (1) final order control. Never click the latter.
 *
 * Returning to checkout validates recoverability, not a promise to persist
 * all form fields: ASM06 did not specify "retain" versus "clear" on refresh.
 */
async function resumeCheckoutAfterRefresh(page: Page): Promise<'cart' | 'checkout'> {
  // A client-side redirect can follow the HTTP reload; wait briefly for it.
  await page.waitForURL(url => url.pathname === '/cart', {
    timeout: 6_000,
  }).catch(() => {});

  const afterRefreshPath = new URL(page.url()).pathname;
  console.log(`[F07_030] Observed path after refresh: ${afterRefreshPath}`);

  if (afterRefreshPath === '/cart') {
    await test.step('F07_030 - Phat hien /cart sau Refresh va quay lai checkout an toan', async () => {
      await expect(page.getByText('Giỏ hàng của bạn', { exact: true }),
        'After refresh, expected a non-empty shopping cart')
        .toBeVisible({ timeout: 15_000 });

      // Both products are valid fallbacks in the shared homepage setup.
      await expect(page.getByText(/iPhone (?:17 256GB|16 128GB)/i).first(),
        'Selected product disappeared from the cart after refresh')
        .toBeVisible({ timeout: 15_000 });

      const resume = page.getByRole('button', {
        name: /^MUA NGAY\s*\(\d+\)$/i,
      }).first();
      await expect(resume, 'Safe MUA NGAY button not found on /cart')
        .toBeVisible({ timeout: 15_000 });
      await expect(resume, 'Cart has no selected product to continue')
        .toBeEnabled();

      // Safety guard: never click a similar button outside the cart.
      expect(new URL(page.url()).pathname, 'Refusing to click outside /cart').toBe('/cart');
      await resume.click();

      await expect(page, 'Cart MUA NGAY did not return to Checkout')
        .toHaveURL(/\/checkout(?:[/?#]|$)/i, { timeout: 30_000 });
      await expect(page.getByRole('button', {
        name: /^ĐẶT HÀNG\s*(?:\(\d+\))?$/i,
      }).first(), 'Checkout did not render after returning from Cart')
        .toBeVisible({ timeout: 20_000 });

      console.log('[F07_030] Refreshed checkout redirected to /cart; safely resumed with cart MUA NGAY.');
    });
    return 'cart';
  }

  if (afterRefreshPath === '/checkout') {
    await expect(page.getByRole('button', {
      name: /^ĐẶT HÀNG\s*(?:\(\d+\))?$/i,
    }).first(), 'Checkout not ready after refresh')
      .toBeVisible({ timeout: 20_000 });
    console.log('[F07_030] Checkout remained at /checkout after refresh.');
    return 'checkout';
  }

  await attachRefreshEvidence(page,
    `Unexpected route after refresh: ${afterRefreshPath} (expected /checkout or /cart)`);
  throw new Error(`F07_030: unexpected redirect ${afterRefreshPath} after Refresh`);
}

async function openRecipientAfterCheckoutRecovery(page: Page): Promise<void> {
  const recipientName = page.getByPlaceholder('Họ và tên', { exact: true });
  if (await recipientName.isVisible().catch(() => false)) return;

  const card = page.locator('#delivery-address-card');
  try {
    await expect(card,
      'Recipient-edit card not available after returning from /cart')
      .toBeVisible({ timeout: 20_000 });
    await card.click({ timeout: 12_000 });
    await expect(recipientName,
      'Recipient form could not be reopened after refresh/recovery')
      .toBeVisible({ timeout: 15_000 });
  } catch (error) {
    await attachRefreshEvidence(page,
      `Could not reopen recipient panel after Checkout recovery: ${String(error).slice(0, 250)}`);
    throw error;
  }
}

// ---------------- ASM06 F07 fixtures and shared assertions ----------------
// The owner of F07_TEST_PHONE must authorize its use; the suite NEVER creates an order.
const AUTHORIZED_PHONE = (process.env.F07_TEST_PHONE ?? '').trim();
const EXPECTED_VALID_PHONE = /^0\d{9}$/;

function fullName(page: Page) {
  return page.getByPlaceholder('Họ và tên', { exact: true });
}
function phoneNumber(page: Page) {
  return page.getByPlaceholder('Số điện thoại', { exact: true });
}
function emailInput(page: Page) {
  return page.getByPlaceholder('Email (không bắt buộc)', { exact: true });
}

async function fillBlur(locator: ReturnType<typeof fullName>, value: string) {
  await expect(locator).toBeEditable();
  await locator.fill(value);
  await locator.press('Tab');
}

function mustHaveAuthorizedPhone() {
  // Data in ASM06 explicitly says valid phone must be authorized test data.
  test.skip(!EXPECTED_VALID_PHONE.test(AUTHORIZED_PHONE),
    'ASM06 requires a valid authorized test phone. Set $env:F07_TEST_PHONE in PowerShell (10 digits, starts with 0).');
  return AUTHORIZED_PHONE;
}

async function mustRemainCheckout(page: Page) {
  await expect(page).toHaveURL(/\/checkout(?:\?|$)/i);
  await expect(page.getByText(/đặt hàng thành công|đặt mua thành công|cảm ơn bạn đã đặt hàng/i))
    .toHaveCount(0);
}

/** Clicks only the ADDRESS PANEL confirm button, NEVER the page's ĐẶT HÀNG button.
 *  Require the delivery address to be unselected first, preventing a real order. */
async function validateIncompletePanel(page: Page) {
  const noAddress = page.getByRole('button', { name: /Chọn địa chỉ từ sổ địa chỉ/i }).first();
  const addressError = page.getByText(/Vui lòng chọn địa chỉ giao hàng/i).first();
  const safe = (await noAddress.isVisible().catch(() => false)) ||
    (await addressError.isVisible().catch(() => false));
  expect(safe, 'Safety guard: no unselected address; refuse to submit any form').toBeTruthy();
  const panelConfirm = page.locator('#addr-confirm-btn');
  await expect(panelConfirm, 'Missing panel-only Xác nhận button').toBeVisible();
  await panelConfirm.click();
  await expect(fullName(page), 'Incomplete panel must remain open').toBeVisible();
  await mustRemainCheckout(page);
}

/** Compare against errors targeted to the given input, rather than unrelated address errors. */
async function hasTargetedFieldError(
  field: ReturnType<typeof fullName>,
  kind: 'name' | 'phone'
): Promise<boolean> {
  return field.evaluate((el: HTMLInputElement, which) => {
    if (el.getAttribute('aria-invalid') === 'true') return true;
    // A native invalid state counts only if it has a relevant validity reason.
    if (el.matches(':invalid') &&
        (el.validity.valueMissing || el.validity.patternMismatch ||
         el.validity.tooShort || el.validity.tooLong || el.validity.typeMismatch)) return true;
    const fieldWord = which === 'name' ? /(họ\s*(?:và\s*)?tên|tên\s*người|tên\s*bắt\s*buộc)/i
      : /(số\s*điện\s*thoại|sđt|điện\s*thoại)/i;
    const errorWord = /(vui lòng|bắt buộc|không hợp lệ|không đúng|thiếu|lỗi|invalid|required)/i;
    let current = el.parentElement;
    // Restrict to nearby form-field wrappers, never whole-page/general address toast.
    for (let depth = 0; depth < 3 && current; depth++, current = current.parentElement) {
      const content = (current.innerText || '').trim().slice(0, 400);
      if (fieldWord.test(content) && errorWord.test(content)) return true;
    }
    return false;
  }, kind);
}

async function expectTargetedFieldError(
  field: ReturnType<typeof fullName>,
  kind: 'name' | 'phone'
) {
  await expect.poll(() => hasTargetedFieldError(field, kind), {
    timeout: 4_000,
    message: `ASM06 expected a ${kind} validation error, not just an address error`,
  }).toBe(true);
}

async function expectNoTargetedFieldError(
  field: ReturnType<typeof fullName>,
  kind: 'name' | 'phone'
) {
  expect(await hasTargetedFieldError(field, kind)).toBe(false);
}

async function checkBadPhone(page: Page, invalid: string) {
  const field = phoneNumber(page);
  await fillBlur(field, invalid);
  const actual = await field.inputValue();
  // Filtering/rejecting invalid characters is acceptable. A fully preserved
  // invalid value must instead produce field-specific validation after confirm.
  if (actual !== invalid && actual === '') {
    // Invalid characters were rejected; phone is now empty, never a valid phone.
    await mustRemainCheckout(page);
    return;
  }
  // A malformed input becoming a valid ten-digit number does not automatically
  // prove rejection. For these negative cases, the invalid characters must have
  // been removed; record exactly what happened rather than treating a valid
  // normalized value as sufficient evidence of validation.
  if (EXPECTED_VALID_PHONE.test(actual) && actual !== invalid) {
    expect(actual, 'Only digit-preserving filtering may normalize the input')
      .toBe(invalid.replace(/[^0-9]/g, '').slice(0, 10));
    await recordObservation(`SĐT sai ${JSON.stringify(invalid)} được lọc thành ${JSON.stringify(actual)}`);
    await mustRemainCheckout(page);
    return;
  }
  await validateIncompletePanel(page);
  await expectTargetedFieldError(field, 'phone');
}

async function recordObservation(text: string) {
  // Appears in the HTML report, making conditional outcomes reviewable.
  await test.info().attach('actual-observation.txt', {
    body: Buffer.from(text, 'utf8'),
    contentType: 'text/plain; charset=utf-8',
  });
  console.log('[F07 observation] ' + text);
}

async function checkNonCrashName(page: Page, candidate: string) {
  const field = fullName(page);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await fillBlur(field, candidate);
  const value = await field.inputValue();
  // Website may reject or normalize; neither may crash or turn text into markup.
  expect(typeof value).toBe('string');
  await expect(field).toBeVisible();
  expect(pageErrors, 'Input triggered an uncaught application exception').toEqual([]);
  await mustRemainCheckout(page);
}

async function openAddressPicker(page: Page) {
  // Guest checkout screenshot: "Thêm Tỉnh/Thành Phố, Phường Xã".
  // Logged-in screenshot: "Chọn địa chỉ từ sổ địa chỉ".
  const button = page.getByRole('button', {
    name: /Chọn địa chỉ từ sổ địa chỉ|Thêm Tỉnh\/Thành Phố|Chọn địa chỉ giao hàng/i,
  }).first().or(page.locator('button').filter({
    hasText: /Chọn địa chỉ từ sổ địa chỉ|Thêm Tỉnh\/Thành Phố/i,
  }).first()).first();
  test.skip(!(await button.isVisible().catch(() => false)),
    'Cannot find the address-picker opener in this checkout session');
  await button.click();
  await expect(page.getByText('Thêm địa chỉ nhận hàng', { exact: true }),
    'Address picker did not open').toBeVisible({ timeout: 12_000 });
}

/** Current public UI (screenshot 2026-10-24) has two administrative levels:
 * Thành phố/Tỉnh -> Phường/Xã -> Số nhà, tên đường (NO Quận/Huyện).
 * The ASM06 IDs/titles stay unchanged for traceability. */
const CITY_A = process.env.F07_CITY_A ?? 'Thành phố Hồ Chí Minh';
const CITY_B = process.env.F07_CITY_B ?? 'Thành phố Hà Nội';
// Ward name confirmed in the user's screenshot after selecting HCMC.
const WARD_A = process.env.F07_WARD_A ?? 'Phường Bến Thành';
// Fictional detail, used only in the local browser checkout form; no real order is placed.
const DEMO_STREET = '12A Đường Kiểm Thử';

function addressPickerHeading(page: Page) {
  return page.getByText('Thêm địa chỉ nhận hàng', { exact: true });
}

function addressPickerConfirm(page: Page) {
  // The child pane has its own Xác nhận button. NEVER click the checkout
  // page's ĐẶT HÀNG button or the parent recipient panel while this is open.
  return page.getByRole('button', { name: 'Xác nhận', exact: true }).last();
}

async function chooseCityFromActualPicker(page: Page, city: string) {
  const search = page.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i);
  await expect(search, 'City-search input is not visible').toBeVisible({ timeout: 10_000 });
  await search.fill(city);
  const result = page.getByText(city, { exact: true }).last();
  await expect(result, `No city option named ${city}`).toBeVisible({ timeout: 10_000 });
  await result.click();
  await expect(page.getByText('Phường/Xã', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder(/Tìm kiếm Phường\/Xã/i)).toBeVisible({ timeout: 8_000 });
}

async function chooseWardFromActualPicker(page: Page, ward: string) {
  const search = page.getByPlaceholder(/Tìm kiếm Phường\/Xã/i);
  await expect(search, 'Ward-search input is not visible after selecting city')
    .toBeVisible({ timeout: 10_000 });
  await search.fill(ward);
  const result = page.getByText(ward, { exact: true }).last();
  await expect(result, `No ward option named ${ward}`).toBeVisible({ timeout: 10_000 });
  await result.click();
  // Verified by Playwright failure video (2026-10-24): after clicking a ward,
  // step 3 IS shown and editable, but the old Ward search input may remain
  // visible with value "Phường Bến Thành". Its visibility is not a reliable
  // transition signal. Assert the DESTINATION step and its editable textbox.
  await expect(page.getByText('Nhập số nhà, tên đường', { exact: true }),
    'Ward selection did not advance to the street-detail step')
    .toBeVisible({ timeout: 10_000 });
  await expect(addressPickerHeading(page)).toBeVisible();
  await expect(streetControl(page),
    'Street-detail textbox is missing after selecting a ward')
    .toBeEditable({ timeout: 10_000 });
  await recordObservation(`Address flow: selected ward ${ward}; street input is editable. ` +
    'The Ward-search control may remain mounted/visible by design.');
}

function streetControl(page: Page) {
  // The user's newest 2026-10-24 screenshots AND the failed-run video show
  // the actual input placeholder "Nhập số nhà, tên đường". The Ward-search
  // input can remain visible after step 3 opens, so selecting the last generic
  // input would be ambiguous. Use this concrete, user-verified locator.
  return page.getByPlaceholder('Nhập số nhà, tên đường', { exact: true });
}

async function confirmedStreetInput(page: Page) {
  await expect(addressPickerHeading(page), 'Address picker is not open').toBeVisible();
  await expect(page.getByText('Nhập số nhà, tên đường', { exact: true }),
    'Not at the street-detail step').toBeVisible();
  const field = streetControl(page);
  await expect(field, 'No editable street-detail textbox detected at address step 3')
    .toBeEditable({ timeout: 10_000 });
  return field;
}

async function expectAddressPickerOnly(page: Page) {
  await expect(addressPickerHeading(page), 'Address-picker pane unexpectedly closed')
    .toBeVisible();
  await mustRemainCheckout(page);
}

// Each test runs in its own browser context, beginning at the real homepage.
// The V3 navigation was confirmed by the user as 1 passed on 2026-10-24.
test.describe('ASM07 | F07 | D07 | 30 test cases from Assignment 6', () => {
  test.describe.configure({ timeout: 150_000 });

  /** Expected Output from ASM06 [DDV_F07_001]:
   * 1. Báo trường Họ tên bắt buộc; không cho qua bước khi thiếu dữ liệu.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_001 - Bắt buộc nhập: Trống họ tên', async ({ page }) => {
    const authorized = mustHaveAuthorizedPhone();
    await openOrderInfoFromHomepage(page);
    await fillBlur(phoneNumber(page), authorized);
    await fillBlur(fullName(page), '');
    await validateIncompletePanel(page);
    await expectTargetedFieldError(fullName(page), 'name');
  });

  /** Expected Output from ASM06 [DDV_F07_002]:
   * 1. Báo trường SĐT bắt buộc; không chấp nhận biểu mẫu chưa có SĐT.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_002 - Bắt buộc nhập: Trống số điện thoại', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    await fillBlur(phoneNumber(page), '');
    await validateIncompletePanel(page);
    await expectTargetedFieldError(phoneNumber(page), 'phone');
  });

  /** Expected Output from ASM06 [DDV_F07_003]:
   * 1. Nếu Tỉnh/Thành bắt buộc: yêu cầu chọn, không tiến bước; không dùng giá trị mặc định sai.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_003 - Bắt buộc nhập: Trống tỉnh/thành nếu yêu cầu', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    // Delivery-to-address is selected by default in the verified guest UI.
    await expect(page.getByRole('button', { name: /Giao hàng tận nơi/i })).toBeVisible();
    await openAddressPicker(page);
    // Verified from user's screenshot: City/Province is the very first
    // required stage, not a native <select> with required attribute.
    await expect(page.getByText('Vui lòng chọn Tỉnh/Thành Phố', { exact: true }))
      .toBeVisible();
    await expect(page.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i)).toBeVisible();
    await expect(page.getByText('Phường/Xã', { exact: true })).toBeVisible();
    // Do not pick any city: remain at the first address-selection stage.
    await recordObservation('F07_003: Province/city empty. UI requires province selection before ward/street stages. Not an order-submit validation test.');
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_004]:
   * 1. Nếu địa chỉ chi tiết bắt buộc: chỉ rõ ô lỗi; không xử lý thành địa chỉ hợp lệ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_004 - Bắt buộc nhập: Trống địa chỉ cụ thể nếu giao hàng', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await expect(page.getByRole('button', { name: /Giao hàng tận nơi/i })).toBeVisible();
    await openAddressPicker(page);
    await chooseCityFromActualPicker(page, CITY_A);
    await chooseWardFromActualPicker(page, WARD_A);

    const street = await confirmedStreetInput(page);
    await fillBlur(street, '');
    await expect(street).toHaveValue('');
    const confirm = addressPickerConfirm(page);
    await expect(confirm, 'Address-only Xác nhận button is missing').toBeVisible();

    if (await confirm.isEnabled()) {
      await confirm.click();
      // An address without a required house/street detail must not be saved.
      await expectAddressPickerOnly(page);
      await expect(street, 'Missing street must remain empty').toHaveValue('');
      await recordObservation('F07_004: empty street rejected; address picker stays open.');
    } else {
      await expect(confirm, 'Incomplete address should keep Save/Confirm disabled')
        .toBeDisabled();
      await expectAddressPickerOnly(page);
      await recordObservation('F07_004: empty street prevents confirmation (button disabled).');
    }
  });

  /** Expected Output from ASM06 [DDV_F07_005]:
   * 1. Không vượt qua bước nhập thông tin; chỉ ra các trường thiếu (đồng thời hoặc tuần tự rõ ràng).
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_005 - Bắt buộc nhập: Bỏ trống nhiều trường bắt buộc', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), '');
    await fillBlur(phoneNumber(page), '');
    await validateIncompletePanel(page);
    const nameBad = await hasTargetedFieldError(fullName(page), 'name');
    const phoneBad = await hasTargetedFieldError(phoneNumber(page), 'phone');
    expect(nameBad || phoneBad,
      'No field-specific error for either required field').toBe(true);

    // Sequential validation is allowed by ASM06, but BOTH omitted fields
    // must eventually be identifiable. Filling name is safe; it cannot place
    // an order while the phone and delivery address are still missing.
    if (!phoneBad) {
      await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
      await validateIncompletePanel(page);
      await expectTargetedFieldError(phoneNumber(page), 'phone');
    }
    // When phone is prioritized, detecting the name error after resolving the
    // phone requires a genuinely authorized valid number.
    if (!nameBad) {
      test.skip(!EXPECTED_VALID_PHONE.test(AUTHORIZED_PHONE),
        'Sequential name validation requires F07_TEST_PHONE to clear the phone error');
      await fillBlur(phoneNumber(page), AUTHORIZED_PHONE);
      await validateIncompletePanel(page);
      await expectTargetedFieldError(fullName(page), 'name');
    }
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_006]:
   * 1. Không nhận chữ cái là số điện thoại hợp lệ; có cảnh báo hoặc chặn tiếp tục.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_006 - Định dạng số điện thoại: SĐT chỉ chữ', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    await checkBadPhone(page, 'abcdefghij');
  });

  /** Expected Output from ASM06 [DDV_F07_007]:
   * 1. Từ chối dấu '@' trong số điện thoại; không coi chuỗi là SĐT hợp lệ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_007 - Định dạng số điện thoại: SĐT có ký tự @', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    await checkBadPhone(page, '09@1234567');
  });

  /** Expected Output from ASM06 [DDV_F07_008]:
   * 1. Phát hiện SĐT thiếu chữ số so với quy tắc đang áp dụng và chặn tiếp tục.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_008 - Định dạng số điện thoại: SĐT thiếu chữ số', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    await checkBadPhone(page, '09012345');
  });

  /** Expected Output from ASM06 [DDV_F07_009]:
   * 1. Không chấp nhận SĐT quá dài so với quy tắc đang áp dụng; lỗi rõ ràng.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_009 - Định dạng số điện thoại: SĐT quá nhiều chữ số', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    const field = phoneNumber(page);
    await fillBlur(field, '090123456789');
    const actual = await field.inputValue();
    if (EXPECTED_VALID_PHONE.test(actual) && actual !== '090123456789') {
      // MaxLength may cap an overlong string to 10 digits.
      expect(actual.length).toBe(10);
    } else {
      await validateIncompletePanel(page);
      await expectTargetedFieldError(field, 'phone');
    }
  });

  /** Expected Output from ASM06 [DDV_F07_010]:
   * 1. Xử lý thống nhất theo đặc tả (chuẩn hóa nếu được cho phép, hoặc thông báo sai); không lưu SĐT không hợp lệ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_010 - Định dạng số điện thoại: SĐT có khoảng trắng xen giữa', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    const field = phoneNumber(page);
    await fillBlur(field, '090 123 4567');
    const actual = await field.inputValue();
    if (actual === '0901234567') {
      // Accepted only after explicit normalization to digits.
      expect(actual).toMatch(EXPECTED_VALID_PHONE);
    } else if (actual === '') {
      // Entire pasted string rejected because it contained spaces.
      await mustRemainCheckout(page);
    } else {
      await validateIncompletePanel(page);
      await expectTargetedFieldError(field, 'phone');
    }
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_011]:
   * 1. Tên tiếng Việt có dấu được hiển thị nguyên vẹn; không có cảnh báo sai với tên hợp lệ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_011 - Dữ liệu hợp lệ: Tên tiếng Việt có dấu', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    await expect(fullName(page)).toHaveValue('Nguyễn Văn Kiểm Thử');
    await expectNoTargetedFieldError(fullName(page), 'name');
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_012]:
   * 1. Trường tên giữ đúng giá trị và không báo lỗi khi phù hợp quy tắc tên.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_012 - Dữ liệu hợp lệ: Tên không dấu', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyen Van Kiem Thu');
    await expect(fullName(page)).toHaveValue('Nguyen Van Kiem Thu');
    await expectNoTargetedFieldError(fullName(page), 'name');
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_013]:
   * 1. SĐT hợp lệ vượt qua kiểm tra định dạng; không bị báo lỗi sai.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_013 - Dữ liệu hợp lệ: SĐT đúng định dạng của website', async ({ page }) => {
    const authorized = mustHaveAuthorizedPhone();
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    await fillBlur(phoneNumber(page), authorized);
    await expect(phoneNumber(page)).toHaveValue(authorized);
    await expectNoTargetedFieldError(phoneNumber(page), 'phone');
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_014]:
   * 1. Khoảng trắng được xử lý nhất quán theo yêu cầu; không tạo tên chỉ chứa dấu cách.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_014 - Dữ liệu hợp lệ: Tên kèm dấu cách', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    const input = '  Nguyễn Văn Kiểm Thử  ';
    await fillBlur(fullName(page), input);
    const actual = await fullName(page).inputValue();
    // ASM06 permits normalization OR faithful preservation of meaningful spaces.
    expect(actual.trim()).toBe('Nguyễn Văn Kiểm Thử');
    await expectNoTargetedFieldError(fullName(page), 'name');
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_015]:
   * 1. Cấp địa chỉ phụ thuộc hiển thị chính xác; giá trị đã chọn hợp lệ được chấp nhận.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_015 - Dữ liệu hợp lệ: Chọn tỉnh quận phường hợp lệ', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await openAddressPicker(page);
    await chooseCityFromActualPicker(page, CITY_A);
    await chooseWardFromActualPicker(page, WARD_A);

    const street = await confirmedStreetInput(page);
    await fillBlur(street, DEMO_STREET);
    await expect(street).toHaveValue(DEMO_STREET);
    await expect(page.getByText(CITY_A, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(WARD_A, { exact: true }).first()).toBeVisible();

    // This is the address-picker confirmation, NOT a checkout order submission.
    await expect(addressPickerConfirm(page)).toBeEnabled();
    await addressPickerConfirm(page).click();
    await expect(addressPickerHeading(page),
      'Valid City/Ward/Street selection was not accepted by the address picker')
      .toBeHidden({ timeout: 12_000 });
    await mustRemainCheckout(page);
    await recordObservation(
      `F07_015: address-picker saved city=${CITY_A}; ward=${WARD_A}; ` +
      `fictional street detail used. Order NOT submitted.`);
  });

  /** Expected Output from ASM06 [DDV_F07_016]:
   * 1. Áp dụng quy tắc độ dài tối thiểu đã xác nhận; nếu từ chối, có thông báo rõ; không lỗi trang.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_016 - Giá trị biên: Tên 1 ký tự', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await checkNonCrashName(page, 'A');
    const actual = await fullName(page).inputValue();
    // No undocumented minimum length is imposed: site may accept or reject.
    expect(actual === 'A' || actual === '').toBe(true);
    const nativeMin = await fullName(page).evaluate((e: HTMLInputElement) => e.minLength);
    if (actual === 'A' && nativeMin > 1) {
      expect(await fullName(page).evaluate((e: HTMLInputElement) => e.validity.tooShort),
        'Input explicitly declares a minimum length; one character must be invalid').toBe(true);
    }
    await recordObservation(`Name one character: actual=${JSON.stringify(actual)}, nativeMinLength=${nativeMin}`);
  });

  /** Expected Output from ASM06 [DDV_F07_017]:
   * 1. Không tràn giao diện; giới hạn độ dài/validation được áp dụng nhất quán.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_017 - Giá trị biên: Tên rất dài 200 ký tự', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    const original = 'A'.repeat(200);
    await checkNonCrashName(page, original);
    const actual = await fullName(page).inputValue();
    expect(actual.length).toBeLessThanOrEqual(200);
    const maxLength = await fullName(page).evaluate((e: HTMLInputElement) => e.maxLength);
    await recordObservation(`Name 200 chars: retained=${actual.length}; declaredMaxLength=${maxLength}`);
    const overflow = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    expect(overflow, 'Form caused an unexpected horizontal page overflow').toBeLessThanOrEqual(24);
  });

  /** Expected Output from ASM06 [DDV_F07_018]:
   * 1. Không tràn giao diện; giới hạn địa chỉ xử lý rõ; không làm mất dữ liệu khác.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_018 - Giá trị biên: Địa chỉ rất dài 300 ký tự', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await openAddressPicker(page);
    await chooseCityFromActualPicker(page, CITY_A);
    await chooseWardFromActualPicker(page, WARD_A);

    const street = await confirmedStreetInput(page);
    const beforeOverflow = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    const address = ('Đường Kiểm Thử ').repeat(30).slice(0, 300);
    expect(address.length).toBe(300);
    await fillBlur(street, address);
    const actual = await street.inputValue();
    // MaxLength may truncate, but should not silently replace it by other text.
    expect(actual.length, 'Unexpectedly emptied the address-detail input').toBeGreaterThan(0);
    expect(actual.length, 'Input longer than 300 characters').toBeLessThanOrEqual(300);
    expect(address.startsWith(actual),
      'Street value was corrupted rather than retained/truncated').toBe(true);
    const afterOverflow = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    expect(afterOverflow - beforeOverflow,
      'Typing 300 chars increased horizontal page overflow').toBeLessThanOrEqual(8);
    await expectAddressPickerOnly(page);
    await recordObservation(
      `F07_018: inserted 300 chars, retained=${actual.length}; ` +
      `extra horizontal overflow=${afterOverflow - beforeOverflow}px; ` +
      `test does not assert an undocumented minimum/maximum business rule.`);
  });

  /** Expected Output from ASM06 [DDV_F07_019]:
   * 1. Tên chỉ chứa dấu cách không được chấp nhận như họ tên hợp lệ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_019 - Giá trị biên: Chỉ dấu cách ở trường tên', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), '     ');
    const actual = await fullName(page).inputValue();
    if (actual.trim() === '' && actual === '') {
      // Whitespace rejected/trimmed outright.
      await mustRemainCheckout(page);
    } else {
      await validateIncompletePanel(page);
      await expectTargetedFieldError(fullName(page), 'name');
    }
  });

  /** Expected Output from ASM06 [DDV_F07_020]:
   * 1. Không lỗi giao diện/không thực thi ký tự lạ; chấp nhận hoặc từ chối có quy tắc rõ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_020 - Giá trị biên: Chuỗi có emoji ở tên', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await checkNonCrashName(page, 'Nguyễn 😀 Văn');
    const actual = await fullName(page).inputValue();
    expect(actual, 'Emoji handling must not corrupt Unicode').not.toContain('\uFFFD');
    expect(actual.length).toBeLessThanOrEqual('Nguyễn 😀 Văn'.length);
    await recordObservation(`Emoji input: actual=${JSON.stringify(actual)}, fieldError=${await hasTargetedFieldError(fullName(page), 'name')}`);
    // ASM06 conditionally allows either acceptance or rejection, not a fixed emoji rule.
  });

  /** Expected Output from ASM06 [DDV_F07_021]:
   * 1. Ký tự nháy đơn không làm lỗi form, lưu/hiển thị an toàn nếu được chấp nhận.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_021 - Dữ liệu đặc biệt: Tên có dấu nháy đơn', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await checkNonCrashName(page, "O'Connor");
    const actual = await fullName(page).inputValue();
    expect(["O'Connor", 'OConnor', ''],
      'Unexpected destructive name transformation for apostrophe input').toContain(actual);
    await recordObservation(`Apostrophe in name: actual=${JSON.stringify(actual)}`);
  });

  /** Expected Output from ASM06 [DDV_F07_022]:
   * 1. Dấu gạch nối xử lý thống nhất theo quy tắc tên; không gây lỗi hệ thống.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_022 - Dữ liệu đặc biệt: Tên có dấu gạch nối', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await checkNonCrashName(page, 'An-Minh');
    const actual = await fullName(page).inputValue();
    expect(['An-Minh', 'AnMinh', ''],
      'Unexpected destructive name transformation for hyphen input').toContain(actual);
    await recordObservation(`Hyphen in name: actual=${JSON.stringify(actual)}`);
  });

  /** Expected Output from ASM06 [DDV_F07_023]:
   * 1. Chuỗi được xử lý như văn bản/không thực thi script; form có thể báo không hợp lệ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_023 - Dữ liệu đặc biệt: Chuỗi <script> dạng text', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await checkNonCrashName(page, '<script>TEST</script>');
    const scriptsInserted = await page.evaluate(() =>
      [...document.querySelectorAll('script')].some(s => s.textContent?.trim() === 'TEST'));
    expect(scriptsInserted, 'Input was inserted into executable script markup').toBe(false);
    await expect(fullName(page)).toBeVisible();
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_024]:
   * 1. Hiển thị/escape an toàn, không phá layout hoặc thực thi HTML.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_024 - Dữ liệu đặc biệt: Ký tự HTML &<>', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await checkNonCrashName(page, 'A & <B>');
    const formValue = await fullName(page).inputValue();
    expect(typeof formValue).toBe('string');
    // Input value must not become an actual <B> element in the input wrapper.
    const createdMarkup = await fullName(page).evaluate((input: HTMLInputElement) =>
      input.parentElement?.querySelector('b') !== null);
    expect(createdMarkup, 'HTML-like input must not be interpreted as markup').toBe(false);
  });

  /** Expected Output from ASM06 [DDV_F07_025]:
   * 1. Áp dụng quy tắc cho ký tự số; chặn nếu không hợp lệ và hiển thị lỗi cụ thể.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_025 - Dữ liệu đặc biệt: Tên có số', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    await checkNonCrashName(page, 'Nguyen123');
    const value = await fullName(page).inputValue();
    if (value.includes('123')) {
      await expect(fullName(page)).toHaveValue(value);
      await recordObservation(`Tên có số được giữ: ${JSON.stringify(value)}; hợp lệ hay không phải đối chiếu quy tắc UI (ASM06 có điều kiện)`);
    } else {
      expect(['Nguyen', ''], 'Digits were filtered but other name data should not be corrupted')
        .toContain(value);
      await recordObservation(`Tên có số được lọc: ${JSON.stringify(value)}`);
    }
    // ASM06 gives no fixed allow/deny rule; this checks safe handling, not acceptance.
  });

  /** Expected Output from ASM06 [DDV_F07_026]:
   * 1. Lỗi SĐT biến mất/cập nhật sau sửa; các trường khác vẫn nguyên giá trị.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_026 - Trạng thái form: SĐT sai rồi sửa đúng', async ({ page }) => {
    const authorized = mustHaveAuthorizedPhone();
    await openOrderInfoFromHomepage(page);
    await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
    await fillBlur(phoneNumber(page), 'abc');
    const before = await phoneNumber(page).inputValue();
    if (before !== '') {
      await validateIncompletePanel(page);
      await expectTargetedFieldError(phoneNumber(page), 'phone');
    } else {
      await recordObservation('SĐT chỉ chữ bị lọc ngay thành rỗng trước khi sửa');
    }
    await fillBlur(phoneNumber(page), authorized);
    await expect(phoneNumber(page)).toHaveValue(authorized);
    await expect(fullName(page)).toHaveValue('Nguyễn Văn Kiểm Thử');
    await expectNoTargetedFieldError(phoneNumber(page), 'phone');
    console.log(`[DDV_F07_026] Invalid phase value was: ${JSON.stringify(before)}`);
    await mustRemainCheckout(page);
  });

  /** Expected Output from ASM06 [DDV_F07_027]:
   * 1. Thông báo lỗi tên được cập nhật đúng; không mất SĐT đã nhập.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_027 - Trạng thái form: Tên trống rồi điền', async ({ page }) => {
    const authorized = mustHaveAuthorizedPhone();
    await openOrderInfoFromHomepage(page);

    await test.step('01 - Giữ SĐT hợp lệ, để trống tên và kích hoạt validation', async () => {
      await fillBlur(phoneNumber(page), authorized);
      await fillBlur(fullName(page), '');
      // Only the panel's Xác nhận; delivery address is intentionally unselected.
      // NEVER click the checkout page's red ĐẶT HÀNG button.
      await validateIncompletePanel(page);
      await expectTargetedFieldError(fullName(page), 'name');
    });

    await test.step('02 - Điền lại tên và chuyển focus', async () => {
      await fillBlur(fullName(page), 'Nguyễn Văn Kiểm Thử');
      await expect(fullName(page)).toHaveValue('Nguyễn Văn Kiểm Thử');
      await expect(phoneNumber(page)).toHaveValue(authorized);
    });

    await test.step('03 - Kiểm tra trạng thái lỗi sau khi sửa và xác nhận lại nếu cần', async () => {
      const stillInvalidAfterBlur = await hasTargetedFieldError(fullName(page), 'name');
      console.log(`[F07_027] Name error after fill + Tab: ${stillInvalidAfterBlur}`);

      if (stillInvalidAfterBlur) {
        // The observed website keeps “Vui lòng nhập họ và tên” after filling.
        // Revalidate through the SAFE recipient-panel Xác nhận, with missing
        // address ensuring no complete order can be placed.
        console.log('[F07_027] Revalidating name via recipient panel Xác nhận (address remains empty).');
        await validateIncompletePanel(page);
      }

      // Must reflect the ASM06 expected result. Do not replace this with a
      // weaker value-only assertion, and do not skip if the error persists.
      await expect.poll(
        () => hasTargetedFieldError(fullName(page), 'name'),
        {
          message: 'F07_027: Name is filled but required-name validation still shows after revalidation',
          timeout: 6_000,
          intervals: [250, 500, 1_000],
        },
      ).toBe(false);
      await expect(fullName(page)).toHaveValue('Nguyễn Văn Kiểm Thử');
      await expect(phoneNumber(page)).toHaveValue(authorized);
      await mustRemainCheckout(page);
    });
  });

  /** Expected Output from ASM06 [DDV_F07_028]:
   * 1. Các lựa chọn phụ thuộc không còn phù hợp được làm mới; không giữ quận thuộc tỉnh cũ.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_028 - Trạng thái form: Đổi tỉnh kéo theo huyện', async ({ page }) => {
    // ASM06 title retains the old three-level scheme; current UI has
    // City/Province -> Ward/Commune -> house/street. Verify the dependent Ward
    // is invalidated when City changes DIRECTLY, not just after Reset All.
    await openOrderInfoFromHomepage(page);
    await openAddressPicker(page);
    await chooseCityFromActualPicker(page, CITY_A);
    await chooseWardFromActualPicker(page, WARD_A);
    await expect(page.getByText(WARD_A, { exact: true }).first()).toBeVisible();

    // Screenshots show 'Thiết lập lại', but a whole-form reset does NOT prove
    // that changing City automatically resets Ward. Try the City breadcrumb.
    const cityBreadcrumb = page.getByText(CITY_A, { exact: true }).first();
    await expect(cityBreadcrumb).toBeVisible();
    await cityBreadcrumb.click({ timeout: 5_000 });
    const citySearch = page.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i);
    await citySearch.waitFor({ state: 'visible', timeout: 2_500 }).catch(() => {});
    const canReselectCity = await citySearch.isVisible().catch(() => false);
    test.skip(!canReselectCity,
      'City breadcrumb did not open City selection. The verified "Thiết lập lại" resets ALL address fields; using it would not prove automatic Ward invalidation when changing City.');
    await chooseCityFromActualPicker(page, CITY_B);

    await expect(page.getByText(CITY_B, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Vui lòng chọn Phường/Xã', { exact: true }))
      .toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(WARD_A, { exact: true }),
      'Ward belonging to the previous City must be cleared').toHaveCount(0);
    await expect(page.getByPlaceholder(/Tìm kiếm Phường\/Xã/i)).toBeVisible();
    await expectAddressPickerOnly(page);
    await recordObservation(
      `F07_028: changing city from ${CITY_A} to ${CITY_B} invalidated ward ${WARD_A}. ` +
      `No real order placed.`);
  });

  /** Expected Output from ASM06 [DDV_F07_029]:
   * 1. Các giá trị được giữ/khôi phục theo thiết kế; không bị thay dữ liệu tùy ý.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_029 - Trạng thái form: Back từ bước kế tiếp', async ({ page }) => {
    // ASM06 expects a step AFTER full valid shipping data, which has not been
    // mapped. Never use the final red ĐẶT HÀNG button to manufacture this step.
    test.skip(true,
      'BLOCKED: next-step navigation DOM not verified. Never submit a real order.');
    await openOrderInfoFromHomepage(page);
  });

  /** Expected Output from ASM06 [DDV_F07_030]:
   * 1. Không tạo đơn chỉ vì refresh; giao diện có hành vi lưu/xóa dữ liệu nhất quán theo đặc tả.
   * 2. Không tự ý tạo đơn hoặc thay đổi các dữ liệu khác.
   */
  test('DDV_F07_030 - Trạng thái form: Refresh trước khi xác nhận', async ({ page }) => {
    await openOrderInfoFromHomepage(page);
    const testName = 'Nguyễn Văn Kiểm Thử';
    const testEmail = 'f07-refresh@example.com';
    await fillBlur(fullName(page), testName);
    await fillBlur(emailInput(page), testEmail);
    const phoneIsAuthorized = EXPECTED_VALID_PHONE.test(AUTHORIZED_PHONE);
    if (phoneIsAuthorized) await fillBlur(phoneNumber(page), AUTHORIZED_PHONE);

    // Refresh occurs BEFORE order submission. The screenshot from the real
    // application shows it redirects to /cart. This is an OBSERVATION, not a
    // promise that recipient values should be persisted across navigation.
    const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded' });
    console.log(`[F07_030] Reload HTTP=${reloadResponse?.status() ?? 'none'}; immediate URL=${page.url()}`);
    const route = await resumeCheckoutAfterRefresh(page);
    await openRecipientAfterCheckoutRecovery(page);

    // ASM06: data may be retained or reset, but never silently replaced by
    // unrelated values. We cannot assert a stronger retention rule without
    // an official specification for refresh behavior.
    const nameAfter = await fullName(page).inputValue();
    const emailAfter = await emailInput(page).inputValue();
    expect(['', testName], 'Unexpected Họ tên after refreshing checkout')
      .toContain(nameAfter);
    expect(['', testEmail], 'Unexpected Email after refreshing checkout')
      .toContain(emailAfter);

    let phoneState = 'not-configured';
    if (phoneIsAuthorized) {
      const phoneAfter = await phoneNumber(page).inputValue();
      expect(['', AUTHORIZED_PHONE], 'Phone was corrupted after refreshing checkout')
        .toContain(phoneAfter);
      phoneState = phoneAfter ? 'retained' : 'cleared';
    }
    await mustRemainCheckout(page); // no order confirmation and still /checkout
    await recordObservation(
      `F07_030 route=${route} -> checkout; ` +
      `name=${nameAfter ? 'retained' : 'cleared'}; ` +
      `email=${emailAfter ? 'retained' : 'cleared'}; ` +
      `phone=${phoneState}; NO real order submitted. ` +
      `Retain/clear policy must be verified against the product specification.`
    );
    console.log('[F07_030] PASS: refresh -> recover safe checkout -> confirm uncorrupted form state.');
  });
});
