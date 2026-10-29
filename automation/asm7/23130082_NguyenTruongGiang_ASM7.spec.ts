import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Group08 - Nguyen Truong Giang (23130082)
 * ASM7 / F04 - 30 TEST CASES from ASM06 (iPhone 16 Plus variants)
 * Starting page: https://didongviet.vn/dien-thoai/iphone-16-plus-256gb.html
 */

const ORIGIN = 'https://didongviet.vn';
const PATH = '/dien-thoai/iphone-16-plus-';
const STORAGE = [128, 256, 512] as const;
type Capacity = (typeof STORAGE)[number];
const COLORS = ['Hồng', 'Xanh Lá', 'Xanh Dương', 'Đen', 'Trắng'] as const;
type Color = (typeof COLORS)[number];
const TITLE = /iPhone 16 Plus/i;
const WAITLIST_TITLE = /ĐĂNG KÝ NHẬN THÔNG TIN KHI CÓ HÀNG/i;
const DEMO_DELAY_MS = 0;

async function showAction(page: Page, action: string) {
  await test.step(`Thao tác trên web: ${action}`, async () => {
    const screenshot = await page.screenshot({
      fullPage: false,
      mask: [page.locator('input, textarea')],
      timeout: 10_000,
    }).catch(() => null);
    if (screenshot) {
      await test.info().attach(`F04_action_${Date.now()}.png`, {
        body: screenshot,
        contentType: 'image/png',
      });
    }
    if (DEMO_DELAY_MS > 0) await page.waitForTimeout(DEMO_DELAY_MS);
  });
}

function urlFor(size: Capacity) {
  return `${ORIGIN}${PATH}${size}gb.html`;
}
function urlPattern(size: Capacity) {
  return new RegExp(`/dien-thoai/iphone-16-plus-${size}gb\\.html(?:[?#].*)?$`, 'i');
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function closeCookieNotice(page: Page) {
  const dialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /Cookie.*Di Động Việt/i }),
  });
  await dialog.waitFor({ state: 'visible', timeout: 2_500 }).catch(() => {});
  if (!(await dialog.isVisible().catch(() => false))) return;
  const reject = dialog.getByRole('button', { name: /Từ chối/i }).first();
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

async function visit(page: Page, size: Capacity) {
  const response = await page.goto(urlFor(size), {
    waitUntil: 'domcontentloaded', timeout: 45_000,
  });
  expect(response, 'Không có HTTP response từ trang sản phẩm').not.toBeNull();
  expect(response!.status(), `Trang ${size}GB trả về HTTP ${response!.status()}`)
      .toBeLessThan(400);
  await closeCookieNotice(page);
  await expectProduct(page, size);
}

async function expectProduct(page: Page, size: Capacity) {
  await expect(page, `URL phải thuộc iPhone 16 Plus ${size}GB`).toHaveURL(urlPattern(size));
  await expect(
      page.getByRole('heading', { level: 1, name: new RegExp(`iPhone 16 Plus\\s+${size}GB`, 'i') }).first(),
      `H1 phải là iPhone 16 Plus ${size}GB`,
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Phiên bản', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Màu sắc sản phẩm', { exact: true }).first()).toBeVisible();
}

function capacityLink(page: Page, size: Capacity) {
  // Liên kết dung lượng khác đang hiển thị trên trang gốc, không chọn sản phẩm gợi ý.
  return page.locator(`a[href$="/dien-thoai/iphone-16-plus-${size}gb.html"]:visible`).first();
}

async function captureBlocked(page: Page, reason: string): Promise<never> {
  console.warn(`[F04][BLOCKED] ${reason} | ${page.url()}`);
  await test.info().attach('F04_BLOCKED.txt', {
    body: `Time: ${new Date().toISOString()}\nURL: ${page.url()}\nReason: ${reason}\n`,
    contentType: 'text/plain; charset=utf-8',
  });
  await test.info().attach('F04_BLOCKED.png', {
    body: await page.screenshot({ fullPage: true, mask: [page.locator('input,textarea')] }),
    contentType: 'image/png',
  }).catch(() => {});
  test.skip(true, `BLOCKED: ${reason}`);
  throw new Error(`BLOCKED: ${reason}`);
}

async function selectCapacity(page: Page, target: Capacity) {
  if (urlPattern(target).test(page.url())) return;
  const link = capacityLink(page, target);
  if (!(await link.isVisible().catch(() => false))) {
    return captureBlocked(page, `Thiếu hoặc không hiển thị tùy chọn dung lượng ${target}GB`);
  }
  if (!(await link.isEnabled())) {
    return captureBlocked(page, `Dung lượng ${target}GB đang bị vô hiệu hóa`);
  }
  const href = await link.getAttribute('href');
  expect(href, `Tùy chọn ${target}GB không có href chính xác`).not.toBeNull();
  expect(new URL(href!, ORIGIN).pathname).toBe(`${PATH}${target}gb.html`);
  await link.click({ timeout: 12_000 });
  await expectProduct(page, target);
  await showAction(page, `Đã bấm ${target}GB, xác minh trang ${target}GB`);
}

/** Click text nằm trong card màu. Website render text màu và giá cạnh nhau;
 *  ưu tiên exact span, fallback text card "Màu <giá> đ". */
function colorOption(page: Page, color: Color): Locator {
  return page.getByText(color, { exact: true }).first().or(
      page.getByText(new RegExp(`^${escapeRegex(color)}\\s+\\d[\\d.,\\s]*đ$`, 'i')).first(),
  ).first();
}

async function chooseColor(page: Page, color: Color) {
  const option = colorOption(page, color);
  if (!(await option.isVisible().catch(() => false))) {
    return captureBlocked(page, `Màu ${color} không được hiển thị trên phiên bản hiện tại`);
  }
  const disabled = await option.evaluate((el) => {
    let current: Element | null = el;
    for (let i = 0; current && i < 5; i++, current = current.parentElement) {
      if (current.matches('button:disabled, input:disabled, [aria-disabled="true"], [data-disabled="true"]')) return true;
      if (/cursor-not-allowed|pointer-events-none/.test(String(current.className))) return true;
    }
    return false;
  });
  if (disabled || !(await option.isEnabled())) {
    return captureBlocked(page, `Màu ${color} đang bị disable / hết khả năng chọn`);
  }
  try {
    await option.click({ timeout: 10_000 });
  } catch (error) {
    return captureBlocked(page, `Không thể click màu ${color}: ${String(error).slice(0, 200)}`);
  }
  // SKU nằm trong CTA chờ hàng là phản hồi rõ ràng nhất về màu đã chọn.
  await expectChosenColor(page, color);
  await showAction(page, `Chọn màu ${color} trên bản ${currentSize(page)}GB`);
}

function skuPattern(size: Capacity, color: Color) {
  return new RegExp(`Sản phẩm\\s+iPhone\\s+16\\s+Plus\\s+${size}GB[^\\n]*[-–]\\s*${escapeRegex(color)}(?=\\s|$)`, 'i');
}

/** Xác minh sự lựa chọn qua dòng SKU của form chờ hàng. Nếu stock thay đổi,
 *  cố xác minh trạng thái aria/class của card; không đánh dấu PASS khi mơ hồ. */
async function expectChosenColor(page: Page, color: Color) {
  const size = currentSize(page);
  if (await hasWaitlist(page)) {
    await expect(page.getByText(skuPattern(size, color)).first(),
        `Biểu mẫu chờ hàng không đồng bộ màu ${color} của ${size}GB`).toBeVisible({ timeout: 9_000 });
    return;
  }
  const selected = await page.evaluate((colorText) => {
    const leaves = [...document.querySelectorAll('body *')].filter(el =>
        el.children.length === 0 && el.textContent?.trim() === colorText &&
        (el as HTMLElement).getClientRects().length > 0);
    for (const leaf of leaves) {
      let current: Element | null = leaf;
      for (let step = 0; current && step < 4; step++, current = current.parentElement) {
        if (current.getAttribute('aria-checked') === 'true' ||
            current.getAttribute('aria-selected') === 'true' ||
            current.getAttribute('data-state') === 'checked' ||
            /(?:^|\s)(?:selected|active|is-selected)(?:\s|$)/i.test(String(current.className))) return true;
      }
    }
    return false;
  }, color);
  expect(selected, `Không xác minh được màu ${color} đang chọn vì CTA chờ hàng không hiển thị. Cần kiểm tra locator theo DOM hiện tại.`)
      .toBe(true);
}

