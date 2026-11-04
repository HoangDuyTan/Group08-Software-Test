import { test as base, expect, type Locator, type Page } from '@playwright/test';

/**
 * Group08 | Nguyễn Văn Anh Hàn | 23130087 | F12 / D12 | 30 case theo Excel.
 * Nguồn: Group08_23130087_NguyenVanAnhHan.xlsx, sheet F12 - Consultation.
 * Chạy từ thư mục Automation Testing Project - Group08:
 * npx playwright test tests/23130087_NguyenVanAnhHan/23130087_NguyenVanAnhHan_F12.spec.ts --project=chromium --headed --workers=1
 *
 * 001–029: UI thật của form Đăng ký tư vấn B2B; context mới cho mỗi case.
 * serviceWorkers=block; route được cài trước goto và abort mọi request ghi.
 * Không mock phản hồi thành công. Validation sai phải KHÔNG tạo request B2B.
 * 029 đối chiếu payload thật tại route đã chặn và xử lý lỗi mạng/gửi lại.
 * 030: Skipped + annotation Blocked, thiếu staging/test contact/oracle trong Excel.
 * Không suy ra đã tạo lead hoặc tham gia chiến dịch khuyến mãi từ kết quả UI.
 * Không sửa workbook, F10/F11, package.json hoặc cấu hình chung của nhóm.
 */

const HOME = 'https://didongviet.vn/';
const B2B = 'https://didongviet.vn/dich-vu-khach-hang-doanh-nghiep.html';
const ENDPOINT = 'https://didongviet.vn/api/fe/wp-landings/b2b';
const FAILURE = 'Gửi đăng ký không thành công. Vui lòng thử lại.';
const SUCCESS = 'Đăng ký thành công!';
const FIELDS = ['name', 'phone', 'email', 'company', 'product', 'quantity', 'note'] as const;
type Field = (typeof FIELDS)[number];
type Data = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;
type CapturedWrite = {
  url: string;
  method: string;
  body: unknown;
  aborted: boolean;
};
type Guard = {
  installed: boolean;
  blocked: CapturedWrite[];
  b2b: CapturedWrite[];
  responses: { url: string; status: number }[];
};

const LABELS: Record<Field, string> = {
  name: 'Tên quý khách', phone: 'Số điện thoại', email: 'Email',
  company: 'Tên công ty', product: 'Sản phẩm đang quan tâm',
  quantity: 'Số lượng', note: 'Yêu cầu khác',
};

const DATA: Data = {
  name: 'Nguyễn Văn An', phone: '0901234567', email: 'asm7@example.com',
  company: 'ASM7 QA', product: 'iPhone 15', quantity: '1', note: '',
};

const EMPTY: Data = { name: '', phone: '', email: '', company: '', product: '', quantity: '', note: '' };
const NAME_MIN = 'Họ và tên tối thiểu 2 ký tự';
const PHONE_ERROR = 'Số điện thoại không hợp lệ';
const EMAIL_ERROR = 'Email không hợp lệ';
const REQUIRED: Errors = {
  name: NAME_MIN, phone: PHONE_ERROR, email: EMAIL_ERROR,
  company: 'Vui lòng nhập tên công ty', product: 'Vui lòng nhập sản phẩm quan tâm',
  quantity: 'Số lượng không hợp lệ',
};

function form(page: Page): Locator {
  return page.locator('form').filter({ has: page.locator('#b2b-name') });
}

function field(page: Page, key: Field): Locator {
  return form(page).locator(`#b2b-${key}`);
}

function fieldRoot(page: Page, key: Field): Locator {
  return field(page, key).locator('xpath=ancestor::*[@data-slot="input-root"][1]');
}

function submit(page: Page): Locator {
  return form(page).getByRole('button', { name: 'Hoàn tất đăng ký', exact: true });
}

function cookieDialog(page: Page): Locator {
  // aria-labelledby của website có thể ghi đè aria-label; dùng tiêu đề hiển thị.
  return page.getByRole('dialog').filter({ hasText: 'Cookie & trải nghiệm Di Động Việt' });
}

async function dismissCookies(page: Page) {
  const cookie = cookieDialog(page);
  await cookie.waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {});
  if (await cookie.isVisible()) {
    await cookie.getByRole('button', { name: 'Từ chối', exact: true }).click();
    await expect(cookie).toBeHidden();
  }
}

