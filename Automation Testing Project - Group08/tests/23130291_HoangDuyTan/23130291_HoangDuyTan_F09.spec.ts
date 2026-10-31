import { test, expect, type Page, type Locator } from '@playwright/test';
import { safeRequiredFixture, addTestNote } from './checkout-helpers';

/**
 * Group08 | Hoàng Duy Tân | 23130291 | F09 (D09) | 30 cases (V8: V7 redesign + F09_012 length/submit diagnostic; genuine server errors retained).
 * Public page confirmed: https://didongviet.vn/order-tracking
 * Input: "Mã đơn hàng", "Số điện thoại"; action: "Tra cứu ngay".
 * ALL actual outcomes must come from the live site. Never print authorized real order IDs/phones.
 * Real order/status tests remain BLOCKED without authorized fixtures. Refined tests only submit synthetic order codes.
 * Do not run high-volume request loops or use third-party order data.
 */
const TRACKING = 'https://didongviet.vn/order-tracking';
const TEST_CODE = process.env.F09_FAKE_ORDER ?? 'INVALID_XYZ_999';
// Only use with synthetic/nonexistent test-only order IDs. Do not use this phone to query real orders.
const SYNTHETIC_PHONE = process.env.F09_SYNTHETIC_PHONE ?? '0900000000';
const NONEXISTENT_CODE_B = 'INVALID_QA_CASE_B_2026';
const orderInput = (p: Page) => p.getByPlaceholder('VD: 10000001').first()
  .or(p.getByRole('textbox', { name: /mã đơn hàng/i }).first()).first();
const phoneInput = (p: Page) => p.getByPlaceholder('SĐT khi đặt hàng').first()
  .or(p.getByRole('textbox', { name: /số điện thoại/i }).first()).first();
const submit = (p: Page) => p.getByRole('button',{name:/^Tra cứu ngay$/i}).first();

async function ready(p: Page) {
  const response = await p.goto(TRACKING,{waitUntil:'domcontentloaded',timeout:40000});
  expect(response?.status()).toBeLessThan(400);
  await expect(p.getByText('Tra cứu đơn hàng',{exact:true}).first()).toBeVisible();
  await expect(orderInput(p)).toBeVisible();
  await expect(phoneInput(p)).toBeVisible();
  await expect(submit(p)).toBeVisible();
}
async function enter(p: Page, order:string, phone:string) {
  await orderInput(p).fill(order); await orderInput(p).press('Tab');
  await phoneInput(p).fill(phone); await phoneInput(p).press('Tab');
}
async function search(p: Page) {
  await expect(submit(p)).toBeVisible();
  await submit(p).click();
}
/**
 * F09 V3: only inspect VISIBLE validation feedback for the active tracking form.
 * The former /vui lòng/ .first() locator matched a hidden site-wide description.
 * An HTTP 500-style UI message is a REAL observed server failure, not a valid rejection.
 */
const specificFeedback =
  /không tìm thấy|không tồn tại|không hợp lệ|không đúng|không khớp|không thể tra cứu|thông tin không chính xác|không có đơn hàng|không được để trống|bắt buộc|vui lòng\s+(?:nhập|kiểm tra|điền|cung cấp)|mã đơn(?: hàng)?\s+(?:sai|không|chưa)/i;

type RejectionState = 'server-error' | 'unauthorized' | 'validation' | 'native-invalid' | 'pending';

async function rejectionState(p: Page): Promise<RejectionState> {
  // Check the most serious outcome first. Exact text avoids matching hidden page descriptions.
  if (await p.getByText(/^Internal server error$/i).filter({ visible: true }).count() > 0)
    return 'server-error';
  if (await p.getByText(/^Unauthorized$/i).filter({ visible: true }).count() > 0)
    return 'unauthorized';
  if (await p.getByText(specificFeedback).filter({ visible: true }).count() > 0)
    return 'validation';

  // Native HTML validation must belong to one of the two tested input fields.
  for (const field of [orderInput(p), phoneInput(p)]) {
    const invalid = await field.evaluate((el: HTMLInputElement) =>
      !el.checkValidity() || el.getAttribute('aria-invalid') === 'true'
    ).catch(() => false);
    if (invalid) return 'native-invalid';
  }
  return 'pending';
}

