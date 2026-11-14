import { test, expect as defaultExpect, type Page, type Locator } from '@playwright/test';

type ActionRecord = Record<string, unknown>;
type Scenario = [string, string, (page: Page, record: ActionRecord[]) => Promise<void>];
const expect = defaultExpect.configure({ timeout: 10_000 });

// BẢN ĐỘC LẬP: TC01–TC30 + helper F02 trong cùng 1 file.
// Đặt file tại automation/asm7/ trong project nhóm; không cần thư mục helpers/.

const FACETS = {
  price: 'Giá',
  os: 'Hệ điều hành',
  ram: 'RAM',
  storage: 'Bộ nhớ trong',
  feature: 'Tính năng nổi bật',
  screen: 'Công nghệ màn hình',
  cpu: 'Chip xử lý (CPU)',
  waterproof: 'Kháng nước',
  network: 'Mạng di động',
  brand: 'Hãng',
} as const;

type Facet = keyof typeof FACETS;

const TEST_OPTIONS: Partial<Record<Facet, RegExp[]>> = {
  ram: [/^8\s*GB$/i, /^12\s*GB$/i, /^6\s*GB$/i, /^4\s*GB$/i],
  storage: [/^128\s*GB$/i, /^256\s*GB$/i, /^512\s*GB$/i, /^64\s*GB$/i],
  os: [/android/i, /ios/i],
  feature: [/5g/i, /sạc nhanh/i, /ai/i],
  brand: [/samsung/i, /apple/i, /xiaomi/i],
  cpu: [/snapdragon/i, /apple/i, /mediatek/i],
  screen: [/oled/i, /amoled/i, /lcd/i],
};

const clean = (s: string | null | undefined) => String(s || '').replace(/\s+/g, ' ').trim();
const money = (s: string | null | undefined) => Number(String(s || '').replace(/\D/g, ''));

// Popup thông báo cookie có thể xuất hiện trễ và che bộ lọc.
// Chỉ bấm nút thật của popup, không dùng force click hoặc ẩn DOM bằng CSS.
async function clickCookieReject(page: Page) {
  const cookie = page.getByRole('dialog', { name: /cookie/i }).first();
  if (!(await cookie.isVisible().catch(() => false))) return false;

  const candidates = [
    cookie.getByRole('button', { name: /từ chối|không đồng ý|chỉ cần thiết|reject|deny/i }).first(),
    cookie.getByRole('button', { name: /đồng ý|chấp nhận|cho phép|đã hiểu|tiếp tục|accept|agree/i }).first(),
    cookie.getByRole('button', { name: /đóng|close|×|✕/i }).first(),
  ];
  for (const button of candidates) {
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click({ timeout: 5000 });
    await expect(cookie, 'Popup cookie phải đóng sau khi bấm nút').toBeHidden({ timeout: 5000 });
    return true;
  }
  const names = await cookie.locator('button').allTextContents().catch(() => []);
  throw new Error('Popup cookie đang chắn thao tác. Không tìm thấy nút đóng/chấp nhận. Các nút: ' + JSON.stringify(names));
}

// Nếu cookie xuất hiện ngay trong lúc bấm bộ lọc, đóng cookie rồi bấm lại.
async function clickWithCookieRecovery(page: Page, target: Locator) {
  await clickCookieReject(page);
  try {
    await target.click({ timeout: 8000 });
  } catch (error) {
    const cookie = page.getByRole('dialog', { name: /cookie/i }).first();
    if (!(await cookie.isVisible().catch(() => false))) throw error;
    await clickCookieReject(page);
    await target.click();
  }
}

async function startF02(page: Page) {
  await page.goto('https://didongviet.vn/dien-thoai.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Bộ lọc tìm kiếm', { exact: true }).first()).toBeVisible();
  await clickCookieReject(page);
}