function currentSize(page: Page): Capacity {
  const matched = page.url().match(/iphone-16-plus-(128|256|512)gb\.html/i);
  if (!matched) throw new Error(`URL không phải 1 trong 3 biến thể iPhone 16 Plus: ${page.url()}`);
  return Number(matched[1]) as Capacity;
}

async function hasWaitlist(page: Page) {
  return page.getByText(WAITLIST_TITLE).first().isVisible().catch(() => false);
}

async function mustHaveWaitlist(page: Page) {
  if (!(await hasWaitlist(page))) {
    return captureBlocked(page,
        'Theo Excel đây là test case phụ thuộc trạng thái hết hàng; tại lúc chạy không có CTA ĐĂNG KÝ NHẬN THÔNG TIN KHI CÓ HÀNG');
  }
}

async function assertWaitlistSku(page: Page, size: Capacity, color: Color) {
  await mustHaveWaitlist(page);
  await expect(page.getByText(skuPattern(size, color)).first(),
      `Nhãn SKU trong CTA không đúng iPhone 16 Plus ${size}GB - ${color}`)
      .toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^ĐĂNG KÝ$/i }).first()).toBeVisible();
}

function parseVnd(value: string) {
  return Number(value.replace(/\D/g, ''));
}
interface PriceSnapshot {
  size: Capacity;
  colorPrices: Partial<Record<Color, number>>;
  sale: number;
  crossed?: number;
  discount?: number;
  region: string;
}

/** Giá đọc từ vùng "Màu sắc sản phẩm" -> "Hoặc": 5 giá cạnh màu,
 *  rồi giá bán hiện hành và giá gạch (nếu có). Không gắn mốc 2026 vào assertion. */
async function getPrices(page: Page): Promise<PriceSnapshot> {
  const body = await page.locator('body').innerText();
  const start = body.indexOf('Màu sắc sản phẩm');
  const end = body.indexOf('Hoặc', start + 1);
  expect(start, 'Không tìm thấy vùng Màu sắc sản phẩm').toBeGreaterThanOrEqual(0);
  expect(end, 'Không tìm thấy cuối vùng giá trước Hoặc/Trả góp').toBeGreaterThan(start);
  const region = body.slice(start, end);
  const colorPrices: Partial<Record<Color, number>> = {};
  let lastColorPriceEnd = -1;
  const moneyPattern = /\d{1,3}(?:[.,]\d{3})+\s*đ/gi;
  for (const color of COLORS) {
    const re = new RegExp(`${escapeRegex(color)}\\s*(\\d{1,3}(?:[.,]\\d{3})+\\s*đ)`, 'i');
    const match = re.exec(region);
    if (match) {
      colorPrices[color] = parseVnd(match[1]);
      lastColorPriceEnd = Math.max(lastColorPriceEnd, match.index + match[0].length);
    }
  }
  expect(Object.keys(colorPrices).length, 'Không đọc được bảng giá theo màu').toBeGreaterThan(0);
  const trailing = region.slice(lastColorPriceEnd);
  const money = [...trailing.matchAll(moneyPattern)].map(m => parseVnd(m[0]));
  expect(money.length, `Không tìm thấy giá bán chính trong vùng giá: ${region.slice(-250)}`)
      .toBeGreaterThanOrEqual(1);
  const discountText = trailing.match(/-\s*(\d{1,2})\s*%/);
  return {
    size: currentSize(page), colorPrices, sale: money[0],
    crossed: money[1], discount: discountText ? Number(discountText[1]) : undefined,
    region,
  };
}

async function assertCurrentPriceMatchesColor(page: Page, color: Color) {
  const prices = await getPrices(page);
  const colorPrice = prices.colorPrices[color];
  expect(colorPrice, `Thiếu giá niêm yết bên cạnh màu ${color}`).toBeDefined();
  expect(prices.sale, `Giá chính chưa khớp màu ${color} trên bản ${prices.size}GB`).toBe(colorPrice);
  expect(prices.sale).toBeGreaterThan(0);
  return prices;
}

async function note(page: Page, message: string) {
  await test.info().attach('F04_observation.txt', {
    body: `${new Date().toISOString()} | ${page.url()}\n${message}\n`,
    contentType: 'text/plain; charset=utf-8',
  });
}


/** Visual state of a color tile: only trust explicit checked/selected attributes or
 * selection classes; price text / current URL alone is NOT a selected-state marker. */
async function colorSelectedMarker(page: Page, color: Color): Promise<boolean | null> {
  return colorOption(page, color).evaluate((el) => {
    let node: Element | null = el;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      const role = node.getAttribute('role');
      const explicit = node.getAttribute('aria-checked') ??
          node.getAttribute('aria-selected') ?? node.getAttribute('aria-pressed');
      if (explicit === 'true') return true;
      if (explicit === 'false') return false;
      const dataState = node.getAttribute('data-state');
      if (dataState === 'checked' || dataState === 'active' || dataState === 'selected') return true;
      if (dataState === 'unchecked' || dataState === 'inactive') return false;
      // Stop before the common grid wrapper (which can contain other colors).
      if (role === 'radiogroup' || node.querySelectorAll('input[type=radio]').length > 1) break;
      const classes = String(node.className ?? '');
      if (/(?:^|\s)(?:is-selected|selected|color-active|option-active)(?:\s|$)/i.test(classes)) return true;
      if (node.matches('input[type=radio]')) return (node as HTMLInputElement).checked;
    }
    return null;
  });
}

/** Where CTA is visible, its single current SKU also proves the previous SKU
 * isn't simultaneously chosen. Explicit tile markers are asserted if exposed. */
async function assertExclusiveColor(page: Page, chosen: Color, previous?: Color) {
  await expectChosenColor(page, chosen);
  if (previous && previous !== chosen) {
    if (await hasWaitlist(page)) {
      await expect(page.getByText(skuPattern(currentSize(page), previous)).first(),
          `CTA vẫn hiển thị màu cũ ${previous}`).toBeHidden();
    }
    const on = await colorSelectedMarker(page, chosen);
    const off = await colorSelectedMarker(page, previous);
    if (on !== null) expect(on, `Thẻ ${chosen} không được đánh dấu chọn`).toBe(true);
    if (off !== null) expect(off, `Thẻ ${previous} còn được đánh dấu chọn`).toBe(false);
    if (on === null || off === null) {
      await note(page, `DOM không cung cấp đầy đủ selected marker (${chosen}=${on}, ${previous}=${off}); ` +
          'đã đối chiếu SKU trên CTA nếu hiện, xem ảnh trong report để đánh giá viền lựa chọn.');
    }
  }
}

/** Gallery images may be identical across colors on some product pages. Do not
 * assert a color-specific image change unless the site explicitly labels images. */
async function gallerySnapshot(page: Page): Promise<string[]> {
  return page.locator('img[alt*="iPhone 16 Plus"]').evaluateAll(images =>
      images.slice(0, 10).map((im: Element) => {
        const i = im as HTMLImageElement;
        return i.getAttribute('src') ?? i.getAttribute('data-src') ?? '';
      }).filter(Boolean));
}