async function assertRejected(p: Page) {
  await expect.poll(() => rejectionState(p), {
    message: 'Expected visible, field-specific validation or an explicit access denial',
    timeout: 12_000,
    intervals: [200, 400, 800, 1000],
  }).not.toBe('pending');

  const state = await rejectionState(p);
  await test.info().attach('F09_rejection_diagnostic.txt', {
    body: Buffer.from(
      `Observed rejection category: ${state}\n` +
      `Tracking form path: ${new URL(p.url()).pathname}\n` +
      'No order code or phone number is stored in this diagnostic.\n', 'utf8'
    ),
    contentType: 'text/plain',
  });

  if (state === 'server-error') {
    // Do NOT silently accept a 500 as valid input rejection. Keep this Failed for bug reporting.
    throw new Error(
      'F09 WEBSITE ERROR: The tracking UI displayed "Internal server error" for invalid input. ' +
      'No order data should be exposed, but a server failure is NOT an acceptable validation response. ' +
      'Retain Failed and attach screenshot/trace as bug evidence.'
    );
  }
  if (state === 'unauthorized') {
    // Access denial protects order privacy, but does not establish format-specific validation.
    await addTestNote(
      'The website displayed "Unauthorized". This confirms access was denied, ' +
      'not that the order-code format was validated. Consider a UX follow-up for an English error message.'
    );
  }
  await expect(p.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i).first()).toHaveCount(0);
}
async function assertRequiredInput(p:Page, field:Locator, which:'order'|'phone') {
  const invalid=await field.evaluate((el:HTMLInputElement)=>el.validity.valueMissing || el.getAttribute('aria-invalid')==='true');
  if(invalid) {await expect(field).toBeVisible();return;}
  const word=which==='order' ? /mã đơn/i : /số điện thoại|sđt/i;
  const section=p.getByText(word).first().locator('xpath=..');
  const error=section.getByText(/vui lòng|bắt buộc|không được để trống|cần nhập/i).first();
  await expect(error,`Expected a field-specific ${which} validation error`).toBeVisible({timeout:10000});
}
async function rejectCase(p:Page,order:string,phone:string) {
  await ready(p);await enter(p,order,phone);await search(p);await assertRejected(p);
}
function authorizedPhone() {
  const value=safeRequiredFixture('F09_TEST_PHONE');
  test.skip(!/^0\d{9}$/.test(value),'F09_TEST_PHONE phải là số thử nghiệm hợp lệ, thuộc quyền sử dụng của bạn.');
  return value;
}
async function realOrder(caseName: string, p:Page) {
  const code = safeRequiredFixture(`F09_${caseName}_ORDER`);
  const phone = safeRequiredFixture(`F09_${caseName}_PHONE`);
  const expected = safeRequiredFixture(`F09_${caseName}_EXPECTED_STATUS`);
  await ready(p);await enter(p,code,phone);await search(p);
  await expect(p.getByText(expected,{exact:false}).first(),`Expected authorized order status ${caseName}`).toBeVisible({timeout:15000});
  await addTestNote(`Authorized order fixture ${caseName}: expected status was found. Sensitive order identifiers omitted.`);
}
async function assertNoRenderedHtml(p:Page){
  await expect(p.locator('b').filter({hasText:/^TEST$/})).toHaveCount(0);
  await expect(p.locator('script').filter({hasText:/TEST/})).toHaveCount(0);
}


/**
 * V7: UI-only flow observations must not use assertRejected(), because that
 * helper intentionally FAILS when the website shows "Internal server error".
 * For F09_026–029, the actual assertion target is the UI transition/Back/Reload,
 * not whether the invalid order lookup is correctly handled by the backend.
 * Report any backend error explicitly; F09_006/_008/_012/_017/_020 remain
 * independent NEGATIVE LOOKUP tests and continue to fail on server errors.
 */
type NegativeUiState = RejectionState | 'raw-route-error';
async function observeNegativeLookupForUi(p: Page, label: string): Promise<NegativeUiState> {
  const readState = async (): Promise<NegativeUiState> => {
    const observed = await rejectionState(p);
    if (observed !== 'pending') return observed;
    if (await p.getByText(/^Cannot GET\b/i).filter({ visible: true }).count() > 0) {
      return 'raw-route-error';
    }
    return 'pending';
  };
  await expect.poll(readState, {
    message: `${label}: expected visible lookup outcome before testing next UI operation`,
    timeout: 15_000,
    intervals: [200, 400, 800, 1000],
  }).not.toBe('pending');
  const state = await readState();
  // No order identifiers or phone numbers included in report attachment.
  await test.info().attach(`${label}_lookup_state.txt`, {
    body: Buffer.from(
      `Scenario: ${label}\nObserved result: ${state}\n` +
      `Page pathname: ${new URL(p.url()).pathname}\n` +
      'Sensitive lookup values and full URLs intentionally omitted.\n',
      'utf8',
    ),
    contentType: 'text/plain',
  });
  if (state === 'server-error' || state === 'raw-route-error') {
    test.info().annotations.push({
      type: 'known-website-issue',
      description: `Tracking response was ${state}; this test evaluates UI navigation/state only. The backend outcome is NOT considered a successful validation.`,
    });
  }
  await expect(p.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i),
    `${label}: synthetic code must not reveal any order details`).toHaveCount(0);
  return state;
}