function popup(page: Page): Locator {
  // In the actual DOM, the cookie notification is also a dialog, so don't use getByRole('dialog') alone.
  return page.locator('[role="dialog"][data-side="bottom"]:visible').last();
}

async function getTrigger(page: Page, facet: Facet) {
  const label = FACETS[facet];
  if (!label) throw new Error(`Bộ lọc không hợp lệ: ${facet}`);
  let t = page.getByRole('button', { name: label, exact: true });
  if (await t.count()) return t.first();
  // After selection some filters append the selected value to their button label.
  t = page.getByRole('button', { name: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)', 'i') });
  if (await t.count()) return t.first();
  t = page.getByText(label, { exact: true });
  if (await t.count()) return t.first();
  // The F02 spreadsheet includes a Brand filter, which may only be in the advanced filter panel.
  if (facet === 'brand') {
    const general = page.getByRole('button', { name: /^Lọc$/i });
    if (await general.count()) {
      await general.first().click();
      const panel = page.getByRole('dialog').filter({ hasNot: page.getByText('Cookie & trải nghiệm') }).last();
      const brand = panel.getByText(/^(Hãng|Thương hiệu)$/i).first();
      if (await brand.isVisible().catch(() => false)) return brand;
    }
  }
  return null;
}

async function openFacet(page: Page, facet: Facet) {
  const trigger = await getTrigger(page, facet);
  if (!trigger || !(await trigger.isVisible().catch(() => false))) {
    throw new Error(`Bộ lọc ${FACETS[facet]} không hiển thị trên giao diện hiện tại. ` +
        'Không thay bằng bộ lọc khác vì sẽ sai test case ASM06.');
  }
  await clickWithCookieRecovery(page, trigger);
  let p = popup(page);
  if (!(await p.isVisible().catch(() => false))) {
    // Some advanced-filter layouts keep the options in a regular drawer.
    p = page.getByRole('dialog').filter({ hasNot: page.getByText('Cookie & trải nghiệm') }).last();
  }
  await expect(p).toBeVisible();
  return p;
}

// Website có thể format lại input và tự đóng/mount lại popover khi đổi giá.
// Không giữ locator cũ hoặc press('Tab') lên input đã bị unmount.
async function ensurePricePopup(page: Page) {
  let p = popup(page);
  if (await p.isVisible().catch(() => false)) {
    const fields = p.locator('input:not([type="range"]):visible');
    if (await fields.count() === 2) return p;
  }
  return openFacet(page, 'price');
}

async function priceSnapshot(page: Page): Promise<number[]> {
  // Đọc cả hai ô trong một lượt, tránh DOM bị thay giữa hai lần inputValue().
  for (let attempt = 1; attempt <= 5; attempt++) {
    const p = await ensurePricePopup(page);
    try {
      const values = await p.locator('input:not([type="range"]):visible').evaluateAll(
          elements => elements.map(element =>
              Number((element as HTMLInputElement).value.replace(/\D/g, ''))));
      if (values.length === 2) return values;
    } catch (error) {
      if (attempt === 5) throw error;
    }
    await page.waitForTimeout(150);
  }
  throw new Error('Không đọc được đủ hai ô Giá từ/Giá đến sau khi popup cập nhật.');
}

async function changePriceBound(page: Page, which: number, desired: number) {
  const label = which === 0 ? 'Giá từ' : 'Giá đến';
  let lastValue = NaN;

  for (let attempt = 1; attempt <= 5; attempt++) {
    // Nếu website đã có giá trị đúng thì KHÔNG nhập lại, tránh kích hoạt render thừa.
    const before = await priceSnapshot(page);
    lastValue = before[which];
    if (lastValue === desired) return;

    const p = await ensurePricePopup(page);
    const field = p.locator(`input[aria-label="${label}"]:visible`).first();
    try {
      // React có thể thay input ngay khi focus. Chỉ dùng focus() để lấy tiêu điểm;
      // gõ bằng page.keyboard, không giữ locator cũ để fill() sau lúc re-render.
      await field.focus({ timeout: 3500 });
      const focused = await page.evaluate(name =>
          document.activeElement?.getAttribute('aria-label') === name, label);
      if (!focused) continue;

      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.insertText(String(desired));
    } catch (error) {
      // Nếu DOM thay giữa thao tác, lấy lại popup/input ở lượt sau.
      if (!/Timeout|detached|not attached|not visible/i.test(String(error))) throw error;
    }

    await page.waitForTimeout(250); // để React áp dụng và format giá
    try {
      const after = await priceSnapshot(page);
      lastValue = after[which];
      if (lastValue === desired) return;
    } catch (error) {
      if (attempt === 5) throw error;
    }
  }

  throw new Error(`Không cập nhật được ${label}: mong đợi ${desired}, website trả ${lastValue}. ` +
      'Hãy xem trace để phân biệt lỗi dữ liệu với lỗi React re-render.');
}

async function fillPrice(page: Page, fromValue: number, toValue: number) {
  if (!(Number.isFinite(fromValue) && Number.isFinite(toValue) && fromValue <= toValue)) {
    throw new Error(`Khoảng giá không hợp lệ: ${fromValue} - ${toValue}`);
  }
  const previous = await priceSnapshot(page);
  // Giữ thứ tự hợp lệ để tránh slider tự ép min/max vượt nhau.
  const sequence = toValue < previous[0] ? [[0, fromValue], [1, toValue]] :
      fromValue > previous[1] ? [[1, toValue], [0, fromValue]] :
          [[1, toValue], [0, fromValue]];
  for (const [which, desired] of sequence) await changePriceBound(page, which, desired);
  const actual = await priceSnapshot(page);
  expect(actual[0], 'Giá từ sau cập nhật').toBe(fromValue);
  expect(actual[1], 'Giá đến sau cập nhật').toBe(toValue);
  await page.waitForTimeout(250); // Hiển thị đủ lâu để người xem thấy thao tác
  return { facet: 'Giá', selected: `${fromValue} - ${toValue}`, check: 'Đã nhập và đọc lại hai ô Giá thật' };
}

async function availableChoices(p: Locator) {
  const choices = p.locator('button:visible, label:visible, [role="option"]:visible, [role="checkbox"]:visible, [role="radio"]:visible, li:visible, [class*="option"]:visible, span:visible');
  const results: Array<{ title: string; element: Locator }> = [];
  for (let i = 0, total = Math.min(await choices.count(), 70); i < total; i++) {
    const element = choices.nth(i);
    const title = clean(await element.innerText().catch(() => '')) || clean(await element.getAttribute('aria-label'));
    if (!title || title.length > 48 || /^(x|đóng|áp dụng|xem kết quả|bỏ chọn|chọn tất cả|xóa tất cả|hủy|đặt lại|lọc|giá|ram|hệ điều hành|bộ nhớ trong)$/i.test(title)) continue;
    // Plain span text is used only for plausible option values, not for arbitrary descriptions.
    if (await element.evaluate(el => el.tagName.toLowerCase() === 'span') && !/(GB|TB|Android|iOS|OLED|AMOLED|LCD|5G|4G|Apple|Samsung|Xiaomi|Snapdragon|MediaTek|sạc nhanh)/i.test(title)) continue;
    if (results.some(r => r.title === title)) continue;
    results.push({ title, element });
  }
  return results;
}

async function chooseOption(page: Page, facet: Facet, variant = 0) {
  const p = await openFacet(page, facet);
  const choices = await availableChoices(p);
  if (choices.length === 0) throw new Error(`Popup ${FACETS[facet]} không có lựa chọn click được. Dùng npx playwright codegen để lấy locator mới.`);
  const patterns = TEST_OPTIONS[facet] || [];
  const sorted = [
    ...patterns.flatMap(rx => choices.filter(c => rx.test(c.title))),
    ...choices,
  ];
  const unique = sorted.filter((item, i, arr) => arr.findIndex(other => other.title === item.title) === i);
  if (variant >= unique.length) throw new Error(`Bộ lọc ${FACETS[facet]} chỉ có ${unique.length} lựa chọn thực.`);
  const selected = unique[variant];
  await expect(selected.element).toBeVisible();
  await clickWithCookieRecovery(page, selected.element);
  // Some filters apply immediately, others provide an Apply button.
  const apply = p.getByRole('button', { name: /^(áp dụng|xem kết quả)$/i });
  if (await apply.isVisible().catch(() => false)) await clickWithCookieRecovery(page, apply);
  await page.waitForTimeout(250);
  // This confirms a real option was clicked. It doesn't claim every returned product matches.
  return { facet: FACETS[facet], selected: selected.title, check: 'Đã click lựa chọn đang hiển thị' };
}

async function select(page: Page, facet: Facet, variant = 0) {
  return facet === 'price' ? fillPrice(page, 5000000, 10000000) : chooseOption(page, facet, variant);
}

async function closeDropdown(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}

async function clearSingle(page: Page, facet: Facet, variant = 0) {
  if (facet === 'price') {
    // Dải mặc định 1–100 triệu được quan sát trong ảnh người dùng cung cấp.
    await fillPrice(page, 1000000, 100000000);
    return 'Đưa Giá về khoảng mặc định 1–100 triệu (không nhấn F5)';
  }
  const p = await openFacet(page, facet);
  const choices = await availableChoices(p);
  const pattern = (TEST_OPTIONS[facet] || [])[variant];
  const item = choices.find(c => pattern && pattern.test(c.title)) || choices[variant];
  if (!item) throw new Error(`Không tìm thấy tùy chọn ${FACETS[facet]} để bỏ chọn.`);
  await clickWithCookieRecovery(page, item.element);
  const apply = p.getByRole('button', { name: /^(áp dụng|xem kết quả)$/i });
  if (await apply.isVisible().catch(() => false)) await clickWithCookieRecovery(page, apply);
  return `Click lại tùy chọn ${item.title} để bỏ chọn`;
}

async function resetAll(page: Page) {
  // Một số phiên bản website không có nút Xóa tất cả; kiểm tra trước.
  for (const name of [/xóa tất cả/i, /bỏ lọc/i, /đặt lại/i]) {
    const btn = page.getByRole('button', { name }).filter({ visible: true }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      return 'Đã nhấn nút xóa bộ lọc có thật';
    }
  }
  // Kịch bản F02_020 đã chọn đúng RAM + Giá, nên bỏ từng điều kiện trên giao diện.
  // Không thay bằng reload vì thao tác reload không chứng minh chức năng xóa lọc.
  await clearSingle(page, 'ram', 0);
  await closeDropdown(page);
  await clearSingle(page, 'price');
  return 'Đã click bỏ RAM và đưa Giá về dải mặc định (không có nút Xóa tất cả)';
}



// Exactly 30 independent test cases mapped 1:1 to the F02 rows of ASM06.
// Each test loads the catalog from scratch and performs visible browser interactions.
// Các fixture buộc tạo worker mới PHẢI ở cấp cao nhất, ngoài test.describe().
// Giữ cấu hình riêng của bài cá nhân, không sửa playwright.config.js của nhóm.
test.use({
  browserName: 'chromium',
  headless: false,
  viewport: { width: 1440, height: 900 },
  launchOptions: { slowMo: 250 },
  actionTimeout: 12_000,
  navigationTimeout: 25_000,
  screenshot: 'only-on-failure',
  video: 'on',
  trace: 'retain-on-failure',
});

test.describe('TV01 – F02 – 30 ca kiểm thử lọc sản phẩm Di Động Việt', () => {
  test.setTimeout(90_000);
  test.beforeEach(async ({ page }) => startF02(page));

  async function run(page: Page, record: ActionRecord[], facet: Facet, variant = 0) {
    await closeDropdown(page);
    const result = await select(page, facet, variant);
    record.push(result);
    await closeDropdown(page);
    return result;
  }
  async function price(page: Page, record: ActionRecord[], from: number, to: number) {
    await closeDropdown(page);
    const result = await fillPrice(page, from, to);
    record.push(result);
    await closeDropdown(page);
    return result;
  }
  // Chỉ dùng cho F02_014: React có thể unmount ô Giá ngay lúc fill().
  // Thử lại từ trang danh mục sạch nếu và chỉ nếu gặp timeout/detached ở thao tác fill.
  // Không ép PASS: mỗi lần thử vẫn phải chạy đầy đủ các kiểm tra trong fillPrice().
  async function priceWithDomRetry(page: Page, record: ActionRecord[], from: number, to: number) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await price(page, record, from, to);
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const domWasReplaced = /element was detached from the DOM|locator\.fill: Timeout/i.test(message);
        if (!domWasReplaced || attempt === maxAttempts) throw error;
        console.warn(`DOM ô Giá không ổn định; thử lại từ trang sạch (${attempt + 1}/${maxAttempts})`);
        // Giá là thao tác đầu tiên của F02_014, nên mở lại trang không mất bước lọc nào.
        await startF02(page);
      }
    }
  }

  async function deleteFacet(page: Page, record: ActionRecord[], facet: Facet, variant = 0) {
    await closeDropdown(page);
    record.push({ remove: facet, result: await clearSingle(page, facet, variant) });
    await closeDropdown(page);
  }
  const scenarios: Scenario[] = [
    ['DDV_F02_001', 'Lọc đơn – Theo hệ điều hành A', async (p, r) => { await run(p, r, 'os'); }],
    ['DDV_F02_002', 'Lọc đơn – Bộ nhớ trong C (tùy chọn thứ ba)', async (p, r) => { await run(p, r, 'storage', 2); }],
    ['DDV_F02_003', 'Lọc đơn – Theo dung lượng A', async (p, r) => { await run(p, r, 'storage'); }],
    ['DDV_F02_004', 'Lọc đơn – Theo RAM A', async (p, r) => { await run(p, r, 'ram'); }],
    ['DDV_F02_005', 'Lọc đơn – Theo tính năng nổi bật A', async (p, r) => { await run(p, r, 'feature'); }],
    ['DDV_F02_006', 'Lọc kết hợp – Hệ điều hành + Giá', async (p, r) => { await run(p, r, 'os'); await price(p, r, 5000000, 15000000); }],
    ['DDV_F02_007', 'Lọc kết hợp – Hệ điều hành + Dung lượng', async (p, r) => { await run(p, r, 'os'); await run(p, r, 'storage'); }],
    ['DDV_F02_008', 'Lọc kết hợp – RAM + Chip xử lý (CPU)', async (p, r) => {await run(p, r, 'ram', 0);await run(p, r, 'cpu', 0);}],    ['DDV_F02_009', 'Lọc kết hợp – Giá + RAM', async (p, r) => { await price(p, r, 7000000, 20000000); await run(p, r, 'ram'); }],
    ['DDV_F02_010', 'Lọc 3 tiêu chí – Hệ điều hành + Giá + Dung lượng', async (p, r) => { await run(p, r, 'os'); await price(p, r, 5000000, 20000000); await run(p, r, 'storage'); }],
    ['DDV_F02_011', 'Đổi điều kiện – Hệ điều hành A sang B', async (p, r) => { await run(p, r, 'os', 0); await deleteFacet(p, r, 'os', 0); await run(p, r, 'os', 1); }],
    ['DDV_F02_012', 'Lọc kết hợp – RAM B + Bộ nhớ trong C', async (p, r) => {
      const ram = await run(p, r, 'ram', 1);
      const storage = await run(p, r, 'storage', 2);
      expect(ram.facet).toBe('RAM');
      expect(storage.facet).toBe('Bộ nhớ trong');
      expect(clean(String(ram.selected)), 'Phải chọn được RAM B thật').not.toBe('');
      expect(clean(String(storage.selected)), 'Phải chọn được Bộ nhớ trong C thật').not.toBe('');
      await expect(p.getByText('Bộ lọc tìm kiếm', { exact: true }).first()).toBeVisible();
    }],
    ['DDV_F02_013', 'Đổi điều kiện – Bộ nhớ nhỏ sang lớn', async (p, r) => { await run(p, r, 'storage', 0); await run(p, r, 'storage', 1); }],
    ['DDV_F02_014', 'Thêm tiêu chí thứ ba', async (p, r) => { await priceWithDomRetry(p, r, 5000000, 30000000); await run(p, r, 'ram'); await run(p, r, 'storage'); }],
    ['DDV_F02_015', 'Đổi một tiêu chí nhưng giữ tiêu chí khác', async (p, r) => { await run(p, r, 'ram'); await price(p, r, 5000000, 15000000); await price(p, r, 15000000, 35000000); }],
    ['DDV_F02_016', 'Xóa bộ lọc – Giá', async (p, r) => {
      await price(p, r, 5000000, 15000000);

      await closeDropdown(p);

      const result = await resetAll(p);

      r.push({
        remove: 'price',
        method: 'resetAll',
        result: result
      });
    }],    ['DDV_F02_017', 'Xóa bộ lọc – Hệ điều hành', async (p, r) => { await run(p, r, 'os'); await deleteFacet(p, r, 'os'); }],
    ['DDV_F02_018', 'Xóa bộ lọc – RAM', async (p, r) => { await run(p, r, 'ram'); await deleteFacet(p, r, 'ram'); }],
    ['DDV_F02_019', 'Xóa một trong ba điều kiện', async (p, r) => { await price(p, r, 5000000, 35000000); await run(p, r, 'ram'); await run(p, r, 'storage'); await deleteFacet(p, r, 'ram'); }],
    ['DDV_F02_020', 'Lọc kết hợp – RAM + Bộ nhớ trong', async (p, r) => { await run(p, r, 'ram'); await run(p, r, 'storage'); }],
    ['DDV_F02_021', 'Lọc kết hợp – Hệ điều hành + Tính năng nổi bật', async (p, r) => { await run(p, r, 'os'); await run(p, r, 'feature'); }],
    ['DDV_F02_022', 'Lọc kết hợp – RAM + Tính năng nổi bật', async (p, r) => { await run(p, r, 'ram'); await run(p, r, 'feature'); }],
    ['DDV_F02_023', 'Lọc đơn – RAM tùy chọn B (khác F02_004)', async (p, r) => { await run(p, r, 'ram', 1); }],
    ['DDV_F02_024', 'Lọc kết hợp – Hệ điều hành + RAM', async (p, r) => { await run(p, r, 'os'); await run(p, r, 'ram'); }],
    ['DDV_F02_025', 'Không chọn bất kỳ bộ lọc nào', async (p, r) => {
      await expect(p.getByText('Bộ lọc tìm kiếm', { exact: true }).first()).toBeVisible();
      const buttons = p.getByRole('button', { name: /^Giá$|^RAM$|^Bộ nhớ trong$/ });
      await expect(buttons.first()).toBeVisible();
      r.push({ baseline: 'Trang bộ lọc hiển thị, chưa click lựa chọn nào' });
    }],
    ['DDV_F02_026', 'Lọc kết hợp – Bộ nhớ trong B + Công nghệ màn hình A', async (p, r) => {
      const storage = await run(p, r, 'storage', 1);
      const screen = await run(p, r, 'screen', 0);
      expect(storage.facet).toBe('Bộ nhớ trong');
      expect(screen.facet).toBe('Công nghệ màn hình');
      expect(clean(String(storage.selected)), 'Phải chọn được Bộ nhớ trong B thật').not.toBe('');
      expect(clean(String(screen.selected)), 'Phải chọn được Công nghệ màn hình A thật').not.toBe('');
      await expect(p.getByText('Bộ lọc tìm kiếm', { exact: true }).first()).toBeVisible();
    }],
    ['DDV_F02_027', 'Mở rồi đóng bảng lọc', async (p, r) => {
      await openFacet(p, 'ram');
      await expect(popup(p)).toBeVisible();
      await closeDropdown(p);
      await expect(popup(p)).toBeHidden();
      r.push({ dialog: 'Mở và đóng bằng Escape' });
    }],
    ['DDV_F02_028', 'Lọc đơn – Theo chip xử lý (CPU)', async (p, r) => {
      await run(p, r, 'cpu');
    }],
    ['DDV_F02_029', 'Lọc đơn – Theo công nghệ màn hình', async (p, r) => {
      await run(p, r, 'screen');
    }],
    ['DDV_F02_030', 'Đổi thứ tự sắp xếp khi đang lọc', async (p, r) => {
      // Giá đôi lúc re-render input; chỉ retry TC30 nếu gặp TimeoutError.
      try {
        await price(p, r, 5000000, 35000000);
      } catch (error) {
        if (!/TimeoutError|Timeout.*exceeded/i.test(String(error))) throw error;
        await closeDropdown(p);
        await price(p, r, 5000000, 35000000);
      }
      await closeDropdown(p);

      // Không dùng .first() trên toàn bộ DOM: có thể bắt nhầm phần tử bị ẩn.
      const ascending = p.getByText('Giá tăng dần', { exact: true })
          .filter({ visible: true }).first();
      await expect(ascending).toBeVisible({ timeout: 15000 });
      await ascending.scrollIntoViewIfNeeded();

      // Ghi nhận trạng thái hiển thị trước/sau click để không báo PASS suông.
      const state = () => ascending.evaluate(el => {
        const target = el.closest('button, [role="button"]') || el.parentElement || el;
        const style = getComputedStyle(target);
        const textStyle = getComputedStyle(el);
        return [target.className, target.getAttribute('aria-pressed'),
          style.borderColor, style.backgroundColor, style.color, textStyle.color].join('|');
      });
      const before = await state();
      await ascending.click();
      await expect.poll(state, {
        timeout: 10000,
        message: 'Đã click nhưng giao diện chưa thể hiện trạng thái chọn Giá tăng dần',
      }).not.toBe(before);

      // Vẫn đang ở màn hình lọc, không chỉ kiểm tra sort rồi kết thúc.
      await expect(p.getByText('Bộ lọc tìm kiếm', { exact: true }).first()).toBeVisible();
      r.push({ sort: 'Giá tăng dần', check: 'Đã click và thấy trạng thái sắp xếp thay đổi' });
    }],
  ];

  // Avoid accidentally shipping 29 cases or duplicate IDs.
  if (scenarios.length !== 30 || new Set(scenarios.map(s => s[0])).size !== 30) {
    throw new Error('F02 phải có đúng 30 test case độc lập, không trùng ID.');
  }

  for (const [id, description, action] of scenarios) {
    test(`${id} - ${description}`, async ({ page }, testInfo) => {
      const record: ActionRecord[] = [];
      await test.step(`Thực hiện ${id}: ${description}`, async () => action(page, record));
      console.log(`${id}: ${JSON.stringify(record)}`);
      await testInfo.attach(`${id}-buoc-thuc-hien.json`, {
        body: JSON.stringify({ id, description, actions: record, url: page.url() }, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach(`${id}-giao-dien.png`, {
        body: await page.screenshot({ fullPage: false }),
        contentType: 'image/png',
      });
    });
  }
});
