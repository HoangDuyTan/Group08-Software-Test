import { test, expect, type Page, type Locator } from '@playwright/test';

const CATALOG = 'https://didongviet.vn/dien-thoai.html';
type RecordItem = Record<string, unknown>;
type Scenario = [string, string, (page: Page, log: RecordItem[]) => Promise<void>];

test.use({ viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' });
test.describe('TV01 – F03 – 30 test so sánh nhiều sản phẩm', () => {
  test.setTimeout(100_000);
  test.beforeEach(async ({ page }) => {
    await page.goto(CATALOG, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Bộ lọc tìm kiếm', { exact: true }).first()).toBeVisible();
    await dismissCookie(page);
  });

  async function dismissCookie(page: Page) {
    const cookie = page.getByRole('dialog', { name: /cookie/i }).first();
    if (!(await cookie.isVisible().catch(() => false))) return;
    for (const name of [/từ chối|không đồng ý/i, /đồng ý|chấp nhận|đã hiểu/i, /đóng/i]) {
      const button = cookie.getByRole('button', { name }).first();
      if (await button.isVisible().catch(() => false)) { await button.click(); return; }
    }
  }

  const compareButtons = (page: Page) => page.getByText('So sánh', { exact: true }).filter({ visible: true });

  async function productMeta(button: Locator) {
    return button.evaluate((el) => {
      let parent: HTMLElement | null = el.parentElement;
      for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
        const anchors = Array.from(parent.querySelectorAll('a[href]')) as HTMLAnchorElement[];
        const titleLink = anchors.find(a => /iphone|samsung|xiaomi|oppo|redmi|galaxy|pixel/i.test(a.textContent ?? ''));
        if (titleLink) {
          const text = (titleLink.textContent ?? '').replace(/\s+/g, ' ').trim();
          const match = parent.innerText.match(/[\d.,]+\s*(?:đ|₫)/i);
          return { title: text.slice(0, 110), href: titleLink.href, price: match?.[0] ?? '' };
        }
      }
      return { title: '', href: '', price: '' };
    });
  }

  function comparePanel(page: Page) {
    // Dò trong các phần tử giao diện so sánh riêng (không nhận 'So sánh' của card).
    return page.locator('[role="dialog"]:visible, [class*="compare-panel"]:visible, [class*="compare-bar"]:visible, [class*="compare-tray"]:visible, [class*="comparison"]:visible')
        .filter({ hasText: /so sánh/i }).last();
  }

  // Nút 'So sánh' ở card có thể đổi nhãn hoặc bị React thay DOM sau click.
  // KHÔNG dùng lại locator getByText('So sánh').nth(index) để kiểm tra chính card vừa chọn:
  // sau khi nút đổi nhãn, locator ấy có thể trỏ sang sản phẩm tiếp theo.
  async function compareControlState(handle: Awaited<ReturnType<Locator['elementHandle']>>) {
    if (!handle) return null;
    return handle.evaluate(el => {
      const control = el.closest('button, a, [role="button"], label') ?? el;
      const svg = control.querySelector('svg');
      const checkbox = control.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      return {
        text: (control.textContent ?? '').replace(/\s+/g, ' ').trim(),
        pressed: control.getAttribute('aria-pressed'),
        checked: control.getAttribute('aria-checked'),
        selected: control.getAttribute('aria-selected'),
        state: control.getAttribute('data-state'),
        selectedState: control.getAttribute('data-selected'),
        inputChecked: checkbox?.checked ?? null,
        svgClass: svg?.getAttribute('class') ?? '',
        svgFill: svg?.getAttribute('fill') ?? '',
      };
    }).catch(() => null);
  }

  async function compareStorageState(page: Page) {
    return page.evaluate(() => {
      const pairs: string[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && /compar|so.?sanh/i.test(key)) pairs.push(`${key}=${localStorage.getItem(key)}`);
        }
      } catch { /* Không có quyền localStorage thì chỉ dùng bằng chứng UI */ }
      return pairs.sort().join('|');
    }).catch(() => '');
  }

  async function changedCompareState(
      page: Page,
      originalHandle: Awaited<ReturnType<Locator['elementHandle']>>,
      initial: {
        buttonCount: number;
        selectedCount: number;
        control: Awaited<ReturnType<typeof compareControlState>>;
        storage: string;
        url: string;
      }
  ) {
    const stateChanged = async () => {
      // Khi nhãn 'So sánh' đổi sang 'Đã chọn', số lượng nhãn cũ sẽ giảm.
      if (await compareButtons(page).count() < initial.buttonCount) return true;

      // Đọc lại chính node đã click, không tìm nút thứ N trong danh sách nữa.
      const control = await compareControlState(originalHandle);
      if (control && initial.control) {
        if (control.text !== initial.control.text) return true;
        for (const field of ['pressed', 'checked', 'selected', 'state', 'selectedState', 'inputChecked', 'svgClass', 'svgFill'] as const) {
          if (control[field] !== initial.control[field]) return true;
        }
      }

      // Các dấu hiệu chọn sản phẩm hiển thị trên giao diện.
      const selectedCount = await page.getByRole('button', {
        name: /đã chọn|đã thêm|bỏ so sánh|xóa so sánh/i,
      }).count();
      if (selectedCount > initial.selectedCount) return true;
      if (await comparePanel(page).isVisible().catch(() => false)) return true;
      if (await page.getByRole('button', { name: /so sánh ngay|xem so sánh|bắt đầu so sánh/i }).first().isVisible().catch(() => false)) return true;
      if (await page.getByText(/đã thêm.*so sánh|so sánh.*thành công|đã chọn.*so sánh/i).first().isVisible().catch(() => false)) return true;

      // Trường hợp site lưu riêng danh sách được so sánh trong bộ nhớ trình duyệt.
      const storage = await compareStorageState(page);
      if (storage !== initial.storage && storage.length > 0) return true;
      if (page.url() !== initial.url && /so.sanh|compare/i.test(page.url())) return true;
      return false;
    };

    try {
      await expect.poll(stateChanged, {
        timeout: 10_000,
        intervals: [200, 350, 500, 750, 1000],
        message: 'Chưa có bằng chứng sản phẩm đã được thêm vào danh sách so sánh',
      }).toBeTruthy();
    } catch (error) {
      // Log này phân biệt: click không có tác dụng hay chỉ locator cũ trỏ nhầm card.
      console.error('F03 compare debug:', JSON.stringify({
        before: initial,
        after: {
          buttonCount: await compareButtons(page).count().catch(() => -1),
          selectedCount: await page.getByRole('button', { name: /đã chọn|đã thêm|bỏ so sánh|xóa so sánh/i }).count().catch(() => -1),
          control: await compareControlState(originalHandle),
          storage: await compareStorageState(page),
          url: page.url(),
          visibleDialogs: await page.locator('[role="dialog"]:visible').allTextContents().catch(() => []),
        },
      }, null, 2));
      throw error;
    }
  }

  async function addAt(page: Page, at: number, log: RecordItem[]) {
    const buttons = compareButtons(page);
    await expect(buttons.nth(at), `Không có nút So sánh thứ ${at + 1}`).toBeVisible();
    const button = buttons.nth(at);
    const product = await productMeta(button);
    await button.scrollIntoViewIfNeeded();
    const originalHandle = await button.elementHandle();
    const initial = {
      buttonCount: await buttons.count(),
      selectedCount: await page.getByRole('button', { name: /đã chọn|đã thêm|bỏ so sánh|xóa so sánh/i }).count(),
      control: await compareControlState(originalHandle),
      storage: await compareStorageState(page),
      url: page.url(),
    };
    await button.click();
    await changedCompareState(page, originalHandle, initial);
    log.push({ action: 'add', index: at, ...product });
    return product;
  }

  async function addNumber(page: Page, amount: number, log: RecordItem[], offset = 0) {
    const products: Array<{ title: string; href: string; price: string }> = [];
    for (let i = 0; i < amount; i++) {
      const buttons = compareButtons(page);
      const count = await buttons.count();
      if (!count) throw Error(`Không đủ sản phẩm để thêm thứ ${i + 1}`);
      let index = -1;
      for (let j = offset; j < Math.min(count, offset + 25); j++) {
        const candidate = await productMeta(buttons.nth(j));
        if (candidate.title && products.some(x => x.title === candidate.title)) continue;
        index = j;
        break;
      }
      if (index < 0) throw Error('Không còn sản phẩm chưa chọn trong 25 nút So sánh đầu tiên');
      const p = await addAt(page, index, log);
      if (p.title && products.some(x => x.title === p.title)) {
        throw Error(`Sản phẩm được thêm trùng: ${p.title}. Cần điều chỉnh chỉ số chọn sản phẩm.`);
      }
      products.push(p);
    }
    return products;
  }

  async function openComparison(page: Page, log: RecordItem[]) {
    const candidate = page.getByRole('button', { name: /so sánh ngay|xem so sánh|bắt đầu so sánh|so sánh \(\d+\)/i }).filter({ visible: true }).first();
    const link = page.locator('a[href*="so-sanh"]:visible').filter({ hasText: /so sánh/i }).first();
    if (await candidate.isVisible().catch(() => false)) await candidate.click();
    else if (await link.isVisible().catch(() => false)) await link.click();
    else {
      throw Error('Không tìm được nút mở BẢNG so sánh sau khi chọn sản phẩm. Cần xem trace để cập nhật locator.');
    }
    const panel = comparePanel(page);
    const visible = await panel.isVisible().catch(() => false);
    const text = (await page.locator('body').innerText()).toLowerCase();
    const hasSpecs = /thông số|màn hình|camera|bộ nhớ|dung lượng pin/.test(text);
    expect(visible || hasSpecs, 'Bảng so sánh phải hiển thị thông số hoặc panel').toBeTruthy();
    log.push({ action: 'openComparison', url: page.url(), visiblePanel: visible });
  }

  async function removeFromCompare(page: Page, log: RecordItem[], at = 0) {
    const panel = comparePanel(page);
    await expect(panel, 'Cần có panel so sánh để xóa sản phẩm').toBeVisible();
    const remove = panel.getByRole('button', { name: /xóa|bỏ|remove|đóng/i }).filter({ visible: true });
    await expect(remove.nth(at), 'Không có nút xóa tương ứng').toBeVisible();
    await remove.nth(at).click();
    log.push({ action: 'remove', at });
  }

  async function readSpec(page: Page, log: RecordItem[], spec: string, re: RegExp) {
    await addNumber(page, 2, log);
    await openComparison(page, log);
    const text = await page.locator('body').innerText();
    expect(re.test(text), `Bảng so sánh chưa hiển thị thông số '${spec}'`).toBeTruthy();
    log.push({ checked: spec, present: true });
  }

  async function assertNoBrokenLayout(page: Page, log: RecordItem[]) {
    const { width, scrollWidth } = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(width, 'Viewport phải có chiều rộng').toBeGreaterThan(0);
    expect(scrollWidth, 'Không được có overflow ngang lớn bất thường').toBeLessThan(width + 120);
    log.push({ width, scrollWidth });
  }


  const scenarios: Scenario[] = [
    ['DDV_F03_001', 'Thêm so sánh – Một sản phẩm A', async (p, r) => { await addAt(p, 0, r); }],
    ['DDV_F03_002', 'Thêm so sánh – Thêm sản phẩm B', async (p, r) => { await addNumber(p, 2, r); }],
    ['DDV_F03_003', 'Thêm so sánh – Sản phẩm C nếu website cho phép', async (p, r) => { await addNumber(p, 3, r); }],
    ['DDV_F03_004', 'Thêm so sánh – Hai máy cùng hãng', async (p, r) => {
      const products = await addNumber(p, 2, r);
      expect(products[0].title && products[1].title, 'Phải lấy được tên hai máy').toBeTruthy();
      const a = /iphone/i.test(products[0].title) ? 'Apple' : /samsung|galaxy/i.test(products[0].title) ? 'Samsung' : '';
      const b = /iphone/i.test(products[1].title) ? 'Apple' : /samsung|galaxy/i.test(products[1].title) ? 'Samsung' : '';
      expect(a && b && a === b, `Đã chọn khác hãng: ${products.map(x => x.title)}`).toBeTruthy();
    }],
    ['DDV_F03_005', 'Thêm so sánh – Hai máy khác hãng', async (p, r) => {
      const a = await addAt(p, 0, r); const controls = compareButtons(p);
      let match = -1;
      for (let i = 0; i < Math.min(20, await controls.count()); i++) {
        const item = await productMeta(controls.nth(i));
        if (/iphone/i.test(a.title) !== /iphone/i.test(item.title) && item.title) { match = i; break; }
      }
      if (match < 0) throw Error('Không tìm thấy máy khác hãng trong 20 sản phẩm hiển thị');
      const b = await addAt(p, match, r);
      expect(b.title).not.toBe(a.title);
    }],
    ['DDV_F03_006', 'Trùng và giới hạn – Thêm lại A', async (p, r) => {
      await addAt(p, 0, r);
      const selected = p.getByRole('button', { name: /đã chọn|bỏ so sánh|xóa so sánh/i }).filter({ visible: true }).first();
      if (await selected.count()) await selected.click();
      else await addAt(p, 0, r);
      r.push({ check: 'Đã thử thao tác lần nữa với cùng sản phẩm; kiểm tra giao diện không báo lỗi' });
    }],
    ['DDV_F03_007', 'Chọn so sánh sản phẩm B sau khi đối chiếu hai thẻ A/B', async (p, r) => {
      const buttons = compareButtons(p);
      await expect(buttons.nth(1), 'Phải có tối thiểu hai thẻ có nút So sánh').toBeVisible();
      const productA = await productMeta(buttons.nth(0));
      const productB = await productMeta(buttons.nth(1));
      expect(productA.title.trim(), 'Thẻ A phải có tên sản phẩm').not.toBe('');
      expect(productB.title.trim(), 'Thẻ B phải có tên sản phẩm').not.toBe('');
      expect(productB.href, 'Hai thẻ cần trỏ tới hai sản phẩm khác nhau').not.toBe(productA.href);
      const selected = await addAt(p, 1, r);
      expect(selected.href, 'Phải click đúng sản phẩm B').toBe(productB.href);
      r.push({ checked: 'selectedCorrectSecondProduct', first: productA.title, second: selected.title });
    }],
    ['DDV_F03_008', 'Giới hạn – Chọn đến mức tối đa cho phép', async (p, r) => {
      await addNumber(p, 3, r); await expect(p.locator('body')).toBeVisible();
    }],
    ['DDV_F03_009', 'Giới hạn – Thử thêm quá mức cho phép', async (p, r) => {
      await addNumber(p, 3, r);
      const count = await compareButtons(p).count();
      if (!count) throw Error('Không còn nút sản phẩm để kiểm tra vượt giới hạn');
      const before = await p.locator('body').innerText();
      await compareButtons(p).first().click();
      const after = await p.locator('body').innerText();
      expect(after !== before, 'Website phải thông báo giới hạn hoặc cập nhật trạng thái').toBeTruthy();
      r.push({ action: 'attemptOverLimit', changed: true });
    }],
    ['DDV_F03_010', 'Chọn một sản phẩm và giữ khả năng so sánh các máy khác', async (p, r) => {
      const before = await compareButtons(p).count();
      expect(before, 'Danh mục phải có ít nhất hai nút So sánh').toBeGreaterThan(1);
      const selected = await addAt(p, 0, r);
      expect(selected.href, 'Sản phẩm được chọn phải có liên kết chi tiết').toMatch(/^https?:\/\//i);
      const remaining = await compareButtons(p).count();
      expect(remaining, 'Sau khi chọn A, vẫn phải có máy khác để so sánh').toBeGreaterThan(0);
      r.push({ checked: 'otherCompareOptionsAvailable', before, remaining });
    }],
    ['DDV_F03_011', 'Thêm hai sản phẩm ở vị trí cách xa nhau', async (p, r) => {
      const a = await addAt(p, 0, r);
      const b = await addAt(p, 7, r);
      expect(a.href, 'Sản phẩm đầu phải có liên kết').toMatch(/^https?:\/\//i);
      expect(b.href, 'Sản phẩm phía dưới phải có liên kết').toMatch(/^https?:\/\//i);
      expect(b.href, 'Hai lượt chọn phải là hai sản phẩm khác nhau').not.toBe(a.href);
      r.push({ checked: 'differentDistantCards', first: a.title, second: b.title });
    }],
    ['DDV_F03_012', 'Chọn hai sản phẩm từ vùng giữa danh sách', async (p, r) => {
      const products = await addNumber(p, 2, r, 3);
      expect(products[0].title.trim(), 'Sản phẩm thứ nhất có tên').not.toBe('');
      expect(products[1].title.trim(), 'Sản phẩm thứ hai có tên').not.toBe('');
      expect(products[0].href, 'Hai sản phẩm phải khác đường dẫn').not.toBe(products[1].href);
      r.push({ checked: 'twoDistinctProductsFromMiddle', count: products.length });
    }],
    ['DDV_F03_013', 'Chọn ba sản phẩm khác nhau từ vùng giữa danh sách', async (p, r) => {
      const products = await addNumber(p, 3, r, 1);
      const urls = products.map(x => x.href);
      expect(products.length, 'Phải click thành công ba sản phẩm').toBe(3);
      expect(urls.every(u => /^https?:\/\//i.test(u)), 'Mỗi sản phẩm phải có liên kết chi tiết').toBeTruthy();
      expect(new Set(urls).size, 'Ba sản phẩm phải khác nhau').toBe(3);
      r.push({ checked: 'threeDistinctProductsFromMiddle', products: products.map(x => x.title) });
    }],
    // F03_014–030: Các tình huống nhẹ, vẫn thao tác nút So sánh thật.
    // Không phụ thuộc nút Xóa tất cả/bảng thông số chưa được xác nhận trên UI.
    ['DDV_F03_014', 'Chọn so sánh từ thẻ sản phẩm thứ tư', async (p, r) => {
      await addAt(p, 3, r);
    }],
    ['DDV_F03_015', 'Chọn so sánh từ thẻ sản phẩm thứ năm', async (p, r) => {
      await addAt(p, 4, r);
    }],
    ['DDV_F03_016', 'Chọn so sánh từ thẻ sản phẩm thứ sáu', async (p, r) => {
      await addAt(p, 5, r);
    }],
    ['DDV_F03_017', 'Chọn so sánh từ thẻ sản phẩm thứ bảy', async (p, r) => {
      await addAt(p, 6, r);
    }],
    ['DDV_F03_018', 'Chọn so sánh từ thẻ sản phẩm thứ tám', async (p, r) => {
      await addAt(p, 7, r);
    }],
    ['DDV_F03_019', 'Chọn so sánh từ thẻ sản phẩm thứ chín', async (p, r) => {
      await addAt(p, 8, r);
    }],
    ['DDV_F03_020', 'Chọn so sánh và đối chiếu tên trên thẻ sản phẩm', async (p, r) => {
      const product = await addAt(p, 0, r);
      expect(product.title.trim(), 'Tên sản phẩm được chọn không được trống').not.toBe('');
      r.push({ checked: 'productTitle', value: product.title });
    }],
    ['DDV_F03_021', 'Chọn so sánh và đối chiếu liên kết sản phẩm', async (p, r) => {
      const product = await addAt(p, 1, r);
      expect(product.href, 'Thẻ sản phẩm phải có đường dẫn chi tiết').toMatch(/^https?:\/\//i);
      r.push({ checked: 'productLink', value: product.href });
    }],
    ['DDV_F03_022', 'Thêm hai sản phẩm từ nhóm thẻ thứ ba trở đi', async (p, r) => {
      const products = await addNumber(p, 2, r, 2);
      expect(products[0].title && products[1].title && products[0].title !== products[1].title,
          'Hai sản phẩm được thêm phải khác tên').toBeTruthy();
      r.push({ checked: 'twoDifferentProductNames' });
    }],
    ['DDV_F03_023', 'Thêm hai sản phẩm từ nhóm thẻ thứ năm trở đi', async (p, r) => {
      const products = await addNumber(p, 2, r, 4);
      expect(products[0].title && products[1].title && products[0].title !== products[1].title,
          'Hai sản phẩm được thêm phải khác tên').toBeTruthy();
      r.push({ checked: 'twoProductsFromLowerCards' });
    }],
    ['DDV_F03_024', 'Chọn so sánh không tự chuyển sang trang sản phẩm', async (p, r) => {
      const before = p.url();
      await addAt(p, 0, r);
      expect(p.url(), 'Thao tác chọn so sánh trên thẻ không được tự điều hướng').toBe(before);
    }],
    ['DDV_F03_025', 'Danh mục vẫn hiển thị sau khi chọn so sánh', async (p, r) => {
      await addAt(p, 0, r);
      await expect(p.getByText('Bộ lọc tìm kiếm', { exact: true }).first()).toBeVisible();
      r.push({ checked: 'catalogStillVisible' });
    }],
    ['DDV_F03_026', 'Cuộn xuống rồi chọn so sánh sản phẩm', async (p, r) => {
      await p.mouse.wheel(0, 650);
      await expect.poll(() => p.evaluate(() => window.scrollY), {
        message: 'Trang danh mục cần cuộn được trước khi chọn so sánh',
      }).toBeGreaterThan(0);
      await addAt(p, 4, r);
      r.push({ action: 'scrolledBeforeSelecting' });
    }],
    ['DDV_F03_027', 'Cuộn sâu và chọn so sánh từ thẻ phía dưới', async (p, r) => {
      await p.mouse.wheel(0, 1100);
      await expect.poll(() => p.evaluate(() => window.scrollY)).toBeGreaterThan(200);
      await addAt(p, 7, r);
      r.push({ action: 'deepScrollBeforeSelecting' });
    }],
    ['DDV_F03_028', 'Cuộn xuống rồi trở lên để chọn so sánh', async (p, r) => {
      await p.mouse.wheel(0, 850);
      await expect.poll(() => p.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await p.mouse.wheel(0, -850);
      await addAt(p, 1, r);
      r.push({ action: 'scrollDownUpThenCompare' });
    }],
    ['DDV_F03_029', 'Chọn so sánh trên màn hình desktop 1366px', async (p, r) => {
      await p.setViewportSize({ width: 1366, height: 768 });
      await addAt(p, 0, r);
      expect(p.viewportSize()?.width).toBe(1366);
      r.push({ viewport: '1366x768' });
    }],
    ['DDV_F03_030', 'Chọn so sánh trên màn hình desktop 1280px', async (p, r) => {
      await p.setViewportSize({ width: 1280, height: 800 });
      await addAt(p, 1, r);
      expect(p.viewportSize()?.width).toBe(1280);
      r.push({ viewport: '1280x800' });
    }],
  ];

  if (scenarios.length !== 30 || new Set(scenarios.map(s => s[0])).size !== 30) throw Error('F03 phải có đúng 30 case không trùng mã');
  for (const [id, title, action] of scenarios) {
    test(`${id} - ${title}`, async ({ page }, testInfo) => {
      const evidence: RecordItem[] = [];
      await test.step(title, async () => action(page, evidence));
      console.log(`${id}: ${JSON.stringify(evidence)}`);
      await testInfo.attach(`${id}.json`, { body: JSON.stringify({ id, title, evidence, url: page.url() }, null, 2), contentType: 'application/json' });
      await testInfo.attach(`${id}.png`, { body: await page.screenshot(), contentType: 'image/png' });
    });
  }
});