async function assertGalleryNotWrongColor(page: Page, chosen: Color, old?: Color) {
  const gallery = page.locator('img[alt*="iPhone 16 Plus"]');
  const altStrings = await gallery.evaluateAll(images => images.slice(0, 10)
      .map(im => im.getAttribute('alt') ?? '').filter(Boolean));
  // If the site actually includes a color in the image alt, it must match SKU.
  // Only the PRIMARY image identifies the selected SKU; the gallery may
  // legitimately contain thumbnails of several other color options.
  const mainAlt = altStrings[0] ?? '';
  const primaryColor = COLORS.find(c => mainAlt.includes(c));
  if (primaryColor) {
    expect(primaryColor, `Ảnh chính vẫn đang mô tả màu ${primaryColor}, không phải ${chosen}`)
        .toBe(chosen);
  } else {
    await note(page, `Alt ảnh chính không chỉ ra màu. Đã đính kèm screenshot để xem màu ${chosen}.`);
  }
}

/** Attach an observation without leaking fields from an order/registration. */
function trackNoUnintendedSubmit(page: Page) {
  const forbiddenPost: string[] = [];
  const submits: string[] = [];
  const marker = '__F04_UNINTENDED_FORM_SUBMIT__';
  page.on('request', req => {
    if (req.method() !== 'POST') return;
    let pathname = '';
    try { pathname = new URL(req.url()).pathname; } catch { pathname = req.url(); }
    if (/(?:^|\/)(?:checkout|orders?|register|subscribe|waitlist|stock-notify|leads?)(?:\/|$)/i.test(pathname)) {
      forbiddenPost.push(`${req.method()} ${pathname}`);
    }
  });
  page.on('console', msg => { if (msg.text().includes(marker)) submits.push(msg.text()); });
  return {
    install: async () => {
      // Persist across a real page navigation caused by selecting storage.
      await page.addInitScript((m: string) => {
        if (window.top === window) {
          document.addEventListener('submit', () => console.log(m), true);
        }
      }, marker);
      // init scripts are only for next loads; also observe current document.
      await page.evaluate((m: string) => {
        document.addEventListener('submit', () => console.log(m), true);
      }, marker).catch(() => {});
    },
    verify: async () => {
      expect(submits, 'Chỉ chọn màu/dung lượng nhưng phát sinh form submit').toEqual([]);
      expect(forbiddenPost, 'Phát hiện POST nghi gửi đăng ký/đơn hàng').toEqual([]);
      await expect(page.getByText(/đăng ký thành công|đặt hàng thành công/i)).toHaveCount(0);
    },
  };
}