async function waitForContent(page: Page, content: Locator) {
  const challenge = page.getByRole('heading', { name: /Verifying that you are not a robot/i });
  await content.or(challenge).first().waitFor({ state: 'visible' });
  if (await challenge.isVisible()) {
    const reason = 'Blocked: website hiển thị xác minh robot/reCAPTCHA trước nội dung cần kiểm tra. Chưa kiểm tra được case; không vượt CAPTCHA hoặc thay bằng nội dung mock.';
    base.info().annotations.push({ type: 'Blocked', description: reason });
    base.skip(true, reason);
  }
}

async function readyForm(page: Page, initializeCookieHandler = true) {
  await expect(page).toHaveURL(B2B);
  await waitForContent(page, form(page));
  if (initializeCookieHandler) {
    await dismissCookies(page);
    const cookie = cookieDialog(page);
    await page.addLocatorHandler(cookie, async () => {
      await cookie.getByRole('button', { name: 'Từ chối', exact: true }).click();
      await expect(cookie).toBeHidden();
    });
  }
  await expect(form(page)).toHaveCount(1);
  await expect(form(page).getByRole('heading', { name: 'Đăng ký tư vấn B2B', exact: true })).toBeVisible();
  await expect(form(page)).toHaveAttribute('novalidate', '');
  await field(page, 'name').scrollIntoViewIfNeeded();
  for (const key of FIELDS) await expect(field(page, key)).toBeEditable();
  await expect(submit(page)).toBeEnabled();
}

async function openForm(page: Page) {
  await test.step('01 - Mở trang B2B, đóng cookie và chờ form tương tác được', async () => {
    const response = await page.goto(B2B, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), 'Trang B2B phải trả HTTP thành công').toBeLessThan(400);
    await readyForm(page);
    await assertValues(page, EMPTY);
    await assertErrors(page, {});
  });
}

function domValue(key: Field, value: string): string {
  // type=email của Chromium tự loại ASCII whitespace hai đầu, khác schema trim.
  return key === 'email' ? value.replace(/^[ \t\r\n\f]+|[ \t\r\n\f]+$/g, '') : value;
}

async function assertValues(page: Page, data: Data, allowTrim = false) {
  for (const key of FIELDS) {
    const expected = domValue(key, data[key]);
    if (allowTrim && key !== 'email' && key !== 'quantity' && expected !== expected.trim()) {
      // Excel cho phép UI giữ nguyên khoảng trắng hoặc hiển thị giá trị đã trim.
      await expect.poll(async () => [expected, expected.trim()].includes(await field(page, key).inputValue()),
        { message: `${LABELS[key]} phải giữ dữ liệu đã nhập` }).toBe(true);
    } else {
      await expect(field(page, key), LABELS[key]).toHaveValue(expected);
    }
  }
}

async function fillData(page: Page, data: Data) {
  for (const key of FIELDS) await field(page, key).fill(data[key]);
  await assertValues(page, data);
}

async function assertErrors(page: Page, errors: Errors) {
  for (const key of FIELDS) {
    const message = errors[key];
    const alert = fieldRoot(page, key).getByRole('alert');
    await expect(field(page, key), `${LABELS[key]}: aria-invalid`)
      .toHaveAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) {
      await expect(alert, `Lỗi riêng của ${LABELS[key]}`).toHaveCount(1);
      await expect(alert).toHaveText(message);
    } else {
      await expect(alert, `${LABELS[key]} không được có lỗi ngoài dự kiến`).toHaveCount(0);
    }
  }
  await expect(form(page).getByRole('alert')).toHaveCount(Object.keys(errors).length);
}

function businessWrites(guard: Guard): CapturedWrite[] {
  return guard.blocked.filter(record => {
    const url = new URL(record.url);
    // Trang chủ tự POST phiên khách không có body; request này vẫn bị abort,
    // được lưu trong blocked, nhưng không phải yêu cầu đăng ký B2B.
    const emptyGuestSession = url.pathname === '/api/guest-session' &&
      record.method === 'POST' && record.body === null;
    return url.origin === new URL(B2B).origin && url.pathname.startsWith('/api/') && !emptyGuestSession;
  });
}