/**
 * Track that a submit was issued with the specific synthetic code; this makes
 * the F09_026/_027 assertions more than a check that the input text changed.
 */
async function assertSubmittedSyntheticCode(p: Page, code: string) {
  await expect.poll(() => {
    try { return new URL(p.url()).searchParams.get('orderId'); }
    catch { return null; }
  }, {
    message: 'The tracking URL must reflect the submitted synthetic code',
    timeout: 12_000,
  }).toBe(code);
}

/** Read the visible tab's UI state without assuming tab vs button semantics. */
async function tabVisualSignature(tab: Locator): Promise<string> {
  return tab.evaluate((el) => {
    const style = getComputedStyle(el);
    return JSON.stringify({
      className: el.getAttribute('class'),
      ariaSelected: el.getAttribute('aria-selected'),
      ariaPressed: el.getAttribute('aria-pressed'),
      dataState: el.getAttribute('data-state'),
      color: style.color,
      backgroundColor: style.backgroundColor,
      fontWeight: style.fontWeight,
      parentClass: el.parentElement?.getAttribute('class'),
    });
  });
}


test.describe("ASM08 | F09 | D09 | 30 scenarios (V7: selective refinement, fixture-dependent cases documented)", () => {
  test.describe.configure({ timeout: 165_000 });
  /** F09 V2 | DDV_F09_001 | refined after ASM06.
   * Expected: Mã đơn trống và số điện thoại chỉ dùng làm input giả; trường mã đơn phải báo bắt buộc.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_001 - Bỏ trống dữ liệu: Trống mã đơn", async ({ page }) => {
    await ready(page);await enter(page,'',SYNTHETIC_PHONE);await search(page);await assertRequiredInput(page,orderInput(page),'order');await assertRejected(page);
  });

  /** ASM06 DDV_F09_002
   * 1. Không hiển thị thông tin đơn; cảnh báo yêu cầu số điện thoại.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_002 - Bỏ trống dữ liệu: Trống số điện thoại", async ({ page }) => {
    await ready(page);await enter(page,TEST_CODE,'');await search(page);await assertRequiredInput(page,phoneInput(page),'phone');await assertRejected(page);
  });

  /** ASM06 DDV_F09_003
   * 1. Không trả dữ liệu đơn; thông báo nhập đủ hai trường bắt buộc.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_003 - Bỏ trống dữ liệu: Trống cả hai", async ({ page }) => {
    await ready(page);await enter(page,'','');await search(page);await assertRequiredInput(page,orderInput(page),'order');await assertRequiredInput(page,phoneInput(page),'phone');await assertRejected(page);
  });

  /** F09 V2 | DDV_F09_004 | refined after ASM06.
   * Expected: Khoảng trắng trong mã đơn phải bị từ chối.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_004 - Bỏ trống dữ liệu: Chỉ khoảng trắng ở mã đơn", async ({ page }) => {
    await ready(page);
    await enter(page, '    ', SYNTHETIC_PHONE);

    // ASM06 expected: an all-whitespace code must NOT be treated as a usable
    // order identifier, and no order data may appear. Whether the website
    // serializes a blank orderId= parameter is a separate URL/UX observation.
    // Do not claim client-side validation or that the network request was blocked.
    expect((await orderInput(page).inputValue()).trim(),
      'Test setup: the input must not contain a non-whitespace order code').toBe('');

    type ValueCategory = 'empty' | 'whitespace' | 'nonblank';
    const category = (value: string): ValueCategory =>
      value.length === 0 ? 'empty' : value.trim().length === 0 ? 'whitespace' : 'nonblank';

    const trackingRequests: Array<{ code: ValueCategory | 'absent'; resource: string }> = [];
    const observeRequest = (request: import('@playwright/test').Request) => {
      try {
        const url = new URL(request.url());
        if (url.origin !== new URL(TRACKING).origin || url.pathname !== '/order-tracking') return;
        const raw = url.searchParams.get('orderId');
        trackingRequests.push({
          code: raw === null ? 'absent' : category(raw),
          resource: request.resourceType(),
        });
      } catch { /* Ignore unrelated URLs. */ }
    };
    page.on('request', observeRequest);
    try {
      await search(page);
      // Give asynchronous tracking/navigation requests time to settle; this
      // is an observation window, not a substitute for asserting the result.
      await page.waitForTimeout(1500);
      await expect(orderInput(page)).toBeVisible();
      await expect(phoneInput(page)).toBeVisible();

      const displayedUrl = new URL(page.url());
      const value = displayedUrl.searchParams.get('orderId');
      const urlCategory = value === null ? 'absent' : category(value);
      const nonBlankRequests = trackingRequests.filter(x => x.code === 'nonblank');
      const blankRequests = trackingRequests.filter(x => x.code === 'empty' || x.code === 'whitespace');
      const noCodeRequests = trackingRequests.filter(x => x.code === 'absent');

      // Attach diagnostic BEFORE assertions, so it is available even on failure.
      await test.info().attach('F09_004_whitespace_diagnostic.txt', {
        body: Buffer.from(
          'Input category: four whitespace characters\n' +
          `URL orderId category: ${urlCategory}\n` +
          `Tracking requests with empty/whitespace orderId: ${blankRequests.length}\n` +
          `Tracking requests with nonblank orderId: ${nonBlankRequests.length}\n` +
          `Tracking requests without orderId: ${noCodeRequests.length}\n` +
          'The website may serialize orderId= even after trimming whitespace.\n' +
          'This diagnostic does NOT claim that server-side validation was performed.\n' +
          'Full URL, raw order code, phone number and cookies are omitted.\n',
          'utf8',
        ),
        contentType: 'text/plain',
      });

      expect(displayedUrl.pathname, 'Must remain on the order-tracking page')
        .toBe('/order-tracking');
      expect(value === null || value.trim().length === 0,
        'Whitespace-only input must not become a meaningful order ID in the URL')
        .toBe(true);
      expect(nonBlankRequests.length,
        'Whitespace-only input must not become a meaningful order ID in any tracking request')
        .toBe(0);
      await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i),
        'No order details should be rendered for an all-whitespace code').toHaveCount(0);
      await expect(page.getByText(/^Internal server error$|^Unauthorized$/i)
        .filter({ visible: true }),
        'A blank code should not cause a server failure or authentication error').toHaveCount(0);

      // Passing proves only that no meaningful identifier/order result was seen.
      // A blank query parameter or silent handling remains a UX issue.
      await addTestNote(
        `Whitespace code produced URL orderId category ${urlCategory}; ` +
        `${blankRequests.length} request(s) carried an empty/whitespace orderId. ` +
        'No order details were displayed. This does NOT verify a visible validation message; ' +
        'consider logging a UX issue for silent handling / blank query submission.'
      );
    } finally {
      page.off('request', observeRequest);
    }
  });

  /** ASM06 DDV_F09_005
   * 1. SĐT chỉ có khoảng trắng không được coi là số hợp lệ; không hiển thị đơn.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_005 - Bỏ trống dữ liệu: Chỉ khoảng trắng ở SĐT", async ({ page }) => {
    await ready(page);await enter(page,TEST_CODE,'    ');await search(page);await assertRejected(page);await expect(phoneInput(page)).toBeVisible();
  });

  /** F09 V2 | DDV_F09_006 | refined after ASM06.
   * Expected: Mã đơn giả ngẫu nhiên phải không hiển thị chi tiết đơn.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_006 - Mã đơn không hợp lệ: Mã ký tự ngẫu nhiên", async ({ page }) => {
    await rejectCase(page,'INVALID_XYZ_999',SYNTHETIC_PHONE);
  });

  /** F09 V2 | DDV_F09_007 | refined after ASM06.
   * Expected: Mã đơn giả quá ngắn phải không hiển thị chi tiết đơn.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_007 - Mã đơn không hợp lệ: Mã quá ngắn", async ({ page }) => {
    await rejectCase(page,'1',SYNTHETIC_PHONE);
  });

  /** F09 V2 | DDV_F09_008 | refined after ASM06.
   * Expected: Mã đơn rất dài phải xử lý an toàn, không lộ chi tiết đơn.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_008 - Mã đơn không hợp lệ: Mã rất dài", async ({ page }) => {
    await ready(page);await enter(page,'X'.repeat(200),SYNTHETIC_PHONE);await search(page);await assertRejected(page);await expect(orderInput(page)).toBeVisible();
  });

  /** F09 V2 | DDV_F09_009 | refined after ASM06.
   * Expected: Mã đơn chứa ký tự đặc biệt phải bị từ chối.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_009 - Mã đơn không hợp lệ: Mã có ký tự đặc biệt", async ({ page }) => {
    await rejectCase(page,'ABC@#$',SYNTHETIC_PHONE);
  });

  /** F09 V7 | DDV_F09_010 | REDESIGNED after ASM06.
   * Former: valid-format but nonexistent real order (cannot prove absence without
   * an authorized fixture / format contract).
   * New: entering an eight-digit candidate and phone must NOT trigger a lookup
   * until the user presses "Tra cứu ngay". No query is submitted here.
   */
  test("DDV_F09_010 - Nhập mã 8 chữ số: Chưa bấm Tra cứu không tự gửi", async ({ page }) => {
    await ready(page);
    const before = new URL(page.url());
    expect(before.searchParams.has('orderId')).toBe(false);
    const candidate = '99999999'; // candidate only; DO NOT SUBMIT or claim it is absent
    await enter(page, candidate, SYNTHETIC_PHONE);
    await expect(orderInput(page)).toHaveValue(candidate);
    await expect(phoneInput(page)).toHaveValue(SYNTHETIC_PHONE);
    await expect(submit(page)).toBeEnabled();
    expect(new URL(page.url()).searchParams.has('orderId'),
      'Just entering candidate data must not start order lookup').toBe(false);
    await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i),
      'No order details without explicit submission').toHaveCount(0);
    await addTestNote('Only input state was checked. Validity/existence of the 8-digit candidate and backend lookup were NOT tested.');
  });

  /** F09 V2 | DDV_F09_011 | refined after ASM06.
   * Expected: SĐT ngắn phải bị từ chối và không lộ đơn; không khẳng định tồn tại đơn thật.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_011 - SĐT không hợp lệ: SĐT thiếu số", async ({ page }) => {
    await rejectCase(page,TEST_CODE,'09012345');
  });

  /** F09 V8 | DDV_F09_012 | refined behavior-based overlength validation.
   * User-entered phone has 12 digits; a genuine rejection may be either:
   * 1. An input length limit, preventing entry of extra digits; OR
   * 2. A visible/native rejection; OR
   * 3. Blocking the invalid lookup without a query (silent UX caveat).
   * An internal server error is NEVER accepted, and no real order is queried.
   */
  test("DDV_F09_012 - SĐT không hợp lệ: SĐT thừa số", async ({ page }) => {
    const tooLong = '090123456789'; // Synthetic, 12 digits; not an actual customer number.
    await ready(page);
    await enter(page, TEST_CODE, tooLong);

    // Read the real input state instead of assuming the UI preserves 12 characters.
    // Native maxlength and React onChange may trim long input before submit.
    const current = await phoneInput(page).inputValue();
    const inputMeta = await phoneInput(page).evaluate((el: HTMLInputElement) => ({
      maxLength: el.maxLength,
      validity: el.checkValidity(),
      ariaInvalid: el.getAttribute('aria-invalid'),
    }));
    const diagnostic = async (outcome: string, sentInvalidCount: number) => {
      const url = new URL(page.url());
      await test.info().attach('F09_012_phone_length_diagnostic.txt', {
        body: Buffer.from(
          `Outcome: ${outcome}\n` +
          `Requested digit count: ${tooLong.length}\n` +
          `Actual input digit count: ${current.length}\n` +
          `Input maxlength: ${inputMeta.maxLength}\n` +
          `Input validity before submit: ${inputMeta.validity}\n` +
          `Input aria-invalid before submit: ${inputMeta.ariaInvalid ?? 'absent'}\n` +
          `Requests with full invalid phone: ${sentInvalidCount}\n` +
          `URL contains orderId: ${url.searchParams.has('orderId')}\n` +
          `URL contains phone: ${url.searchParams.has('phone')}\n` +
          'No full phone number, order code, or query string is stored.\n',
          'utf8'
        ),
        contentType: 'text/plain',
      });
    };

    if (current !== tooLong) {
      // Prove that this specific UI enforces a ten-digit limit; a different
      // or unexpectedly modified number does not count as valid rejection.
      await diagnostic('client-input-constrained', 0);
      expect(current, 'Phone field must truncate only the excess digits').toBe(tooLong.slice(0, 10));
      await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i)).toHaveCount(0);
      await addTestNote(
        'Phone input rejected extra digits by truncating to 10 before submit. ' +
        'No lookup was submitted; this checks client-side input constraints, not backend phone validation.'
      );
      return;
    }

    // If all 12 digits are accepted, submit only a synthetic/nonexistent order
    // and observe whether those invalid digits are transmitted or rejected.
    let sentInvalidCount = 0;
    const observeRequest = (req: import('@playwright/test').Request) => {
      let decoded = req.url();
      try { decoded = decodeURIComponent(decoded); } catch { /* Keep encoded URL */ }
      const body = req.postData() ?? '';
      if (decoded.includes(tooLong) || body.includes(tooLong)) sentInvalidCount++;
    };
    page.on('request', observeRequest);
    let state: RejectionState = 'pending';
    try {
      await search(page);
      // Negative tests need a short observation window for client-side
      // validation, navigation, and request dispatch (without fixed URL guesses).
      await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => {});
      await page.waitForTimeout(600);
      state = await rejectionState(page);
    } finally {
      page.off('request', observeRequest);
    }
    await diagnostic(state, sentInvalidCount);
    await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i),
      'An invalid phone must not expose any order data').toHaveCount(0);

    if (state === 'server-error') {
      throw new Error('F09 WEBSITE ERROR: overlong phone resulted in Internal server error, not safe validation.');
    }
    if (await page.getByText(/^Cannot GET\b/i).filter({ visible: true }).count()) {
      throw new Error('F09 WEBSITE ERROR: overlong phone reached a broken routing endpoint (Cannot GET).');
    }
    if (state === 'validation' || state === 'native-invalid' || state === 'unauthorized') {
      if (state === 'unauthorized') {
        await addTestNote('Unauthorized means access denied; phone length-specific validation was NOT confirmed.');
      }
      return;
    }

    // Silent blocking is acceptable for the negative/privacy outcome only when
    // there is direct evidence that the 12-digit phone was NOT transmitted.
    // A submitted invalid phone without feedback remains a genuine test failure.
    expect(sentInvalidCount,
      'The website silently sent the 12-digit invalid phone without validation feedback').toBe(0);
    const observedPhone = new URL(page.url()).searchParams.get('phone');
    expect(observedPhone === tooLong,
      'The URL must not contain the submitted 12-digit phone').toBe(false);
    await addTestNote(
      'The website silently blocked the overlong phone without transmitting the 12-digit value. ' +
      'This passes the no-lookup/privacy outcome, but the missing visible validation is a UX finding.'
    );
  });

  /** F09 V2 | DDV_F09_013 | refined after ASM06.
   * Expected: SĐT chứa chữ phải bị từ chối và không lộ đơn.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_013 - SĐT không hợp lệ: SĐT có chữ", async ({ page }) => {
    await rejectCase(page,TEST_CODE,'09abc12345');
  });

  /** F09 V2 | DDV_F09_014 | refined after ASM06.
   * Expected: SĐT có ký tự đặc biệt phải bị từ chối và không lộ đơn.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_014 - SĐT không hợp lệ: SĐT chứa !@#", async ({ page }) => {
    await rejectCase(page,TEST_CODE,'09!@#12345');
  });

  /** F09 V2 | DDV_F09_015 | refined after ASM06.
   * Expected: Xóa hết SĐT phải kích hoạt validation bắt buộc.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_015 - SĐT không hợp lệ: SĐT trống sau khi xóa", async ({ page }) => {
    await ready(page);await enter(page,TEST_CODE,SYNTHETIC_PHONE);await phoneInput(page).fill('');await search(page);await assertRequiredInput(page,phoneInput(page),'phone');await assertRejected(page);
  });

  /** ASM06 DDV_F09_016
   * 1. Không hiển thị đơn A hoặc thông tin cá nhân; báo cặp mã/SĐT không khớp hoặc không tìm thấy.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_016 - Sai kết hợp: Mã đơn thật + SĐT khác được phép", async ({ page }) => {
    const code=safeRequiredFixture('F09_AUTH_ORDER');const other=safeRequiredFixture('F09_OTHER_PHONE');await rejectCase(page,code,other);
  });

  /** F09 V2 | DDV_F09_017 | refined after ASM06.
   * Expected: Mã giả không tồn tại cùng SĐT đúng định dạng phải không lộ đơn.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_017 - Sai kết hợp: Mã giả không tồn tại + SĐT đúng định dạng", async ({ page }) => {
    await rejectCase(page,NONEXISTENT_CODE_B,SYNTHETIC_PHONE);
  });

  /** F09 V2 | DDV_F09_018 | refined after ASM06.
   * Expected: Mã giả cùng SĐT sai định dạng phải không lộ đơn.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_018 - Sai kết hợp: Mã giả + SĐT sai định dạng", async ({ page }) => {
    await rejectCase(page,NONEXISTENT_CODE_B,'09012');
  });

  /** F09 V7 | DDV_F09_019 | REDESIGNED after ASM06.
   * Former duplicated F09_016 (real order + other phone) and required
   * an authorized order fixture.
   * New: clear a previously typed code, keep the phone and submit; required
   * code validation should prevent the lookup and avoid exposing order data.
   */
  test("DDV_F09_019 - Xóa mã đang nhập: Bắt buộc điền mã trước tra cứu", async ({ page }) => {
    await ready(page);
    await enter(page, TEST_CODE, SYNTHETIC_PHONE);
    await orderInput(page).fill('');
    await expect(orderInput(page)).toHaveValue('');
    await expect(phoneInput(page)).toHaveValue(SYNTHETIC_PHONE);
    await search(page);
    await assertRequiredInput(page, orderInput(page), 'order');
    await assertRejected(page);
    await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i)).toHaveCount(0);
  });

  /** F09 V2 | DDV_F09_020 | refined after ASM06.
   * Expected: Mã đơn giả với khoảng trắng đầu/cuối không lộ đơn; không suy luận quy tắc chuẩn hóa mã thật.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_020 - Chuẩn hóa đầu vào: Thêm dấu cách quanh mã giả", async ({ page }) => {
    await ready(page);await enter(page,'  '+TEST_CODE+'  ',SYNTHETIC_PHONE);await search(page);await assertRejected(page);await addTestNote('Order code with leading/trailing whitespace rejected; no unauthorized order details rendered.');
  });

  /** ASM06 DDV_F09_021
   * 1. Hiển thị trạng thái chờ xác nhận khớp dữ liệu nguồn và đúng mã đơn A.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_021 - Trạng thái kết quả: Đơn chờ xác nhận nếu có", async ({ page }) => {
    await realOrder('PENDING',page);
  });

  /** ASM06 DDV_F09_022
   * 1. Trạng thái hiển thị tương ứng dữ liệu đơn đang giao; không hiển thị trạng thái khác.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_022 - Trạng thái kết quả: Đơn đang giao nếu có", async ({ page }) => {
    await realOrder('SHIPPING',page);
  });

  /** ASM06 DDV_F09_023
   * 1. Hiển thị trạng thái hoàn tất đúng theo đơn test C.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_023 - Trạng thái kết quả: Đơn hoàn tất nếu có", async ({ page }) => {
    await realOrder('COMPLETED',page);
  });

  /** ASM06 DDV_F09_024
   * 1. Hiển thị trạng thái hủy phù hợp dữ liệu hệ thống, không hiển thị đang giao.
   * 2. Không lộ tên, SĐT, địa chỉ hoặc trạng thái của đơn hàng không được phép xem.
   * 3. Nếu thiếu đơn test cho trạng thái cụ thể, ghi Blocked khi thực thi.
   */
  test("DDV_F09_024 - Trạng thái kết quả: Đơn hủy nếu có", async ({ page }) => {
    await realOrder('CANCELLED',page);
  });

  /** F09 V7 | DDV_F09_025 | REDESIGNED after ASM06.
   * Former: deposit order status, requires an authorized deposit-order record.
   * New: switch to deposit-order lookup and back; verify that the tab UI truly
   * changes selected state while never submitting or exposing order data.
   */
  test("DDV_F09_025 - Chuyển tab Đơn hàng ↔ Đơn đặt cọc: Trạng thái chọn cập nhật", async ({ page }) => {
    await ready(page);
    const orderTab = page.getByRole('button', { name: 'Đơn hàng', exact: true }).first()
      .or(page.getByRole('tab', { name: 'Đơn hàng', exact: true }).first()).first();
    const depositTab = page.getByRole('button', { name: 'Đơn đặt cọc', exact: true }).first()
      .or(page.getByRole('tab', { name: 'Đơn đặt cọc', exact: true }).first()).first();
    await expect(orderTab, 'Trang có nút chuyển về Đơn hàng').toBeVisible();
    await expect(depositTab, 'Trang có nút Đơn đặt cọc').toBeVisible();
    const beforeOrder = await tabVisualSignature(orderTab);
    const beforeDeposit = await tabVisualSignature(depositTab);
    await depositTab.click();
    await expect.poll(() => tabVisualSignature(depositTab), {
      message: 'Chọn Đơn đặt cọc phải thay đổi trạng thái hiển thị/tab',
      timeout: 8000,
    }).not.toBe(beforeDeposit);
    await expect(orderTab).toBeVisible();
    await orderTab.click();
    await expect.poll(() => tabVisualSignature(orderTab), {
      message: 'Chọn lại Đơn hàng phải khôi phục trạng thái tab',
      timeout: 8000,
    }).toBe(beforeOrder);
    expect(new URL(page.url()).pathname).toBe('/order-tracking');
    expect(new URL(page.url()).searchParams.has('orderId'),
      'Chỉ chuyển tab không được tự tra cứu đơn hàng').toBe(false);
    await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i)).toHaveCount(0);
    await addTestNote('This is tab-state testing. It does NOT cover the former authorized deposit-order status scenario.');
  });

  /** F09 V7 | DDV_F09_026 | REFINED UI-flow test.
   * Two synthetic lookups must each be issued with the edited code; the UI
   * remains usable and must never reveal an unauthorized order. A backend
   * server-error is reported as a website issue, not silently accepted as
   * successful input validation.
   */
  test("DDV_F09_026 - Tra cứu lại: Thay mã giả A sang B và gửi lần hai", async ({ page }) => {
    await ready(page);
    await enter(page, TEST_CODE, SYNTHETIC_PHONE);
    await search(page);
    await assertSubmittedSyntheticCode(page, TEST_CODE);
    await observeNegativeLookupForUi(page, 'F09_026_first');
    await enter(page, NONEXISTENT_CODE_B, SYNTHETIC_PHONE);
    await search(page);
    await assertSubmittedSyntheticCode(page, NONEXISTENT_CODE_B);
    await expect(orderInput(page)).toHaveValue(NONEXISTENT_CODE_B);
    await observeNegativeLookupForUi(page, 'F09_026_second');
    await addTestNote('UI re-submission verified; any technical error is separately annotated as a website issue.');
  });

  /** F09 V7 | DDV_F09_027 | REFINED UI-flow test. */
  test("DDV_F09_027 - Chỉnh sửa mã sau phản hồi lỗi: Form vẫn dùng được", async ({ page }) => {
    await ready(page);
    await enter(page, TEST_CODE, SYNTHETIC_PHONE);
    await search(page);
    await assertSubmittedSyntheticCode(page, TEST_CODE);
    await observeNegativeLookupForUi(page, 'F09_027_first');
    await orderInput(page).fill(NONEXISTENT_CODE_B);
    await expect(orderInput(page)).toHaveValue(NONEXISTENT_CODE_B);
    await search(page);
    await assertSubmittedSyntheticCode(page, NONEXISTENT_CODE_B);
    await observeNegativeLookupForUi(page, 'F09_027_second');
  });

  /** F09 V7 | DDV_F09_028 | REFINED UI-flow test. */
  test("DDV_F09_028 - Điều hướng Back sau phản hồi lỗi: Không lộ dữ liệu", async ({ page }) => {
    await page.goto('https://didongviet.vn/', { waitUntil: 'domcontentloaded' });
    await ready(page);
    await enter(page, TEST_CODE, SYNTHETIC_PHONE);
    await search(page);
    await assertSubmittedSyntheticCode(page, TEST_CODE);
    await observeNegativeLookupForUi(page, 'F09_028_before_back');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    const url = new URL(page.url());
    expect(url.origin).toBe('https://didongviet.vn');
    expect(['/', '/order-tracking']).toContain(url.pathname);
    await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i)).toHaveCount(0);
  });

  /** F09 V7 | DDV_F09_029 | REFINED UI-flow test. */
  test("DDV_F09_029 - Refresh sau phản hồi lỗi: Form vẫn dùng được", async ({ page }) => {
    await ready(page);
    await enter(page, TEST_CODE, SYNTHETIC_PHONE);
    await search(page);
    await assertSubmittedSyntheticCode(page, TEST_CODE);
    await observeNegativeLookupForUi(page, 'F09_029_before_reload');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(orderInput(page)).toBeVisible();
    await expect(phoneInput(page)).toBeVisible();
    await expect(submit(page)).toBeVisible();
    await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i)).toHaveCount(0);
  });

  /** F09 V2 | DDV_F09_030 | refined after ASM06.
   * Expected: Chuỗi HTML trong mã giả không tạo thẻ HTML được thực thi từ input.
   * Test chỉ dùng dữ liệu giả, không chứng minh khả năng tra cứu một đơn thật.
   */
  test("DDV_F09_030 - Chống lộ thông tin/UI: Nhập chuỗi HTML ở mã đơn", async ({ page }) => {
    const harmlessMarkup = '<b>TEST</b>';
    await ready(page);
    await enter(page, harmlessMarkup, SYNTHETIC_PHONE);
    await search(page);

    // ASM06 expectation: user-controlled markup must be treated as data, NOT
    // interpreted as a DOM element, and must not expose other users' orders.
    // Do not reuse assertRejected() here: that helper tests business-error
    // feedback, which is a different requirement from HTML injection safety.
    const cannotGet = page.getByText(/^Cannot GET\b/i).filter({ visible: true });
    const feedback = page.getByText(specificFeedback).filter({ visible: true });
    await expect.poll(async () => {
      const state = await rejectionState(page);
      return state !== 'pending' || await cannotGet.count() > 0 || await feedback.count() > 0;
    }, {
      message: 'Expected the site to respond to the submitted harmless HTML text',
      timeout: 15_000,
      intervals: [250, 500, 1000],
    }).toBe(true);

    const observedState = await rejectionState(page);
    const rawRouteErrorShown = await cannotGet.count() > 0;
    await test.info().attach('F09_030_html_safety_diagnostic.txt', {
      body: Buffer.from(
        'Payload category: harmless HTML bold tag (NOT an executable script)\n' +
        `Response category: ${observedState}\n` +
        `Technical Cannot GET message visible: ${rawRouteErrorShown}\n` +
        'No raw URL, order ID, or phone number included in this diagnostic.\n' +
        'A visible technical route message should be recorded as a separate UX/error-handling issue.\n' +
        'Passing the HTML-tag check does not prove full XSS resistance.\n',
        'utf8',
      ),
      contentType: 'text/plain',
    });

    // A true internal-server-error response is still a failed test, as in F09_006.
    expect(observedState, 'Unexpected Internal server error for harmless markup')
      .not.toBe('server-error');
    await expect(orderInput(page)).toHaveValue(harmlessMarkup);
    await assertNoRenderedHtml(page);
    await expect(page.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i).first(),
      'Harmless markup must never reveal order details').toHaveCount(0);
    if (rawRouteErrorShown) {
      await addTestNote(
        'F09_030: harmless HTML was not rendered as a <b> element and no order details appeared. ' +
        'However, the UI showed a raw "Cannot GET" backend route. ' +
        'Record a separate technical-error/UX issue; this test alone does not verify all XSS vectors.'
      );
    }
  });

});