// Theo thông tin tồn kho 20/10/2026: ảnh chụp / giá hôm nay là bằng chứng chứ
// không phải expected cố định. Các test KHÔNG tạo đơn, KHÔNG gửi đăng ký.
test.describe('ASM07 | F04 | D04 | 30 test cases from Assignment 6', () => {
  test.describe.configure({ timeout: 150_000 });

  test.afterEach(async ({ page }, testInfo) => {
    await testInfo.attach('F04_run_metadata.json', {
      body: JSON.stringify({
        test: testInfo.title, status: testInfo.status, expectedStatus: testInfo.expectedStatus,
        time: new Date().toISOString(), url: page.url(),
      }, null, 2),
      contentType: 'application/json',
    });
    const image = await page.screenshot({
      fullPage: false, mask: [page.locator('input,textarea')], timeout: 8_000,
    }).catch(() => null);
    if (image) await testInfo.attach('F04_snapshot.png', { body: image, contentType: 'image/png' });
  });

  /** Expected Output from ASM06 [DDV_F04_001]:
   * 1. Điều hướng đúng 128GB và chỉ hiển thị thông tin 128GB.
   * 2. Giá chính khớp giá cạnh màu đang chọn; nếu Hồng và Xanh Lá niêm yết khác nhau thì giá chính thay đổi tương ứng.
   */
  test('DDV_F04_001 - Chọn mức dung lượng nhỏ nhất', async ({ page }) => {
    let pink!: PriceSnapshot;

    await test.step('01 - Mở trang mẫu 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Click 128GB và xác nhận H1, URL', async () => {
      await selectCapacity(page, 128);
      await expectProduct(page, 128);
    });

    await test.step('03 - Chọn Hồng, đọc giá niêm yết và giá bán', async () => {
      await chooseColor(page, 'Hồng');
      pink = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('04 - Chọn Xanh Lá, kiểm tra giá cập nhật', async () => {
      await chooseColor(page, 'Xanh Lá');
      await assertExclusiveColor(page, 'Xanh Lá', 'Hồng');
      const green = await assertCurrentPriceMatchesColor(page, 'Xanh Lá');
      if (pink.colorPrices['Hồng'] !== pink.colorPrices['Xanh Lá']) expect(green.sale).not.toBe(pink.sale);
    });

    await test.step('05 - Lưu ảnh các trạng thái, không gửi biểu mẫu', async () => {
      await showAction(page, '128GB Xanh Lá - kiểm tra giá và trạng thái màu');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_002]:
   * 1. Trang đích là iPhone 16 Plus 512GB và URL chính xác.
   * 2. Chọn được màu Đen của bản 512GB; giá chính đúng giá màu Đen; không có tùy chọn 1TB.
   */
  test('DDV_F04_002 - Chọn mức dung lượng lớn nhất', async ({ page }) => {
    await test.step('01 - Mở 256GB, kiểm tra 3 lựa chọn dung lượng và không có 1TB', async () => {
      await visit(page, 256);
      await expect(capacityLink(page, 128)).toBeVisible();
      await expect(capacityLink(page, 512)).toBeVisible();
      await expect(page.getByText('256GB', { exact: true }).first()).toBeVisible();
      await expect(page.locator('a[href*="iphone-16-plus-1tb"]:visible')).toHaveCount(0);
    });

    await test.step('02 - Click 512GB và xác nhận URL, H1', async () => {
      await selectCapacity(page, 512);
      await expectProduct(page, 512);
    });

    await test.step('03 - Chọn Đen, kiểm tra giá chính khớp thẻ màu', async () => {
      await chooseColor(page, 'Đen');
      await assertCurrentPriceMatchesColor(page, 'Đen');
    });

    await test.step('04 - Lưu ảnh, không gửi đăng ký/đặt hàng', async () => {
      await showAction(page, '512GB Đen - không submit');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_003]:
   * 1. Đi từ 128GB sang đúng iPhone 16 Plus 256GB.
   * 2. Màu cuối cùng là Trắng và giá thuộc SKU 256GB – Trắng, không còn giá 128GB.
   */
  test('DDV_F04_003 - Chọn dung lượng ở giữa', async ({ page }) => {
    let price128!: PriceSnapshot;

    await test.step('01 - Mở trực tiếp 128GB, chọn Xanh Lá và kiểm tra giá', async () => {
      await visit(page, 128);
      await chooseColor(page, 'Xanh Lá');
      price128 = await assertCurrentPriceMatchesColor(page, 'Xanh Lá');
    });

    await test.step('02 - Click dung lượng 256GB thật trên UI', async () => {
      await selectCapacity(page, 256);
      await expectProduct(page, 256);
    });

    await test.step('03 - Chọn Trắng trên bản 256GB', async () => {
      await chooseColor(page, 'Trắng');
      await assertExclusiveColor(page, 'Trắng');
    });

    await test.step('04 - Kiểm tra URL, giá SKU Trắng và lưu ảnh', async () => {
      const price256 = await assertCurrentPriceMatchesColor(page, 'Trắng');
      expect(price256.size).toBe(256);
      await note(page, `128GB Xanh Lá=${price128.sale}đ; 256GB Trắng=${price256.sale}đ`);
      await showAction(page, '256GB Trắng sau đổi từ 128GB Xanh Lá');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_004]:
   * 1. Chuyển đủ 2 chiều bằng click dung lượng thật; màu được đổi giữa chừng.
   * 2. Trang cuối đúng 256GB Hồng và giá trở về giá A đang niêm yết, không giữ giá 128GB Xanh Lá.
   */
  test('DDV_F04_004 - Đổi 128GB rồi quay về 256GB', async ({ page }) => {
    let a!: PriceSnapshot;
    let b!: PriceSnapshot;

    await test.step('01 - Mở 256GB, chọn Hồng và ghi giá A', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
      a = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('02 - Click 128GB, chọn Xanh Lá và kiểm tra giá biến thể', async () => {
      await selectCapacity(page, 128);
      await chooseColor(page, 'Xanh Lá');
      b = await assertCurrentPriceMatchesColor(page, 'Xanh Lá');
      expect(b.size).toBe(128);
    });

    await test.step('03 - Click về 256GB và chọn Hồng', async () => {
      await selectCapacity(page, 256);
      await chooseColor(page, 'Hồng');
      await assertExclusiveColor(page, 'Hồng');
    });

    await test.step('04 - Đối chiếu A2 với A và chụp ảnh', async () => {
      const a2 = await assertCurrentPriceMatchesColor(page, 'Hồng');
      expect(a2.sale).toBe(a.sale);
      await expectProduct(page, 256);
      await note(page, `A=${a.sale}; B=${b.sale}; A2=${a2.sale}`);
      await showAction(page, 'Đã quay lại 256GB Hồng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_005]:
   * 1. Không điều hướng sang sản phẩm khác, không phát sinh lỗi.
   * 2. 256GB vẫn là lựa chọn duy nhất; giá và màu không đổi do chọn lại cùng phiên bản.
   */
  test('DDV_F04_005 - Bấm lại phiên bản 256GB hiện tại', async ({ page }) => {
    let before!: PriceSnapshot;
    let title!: string;
    let initialUrl!: string;
    let photoBefore!: string[];

    await test.step('01 - Mở 256GB, chọn Hồng và ghi tiêu đề, giá, màu, URL', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
      before = await assertCurrentPriceMatchesColor(page, 'Hồng');
      title = await page.getByRole('heading', { level: 1, name: TITLE }).first().innerText();
      initialUrl = page.url();
      photoBefore = await gallerySnapshot(page);
    });

    await test.step('02 - Click lại ô phiên bản 256GB đang được chọn', async () => {
      const versionHeading = page.getByText('Phiên bản', { exact: true }).first();
      let currentOption: Locator | null = null;
      for (const path of ['xpath=..', 'xpath=../..', 'xpath=../../..']) {
        const item = versionHeading.locator(path).getByText('256GB', { exact: true }).first();
        if (await item.isVisible().catch(() => false)) { currentOption = item; break; }
      }
      if (!currentOption) return captureBlocked(page, 'Không xác định được ô 256GB trong phần Phiên bản');
      await currentOption.click();
    });

    await test.step('03 - Kiểm tra URL, H1, màu Hồng, giá và ảnh không đổi', async () => {
      await expectProduct(page, 256);
      expect(page.url()).toBe(initialUrl);
      expect(await page.getByRole('heading', { level: 1, name: TITLE }).first().innerText()).toBe(title);
      await assertExclusiveColor(page, 'Hồng');
      const after = await assertCurrentPriceMatchesColor(page, 'Hồng');
      expect(after.sale).toBe(before.sale);
      expect(await gallerySnapshot(page)).toEqual(photoBefore);
    });

    await test.step('04 - Ghi ảnh và kết quả, không gửi đăng ký', async () => {
      await showAction(page, 'Click lại 256GB khi đang chọn Hồng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_006]:
   * 1. Hồng trở thành màu được chọn; Đen không đồng thời được chọn.
   * 2. Tên biến thể và ảnh/giá (nếu cập nhật theo màu) khớp Hồng – 256GB.
   */
  test('DDV_F04_006 - Chọn màu đầu danh sách – Hồng', async ({ page }) => {
    let beforeGallery!: string[];

    await test.step('01 - Mở 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Chọn Đen làm màu trước đó', async () => {
      await chooseColor(page, 'Đen');
      await assertExclusiveColor(page, 'Đen');
      beforeGallery = await gallerySnapshot(page);
    });

    await test.step('03 - Chọn Hồng và kiểm tra chỉ Hồng hiện hành', async () => {
      await chooseColor(page, 'Hồng');
      await assertExclusiveColor(page, 'Hồng', 'Đen');
    });

    await test.step('04 - Kiểm tra SKU Hồng, giá và ảnh nếu có nhãn màu', async () => {
      await assertCurrentPriceMatchesColor(page, 'Hồng');
      await assertGalleryNotWrongColor(page, 'Hồng', 'Đen');
      await note(page, `Gallery trước=${beforeGallery.length} ảnh, sau=${(await gallerySnapshot(page)).length} ảnh.`);
    });

    await test.step('05 - Ghi ảnh, không gửi form', async () => {
      await showAction(page, 'Đen sang Hồng trên 256GB');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_007]:
   * 1. Trắng được chọn duy nhất; Hồng mất dấu chọn.
   * 2. Thông tin biến thể và giá/ảnh thể hiện đúng Trắng – 256GB.
   */
  test('DDV_F04_007 - Chọn màu cuối danh sách – Trắng', async ({ page }) => {
    await test.step('01 - Mở 256GB và chọn Hồng', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
    });

    await test.step('02 - Chọn Trắng trong Màu sắc sản phẩm', async () => {
      await chooseColor(page, 'Trắng');
    });

    await test.step('03 - Kiểm tra Trắng duy nhất, Hồng bỏ chọn, giá và ảnh', async () => {
      await assertExclusiveColor(page, 'Trắng', 'Hồng');
      await assertCurrentPriceMatchesColor(page, 'Trắng');
      await assertGalleryNotWrongColor(page, 'Trắng', 'Hồng');
    });

    await test.step('04 - Lưu ảnh và URL', async () => {
      await showAction(page, '256GB Hồng sang Trắng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_008]:
   * 1. Xanh Lá được đánh dấu duy nhất, không trùng trạng thái với Hồng.
   * 2. Phiên bản vẫn 256GB; không nhảy sang dòng iPhone khác.
   */
  test('DDV_F04_008 - Chọn màu thứ hai – Xanh Lá', async ({ page }) => {
    await test.step('01 - Mở 256GB và kiểm tra danh sách 5 màu', async () => {
      await visit(page, 256);
      for (const c of COLORS) await expect(colorOption(page, c)).toBeVisible();
    });

    await test.step('02 - Chọn Hồng rồi chọn Xanh Lá', async () => {
      await chooseColor(page, 'Hồng');
      await chooseColor(page, 'Xanh Lá');
    });

    await test.step('03 - Kiểm tra Xanh Lá duy nhất và giá theo màu', async () => {
      await assertExclusiveColor(page, 'Xanh Lá', 'Hồng');
      await assertCurrentPriceMatchesColor(page, 'Xanh Lá');
    });

    await test.step('04 - Kiểm tra URL vẫn 256GB và chụp ảnh', async () => {
      await expectProduct(page, 256);
      await showAction(page, '256GB Hồng sang Xanh Lá');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_009]:
   * 1. Đen là màu duy nhất đang chọn; thông tin màu Xanh Dương cũ không còn hiện là màu hiện hành.
   * 2. Giá/ảnh được hiển thị nhất quán với Đen – 256GB.
   */
  test('DDV_F04_009 - Đổi màu Xanh Dương sang Đen', async ({ page }) => {
    let blue!: PriceSnapshot;
    let black!: PriceSnapshot;

    await test.step('01 - Mở 256GB và chọn Xanh Dương', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Xanh Dương');
    });

    await test.step('02 - Ghi nhận giá và SKU trước khi thay đổi', async () => {
      blue = await assertCurrentPriceMatchesColor(page, 'Xanh Dương');
      await showAction(page, `Màu Xanh Dương, giá ${blue.sale}đ`);
    });

    await test.step('03 - Chọn Đen, kiểm tra hết trạng thái màu cũ', async () => {
      await chooseColor(page, 'Đen');
      await assertExclusiveColor(page, 'Đen', 'Xanh Dương');
      black = await assertCurrentPriceMatchesColor(page, 'Đen');
      await assertGalleryNotWrongColor(page, 'Đen', 'Xanh Dương');
    });

    await test.step('04 - Kiểm tra URL và ghi nhận hai giá', async () => {
      await expectProduct(page, 256);
      await note(page, `Giá Xanh Dương=${blue.sale}, Đen=${black.sale}`);
      await showAction(page, '256GB Xanh Dương sang Đen');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_010]:
   * 1. Không lỗi hay tự chọn hai màu; Hồng vẫn được đánh dấu một lần.
   * 2. Giá, ảnh và dung lượng không đổi do click lại cùng màu.
   */
  test('DDV_F04_010 - Bấm lại màu Hồng đang được chọn', async ({ page }) => {
    let before!: PriceSnapshot;
    let beforeGallery!: string[];

    await test.step('01 - Mở 256GB, chọn Hồng và ghi giá, ảnh, trạng thái', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
      before = await assertCurrentPriceMatchesColor(page, 'Hồng');
      beforeGallery = await gallerySnapshot(page);
    });

    await test.step('02 - Click màu Hồng thêm lần nữa', async () => {
      await chooseColor(page, 'Hồng');
    });

    await test.step('03 - Kiểm tra chỉ Hồng được chọn, giá và ảnh không đổi', async () => {
      await assertExclusiveColor(page, 'Hồng');
      const after = await assertCurrentPriceMatchesColor(page, 'Hồng');
      expect(after.sale).toBe(before.sale);
      expect(await gallerySnapshot(page)).toEqual(beforeGallery);
      await expectProduct(page, 256);
    });

    await test.step('04 - Chụp ảnh, ghi nhận trạng thái', async () => {
      await showAction(page, 'Chọn lại màu Hồng, không thay đổi SKU');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_011]:
   * 1. Hiển thị đúng iPhone 16 Plus 128GB – Hồng, không nhầm sang 256GB.
   * 2. Trạng thái 128GB/Hồng và giá của tổ hợp được đồng bộ.
   */
  test('DDV_F04_011 - Tổ hợp Hồng + 128GB', async ({ page }) => {
    await test.step('01 - Mở 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Bấm 128GB', async () => {
      await selectCapacity(page, 128);
    });

    await test.step('03 - Chọn Hồng trên bản 128GB', async () => {
      await chooseColor(page, 'Hồng');
    });

    await test.step('04 - Kiểm tra URL, SKU, màu và giá', async () => {
      await expectProduct(page, 128);
      await assertExclusiveColor(page, 'Hồng');
      await assertCurrentPriceMatchesColor(page, 'Hồng');
      await showAction(page, '128GB Hồng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_012]:
   * 1. Hiển thị iPhone 16 Plus 512GB – Hồng; dung lượng và màu nhất quán.
   * 2. Giá tham chiếu màu Hồng của 512GB là 29.290.000đ tại ngày xác minh (cập nhật snapshot khi chạy).
   */
  test('DDV_F04_012 - Tổ hợp Hồng + 512GB', async ({ page }) => {
    await test.step('01 - Mở 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Bấm 512GB', async () => {
      await selectCapacity(page, 512);
    });

    await test.step('03 - Chọn Hồng', async () => {
      await chooseColor(page, 'Hồng');
    });

    await test.step('04 - Kiểm tra SKU 512GB Hồng và ghi giá thực tế', async () => {
      await expectProduct(page, 512);
      await assertExclusiveColor(page, 'Hồng');
      const p = await assertCurrentPriceMatchesColor(page, 'Hồng');
      await note(page, `Giá hiện tại 512GB Hồng=${p.sale}đ; Excel snapshot 20/10/2026 = 29.290.000đ`);
      await showAction(page, '512GB Hồng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_013]:
   * 1. Tên phiên bản 128GB và màu Đen hiển thị đồng nhất.
   * 2. Giá tham chiếu màu Đen 128GB: 23.790.000đ tại ngày xác minh; không dùng giá 256GB.
   */
  test('DDV_F04_013 - Tổ hợp Đen + 128GB', async ({ page }) => {
    await test.step('01 - Mở 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Click 128GB', async () => {
      await selectCapacity(page, 128);
    });

    await test.step('03 - Chọn Đen', async () => {
      await chooseColor(page, 'Đen');
    });

    await test.step('04 - Đối chiếu URL, màu, giá và snapshot', async () => {
      await expectProduct(page, 128);
      await assertExclusiveColor(page, 'Đen');
      const p = await assertCurrentPriceMatchesColor(page, 'Đen');
      await note(page, `128GB Đen đang bán ${p.sale}đ; Excel snapshot 23.790.000đ`);
      await showAction(page, '128GB Đen');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_014]:
   * 1. Hiển thị đúng 512GB – Đen và chỉ một màu được chọn.
   * 2. Giá hiện hành nhất quán với 512GB, không giữ giá của 256GB.
   */
  test('DDV_F04_014 - Tổ hợp Đen + 512GB', async ({ page }) => {
    await test.step('01 - Mở 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Click 512GB', async () => {
      await selectCapacity(page, 512);
    });

    await test.step('03 - Chọn Đen', async () => {
      await chooseColor(page, 'Đen');
    });

    await test.step('04 - Đối chiếu URL, trạng thái màu duy nhất và giá', async () => {
      await expectProduct(page, 512);
      await assertExclusiveColor(page, 'Đen');
      await assertCurrentPriceMatchesColor(page, 'Đen');
      await showAction(page, '512GB Đen');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_015]:
   * 1. Kết thúc ở 512GB – Xanh Dương; hai lựa chọn đều hợp lệ.
   * 2. Tên biến thể, trạng thái, giá không pha lẫn dữ liệu 256GB – Trắng ban đầu.
   */
  test('DDV_F04_015 - Đổi màu rồi đổi dung lượng', async ({ page }) => {
    await test.step('01 - Mở 256GB, chọn Trắng', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Trắng');
    });

    await test.step('02 - Đổi màu Trắng sang Xanh Dương', async () => {
      await chooseColor(page, 'Xanh Dương');
      await assertExclusiveColor(page, 'Xanh Dương', 'Trắng');
    });

    await test.step('03 - Click dung lượng 512GB, kiểm tra SKU trên trang mới', async () => {
      await selectCapacity(page, 512);
      await expectProduct(page, 512);
    });

    await test.step('04 - Chọn lại Xanh Dương nếu điều hướng reset màu', async () => {
      await chooseColor(page, 'Xanh Dương');
      await assertExclusiveColor(page, 'Xanh Dương');
    });

    await test.step('05 - Kiểm tra giá và lưu ảnh', async () => {
      await assertCurrentPriceMatchesColor(page, 'Xanh Dương');
      await showAction(page, '256GB Trắng -> Xanh Dương -> 512GB Xanh Dương');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_016]:
   * 1. Mỗi trang sử dụng đúng giá bán của dung lượng/màu tương ứng.
   * 2. Ghi P1 và P2 thực tế (giá có thể đổi). Nếu bảng giá khác nhau, giá chính phải phản ánh sự khác biệt; không hardcode giá lịch sử.
   */
  test('DDV_F04_016 - So sánh giá khi đổi bộ nhớ', async ({ page }) => {
    let p1!: PriceSnapshot;
    let p2!: PriceSnapshot;

    await test.step('01 - Mở 256GB, click 128GB', async () => {
      await visit(page, 256);
      await selectCapacity(page, 128);
    });

    await test.step('02 - Chọn Hồng, ghi P1 và giá bên thẻ màu', async () => {
      await chooseColor(page, 'Hồng');
      p1 = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('03 - Click 256GB, chọn Hồng và ghi P2', async () => {
      await selectCapacity(page, 256);
      await chooseColor(page, 'Hồng');
      p2 = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('04 - So giá từng SKU, URL/H1 và lưu ảnh', async () => {
      expect(p1.size).toBe(128);
      expect(p2.size).toBe(256);
      if (p1.colorPrices['Hồng'] !== p2.colorPrices['Hồng']) expect(p2.sale).not.toBe(p1.sale);
      await expectProduct(page, 256);
      await note(page, `P1 128GB Hồng=${p1.sale}đ; P2 256GB Hồng=${p2.sale}đ`);
      await showAction(page, 'So sánh 128GB Hồng và 256GB Hồng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_017]:
   * 1. Mỗi giá chính khớp với giá được hiển thị cạnh màu đã chọn.
   * 2. Nếu website vẫn niêm yết cùng giá, P1 = P2; thay đổi giá sau này phải đối chiếu dữ liệu mới.
   */
  test('DDV_F04_017 - So sánh hai màu có cùng giá', async ({ page }) => {
    let pink!: PriceSnapshot;
    let black!: PriceSnapshot;

    await test.step('01 - Mở 256GB và chọn Hồng', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
    });

    await test.step('02 - Ghi giá P1', async () => {
      pink = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('03 - Chọn Đen và ghi giá P2', async () => {
      await chooseColor(page, 'Đen');
      await assertExclusiveColor(page, 'Đen', 'Hồng');
      black = await assertCurrentPriceMatchesColor(page, 'Đen');
    });

    await test.step('04 - So giá P1/P2 với thẻ màu và ghi ảnh', async () => {
      if (pink.colorPrices['Hồng'] === black.colorPrices['Đen']) expect(pink.sale).toBe(black.sale);
      await note(page, `P1 Hồng=${pink.sale}đ; P2 Đen=${black.sale}đ`);
      await showAction(page, 'Giá 256GB Hồng / Đen');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_018]:
   * 1. Giá bán hiển thị rõ, định dạng đồng; nếu có giá gạch thì giá gạch > giá bán.
   * 2. Snapshot 20/10/2026: 26.390.000đ và 28.990.000đ, không cố định nếu thay đổi giá.
   */
  test('DDV_F04_018 - Kiểm tra giá bán và giá gạch', async ({ page }) => {
    let p!: PriceSnapshot;

    await test.step('01 - Mở 256GB và chọn Hồng', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
    });

    await test.step('02 - Lấy giá bán và giá gạch thực tế', async () => {
      p = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('03 - Kiểm tra định dạng đồng và giá gạch nếu hiển thị', async () => {
      expect(p.region).toMatch(/\d{1,3}(?:[.,]\d{3})+\s*đ/i);
      if (p.crossed !== undefined) expect(p.crossed).toBeGreaterThan(p.sale);
    });

    await test.step('04 - Ghi giá và chụp ảnh', async () => {
      await note(page, `Giá bán=${p.sale}, giá gạch=${p.crossed ?? 'không hiển thị'}; snapshot 20/10/2026: 26.390.000 / 28.990.000`);
      await showAction(page, 'Giá bán và giá gạch');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_019]:
   * 1. Nhãn % giảm phù hợp với chênh lệch giá và cách làm tròn của website.
   * 2. Với snapshot G=28.990.000đ, P=26.390.000đ, mức giảm xấp xỉ 8,97% → nhãn -9%.
   */
  test('DDV_F04_019 - Kiểm tra phần trăm giảm giá', async ({ page }) => {
    let p!: PriceSnapshot;
    let percent!: number;

    await test.step('01 - Mở 256GB và chọn Hồng', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
    });

    await test.step('02 - Ghi G, P và nhãn giảm D', async () => {
      p = await assertCurrentPriceMatchesColor(page, 'Hồng');
      if (p.crossed === undefined || p.discount === undefined) return captureBlocked(page, 'Không còn hiển thị đủ giá gốc và nhãn giảm giá');
    });

    await test.step('03 - Tính (G-P)/G x 100 và so với phần trăm trên UI', async () => {
      percent = (p.crossed! - p.sale) / p.crossed! * 100;
      expect(Math.abs(p.discount! - Math.round(percent))).toBeLessThanOrEqual(1);
    });

    await test.step('04 - Ghi ảnh và kết quả', async () => {
      await note(page, `G=${p.crossed}, P=${p.sale}, tính=${percent.toFixed(2)}%, nhãn=${p.discount}%`);
      await showAction(page, 'Đối chiếu phần trăm giảm giá');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_020]:
   * 1. Giá trở về đúng mức đang niêm yết cho 256GB Hồng, không bị kẹt giá 512GB.
   * 2. URL, tiêu đề, dung lượng và màu cuối cùng là A; nếu giá thị trường đổi trong lúc test ghi lại thời điểm.
   */
  test('DDV_F04_020 - Quay về biến thể và giá ban đầu', async ({ page }) => {
    let a!: PriceSnapshot;
    let b!: PriceSnapshot;
    let a2!: PriceSnapshot;

    await test.step('01 - Mở 256GB Hồng và ghi giá A', async () => {
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
      a = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('02 - Click 512GB Hồng và ghi giá B', async () => {
      await selectCapacity(page, 512);
      await chooseColor(page, 'Hồng');
      b = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('03 - Click về 256GB Hồng và ghi A2', async () => {
      await selectCapacity(page, 256);
      await chooseColor(page, 'Hồng');
      a2 = await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('04 - Kiểm tra A2=A và URL/H1/SKU cuối cùng', async () => {
      expect(a2.sale).toBe(a.sale);
      await assertExclusiveColor(page, 'Hồng');
      await expectProduct(page, 256);
      await note(page, `A=${a.sale}; B=${b.sale}; A2=${a2.sale}`);
      await showAction(page, 'Quay về 256GB Hồng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_021]:
   * 1. Với trạng thái hết hàng, CTA có form chờ hàng và cập nhật SKU từ 256GB Đen sang Hồng.
   * 2. Không tự tạo đăng ký, đơn hàng; khi có hàng trở lại thì ghi Blocked để đối chiếu trạng thái mới.
   */
  test('DDV_F04_021 - Kiểm tra CTA khi phiên bản 256GB đang hết hàng', async ({ page }) => {
    await test.step('01 - Mở 256GB và chỉ kiểm tra CTA khi hết hàng', async () => {
      await visit(page, 256);
      await mustHaveWaitlist(page);
    });

    await test.step('02 - Chọn Đen và xác minh SKU trong CTA', async () => {
      await chooseColor(page, 'Đen');
      await assertWaitlistSku(page, 256, 'Đen');
    });

    await test.step('03 - Chọn Hồng và xác minh CTA cập nhật, không có MUA NGAY', async () => {
      await chooseColor(page, 'Hồng');
      await assertExclusiveColor(page, 'Hồng', 'Đen');
      await assertWaitlistSku(page, 256, 'Hồng');
      await expect(page.getByRole('button', { name: /^MUA NGAY$/i })).toHaveCount(0);
    });

    await test.step('04 - Lưu ảnh hai trạng thái, không nhấn ĐĂNG KÝ', async () => {
      await showAction(page, 'CTA chờ hàng: Đen -> Hồng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_022]:
   * 1. Biểu mẫu (nếu trạng thái hết hàng) hiển thị đúng màu Đen – 256GB, không giữ nhãn Hồng.
   * 2. Nếu màu Đen bị vô hiệu hóa, ghi Blocked và chụp màn hình thay vì suy đoán.
   */
  test('DDV_F04_022 - Thông tin chờ hàng theo màu Đen', async ({ page }) => {
    await test.step('01 - Mở 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Chọn Đen nếu ô màu đang hoạt động', async () => {
      await chooseColor(page, 'Đen');
      await assertExclusiveColor(page, 'Đen');
    });

    await test.step('03 - Đọc tên SKU nếu CTA chờ hàng tồn tại', async () => {
      if (await hasWaitlist(page)) {
        await assertWaitlistSku(page, 256, 'Đen');
      } else {
        await note(page, 'Không có CTA chờ hàng: điều kiện theo Excel không xảy ra; chỉ xác minh SKU/giá trên trang');
      }
      await assertCurrentPriceMatchesColor(page, 'Đen');
    });

    await test.step('04 - Ghi nhận ảnh và trạng thái tồn kho', async () => {
      await showAction(page, '256GB Đen - CTA nếu có');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_023]:
   * 1. Tên biến thể trong khu vực đăng ký (nếu có) là iPhone 16 Plus 256GB – Trắng.
   * 2. Không còn màu cũ bị đánh dấu song song; ghi Blocked nếu tuỳ chọn không tương tác.
   */
  test('DDV_F04_023 - Thông tin chờ hàng theo màu Trắng', async ({ page }) => {
    await test.step('01 - Mở 256GB', async () => {
      await visit(page, 256);
    });

    await test.step('02 - Chọn Hồng để có màu đối chiếu', async () => {
      await chooseColor(page, 'Hồng');
    });

    await test.step('03 - Chọn Trắng, kiểm tra viền chọn và SKU nếu có form', async () => {
      await chooseColor(page, 'Trắng');
      await assertExclusiveColor(page, 'Trắng', 'Hồng');
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 256, 'Trắng');
      else await note(page, 'CTA không hiển thị nên phần đối chiếu tên SKU trên form chưa áp dụng');
    });

    await test.step('04 - Ghi ảnh và giá của Trắng', async () => {
      await assertCurrentPriceMatchesColor(page, 'Trắng');
      await showAction(page, '256GB Hồng sang Trắng');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_024]:
   * 1. Nếu 128GB vẫn hết hàng, khu vực đăng ký ghi đúng iPhone 16 Plus 128GB – Hồng.
   * 2. Không hiển thị thông tin đăng ký của bản 256GB.
   */
  test('DDV_F04_024 - Đăng ký nhận thông tin cho 128GB', async ({ page }) => {
    await test.step('01 - Mở 256GB, bấm 128GB', async () => {
      await visit(page, 256);
      await selectCapacity(page, 128);
    });

    await test.step('02 - Chọn Hồng', async () => {
      await chooseColor(page, 'Hồng');
    });

    await test.step('03 - Kiểm tra CTA chờ hàng nếu xuất hiện', async () => {
      if (await hasWaitlist(page)) {
        await assertWaitlistSku(page, 128, 'Hồng');
        await expect(page.getByText(/Sản phẩm\s+iPhone 16 Plus 256GB/i)).toHaveCount(0);
      } else {
        await note(page, '128GB không hiển thị form chờ hàng; phần kiểm tra form là điều kiện theo Excel.');
      }
      await assertCurrentPriceMatchesColor(page, 'Hồng');
    });

    await test.step('04 - Ghi ảnh và URL; không submit', async () => {
      await expectProduct(page, 128);
      await showAction(page, '128GB Hồng - CTA nếu có');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_025]:
   * 1. Nếu 512GB vẫn hết hàng, biểu mẫu gắn đúng iPhone 16 Plus 512GB – Hồng.
   * 2. Giá hiển thị theo 512GB, không bị giữ ở mức 256GB.
   */
  test('DDV_F04_025 - Đăng ký nhận thông tin cho 512GB', async ({ page }) => {
    await test.step('01 - Mở 256GB, click 512GB', async () => {
      await visit(page, 256);
      await selectCapacity(page, 512);
    });

    await test.step('02 - Chọn Hồng và xác minh URL 512GB', async () => {
      await chooseColor(page, 'Hồng');
      await expectProduct(page, 512);
    });

    await test.step('03 - Kiểm tra SKU form nếu có và giá theo 512GB', async () => {
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 512, 'Hồng');
      else await note(page, '512GB không còn CTA chờ hàng; chỉ kiểm tra giá/SKU hiện tại');
      const p = await assertCurrentPriceMatchesColor(page, 'Hồng');
      expect(p.size).toBe(512);
    });

    await test.step('04 - Lưu ảnh và không submit', async () => {
      await showAction(page, '512GB Hồng - CTA nếu có');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_026]:
   * 1. Bắt đầu tại iPhone 16 Plus 128GB – Đen; URL, H1, màu và giá thuộc đúng phiên bản 128GB Đen.
   * 2. Sau click 256GB và chọn Hồng, URL/H1 là 256GB; chỉ màu Hồng được chọn, không giữ trạng thái Đen.
   * 3. Giá bán chính khớp giá Hồng của bản 256GB; SKU trong form chờ hàng (nếu có) là 256GB – Hồng,
   *    không giữ thông tin của 128GB Đen; không tự tạo đăng ký hoặc đơn hàng.
   */
  test('DDV_F04_026 - Đổi màu sau khi thay đổi dung lượng', async ({ page }) => {
    let price128Black!: PriceSnapshot;
    let price256Pink!: PriceSnapshot;
    let watcher!: ReturnType<typeof trackNoUnintendedSubmit>;

    await test.step('01 - Mở 128GB, chọn Đen và ghi giá A', async () => {
      watcher = trackNoUnintendedSubmit(page);
      await watcher.install();
      await visit(page, 128);
      await chooseColor(page, 'Đen');
      await expectProduct(page, 128);
      price128Black = await assertCurrentPriceMatchesColor(page, 'Đen');
      expect(price128Black.size).toBe(128);
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 128, 'Đen');
      await showAction(page, 'F04_026 trước đổi: 128GB Đen');
    });

    await test.step('02 - Click 256GB thật trên UI và xác minh URL/H1', async () => {
      await selectCapacity(page, 256);
      await expectProduct(page, 256);
    });

    await test.step('03 - Chọn Hồng và kiểm tra chỉ một màu đang chọn', async () => {
      await chooseColor(page, 'Hồng');
      await assertExclusiveColor(page, 'Hồng', 'Đen');
      await expectProduct(page, 256);
    });

    await test.step('04 - Kiểm tra giá Hồng và SKU sau đổi dung lượng', async () => {
      price256Pink = await assertCurrentPriceMatchesColor(page, 'Hồng');
      expect(price256Pink.size).toBe(256);
      if (await hasWaitlist(page)) {
        await assertWaitlistSku(page, 256, 'Hồng');
        await expect(page.getByText(skuPattern(128, 'Đen')).first(),
            'SKU cũ 128GB Đen không được còn hiển thị trong form').toBeHidden();
      }
      await note(page, `Giá trước: 128GB Đen=${price128Black.sale}đ; ` +
          `giá sau: 256GB Hồng=${price256Pink.sale}đ. ` +
          'Giá được đối chiếu với nhãn của đúng màu, không cố định số tiền theo ngày.');
    });

    await test.step('05 - Lưu ảnh và xác minh không tự gửi đăng ký hoặc đặt hàng', async () => {
      await watcher.verify();
      await showAction(page, 'F04_026 sau đổi: 256GB Hồng, giá và màu cập nhật');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_027]:
   * 1. Việc chọn màu không tự gửi đăng ký hoặc tạo đơn hàng.
   * 2. Dòng sản phẩm trong biểu mẫu, nếu có, phản ánh 256GB – Xanh Lá; không giữ Hồng.
   */
  test('DDV_F04_027 - Thay màu không đăng ký hoặc mua hàng tự động', async ({ page }) => {
    let watcher!: ReturnType<typeof trackNoUnintendedSubmit>;

    await test.step('01 - Thiết lập quan sát request và mở 256GB, ghi trạng thái CTA', async () => {
      watcher = trackNoUnintendedSubmit(page);
      await watcher.install();
      await visit(page, 256);
      await note(page, `Trước đổi màu: có CTA=${await hasWaitlist(page)}`);
    });

    await test.step('02 - Chọn Hồng rồi Xanh Lá (nếu khả dụng)', async () => {
      await chooseColor(page, 'Hồng');
      await chooseColor(page, 'Xanh Lá');
    });

    await test.step('03 - Kiểm tra SKU/CTA và không tự động đăng ký', async () => {
      await assertExclusiveColor(page, 'Xanh Lá', 'Hồng');
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 256, 'Xanh Lá');
      await expectProduct(page, 256);
      await watcher.verify();
    });

    await test.step('04 - Lưu ảnh và bằng chứng, không click ĐĂNG KÝ', async () => {
      await showAction(page, 'Đổi Hồng sang Xanh Lá: không submit');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_028]:
   * 1. Các dung lượng và màu được cập nhật thực sự sau mỗi click, kể cả giá khi các màu có giá khác nhau.
   * 2. Chuyển phiên bản/màu không tự kích hoạt submit/đăng ký/đặt hàng; nếu form chờ hàng xuất hiện thì SKU phải đúng trạng thái hiện tại.
   * 3. Biểu mẫu chờ hàng không phải tiền điều kiện bắt buộc; bằng chứng request phía trình duyệt không thay thế kiểm tra server.
   */
  test('DDV_F04_028 - Thay dung lượng không gửi biểu mẫu tự động', async ({ page }) => {
    let watcher!: ReturnType<typeof trackNoUnintendedSubmit>;
    let first!: PriceSnapshot;

    await test.step('01 - Thiết lập theo dõi submit/request, mở 256GB Hồng', async () => {
      watcher = trackNoUnintendedSubmit(page);
      await watcher.install();
      await visit(page, 256);
      await chooseColor(page, 'Hồng');
      first = await assertCurrentPriceMatchesColor(page, 'Hồng');
      await note(page, `256GB Hồng=${first.sale}đ; có CTA=${await hasWaitlist(page)}`);
    });

    await test.step('02 - Click 128GB, Hồng, rồi đổi Xanh Lá và so giá', async () => {
      await selectCapacity(page, 128);
      await chooseColor(page, 'Hồng');
      const pink = await assertCurrentPriceMatchesColor(page, 'Hồng');
      await chooseColor(page, 'Xanh Lá');
      await assertExclusiveColor(page, 'Xanh Lá', 'Hồng');
      const green = await assertCurrentPriceMatchesColor(page, 'Xanh Lá');
      if (pink.colorPrices['Hồng'] !== green.colorPrices['Xanh Lá']) expect(green.sale).not.toBe(pink.sale);
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 128, 'Xanh Lá');
    });

    await test.step('03 - Click 512GB, chọn Đen và kiểm tra giá, URL, SKU nếu có', async () => {
      await selectCapacity(page, 512);
      await chooseColor(page, 'Đen');
      await expectProduct(page, 512);
      await assertCurrentPriceMatchesColor(page, 'Đen');
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 512, 'Đen');
    });

    await test.step('04 - Click trở về 256GB Hồng và xác minh trạng thái cuối', async () => {
      await selectCapacity(page, 256);
      await chooseColor(page, 'Hồng');
      await assertExclusiveColor(page, 'Hồng');
      await expectProduct(page, 256);
      const last = await assertCurrentPriceMatchesColor(page, 'Hồng');
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 256, 'Hồng');
      await note(page, `256GB Hồng trước=${first.sale}, sau=${last.sale}đ`);
    });

    await test.step('05 - Đảm bảo không submit/POST đặt hàng và chụp ảnh', async () => {
      await watcher.verify();
      await showAction(page, '256 Hồng -> 128 Hồng -> 128 Xanh Lá -> 512 Đen -> 256 Hồng; không submit');
    });
  });

  /** Expected Output from ASM06 [DDV_F04_029]:
   * 1. Refresh vẫn ở đúng phiên bản 512GB, không quay về 256GB.
   * 2. Màu có thể được giữ hoặc trở về mặc định theo thiết kế trang; giá chính và form (nếu có) phản ánh trạng thái sau reload, không trộn SKU.
   */
  test('DDV_F04_029 - Tải lại sau khi chọn 512GB', async ({ page }) => {
    let before!: PriceSnapshot;

    await test.step('01 - Mở 256GB, click 512GB, chọn Đen và đối chiếu giá', async () => {
      await visit(page, 256);
      await selectCapacity(page, 512);
      await chooseColor(page, 'Đen');
      before = await assertCurrentPriceMatchesColor(page, 'Đen');
    });

    await test.step('02 - Chụp ảnh trước Refresh và tải lại trang', async () => {
      await showAction(page, 'Trước Refresh: 512GB Đen');
      const response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
      expect(response).not.toBeNull();
      await closeCookieNotice(page);
    });

    await test.step('03 - Xác minh H1, URL vẫn 512GB; màu và giá đồng bộ', async () => {
      await expectProduct(page, 512);
      if (await hasWaitlist(page)) {
        const sku = await page.getByText(/Sản phẩm\s+iPhone 16 Plus 512GB/i).first().innerText();
        // Trong new RegExp được tạo từ template literal phải dùng \\s, không dùng \s.
        const color = COLORS.find(c => new RegExp(`[-–]\\s*${escapeRegex(c)}\\s*$`, 'i').test(sku));
        expect(color, `Không xác định được màu của SKU: ${sku}`).toBeDefined();
        await assertCurrentPriceMatchesColor(page, color!);
      } else {
        const after = await getPrices(page);
        expect(after.size).toBe(512);
        // Nếu không có form chờ hàng, xác định màu được chọn từ DOM.
        // Không cho PASS khi chưa biết màu hiện hành sau reload.
        const markers = await Promise.all(COLORS.map(async color => ({
          color,
          selected: await colorSelectedMarker(page, color).catch(() => null),
        })));
        const checkedColors = markers.filter(m => m.selected === true).map(m => m.color);
        let currentColor: Color | undefined;
        if (checkedColors.length === 1) {
          currentColor = checkedColors[0];
        } else {
          // Fallback có cơ sở khi chỉ DUY NHẤT một màu trùng giá chính.
          const priceMatches = COLORS.filter(color => after.colorPrices[color] === after.sale);
          if (priceMatches.length === 1) {
            currentColor = priceMatches[0];
            await note(page, `Không có marker chọn màu; suy ra từ giá duy nhất: ${currentColor}`);
          }
        }
        if (!currentColor) {
          return captureBlocked(page,
              'F04_029: Sau Refresh không có CTA và không xác định duy nhất màu hiện hành từ DOM/giá. ' +
              'Cần kiểm tra selector trạng thái màu trên trang thật, không đánh dấu PASS thiếu chứng cứ.');
        }
        await assertCurrentPriceMatchesColor(page, currentColor);
        await note(page, `F04_029: Sau Refresh, phiên bản 512GB, màu đang chọn=${currentColor}, giá=${after.sale}đ`);
      }
    });

    await test.step('04 - Chụp ảnh sau Refresh, ghi nhận giá trước đó', async () => {
      await showAction(page, 'Sau Refresh: vẫn đúng 512GB');
      await note(page, `Giá 512GB Đen trước Refresh=${before.sale}đ`);
    });
  });

  /** Expected Output from ASM06 [DDV_F04_030]:
   * 1. Sau mở trực tiếp, H1/URL đúng 256GB và chọn được Hồng.
   * 2. Giá/form thuộc bản 256GB Hồng, không giữ nhãn/giá 512GB Trắng.
   */
  test('DDV_F04_030 - Mở trực tiếp lại bản 256GB', async ({ page }) => {
    let price512!: PriceSnapshot;
    let price256!: PriceSnapshot;

    await test.step('01 - Mở 256GB, click 512GB, chọn Trắng và ghi giá', async () => {
      await visit(page, 256);
      await selectCapacity(page, 512);
      await chooseColor(page, 'Trắng');
      price512 = await assertCurrentPriceMatchesColor(page, 'Trắng');
      await showAction(page, 'Trước khi nhập URL: 512GB Trắng');
    });

    await test.step('02 - Mở trực tiếp URL 256GB (như dán URL)', async () => {
      await visit(page, 256);
    });

    await test.step('03 - Chọn Hồng trên 256GB, kiểm tra SKU và giá', async () => {
      await chooseColor(page, 'Hồng');
      await expectProduct(page, 256);
      await assertExclusiveColor(page, 'Hồng');
      price256 = await assertCurrentPriceMatchesColor(page, 'Hồng');
      if (await hasWaitlist(page)) await assertWaitlistSku(page, 256, 'Hồng');
    });

    await test.step('04 - Ghi hai mức giá, chụp ảnh, không submit', async () => {
      await note(page, `512GB Trắng=${price512.sale}đ; 256GB Hồng=${price256.sale}đ`);
      await showAction(page, 'Mở trực tiếp 256GB Hồng');
    });
  });
});