async function assertNoSuccess(page: Page) {
  await expect(form(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: SUCCESS, exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(B2B);
}

async function assertUnsent(page: Page, guard: Guard, data: Data) {
  expect(guard.installed, 'Guard phải được cài trước goto').toBe(true);
  expect(guard.b2b, 'Validation phải chặn tại client, không chỉ nhờ route.abort').toHaveLength(0);
  expect(businessWrites(guard), 'Không được gửi sang endpoint ghi khác').toHaveLength(0);
  expect(guard.responses, 'Không có phản hồi API tạo lead').toHaveLength(0);
  await assertValues(page, data, true);
  await assertNoSuccess(page);
  await expect(submit(page)).toBeEnabled();
}

async function clickSubmit(page: Page, guard: Guard) {
  expect(guard.installed).toBe(true);
  await expect(submit(page)).toBeEnabled();
  await submit(page).evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await submit(page).click();
}

const test = base.extend<{ guard: Guard }>({
  guard: async ({ context, serviceWorkers }, use, testInfo) => {
    expect(serviceWorkers).toBe('block');
    const state: Guard = { installed: false, blocked: [], b2b: [], responses: [] };
    context.on('response', response => {
      if (response.url() === ENDPOINT && response.request().method() === 'POST') {
        state.responses.push({ url: response.url(), status: response.status() });
      }
    });
    await context.route('**/*', async route => {
      const request = route.request();
      if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        await route.continue();
        return;
      }
      let body: unknown = request.postData();
      try { body = request.postDataJSON(); } catch { /* Giữ raw body nếu không phải JSON. */ }
      const record: CapturedWrite = { url: request.url(), method: request.method(), body, aborted: false };
      state.blocked.push(record);
      if (record.url === ENDPOINT && record.method === 'POST') state.b2b.push(record);
      // Fail closed: endpoint thay đổi vẫn không được gửi dữ liệu ra backend.
      await route.abort('blockedbyclient');
      record.aborted = true;
    });
    state.installed = true;
    try {
      await use(state);
    } finally {
      await testInfo.attach('F12-request-guard.json', {
        body: JSON.stringify({ ...state, scope: 'Requests captured and aborted; no backend success asserted' }, null, 2),
        contentType: 'application/json',
      });
      // Không unroute: giữ guard cho đến khi Playwright đóng context.
    }
  },
});

type ValidationCase = {
  id: string;
  title: string;
  field: Field;
  values: string[];
  messages: (string | null)[];
  sentinel?: 'name' | 'phone';
};

const CASES: ValidationCase[] = [
  { id: 'DDV_F12_003', title: 'Tên quý khách trống hoặc chỉ gồm năm dấu cách', field: 'name', values: ['', '     '], messages: [NAME_MIN, NAME_MIN] },
  { id: 'DDV_F12_004', title: 'Tên quý khách chỉ một ký tự', field: 'name', values: ['A'], messages: [NAME_MIN] },
  { id: 'DDV_F12_005', title: 'Tên quý khách đúng ngưỡng tối thiểu hai ký tự', field: 'name', values: ['An'], messages: [null], sentinel: 'phone' },
  { id: 'DDV_F12_006', title: 'Giới hạn họ tên 255 và 256 ký tự', field: 'name', values: ['A'.repeat(255), 'A'.repeat(256)], messages: [null, 'Họ và tên tối đa 255 ký tự'], sentinel: 'phone' },
  { id: 'DDV_F12_007', title: 'Họ tên tiếng Việt và khoảng trắng hai đầu', field: 'name', values: ['  Nguyễn Văn An  '], messages: [null], sentinel: 'phone' },
  { id: 'DDV_F12_008', title: 'Số điện thoại để trống', field: 'phone', values: [''], messages: [PHONE_ERROR] },
  { id: 'DDV_F12_009', title: 'Số điện thoại chứa chữ cái', field: 'phone', values: ['09abc12345'], messages: [PHONE_ERROR] },
  { id: 'DDV_F12_010', title: 'Số điện thoại nội địa chỉ có chín chữ số', field: 'phone', values: ['090123456'], messages: [PHONE_ERROR] },
  { id: 'DDV_F12_011', title: 'Số điện thoại nội địa có mười chữ số', field: 'phone', values: ['0901234567'], messages: [null], sentinel: 'name' },
  { id: 'DDV_F12_012', title: 'Số điện thoại nội địa mười một chữ số theo validation hiện tại', field: 'phone', values: ['09012345678'], messages: [null], sentinel: 'name' },
  { id: 'DDV_F12_013', title: 'Số điện thoại có tiền tố quốc tế +84', field: 'phone', values: ['+84901234567'], messages: [null], sentinel: 'name' },
  { id: 'DDV_F12_014', title: 'Phân biệt khoảng trắng giữa số và khoảng trắng hai đầu', field: 'phone', values: ['090 1234567', '  0901234567  '], messages: [PHONE_ERROR, null], sentinel: 'name' },
  { id: 'DDV_F12_015', title: 'Email để trống', field: 'email', values: [''], messages: [EMAIL_ERROR] },
  { id: 'DDV_F12_016', title: 'Email thiếu @ hoặc thiếu tên miền', field: 'email', values: ['asm7.example.com', 'asm7@'], messages: [EMAIL_ERROR, EMAIL_ERROR] },
  { id: 'DDV_F12_017', title: 'Email đúng cú pháp có dấu cách ASCII hai đầu', field: 'email', values: [' asm7@example.com '], messages: [null], sentinel: 'phone' },
  { id: 'DDV_F12_018', title: 'Tên công ty trống hoặc chỉ có dấu cách', field: 'company', values: ['', '     '], messages: [REQUIRED.company!, REQUIRED.company!] },
  { id: 'DDV_F12_019', title: 'Giới hạn tên công ty 255 và 256 ký tự', field: 'company', values: ['C'.repeat(255), 'C'.repeat(256)], messages: [null, 'Tên công ty tối đa 255 ký tự'], sentinel: 'phone' },
  { id: 'DDV_F12_020', title: 'Sản phẩm quan tâm trống hoặc chỉ có dấu cách', field: 'product', values: ['', '     '], messages: [REQUIRED.product!, REQUIRED.product!] },
  { id: 'DDV_F12_021', title: 'Giới hạn sản phẩm quan tâm 500 và 501 ký tự', field: 'product', values: ['P'.repeat(500), 'P'.repeat(501)], messages: [null, 'Tối đa 500 ký tự'], sentinel: 'phone' },
  { id: 'DDV_F12_022', title: 'Số lượng để trống', field: 'quantity', values: [''], messages: [REQUIRED.quantity!] },
  { id: 'DDV_F12_023', title: 'Số lượng bằng không hoặc âm', field: 'quantity', values: ['0', '-1'], messages: ['Số lượng tối thiểu là 1', 'Số lượng tối thiểu là 1'] },
  { id: 'DDV_F12_024', title: 'Số lượng là số thập phân', field: 'quantity', values: ['1.5'], messages: ['Số lượng phải là số nguyên'] },
  { id: 'DDV_F12_025', title: 'Số lượng tối thiểu một và bỏ trống yêu cầu tùy chọn', field: 'quantity', values: ['1'], messages: [null], sentinel: 'phone' },
  { id: 'DDV_F12_026', title: 'Giới hạn yêu cầu khác 1000 và 1001 ký tự', field: 'note', values: ['N'.repeat(1000), 'N'.repeat(1001)], messages: [null, 'Tối đa 1000 ký tự'], sentinel: 'phone' },
];

test.describe('F12 | Đăng ký tư vấn B2B | Nguyễn Văn Anh Hàn | 30 case theo Excel', () => {
  test.describe.configure({ mode: 'default', timeout: 90_000 });
  test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });

  test('DDV_F12_001 - Mở form tư vấn B2B từ liên kết footer và kiểm tra trạng thái ban đầu', async ({ page, guard }) => {
    await test.step('01 - Mở trang chủ trong context có guard, cuộn footer', async () => {
      expect(guard.installed).toBe(true);
      const response = await page.goto(HOME, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(400);
      await waitForContent(page, page.locator('footer'));
      await dismissCookies(page);
      await page.locator('footer').scrollIntoViewIfNeeded();
    });
    await test.step('02 - Nhấn liên kết B2B thật và chờ đúng trang/form', async () => {
      const link = page.locator('footer').getByRole('link', { name: 'Liên hệ hợp tác kinh doanh (B2B)', exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await readyForm(page);
    });
    await test.step('03 - Đúng bảy trường, sáu dấu bắt buộc, tất cả ban đầu trống', async () => {
      await expect(form(page).locator('input, textarea')).toHaveCount(7);
      for (const key of FIELDS) {
        const label = form(page).locator(`label[for="b2b-${key}"]`);
        await expect(label).toContainText(LABELS[key]);
        if (key === 'note') await expect(label).toContainText('(Tùy chọn)');
        else await expect(label.locator('span[aria-hidden="true"]')).toHaveText('*');
      }
      await expect(form(page).locator('select, [role="combobox"], input[type="checkbox"], [role="checkbox"]')).toHaveCount(0);
      await assertValues(page, EMPTY);
      await assertErrors(page, {});
      await assertUnsent(page, guard, EMPTY);
    });
  });

  test('DDV_F12_002 - Bỏ trống toàn bộ: đủ sáu lỗi bắt buộc và không lỗi ô tùy chọn', async ({ page, guard }) => {
    await openForm(page);
    await test.step('02 - Đảm bảo cả bảy giá trị thật đều trống', () => fillData(page, EMPTY));
    await test.step('03 - Nhấn gửi và kiểm tra đủ sáu lỗi inline', async () => {
      await clickSubmit(page, guard);
      await assertErrors(page, REQUIRED);
    });
    await test.step('04 - Dữ liệu không đổi, không phát sinh request đăng ký', () => assertUnsent(page, guard, EMPTY));
  });

  for (const c of CASES) {
    test(`${c.id} - ${c.title}`, async ({ page, guard }, testInfo) => {
      if (c.id === 'DDV_F12_012') {
        testInfo.annotations.push({ type: 'Scope', description: 'Characterization theo Excel: UI nhận mẫu 11 số; không khẳng định số thuê bao hợp lệ hoặc quy tắc nghiệp vụ đã duyệt.' });
      }
      await openForm(page);
      const data: Data = { ...DATA, [c.field]: c.values[0] };
      if (c.sentinel) data[c.sentinel] = '';
      await test.step('02 - Nhập đủ dữ liệu riêng của case, gồm trường cố ý để trống', () => fillData(page, data));
      for (const [index, value] of c.values.entries()) {
        const description = value.length > 50 ? `${value.length} ký tự ${value[0]}` : JSON.stringify(value);
        await test.step(`${String(index + 3).padStart(2, '0')} - ${LABELS[c.field]} = ${description}, nhấn gửi và đối chiếu lỗi`, async () => {
          data[c.field] = value;
          await field(page, c.field).fill(value);
          await expect(field(page, c.field)).toHaveValue(domValue(c.field, value));
          const errors: Errors = {};
          if (c.sentinel) errors[c.sentinel] = REQUIRED[c.sentinel];
          if (c.messages[index]) errors[c.field] = c.messages[index]!;
          await clickSubmit(page, guard);
          await assertErrors(page, errors);
          expect(guard.b2b, 'Mọi lần validation trong case phải ngăn gửi API').toHaveLength(0);
        });
      }
      await test.step(`${String(c.values.length + 3).padStart(2, '0')} - Dữ liệu còn nguyên và request đăng ký bằng 0`,
        () => assertUnsent(page, guard, data));
    });
  }

  test('DDV_F12_027 - Sửa lỗi điện thoại mà vẫn giữ lỗi của họ tên', async ({ page, guard }) => {
    await openForm(page);
    const data: Data = { ...DATA, name: '', phone: '090123456' };
    await test.step('02 - Nhập dữ liệu và xác minh cả lỗi tên lẫn điện thoại', async () => {
      await fillData(page, data);
      await clickSubmit(page, guard);
      await assertErrors(page, { name: NAME_MIN, phone: PHONE_ERROR });
    });
    await test.step('03 - Chỉ sửa điện thoại, lỗi tên vẫn còn', async () => {
      data.phone = '0901234567';
      await field(page, 'phone').fill(data.phone);
      await clickSubmit(page, guard);
      await assertErrors(page, { name: NAME_MIN });
    });
    await test.step('04 - Không xóa trường khác hoặc tạo request đăng ký', () => assertUnsent(page, guard, data));
  });

  test('DDV_F12_028 - Reload khi đã nhập nhưng chưa gửi đăng ký', async ({ page, guard }) => {
    await openForm(page);
    await test.step('02 - Nhập đầy đủ dữ liệu nhưng không nhấn gửi', async () => {
      await fillData(page, DATA);
      await assertUnsent(page, guard, DATA);
    });
    await test.step('03 - Reload cùng URL và chờ form mới', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await readyForm(page, false);
    });
    await test.step('04 - Bảy trường rỗng, không lỗi, không có request đăng ký', async () => {
      await assertErrors(page, {});
      await assertUnsent(page, guard, EMPTY);
    });
  });

  test('DDV_F12_029 - Payload hợp lệ, lỗi mạng có kiểm soát và gửi lại', async ({ page, guard }, testInfo) => {
    await openForm(page);
    const data: Data = { ...DATA, name: '  Nguyễn Văn An  ', phone: '  0901234567  ',
      company: '  ASM7 QA  ', product: '  iPhone 15  ', note: '  ASM7 QA - khong lien he  ' };
    const payload = { fullName: DATA.name, phone: DATA.phone, email: DATA.email,
      company: DATA.company, product: DATA.product, quantity: 1, note: 'ASM7 QA - khong lien he',
      sourcePath: 'landing/dich-vu-khach-hang-doanh-nghiep' };
    testInfo.annotations.push({ type: 'Scope', description: 'Request thật bị abort tại client. Passed chỉ chứng minh payload frontend và xử lý lỗi mạng; không có đăng ký thành công ở backend.' });
    await test.step('02 - Xác minh guard, bộ đếm 0 và nhập dữ liệu hợp lệ', async () => {
      expect(guard.installed).toBe(true);
      expect(guard.b2b).toHaveLength(0);
      expect(businessWrites(guard)).toHaveLength(0);
      await fillData(page, data);
    });
    await test.step('03 - Click thật, capture rồi abort POST và đối chiếu toàn bộ payload', async () => {
      await clickSubmit(page, guard);
      await expect.poll(() => guard.b2b.length).toBe(1);
      await expect.poll(() => guard.b2b[0]?.aborted).toBe(true);
      expect(guard.b2b[0]).toEqual({ url: ENDPOINT, method: 'POST', body: payload, aborted: true });
      expect(businessWrites(guard)).toHaveLength(1);
      await assertErrors(page, {});
    });
    await test.step('04 - Báo lỗi mạng, giữ dữ liệu và cho phép gửi lại', async () => {
      await expect(page.locator('[data-sonner-toast]').filter({ hasText: FAILURE }).last()).toBeVisible();
      await expect(submit(page)).toBeEnabled();
      await assertValues(page, data, true);
      await assertNoSuccess(page);
      expect(guard.responses).toHaveLength(0);
    });
    await test.step('05 - Click lại đúng một lần, tổng hai request đều bị abort', async () => {
      await clickSubmit(page, guard);
      await expect.poll(() => guard.b2b.length).toBe(2);
      await expect.poll(() => guard.b2b.every(record => record.aborted)).toBe(true);
      expect(guard.b2b).toEqual([1, 2].map(() => ({ url: ENDPOINT, method: 'POST', body: payload, aborted: true })));
      expect(businessWrites(guard)).toHaveLength(2);
      await expect(page.locator('[data-sonner-toast]').filter({ hasText: FAILURE }).last()).toBeVisible();
      await expect(submit(page)).toBeEnabled();
      await assertErrors(page, {});
      await assertValues(page, data, true);
      await assertNoSuccess(page);
      expect(guard.responses).toHaveLength(0);
    });
  });

  test('DDV_F12_030 - Đăng ký tư vấn thành công trên môi trường test được cấp', async ({}, testInfo) => {
    await test.step('01 - Kiểm tra tiền điều kiện tích hợp theo Excel', async () => {
      const reason = 'Blocked: chưa có TEST_URL staging được cấp phép, test contact, thông điệp thành công và kênh đối soát lead. Không chạy production hoặc mock thành công để thay case tích hợp.';
      testInfo.annotations.push({ type: 'Blocked', description: reason });
      test.skip(true, reason);
      // Bước 02–04 chỉ triển khai sau khi có hợp đồng API và fixture thực tế.
      // Cần xác minh đúng một lead QA, rồi Đăng ký thêm mở form trống, không POST.
    });
  });
});
