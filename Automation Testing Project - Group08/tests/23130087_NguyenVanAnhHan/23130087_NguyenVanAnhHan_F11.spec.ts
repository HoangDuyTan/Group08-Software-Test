import { test as base, expect, type Locator, type Page } from '@playwright/test';

/**
 * Group08 | Nguyễn Văn Anh Hàn | 23130087 | F11 / D11 | 30 test cases.
 * Nguồn: Group08_23130087_NguyenVanAnhHan.xlsx, sheet F11 - Store Search.
 * Chạy từ thư mục Automation Testing Project - Group08:
 * npx playwright test tests/23130087_NguyenVanAnhHan/23130087_NguyenVanAnhHan_F11.spec.ts --project=chromium --headed --workers=1
 *
 * Mỗi case có context mới; bước 01–02 mở trang và ghi S0/N0 độc lập.
 * Dữ liệu và DOM thật; không mock danh sách, geolocation hoặc Google Maps.
 * S0 là tập (tên, địa chỉ hiện hành), không phụ thuộc thứ tự hay màu chọn.
 * Không cố định số cửa hàng; không dùng Địa chỉ cũ để xác định tỉnh/phường.
 * Thiếu fixture trong S0: Skipped với annotation Blocked, không báo Passed.
 * Case 025 chỉ kiểm tra request điều hướng đầu của popup, không chờ CAPTCHA.
 * Case 030 chặn permission trước goto và quan sát callback geolocation thật.
 * Không gọi điện, gửi câu hỏi, đăng ký tư vấn hoặc tự sửa trạng thái Excel.
 */

const URL = 'https://didongviet.vn/cua-hang-gan-ban.html';
const ORIGIN = 'https://didongviet.vn';
const ALL = 'Toàn quốc';
const HCM = 'Thành phố Hồ Chí Minh';
const HANOI = 'Thành phố Hà Nội';
const DANANG = 'Thành phố Đà Nẵng';
const TAYNINH = 'Tỉnh Tây Ninh';
const ANKHANH = 'Phường An Khánh';
const VUONLAI = 'Phường Vườn Lài';
const HOANKIEM = 'Phường Hoàn Kiếm';
const TRANNAO = 'Cửa hàng Di Động Việt Trần Não';
const LHP_A = 'Cửa hàng Di Động Việt 300 Lê Hồng Phong';
const LHP_B = 'Cửa hàng Di Động Việt 607- 609 Lê Hồng Phong';
const MISSING = 'ZZZ_STORE_23130087';
const SELECTED = /(?:^|\s)border-l-primary-500(?:\s|$)/;

type Store = {
  name: string;
  address: string;
  oldAddress: string;
  phone: string;
  tel: string;
  map: string;
};
type GeoObservation = { calls: number; errors: number; errorCode: number | null };

declare global {
  interface Window {
    __f11Geo?: GeoObservation;
  }
}

function text(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function primaryPattern(value: string): RegExp {
  const words = text(value).split(' ').map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^\\s*${words.join('\\s+')}`);
}

function cards(page: Page): Locator {
  return page.locator('main [role="button"]').filter({ has: page.locator('h3') });
}

function cardNamed(page: Page, name: string): Locator {
  return cards(page).filter({ has: page.getByRole('heading', { name, exact: true }) });
}

function query(page: Page): Locator {
  return page.locator('main').getByPlaceholder('Tìm bằng tên đường/Tỉnh thành', { exact: true });
}

function pickers(page: Page): Locator {
  return page.locator('main button[aria-haspopup="listbox"]');
}

function quick(page: Page, name: string): Locator {
  // Dropdown cũng mang tên tỉnh sau chọn; chỉ chip nhanh có aria-pressed.
  return page.locator('main button[aria-pressed]').and(page.getByRole('button', { name, exact: true }));
}

function countLabel(page: Page): Locator {
  return page.locator('main').getByText(/^Có\s+\d+\s+cửa hàng gần bạn$/);
}

function directions(page: Page): Locator {
  return page.locator('main').getByRole('link', { name: 'Chỉ đường', exact: true });
}

async function readCards(page: Page): Promise<Store[]> {
  return cards(page).evaluateAll(elements => elements.map(element => {
    const clean = (s: string | null | undefined) => (s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const paragraphs = Array.from(element.querySelectorAll('p'));
    const phone = element.querySelector<HTMLAnchorElement>('a[href^="tel:"]');
    const map = Array.from(element.querySelectorAll<HTMLAnchorElement>('a'))
      .find(link => clean(link.textContent) === 'Xem bản đồ');
    return {
      name: clean(element.querySelector('h3')?.textContent),
      address: clean(paragraphs[0]?.textContent),
      oldAddress: clean(paragraphs[1]?.textContent).replace(/^Địa chỉ cũ:\s*/, ''),
      phone: clean(phone?.textContent),
      tel: phone?.getAttribute('href') ?? '',
      map: map?.href ?? '',
    };
  }));
}

function keys(stores: Store[]): string[] {
  return stores.map(s => JSON.stringify([s.name, s.address])).sort();
}

function maps(stores: Store[]): string[] {
  return stores.map(s => JSON.stringify([s.name, s.address, s.map])).sort();
}

function inArea(stores: Store[], province: string, ward?: string): Store[] {
  return stores.filter(s => s.address.includes(province) && (!ward || s.address.includes(ward)));
}

function matching(stores: Store[], keyword: string): Store[] {
  // Không trim keyword: Excel_027 cố ý nhập đúng năm dấu cách.
  const term = keyword.normalize('NFC').toLocaleLowerCase('vi');
  return stores.filter(s => [s.name, s.address, s.oldAddress]
    .some(value => value.toLocaleLowerCase('vi').includes(term)));
}

function fixture(condition: boolean, description: string): asserts condition {
  if (condition) return;
  const reason = `Blocked – thiếu tiền điều kiện trong S0: ${description}`;
  base.info().annotations.push({ type: 'Blocked', description: reason });
  base.skip(true, reason);
}

function requireStore(stores: Store[], name: string): Store {
  const store = stores.find(s => s.name === name);
  fixture(Boolean(store), name);
  return store!;
}

async function assertResults(page: Page, expected: Store[]): Promise<Store[]> {
  await expect.poll(async () => ({
    count: Number((await countLabel(page).textContent())?.match(/Có\s+(\d+)/)?.[1]),
    stores: keys(await readCards(page)),
  }), { message: 'Số đếm và toàn bộ tên/địa chỉ phải cùng khớp bộ lọc' })
    .toEqual({ count: expected.length, stores: keys(expected) });
  if (expected.length === 0) {
    await expect(page.locator('main').getByText('Không tìm thấy cửa hàng', { exact: true })).toBeVisible();
    await expect(page.locator('main').getByText('Chọn một cửa hàng để xem chi tiết', { exact: true })).toBeVisible();
    await expect(directions(page)).toHaveCount(0);
  } else {
    await expect(page.locator('main').getByText('Không tìm thấy cửa hàng', { exact: true })).toBeHidden();
    await expect(page.locator('main').getByText('Chọn một cửa hàng để xem chi tiết', { exact: true })).toBeHidden();
  }
  return readCards(page);
}

async function pickerValue(picker: Locator): Promise<string> {
  return text(await picker.locator(':scope > span').innerText());
}

async function assertFilters(page: Page, province: string | null, ward: string | null, keyword: string) {
  await expect(query(page)).toHaveValue(keyword);
  await expect(pickers(page)).toHaveCount(province ? 2 : 1);
  await expect.poll(() => pickerValue(pickers(page).nth(0)))
    .toBe(province ?? 'Chọn Tỉnh/Thành phố');
  if (province) {
    await expect.poll(() => pickerValue(pickers(page).nth(1))).toBe(ward ?? 'Chọn Phường/Xã');
  }
  for (const label of [ALL, HANOI, DANANG, HCM]) {
    await expect(quick(page, label)).toHaveAttribute('aria-pressed',
      (province ? label === province : label === ALL) ? 'true' : 'false');
  }
}

async function chooseProvince(page: Page, province: string, keyword = '') {
  await quick(page, province).click();
  await assertFilters(page, province, null, keyword);
}

async function openMenu(picker: Locator): Promise<Locator> {
  await picker.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await picker.click();
  await expect(picker).toHaveAttribute('aria-expanded', 'true');
  const menu = picker.locator('..');
  await expect(menu.getByPlaceholder('Tìm kiếm...', { exact: true })).toBeVisible();
  return menu;
}

async function optionLabels(menu: Locator): Promise<string[]> {
  return menu.locator('ul > li > button').evaluateAll(buttons => buttons.map(button =>
    // Text nodes trực tiếp là nhãn chính; span con chứa các địa danh cũ.
    Array.from(button.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent ?? '').join('').normalize('NFC').replace(/\s+/g, ' ').trim()));
}

async function selectOption(picker: Locator, menu: Locator, label: string) {
  const option = menu.locator('ul > li > button').filter({ hasText: primaryPattern(label) });
  await expect(option, `Cần đúng một lựa chọn nhãn chính ${label}`).toHaveCount(1);
  await expect.poll(() => optionLabels(menu)).toContain(label);
  await option.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await option.click();
  await expect(picker).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => pickerValue(picker)).toBe(label);
}

async function chooseWard(page: Page, ward: string) {
  const picker = pickers(page).nth(1);
  await selectOption(picker, await openMenu(picker), ward);
}

async function search(page: Page, keyword: string) {
  await query(page).fill(keyword); // Tìm khi nhập, không dùng Enter.
  await expect(query(page)).toHaveValue(keyword);
}

async function clearQuery(page: Page) {
  await query(page).click();
  await query(page).press('ControlOrMeta+A');
  await query(page).press('Backspace');
  await expect(query(page)).toHaveValue('');
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function assertMapURL(href: string) {
  const url = new globalThis.URL(href);
  expect(url.protocol).toBe('https:');
  expect(['maps.google.com', 'www.google.com', 'google.com']).toContain(url.hostname);
  expect(url.pathname).toMatch(/^\/maps(?:\/|$)/);
  expect(Boolean(url.searchParams.get('cid') || url.searchParams.get('destination')),
    'Liên kết phải chỉ rõ cid hoặc destination, không chỉ tên miền Google').toBe(true);
}

async function assertDetail(page: Page, expected: Store) {
  const detail = directions(page).locator('..');
  await expect(detail).toBeVisible();
  await expect.poll(async () => ({
    name: text(await detail.locator('h3').innerText()),
    address: text(await detail.locator('p').first().innerText()),
    phone: digits(await detail.locator('span').innerText()),
    map: await directions(page).getAttribute('href'),
  })).toEqual({ name: expected.name, address: expected.address, phone: digits(expected.phone), map: expected.map });
  await expect(page.locator('main iframe[title="Bản đồ cửa hàng"]')).toBeVisible();
  assertMapURL(expected.map);
}

async function selectStore(page: Page, expected: Store) {
  const card = cardNamed(page, expected.name);
  await expect(card).toHaveCount(1);
  await card.locator('h3').click(); // Tránh các link tel: / bản đồ bên trong thẻ.
  await expect(card).toHaveClass(SELECTED);
  await expect(cards(page).filter({ has: page.locator('h3.text-primary-600') })).toHaveCount(1);
  await assertDetail(page, expected);
}

const test = base.extend<{ stores: Store[] }>({
  stores: async ({ page, context }, use, testInfo) => {
    if (testInfo.title.startsWith('DDV_F11_030')) {
      // Playwright Chromium: empty allowed permissions for this origin => denied.
      await context.grantPermissions([], { origin: ORIGIN });
      await page.addInitScript(() => {
        const state: GeoObservation = { calls: 0, errors: 0, errorCode: null };
        Object.defineProperty(window, '__f11Geo', { value: state });
        const native = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        navigator.geolocation.getCurrentPosition = (success, failure, options) => {
          state.calls += 1;
          // Chỉ ghi nhận lỗi thật rồi chuyển tiếp; không tạo lỗi/tọa độ giả.
          return native(success, error => {
            state.errors += 1;
            state.errorCode = error.code;
            failure?.(error);
          }, options);
        };
      });
    }
    await test.step('01 - Mở trang cửa hàng và đóng cookie nếu có', async () => {
      const response = await page.goto(URL, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), 'Trang cửa hàng phải trả HTTP thành công').toBeLessThan(400);
      await expect(page).toHaveURL(URL);
      await expect(page.locator('main h1')).toHaveText('Danh sách cửa hàng Di Động Việt');
      // aria-labelledby của web ghi đè aria-label; scope bằng nội dung hiển thị.
      const cookie = page.getByRole('dialog').filter({ hasText: 'Cookie & trải nghiệm Di Động Việt' });
      await cookie.waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {});
      if (await cookie.isVisible()) {
        await cookie.getByRole('button', { name: 'Từ chối', exact: true }).click();
        await expect(cookie).toBeHidden();
      }
      await page.addLocatorHandler(cookie, async () => {
        await cookie.getByRole('button', { name: 'Từ chối', exact: true }).click();
        await expect(cookie).toBeHidden();
      });
    });
    const initial = await test.step('02 - Xác minh mặc định Toàn quốc và ghi S0/N0', async () => {
      await assertFilters(page, null, null, '');
      await expect(cards(page).first()).toBeVisible();
      await expect.poll(async () => {
        const rows = await readCards(page);
        const count = Number((await countLabel(page).textContent())?.match(/Có\s+(\d+)/)?.[1]);
        return rows.length > 0 && count === rows.length && rows.every(s => s.name && s.address);
      }, { message: 'Chờ số đếm và danh sách đầy đủ trước khi ghi baseline' }).toBe(true);
      const rows = await readCards(page);
      await assertResults(page, rows);
      await testInfo.attach('S0-N0.json', { body: JSON.stringify({ N0: rows.length, S0: rows }, null, 2), contentType: 'application/json' });
      return rows;
    });
    await use(initial);
  },
});

test.describe('F11 | Tìm kiếm cửa hàng | Nguyễn Văn Anh Hàn | 30 case theo Excel', () => {
  test.describe.configure({ mode: 'default', timeout: 90_000 });
  test.use({ viewport: { width: 1440, height: 900 } });

  test.afterEach(async ({ page }, testInfo) => {
    if (page.isClosed()) return;
    await testInfo.attach('F11-ket-qua-cuoi.json', {
      body: JSON.stringify({ url: page.url(), keyword: await query(page).inputValue().catch(() => null),
        stores: await readCards(page).catch(() => []), status: testInfo.status }, null, 2),
      contentType: 'application/json',
    });
  });

  for (const c of [
    { id: 'DDV_F11_001', province: HCM, sample: TRANNAO },
    { id: 'DDV_F11_002', province: HANOI, sample: 'Cửa hàng Di Động Việt Thái Hà' },
    { id: 'DDV_F11_003', province: DANANG, sample: 'Cửa hàng Di Động Việt Đà Nẵng' },
  ]) {
    test(`${c.id} - Lọc nhanh cửa hàng tại ${c.province}`, async ({ page, stores }) => {
      const expected = inArea(stores, c.province);
      requireStore(expected, c.sample);
      await test.step('03 - Chọn nút tỉnh và xác minh nhãn bộ lọc', () => chooseProvince(page, c.province));
      await test.step('04–05 - Địa chỉ hiện hành, chi nhánh mẫu và số đếm cùng khớp', async () => {
        const actual = await assertResults(page, expected);
        expect(actual.every(s => s.address.includes(c.province))).toBe(true);
        expect(actual.map(s => s.name)).toContain(c.sample);
      });
    });
  }

  test('DDV_F11_004 - Chọn Tỉnh Tây Ninh bằng bộ chọn tỉnh', async ({ page, stores }) => {
    const expected = inArea(stores, TAYNINH);
    requireStore(expected, 'Cửa hàng Di Động Việt Tây Ninh');
    const picker = pickers(page).first();
    const menu = await test.step('03 - Tìm Tây Ninh trong menu tỉnh', async () => {
      const root = await openMenu(picker);
      await root.getByPlaceholder('Tìm kiếm...', { exact: true }).fill('Tây Ninh');
      await expect.poll(() => optionLabels(root)).toEqual([TAYNINH]);
      return root;
    });
    await test.step('04 - Chọn nhãn tỉnh hiện hành, không chọn địa danh cũ', async () => {
      await selectOption(picker, menu, TAYNINH);
      await assertFilters(page, TAYNINH, null, '');
    });
    await test.step('05 - Địa chỉ hiện hành và số đếm Tây Ninh', () => assertResults(page, expected));
  });

  test('DDV_F11_005 - Đổi tỉnh Hà Nội → Hồ Chí Minh → Hà Nội', async ({ page, stores }) => {
    const hn = inArea(stores, HANOI), hcm = inArea(stores, HCM);
    fixture(hn.length > 0 && hcm.length > 0, 'Hà Nội và Hồ Chí Minh phải có cửa hàng');
    const saved = await test.step('03 - Lọc và ghi S_HN', async () => {
      await chooseProvince(page, HANOI);
      return assertResults(page, hn);
    });
    await test.step('04 - Chuyển trực tiếp Hồ Chí Minh', async () => {
      await chooseProvince(page, HCM);
      await assertResults(page, hcm);
    });
    await test.step('05 - Chọn lại Hà Nội và khôi phục S_HN', async () => {
      await chooseProvince(page, HANOI);
      await assertResults(page, saved);
    });
  });

  for (const c of [
    { id: 'DDV_F11_006', province: HCM, ward: ANKHANH, sample: TRANNAO },
    { id: 'DDV_F11_007', province: HCM, ward: VUONLAI, sample: LHP_A },
    { id: 'DDV_F11_008', province: HANOI, ward: HOANKIEM, sample: 'Cửa hàng Di Động Việt Lê Thái Tổ' },
  ]) {
    test(`${c.id} - Lọc ${c.ward} thuộc ${c.province}`, async ({ page, stores }) => {
      const expected = inArea(stores, c.province, c.ward);
      requireStore(expected, c.sample);
      await test.step('03 - Lọc tỉnh trước khi chọn phường', async () => {
        await chooseProvince(page, c.province);
        await assertResults(page, inArea(stores, c.province));
      });
      await test.step('04 - Chọn nhãn phường chính, chuẩn hóa CR/LF', async () => {
        await chooseWard(page, c.ward);
        await assertFilters(page, c.province, c.ward, '');
      });
      await test.step('05 - Đúng giao tỉnh/phường, mẫu và số đếm', async () => {
        const actual = await assertResults(page, expected);
        expect(actual.map(s => s.name)).toContain(c.sample);
      });
    });
  }

  test('DDV_F11_009 - Đổi tỉnh phải xóa phường của tỉnh trước', async ({ page, stores }) => {
    requireStore(inArea(stores, HCM, ANKHANH), TRANNAO);
    fixture(inArea(stores, HANOI, HOANKIEM).length > 0 && inArea(stores, HANOI, 'Phường Đống Đa').length > 0,
      'Hà Nội có Hoàn Kiếm và Đống Đa');
    await test.step('03 - Thiết lập Hồ Chí Minh / An Khánh', async () => {
      await chooseProvince(page, HCM);
      await chooseWard(page, ANKHANH);
      await assertFilters(page, HCM, ANKHANH, '');
      await assertResults(page, inArea(stores, HCM, ANKHANH));
    });
    await test.step('04 - Chọn trực tiếp Hà Nội và xóa phường cũ', async () => {
      await chooseProvince(page, HANOI);
      await assertResults(page, inArea(stores, HANOI));
    });
    await test.step('05 - Menu phường Hà Nội không còn An Khánh', async () => {
      const picker = pickers(page).nth(1), menu = await openMenu(picker);
      const labels = await optionLabels(menu);
      expect(labels).toEqual(expect.arrayContaining([HOANKIEM, 'Phường Đống Đa']));
      expect(labels).not.toContain(ANKHANH);
      await picker.click();
      await expect(picker).toHaveAttribute('aria-expanded', 'false');
    });
  });

  test('DDV_F11_010 - Tìm rồi chọn một phường trong menu Phường/Xã', async ({ page, stores }) => {
    const expected = inArea(stores, HCM, VUONLAI);
    fixture(expected.length > 0, VUONLAI);
    const picker = pickers(page).nth(1);
    const menu = await test.step('03 - Mở menu phường của Hồ Chí Minh', async () => {
      await chooseProvince(page, HCM);
      await assertResults(page, inArea(stores, HCM));
      return openMenu(picker);
    });
    await test.step('04 - Tìm Vườn Lài trong ô tìm nội bộ menu', async () => {
      await menu.getByPlaceholder('Tìm kiếm...', { exact: true }).fill('Vườn Lài');
      await expect.poll(() => optionLabels(menu)).toEqual([VUONLAI]);
      await expect(query(page)).toHaveValue('');
    });
    await test.step('05 - Chọn Vườn Lài và đối chiếu giao tỉnh/phường', async () => {
      await selectOption(picker, menu, VUONLAI);
      await assertFilters(page, HCM, VUONLAI, '');
      await assertResults(page, expected);
    });
  });

  for (const c of [
    { id: 'DDV_F11_011', keyword: 'Trần Não', samples: [TRANNAO] },
    { id: 'DDV_F11_012', keyword: 'Lê Hồng', samples: [LHP_A, LHP_B] },
    { id: 'DDV_F11_013', keyword: '11 Trần Não', samples: [TRANNAO] },
  ]) {
    test(`${c.id} - Tìm cửa hàng bằng ${c.keyword}`, async ({ page, stores }) => {
      const expected = matching(stores, c.keyword);
      for (const sample of c.samples) requireStore(expected, sample);
      await test.step('03 - Nhập từ khóa cửa hàng, không nhấn Enter', () => search(page, c.keyword));
      await test.step('04–05 - Mọi kết quả liên quan tên/địa chỉ, không giữ thẻ cũ', async () => {
        const actual = await assertResults(page, expected);
        expect(actual.map(s => s.name)).toEqual(expect.arrayContaining(c.samples));
        expect(matching(actual, c.keyword)).toHaveLength(actual.length);
        await assertFilters(page, null, null, c.keyword);
        await expect(page).toHaveURL(URL);
      });
    });
  }

  test('DDV_F11_014 - Tìm tên đường không phân biệt chữ hoa và chữ thường', async ({ page, stores }) => {
    const expected = matching(stores, 'Trần Não');
    requireStore(expected, TRANNAO);
    let saved: string[];
    await test.step('03 - Ghi tập tên, địa chỉ và bản đồ của Trần Não', async () => {
      await search(page, 'Trần Não');
      saved = maps(await assertResults(page, expected));
    });
    for (const [step, keyword] of [['04', 'trần não'], ['05', 'TRẦN NÃO']]) {
      await test.step(`${step} - Thay bằng ${keyword}, giữ nguyên tập kết quả`, async () => {
        await search(page, keyword);
        expect(maps(await assertResults(page, expected))).toEqual(saved);
        await expect(query(page)).toHaveValue(keyword);
      });
    }
  });

  test('DDV_F11_015 - Tìm từ khóa cửa hàng không tồn tại', async ({ page, stores }) => {
    fixture(matching(stores, MISSING).length === 0, `${MISSING} không thuộc tên/địa chỉ nguồn`);
    await test.step('03 - Nhập từ khóa không tồn tại', () => search(page, MISSING));
    await test.step('04 - Danh sách và chi tiết cùng rỗng', () => assertResults(page, []));
    await test.step('05 - Bộ lọc và ô tìm vẫn sử dụng được', async () => {
      await assertFilters(page, null, null, MISSING);
      await expect(query(page)).toBeEditable();
      await expect(pickers(page).first()).toBeEnabled();
      await expect(page).toHaveURL(URL);
    });
  });

  test('DDV_F11_016 - Kết hợp tỉnh Hồ Chí Minh với tên đường Trần Não', async ({ page, stores }) => {
    const hcm = inArea(stores, HCM), expected = matching(hcm, 'Trần Não');
    requireStore(expected, TRANNAO);
    await test.step('03 - Lọc và ghi S_HCM', async () => {
      await chooseProvince(page, HCM);
      await assertResults(page, hcm);
    });
    await test.step('04 - Nhập Trần Não và giữ tỉnh', () => search(page, 'Trần Não'));
    await test.step('05 - Đúng giao tỉnh và từ khóa', async () => {
      await assertResults(page, expected);
      await assertFilters(page, HCM, null, 'Trần Não');
    });
  });

  test('DDV_F11_017 - Kết hợp tỉnh Hà Nội với tên đường không thuộc tỉnh', async ({ page, stores }) => {
    requireStore(inArea(stores, HCM), TRANNAO);
    const hn = inArea(stores, HANOI);
    fixture(hn.length > 0 && matching(hn, 'Trần Não').length === 0, 'Hà Nội có cửa hàng, không có Trần Não');
    await test.step('03 - Chọn Hà Nội và xác minh danh sách không rỗng', async () => {
      await chooseProvince(page, HANOI);
      await assertResults(page, hn);
    });
    await test.step('04 - Nhập đường thuộc tỉnh khác, kết quả phải rỗng', async () => {
      await search(page, 'Trần Não');
      await assertResults(page, []);
    });
    await test.step('05 - Không tự bỏ tỉnh hay từ khóa', () => assertFilters(page, HANOI, null, 'Trần Não'));
  });

  test('DDV_F11_018 - Xóa từ khóa để khôi phục cửa hàng của tỉnh đang chọn', async ({ page, stores }) => {
    const hn = inArea(stores, HANOI);
    fixture(hn.length > 0 && matching(stores, MISSING).length === 0, 'Hà Nội có cửa hàng và từ khóa giả không tồn tại');
    await test.step('03 - Ghi S_HN/N_HN', async () => {
      await chooseProvince(page, HANOI);
      await assertResults(page, hn);
    });
    await test.step('04 - Tìm chuỗi không tồn tại', async () => {
      await search(page, MISSING);
      await assertResults(page, []);
    });
    await test.step('05 - Ctrl+A, Backspace và giữ tỉnh Hà Nội', async () => {
      await clearQuery(page);
      await assertFilters(page, HANOI, null, '');
    });
    await test.step('06 - Khôi phục S_HN/N_HN, không trả toàn quốc', () => assertResults(page, hn));
  });

  test('DDV_F11_019 - Đổi tỉnh khi đang giữ từ khóa tìm cửa hàng', async ({ page, stores }) => {
    const hn = inArea(stores, HANOI), hcm = inArea(stores, HCM);
    requireStore(matching(hcm, 'Trần Não'), TRANNAO);
    fixture(hn.length > 0 && matching(hn, 'Trần Não').length === 0, 'Trần Não không thuộc Hà Nội');
    await test.step('03 - Thiết lập Hà Nội + Trần Não, kết quả rỗng', async () => {
      await chooseProvince(page, HANOI);
      await assertResults(page, hn);
      await search(page, 'Trần Não');
      await assertResults(page, []);
    });
    await test.step('04 - Chọn trực tiếp Hồ Chí Minh, giữ Trần Não', () => chooseProvince(page, HCM, 'Trần Não'));
    await test.step('05 - Có lại Trần Não thuộc Hồ Chí Minh', () => assertResults(page, matching(hcm, 'Trần Não')));
  });

  test('DDV_F11_020 - Xóa lọc địa phương bằng Toàn quốc rồi xóa từ khóa', async ({ page, stores }) => {
    requireStore(inArea(stores, HCM, ANKHANH), TRANNAO);
    await test.step('03 - Thiết lập Hồ Chí Minh / An Khánh / Trần Não', async () => {
      await chooseProvince(page, HCM);
      await chooseWard(page, ANKHANH);
      await search(page, 'Trần Não');
      await assertFilters(page, HCM, ANKHANH, 'Trần Não');
      await assertResults(page, matching(inArea(stores, HCM, ANKHANH), 'Trần Não'));
    });
    await test.step('04 - Toàn quốc xóa tỉnh/phường nhưng giữ từ khóa', async () => {
      await quick(page, ALL).click();
      await assertFilters(page, null, null, 'Trần Não');
      await assertResults(page, matching(stores, 'Trần Não'));
    });
    await test.step('05 - Xóa từ khóa và khôi phục S0/N0', async () => {
      await clearQuery(page);
      await assertFilters(page, null, null, '');
      await assertResults(page, stores);
    });
  });

  test('DDV_F11_021 - Chọn thẻ đầu danh sách và đối chiếu phần chi tiết', async ({ page, stores }) => {
    const first = stores[0];
    await test.step('03 - Ghi dữ liệu S_FIRST trên đúng thẻ đầu', async () => {
      expect(first.name).not.toBe('');
      expect(first.address).not.toBe('');
      expect(first.tel).toMatch(/^tel:\+?\d+$/);
      expect(digits(first.phone)).toBe(digits(first.tel));
      assertMapURL(first.map);
    });
    await test.step('04 - Nhấn tên thẻ đầu, không nhấn liên kết', () => selectStore(page, first));
    await test.step('05 - Đúng tên, địa chỉ, điện thoại và Chỉ đường của S_FIRST', async () => {
      await assertDetail(page, first);
      await assertResults(page, stores);
    });
  });

  test('DDV_F11_022 - Chọn thẻ cuối danh sách và thay thế chi tiết thẻ đầu', async ({ page, stores }) => {
    fixture(stores.length >= 2, 'Danh sách có ít nhất hai cửa hàng');
    const first = stores[0], last = stores[stores.length - 1];
    await test.step('03 - Chọn thẻ đầu trước, cuộn đến và ghi S_LAST', async () => {
      expect(keys([first])).not.toEqual(keys([last]));
      await selectStore(page, first);
      await cardNamed(page, last.name).scrollIntoViewIfNeeded();
      expect(last.name).not.toBe('');
      expect(last.address).not.toBe('');
      expect(last.tel).toMatch(/^tel:\+?\d+$/);
    });
    await test.step('04 - Nhấn thẻ cuối và bỏ trạng thái chọn thẻ đầu', async () => {
      await selectStore(page, last);
      await expect(cardNamed(page, first.name)).not.toHaveClass(SELECTED);
    });
    await test.step('05 - Chi tiết S_LAST khớp, N0/S0 không đổi', async () => {
      await assertDetail(page, last);
      await assertResults(page, stores);
    });
  });

  test('DDV_F11_023 - Phân biệt hai cửa hàng trên đường Lê Hồng Phong', async ({ page, stores }) => {
    const expected = matching(stores, 'Lê Hồng');
    const a = requireStore(expected, LHP_A), b = requireStore(expected, LHP_B);
    await test.step('03 - Tìm và ghi riêng tên, số nhà cũ, bản đồ A/B', async () => {
      await search(page, 'Lê Hồng');
      await assertResults(page, expected);
      // Tên B ghi 607-609 nhưng Địa chỉ cũ thực tế ghi 609; đọc riêng hai trường.
      const numberA = a.oldAddress.match(/\d+(?:\s*-\s*\d+)?/)?.[0];
      const numberB = b.oldAddress.match(/\d+(?:\s*-\s*\d+)?/)?.[0];
      expect(numberA, 'Thẻ A phải có số nhà trong Địa chỉ cũ').toBeTruthy();
      expect(numberB, 'Thẻ B phải có số nhà trong Địa chỉ cũ').toBeTruthy();
      expect(numberA, 'Hai chi nhánh phải phân biệt được bằng số nhà').not.toBe(numberB);
      assertMapURL(a.map);
      assertMapURL(b.map);
      expect(a.map).not.toBe(b.map);
    });
    await test.step('04 - Chọn A và đối chiếu tên/bản đồ A', () => selectStore(page, a));
    await test.step('05 - Chọn B và thay tên/bản đồ A, số đếm không đổi', async () => {
      await selectStore(page, b);
      await expect(cardNamed(page, a.name)).not.toHaveClass(SELECTED);
      await assertResults(page, expected);
    });
  });

  test('DDV_F11_024 - Đối chiếu liên kết gọi điện của đúng cửa hàng', async ({ page, stores }) => {
    const expected = matching(stores, 'Trần Não'), store = requireStore(expected, TRANNAO);
    await test.step('03 - Tìm đúng thẻ Trần Não', async () => {
      await search(page, 'Trần Não');
      await assertResults(page, expected);
    });
    await test.step('04 - Chỉ đọc tel và nhãn điện thoại, không click gọi', async () => {
      const link = cardNamed(page, TRANNAO).locator('a[href^="tel:"]');
      await expect(link).toHaveCount(1);
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^tel:\+?\d+$/);
      expect(digits(await link.innerText())).toBe(digits(href!));
      expect(href).toBe(store.tel);
    });
    await test.step('05 - Chọn thẻ và đối chiếu điện thoại ở chi tiết', () => selectStore(page, store));
  });

  test('DDV_F11_025 - Mở bản đồ của đúng chi nhánh và trở lại trang cửa hàng', async ({ page, context, stores }) => {
    const expected = matching(stores, 'Trần Não'), store = requireStore(expected, TRANNAO);
    const href = await test.step('03 - Chọn Trần Não rồi mới đọc MAP_URL', async () => {
      await search(page, 'Trần Não');
      await assertResults(page, expected);
      await selectStore(page, store);
      const link = cardNamed(page, TRANNAO).getByRole('link', { name: 'Xem bản đồ', exact: true });
      await expect(link).toHaveAttribute('target', '_blank');
      const url = (await link.getAttribute('href'))!;
      assertMapURL(url);
      expect(url).toBe(store.map);
      return url;
    });
    await test.step('04 - Mở popup thật, đối chiếu request đầu và đóng popup', async () => {
      // Listener có trước click; không so URL cuối sau Google redirect/CAPTCHA.
      const [popup, request] = await Promise.all([
        page.waitForEvent('popup', { timeout: 30_000 }),
        context.waitForEvent('request', { timeout: 30_000,
          predicate: request => request.isNavigationRequest() && request.url() === href }),
        cardNamed(page, TRANNAO).getByRole('link', { name: 'Xem bản đồ', exact: true }).click(),
      ]);
      try {
        expect(request.url()).toBe(href);
        expect(request.frame().page()).toBe(popup);
        expect(await popup.opener()).toBe(page);
      } finally {
        await popup.close();
      }
    });
    await test.step('05 - Tab gốc giữ từ khóa, kết quả và thẻ đang chọn', async () => {
      await page.bringToFront();
      await expect(page).toHaveURL(URL);
      await assertFilters(page, null, null, 'Trần Não');
      await assertResults(page, expected);
      await expect(cardNamed(page, TRANNAO)).toHaveClass(SELECTED);
      await assertDetail(page, store);
    });
  });

  test('DDV_F11_026 - Tìm tỉnh không tồn tại trong menu chọn tỉnh', async ({ page, stores }) => {
    const picker = pickers(page).first();
    let original: string[];
    const menu = await test.step('03 - Tìm chuỗi giả trong menu tỉnh', async () => {
      const root = await openMenu(picker);
      original = await optionLabels(root);
      fixture(original.length > 0 && !original.some(s => s.includes('ZZZ_TINH_23130087')), 'Chuỗi tỉnh giả không thuộc menu');
      await root.getByPlaceholder('Tìm kiếm...', { exact: true }).fill('ZZZ_TINH_23130087');
      await expect(root.getByText('Không tìm thấy', { exact: true })).toBeVisible();
      await expect(root.locator('ul > li > button')).toHaveCount(0);
      return root;
    });
    await test.step('04 - Tìm nội bộ menu không lọc danh sách cửa hàng', async () => {
      await assertFilters(page, null, null, '');
      await assertResults(page, stores);
    });
    await test.step('05 - Xóa chuỗi, khôi phục lựa chọn và đóng menu', async () => {
      await menu.getByPlaceholder('Tìm kiếm...', { exact: true }).fill('');
      await expect.poll(async () => (await optionLabels(menu)).sort()).toEqual([...original].sort());
      await picker.click();
      await expect(picker).toHaveAttribute('aria-expanded', 'false');
      await assertResults(page, stores);
    });
  });

  test('DDV_F11_027 - Nhập rồi xóa năm dấu cách trong ô tìm cửa hàng', async ({ page, stores }) => {
    await test.step('03 - Nhập đúng 5 dấu cách, baseline hiện tại trả 0 kết quả', async () => {
      await search(page, ' '.repeat(5));
      expect((await query(page).inputValue()).length).toBe(5);
      await assertResults(page, []);
    });
    await test.step('04 - Ô tìm/bộ lọc không bị khóa, xóa bằng bàn phím', async () => {
      await expect(query(page)).toBeEditable();
      await expect(pickers(page).first()).toBeEnabled();
      await clearQuery(page);
    });
    await test.step('05 - Khôi phục S0/N0 và bỏ trạng thái chi tiết rỗng', () => assertResults(page, stores));
  });

  test('DDV_F11_028 - Tìm cửa hàng bằng ký tự đặc biệt không có kết quả', async ({ page, stores }) => {
    const keyword = '!@#_23130087';
    fixture(matching(stores, keyword).length === 0, 'Chuỗi đặc biệt không thuộc nguồn');
    await test.step('03 - Nhập nguyên chuỗi đặc biệt vào ô tìm cửa hàng', () => search(page, keyword));
    await test.step('04 - Số đếm, danh sách và chi tiết cùng rỗng', () => assertResults(page, []));
    await test.step('05 - Xóa chuỗi và khôi phục S0/N0', async () => {
      await clearQuery(page);
      await assertResults(page, stores);
      await assertFilters(page, null, null, '');
    });
  });

  test('DDV_F11_029 - Tải lại trang sau khi lọc tỉnh, phường và từ khóa', async ({ page, stores }) => {
    requireStore(inArea(stores, HCM, ANKHANH), TRANNAO);
    await test.step('03 - Thiết lập và ghi trạng thái Hồ Chí Minh / An Khánh / Trần Não', async () => {
      await chooseProvince(page, HCM);
      await chooseWard(page, ANKHANH);
      await search(page, 'Trần Não');
      await assertFilters(page, HCM, ANKHANH, 'Trần Não');
      await assertResults(page, matching(inArea(stores, HCM, ANKHANH), 'Trần Não'));
      await expect(page).toHaveURL(URL);
    });
    await test.step('04 - Reload cùng tab, về bộ lọc mặc định', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await assertFilters(page, null, null, '');
    });
    await test.step('05 - Khôi phục toàn quốc S0/N0 và vẫn thao tác được', async () => {
      await assertResults(page, stores);
      await expect(query(page)).toBeEditable();
    });
  });

  test('DDV_F11_030 - Từ chối quyền vị trí vẫn lọc cửa hàng thủ công được', async ({ page, stores }) => {
    const hn = inArea(stores, HANOI);
    fixture(hn.length > 0, 'Hà Nội còn cửa hàng');
    let before: GeoObservation;
    await test.step('03 - Xác minh quyền thật là denied trước thao tác', async () => {
      expect(await page.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state)).toBe('denied');
      await assertResults(page, stores);
      before = (await page.evaluate(() => window.__f11Geo))!;
      expect(before).toBeDefined();
    });
    await test.step('04 - Nhấn tìm gần tôi, nhận PERMISSION_DENIED từ trình duyệt', async () => {
      await quick(page, 'Tìm cửa hàng gần tôi').click();
      // Web có thể thăm dò vị trí khi mount; chỉ xét lời gọi/lỗi mới sau click.
      await expect.poll(() => page.evaluate(previous => {
        const current = window.__f11Geo;
        return Boolean(current && current.calls > previous.calls &&
          current.errors > previous.errors && current.errorCode === 1);
      }, before)).toBe(true);
      await assertResults(page, stores);
      await expect(query(page)).toBeEditable();
      await expect(quick(page, HANOI)).toBeEnabled();
    });
    await test.step('05 - Lọc thủ công Hà Nội vẫn đúng địa chỉ và số đếm', async () => {
      await chooseProvince(page, HANOI);
      await assertResults(page, hn);
    });
  });
});
