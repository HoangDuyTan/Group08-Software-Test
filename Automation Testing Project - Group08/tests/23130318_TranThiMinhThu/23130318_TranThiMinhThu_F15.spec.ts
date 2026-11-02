import { test, expect, type Locator, type Page } from '@playwright/test';

/** F15: 30 case giá khuyến mãi trên UI hiện tại, đồng bộ Excel cá nhân.
 * Chưa có fixture Flash Sale đang chạy: không coi giảm giá thường là Flash Sale,
 * không giả lập đồng hồ server, quota hay kết quả giao dịch. Mỗi case context mới;
 * giá lấy từ UI thật, không seed giỏ/mock API. Không nhập khách hàng/đặt hàng.
 */
const BASE = 'https://didongviet.vn';
const PRODUCTS = {
  A: { path: '/dien-thoai/samsung-galaxy-a07-5g.html', name: 'Samsung Galaxy A07 5G 128GB Chính Hãng' },
  B: { path: '/dien-thoai/iphone-15-128gb.html', name: 'iPhone 15 128GB Chính hãng (VN/A)' },
  C: { path: '/dien-thoai/iphone-16-128gb.html', name: 'iPhone 16 128GB Chính Hãng (VN/A)' },
};
type Product = keyof typeof PRODUCTS;
type Prices = { sale: number; original?: number; percent?: number };
type F15Case = { id: string; title: string; group: string; product?: Product; steps: string[]; expected: string[] };

const cases: F15Case[] = [
  {"id":"DDV_F15_001","title":"Giá Galaxy A07 5G từ trang chủ sang chi tiết","group":"F15.1 – Giá và mức giảm","steps":["Đọc giá hiện tại và giá gạch của A trên trang chủ; bấm đúng card A."],"expected":["Đúng URL/tên A; giá hiện tại và giá gạch trên chi tiết khớp card."]},
  {"id":"DDV_F15_002","title":"Giá iPhone 15 từ trang chủ sang chi tiết","group":"F15.1 – Giá và mức giảm","product":"B","steps":["Đọc giá và giá gạch của B trên trang chủ; mở card B."],"expected":["Đúng B, giá hai màn hình khớp; không dùng giá của A."]},
  {"id":"DDV_F15_003","title":"Sản phẩm C không có giá gạch không nhận mức giảm của A","group":"F15.1 – Giá và mức giảm","product":"C","steps":["Đọc card C, mở chi tiết và đối chiếu vùng giá chính."],"expected":["Giá C dương và khớp card; không có giá gạch hoặc phần trăm giảm trong vùng giá C."]},
  {"id":"DDV_F15_004","title":"Giá bán và giá gạch của A hợp lệ","group":"F15.1 – Giá và mức giảm","steps":["Đọc đúng vùng giá chính của A."],"expected":["Giá bán > 0; giá gạch > giá bán; giá được hiển thị theo VNĐ."]},
  {"id":"DDV_F15_005","title":"Phần trăm giảm của A khớp hai mức giá","group":"F15.1 – Giá và mức giảm","steps":["Tính round((giá gạch − giá bán) / giá gạch × 100)."],"expected":["Nhãn phần trăm bằng kết quả tính, nằm trong khoảng 1–99%."]},
  {"id":"DDV_F15_006","title":"Phần trăm giảm của B được tính theo giá B","group":"F15.1 – Giá và mức giảm","product":"B","steps":["Đọc giá bán, giá gạch, phần trăm của B; tính tỷ lệ giảm."],"expected":["Phần trăm B khớp công thức làm tròn; không lấy tỷ lệ A."]},
  {"id":"DDV_F15_007","title":"Card thường không tự hiển thị Flash Sale hoặc quota","group":"F15.2 – Thông tin và điều kiện ưu đãi","product":"C","steps":["Mở trang chủ; kiểm tra card C không thuộc Flash Sale trong fixture hiện tại."],"expected":["Card có tên/giá; không gắn Flash Sale, countdown, nhãn số suất hay số đã bán khi không có chương trình."]},
  {"id":"DDV_F15_008","title":"Công bố khả năng thay đổi giá và khuyến mãi","group":"F15.2 – Thông tin và điều kiện ưu đãi","steps":["Mở chi tiết A và đọc thông báo trong mục Khuyến mãi."],"expected":["Hiển thị Giá và khuyến mãi có thể kết thúc sớm hơn dự kiến; giá chính vẫn dương."]},
  {"id":"DDV_F15_009","title":"Ưu đãi HSSV/TXCN giữ điều kiện và mức tối đa","group":"F15.2 – Thông tin và điều kiện ưu đãi","steps":["Đọc ưu đãi HSSV/TXCN trong danh sách khuyến mãi A."],"expected":["Công bố đúng đối tượng, giảm thêm đến 5% và tối đa 500K; không coi là giá bán vô điều kiện."]},
  {"id":"DDV_F15_010","title":"Ưu đãi Kredivo có điều kiện kỳ hạn và liên kết chi tiết","group":"F15.2 – Thông tin và điều kiện ưu đãi","steps":["Đọc dòng Kredivo và href Xem chi tiết trong mục Khuyến mãi A."],"expected":["Có giảm 5%, tối đa 200,000đ, kỳ hạn 6/9/12 tháng; liên kết HTTPS đúng website, không mở giao dịch."]},
  {"id":"DDV_F15_011","title":"Mở và thu gọn ưu đãi thanh toán không đổi giá bán","group":"F15.2 – Thông tin và điều kiện ưu đãi","steps":["Ghi giá A; mở Xem thêm ưu đãi thanh toán rồi Thu gọn."],"expected":["Nút đổi trạng thái đúng; giá bán/giá gạch không đổi sau cả hai thao tác."]},
  {"id":"DDV_F15_012","title":"Mở và thu gọn danh sách khuyến mãi sản phẩm","group":"F15.2 – Thông tin và điều kiện ưu đãi","product":"C","steps":["Ghi số dòng ưu đãi C; bấm Xem thêm rồi Thu gọn trong mục Khuyến mãi."],"expected":["Số dòng tăng khi mở và trở lại ban đầu khi thu gọn; giá C giữ nguyên."]},
  {"id":"DDV_F15_013","title":"Chọn màu Tím của A dùng đúng giá trên ô màu","group":"F15.3 – Màu và phiên bản","steps":["Ghi giá ô màu Tím; chọn Tím."],"expected":["Chỉ Tím có aria-pressed=true; giá chính bằng giá đã công bố trên ô Tím."]},
  {"id":"DDV_F15_014","title":"Đổi B sang Hồng cập nhật giá theo màu","group":"F15.3 – Màu và phiên bản","product":"B","steps":["Ghi giá Đen và giá ô Hồng; chọn Hồng."],"expected":["Hồng được chọn duy nhất; giá chính khớp ô Hồng và khác giá Đen của fixture."]},
  {"id":"DDV_F15_015","title":"Đổi màu B rồi quay lại khôi phục giá ban đầu","group":"F15.3 – Màu và phiên bản","product":"B","steps":["Ghi giá Đen; chọn Hồng rồi chọn lại Đen."],"expected":["Giá chính cuối bằng giá Đen đầu; chỉ Đen được chọn."]},
  {"id":"DDV_F15_016","title":"Đổi A07 5G sang bản 4G không giữ nhầm giá","group":"F15.3 – Màu và phiên bản","steps":["Ghi giá A07 5G; bấm phiên bản 128GB liên kết sang A07 4G."],"expected":["Đúng URL/tên A07 4G; giá mới dương, thấp hơn bản 5G trong fixture."]},
  {"id":"DDV_F15_017","title":"Phiên bản 256GB không khả dụng không có liên kết mua","group":"F15.3 – Màu và phiên bản","steps":["Kiểm tra ô phiên bản 256GB đang bị khóa trên A."],"expected":["Ô có aria-disabled=true; không phải link hoặc button; không giả lập click để bỏ qua trạng thái khóa."]},
  {"id":"DDV_F15_018","title":"Đổi phiên bản 5G sang 4G rồi quay lại","group":"F15.3 – Màu và phiên bản","steps":["Ghi giá A; chuyển 128GB 4G, sau đó chọn liên kết 5G 128GB."],"expected":["Quay về đúng A07 5G; giá bán và giá gạch khôi phục như đầu."]},
  {"id":"DDV_F15_019","title":"Reload chi tiết giữ giá mặc định và mức giảm","group":"F15.4 – Điều hướng và tải trang","steps":["Đọc giá A ở màu mặc định; tải lại trang."],"expected":["Cùng sản phẩm/màu mặc định, giá bán/giá gạch/phần trăm không đổi trong phiên kiểm tra."]},
  {"id":"DDV_F15_020","title":"Back từ chi tiết B về trang chủ giữ giá card","group":"F15.4 – Điều hướng và tải trang","product":"B","steps":["Ghi giá card B; mở chi tiết; dùng Back về trang chủ."],"expected":["Đúng trang chủ; card B có giá bán/giá gạch/phần trăm như trước khi điều hướng."]},
  {"id":"DDV_F15_021","title":"Giỏ một A dùng giá bán và tiền tiết kiệm đúng","group":"F15.5 – Giá trong giỏ và checkout","steps":["Ghi hai mức giá A; thêm một A vào giỏ qua UI."],"expected":["Đúng sản phẩm, số lượng 1, đơn giá/giá gạch khớp chi tiết; tổng bằng giá bán, tiết kiệm bằng giá gạch trừ giá bán."]},
  {"id":"DDV_F15_022","title":"Giỏ A và B cộng đúng hai mức giá riêng","group":"F15.5 – Giá trong giỏ và checkout","steps":["Thêm A rồi B vào cùng giỏ qua UI, mỗi sản phẩm một chiếc."],"expected":["Có hai dòng đúng tên/đơn giá; tổng bằng giá A + giá B; tiết kiệm bằng tổng hai khoản giảm."]},
  {"id":"DDV_F15_023","title":"Tăng A từ một lên hai cập nhật tổng và tiết kiệm","group":"F15.5 – Giá trong giỏ và checkout","steps":["Thêm một A; bấm Tăng số lượng một lần."],"expected":["Số lượng 2; đơn giá không đổi; tổng và tiết kiệm bằng hai lần mức một chiếc."]},
  {"id":"DDV_F15_024","title":"Giảm A từ hai về một khôi phục tổng","group":"F15.5 – Giá trong giỏ và checkout","steps":["Thêm A; tăng lên 2 rồi giảm về 1."],"expected":["Số lượng 1; tổng/tiết kiệm trở lại giá trị ban đầu, không cộng giảm hai lần."]},
  {"id":"DDV_F15_025","title":"Xóa sản phẩm giảm giá cuối cùng trả giỏ về rỗng","group":"F15.5 – Giá trong giỏ và checkout","steps":["Thêm A; bấm Xóa sản phẩm; xác nhận Xóa trong dialog."],"expected":["Giỏ hiển thị trạng thái rỗng; không còn dòng sản phẩm hoặc nút mua giỏ cũ."]},
  {"id":"DDV_F15_026","title":"Xóa rồi thêm lại A không nhân đôi số lượng hay ưu đãi","group":"F15.5 – Giá trong giỏ và checkout","steps":["Thêm A, xóa và xác nhận; mở lại A rồi thêm một chiếc."],"expected":["Chỉ một A số lượng 1; đơn giá/tổng/tiết kiệm khớp lần đầu."]},
  {"id":"DDV_F15_027","title":"Reload giỏ hai A giữ số lượng và tổng tiền","group":"F15.5 – Giá trong giỏ và checkout","steps":["Thêm A và tăng lên 2; tải lại giỏ."],"expected":["Vẫn đúng A, số lượng 2, đơn giá cũ; tổng và tiết kiệm đúng hai chiếc."]},
  {"id":"DDV_F15_028","title":"Chuyển từ giỏ sang checkout không mất giá khuyến mãi","group":"F15.5 – Giá trong giỏ và checkout","steps":["Thêm một A; bấm MUA NGAY (1) trong giỏ; đọc sản phẩm và Tạm tính."],"expected":["Checkout có đúng A số lượng 1; đơn giá và Tạm tính khớp giá bán A; dừng trước nhập người nhận/đặt hàng."]},
  {"id":"DDV_F15_029","title":"C không nhận tiền tiết kiệm của sản phẩm khác","group":"F15.5 – Giá trong giỏ và checkout","product":"C","steps":["Mở C không có giá gạch; thêm một C vào context mới."],"expected":["Đơn giá và tổng đúng C; không có giá gạch hoặc dòng Tiết kiệm trong giỏ."]},
  {"id":"DDV_F15_030","title":"Ảnh sản phẩm tải lỗi không che giá hoặc ngăn thêm giỏ","group":"F15.4 – Điều hướng và tải trang","steps":["Chặn riêng request ảnh sản phẩm; mở A, đọc giá và thêm vào giỏ qua UI."],"expected":["Có request ảnh bị chặn thật; giá bán/giá gạch vẫn đọc được; giỏ nhận đúng một A và giá. API nghiệp vụ không bị thay thế."]}
];

function money(text: string) {
  const match = text.match(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/);
  expect(match, `Không đọc được tiền VNĐ: ${text}`).not.toBeNull();
  return Number(match![0].replace(/\D/g, ''));
}
function priceBox(page: Page) {
  // Vùng giá chính có direct child text-2xl; tránh giá ô màu/trả góp/sản phẩm gợi ý.
  return page.locator('main div.shrink-0:has(> div.text-2xl.font-bold)').first();
}
async function readPrices(box: Locator, card = false): Promise<Prices> {
  const sale = box.locator(card ? 'p.font-bold.text-primary-500' : ':scope > div.text-2xl.font-bold');
  await expect(sale).toBeVisible();
  const original = box.locator('.line-through');
  const percent = box.getByText(/^-\d+%$/, { exact: true });
  const result: Prices = { sale: money(await sale.innerText()) };
  if (await original.count()) result.original = money(await original.innerText());
  if (await percent.count()) result.percent = Number((await percent.innerText()).replace(/\D/g, ''));
  expect(result.sale).toBeGreaterThan(0);
  return result;
}
function card(page: Page, product: Product) {
  return page.locator(`main a[class*="group/product-card"][href="${PRODUCTS[product].path}"]`).first();
}
async function ready(page: Page) {
  // SSR có cả CTA và banner cookie trước khi React gắn handler.
  // Đợi hydration trước khi đóng cookie hoặc thực hiện mutation.
  await expect.poll(() => page.locator('main button').first().evaluate(
    element => Object.keys(element).some(key => key.startsWith('__reactProps$'))
  ), { timeout: 15_000 }).toBe(true);
  if (!(await page.context().cookies()).some(cookie => cookie.name === 'ddv_consent')) {
    const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
    await expect(reject).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => reject.evaluate(
      element => Object.keys(element).some(key => key.startsWith('__reactProps$'))
    ), { timeout: 15_000 }).toBe(true);
    await reject.click({ timeout: 20_000 });
    await expect(reject).toBeHidden();
    await expect.poll(async () => (await page.context().cookies())
      .some(cookie => cookie.name === 'ddv_consent')).toBe(true);
  }
}
async function home(page: Page) {
  const response = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await ready(page);
}
async function productPage(page: Page, product: Product = 'A') {
  const response = await page.goto(BASE + PRODUCTS[product].path, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await ready(page);
  await expect(page.getByRole('heading', { level: 1, name: PRODUCTS[product].name, exact: true })).toBeVisible();
  return readPrices(priceBox(page));
}
function promotion(page: Page) {
  return page.getByText('Giá và khuyến mãi có thể kết thúc sớm hơn dự kiến', { exact: true }).locator('xpath=../../..');
}
function color(page: Page, name: string) {
  return page.getByRole('button').filter({ has: page.locator(`span[title="${name}"]`) });
}
async function chooseColor(page: Page, name: string) {
  const button = color(page, name);
  const price = money(await button.innerText());
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button').filter({ has: page.locator('span[title]') }).locator('xpath=self::*[@aria-pressed="true"]')).toHaveCount(1);
  await expect.poll(async () => (await readPrices(priceBox(page))).sale).toBe(price);
  return price;
}
function cartItem(page: Page, product: Product) {
  return page.locator('main div.rounded-xl').filter({
    has: page.getByRole('link', { name: PRODUCTS[product].name, exact: true }),
  }).filter({ has: page.getByRole('button', { name: 'Xóa sản phẩm', exact: true }) });
}
function quantity(item: Locator) {
  return item.getByRole('button', { name: 'Tăng số lượng', exact: true }).locator('xpath=../span');
}
function cartTotals(page: Page) {
  return page.getByRole('button', { name: /^MUA NGAY \(\d+\)$/ }).locator('xpath=../..').locator('div.items-end');
}
async function assertCart(page: Page, product: Product, prices: Prices, count = 1) {
  const item = cartItem(page, product);
  await expect(item).toHaveCount(1);
  await expect(quantity(item)).toHaveText(String(count));
  await expect.poll(async () => money(await item.locator('span.font-semibold.text-primary-500').innerText())).toBe(prices.sale);
  if (prices.original) await expect.poll(async () => money(await item.locator('.line-through').innerText())).toBe(prices.original);
  else await expect(item.locator('.line-through')).toHaveCount(0);
}
async function assertTotals(page: Page, sale: number, saving?: number) {
  const totals = cartTotals(page);
  await expect.poll(async () => money(await totals.locator(':scope > span').innerText())).toBe(sale);
  if (saving) {
    await expect.poll(async () => money(await totals.getByText('Tiết kiệm', { exact: true }).locator('xpath=..').innerText())).toBe(saving);
  } else await expect(totals.getByText('Tiết kiệm', { exact: true })).toHaveCount(0);
}
async function addToCart(page: Page, product: Product) {
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).first().click();
  await page.getByRole('link', { name: 'Giỏ hàng', exact: true }).first().click();
  await expect(page).toHaveURL(/\/cart(?:[/?#]|$)/);
  await expect(quantity(cartItem(page, product))).toBeVisible();
}
async function removeProduct(page: Page, product: Product) {
  await cartItem(page, product).getByRole('button', { name: 'Xóa sản phẩm', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Xóa sản phẩm?');
  await dialog.getByRole('button', { name: 'Xóa', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(cartItem(page, product)).toHaveCount(0);
}

test.use({ video: 'off', trace: process.env.F15_TRACE === '1' ? 'retain-on-failure' : 'off' });
test.describe('F15 – Giá khuyến mãi trên UI thực tế', () => {
  test.describe.configure({ mode: 'parallel', timeout: 60000 });
  test.beforeEach(async ({ context }) => {
    await context.route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      const tracker = /(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net|googleadservices\.com|facebook\.net|facebook\.com|tiktok\.com|clarity\.ms|cdp\.asia|criteo\.com|chat-plugin\.pancake\.vn)$/i.test(host);
      return tracker ? route.abort() : route.continue();
    });
  });
  for (const c of cases) test(`${c.id} | ${c.title}`, async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'scope', description: 'Giá khuyến mãi hiện tại; không xác minh lịch/quota Flash Sale.' });
    const n = Number(c.id.slice(-3)), p = c.product ?? 'A';
    if ([1, 2, 3, 7, 20].includes(n)) {
      await home(page);
      const currentCard = card(page, p);
      const prices = await readPrices(currentCard, true);
      if (n === 7) {
        await expect(currentCard).toContainText(PRODUCTS[p].name);
        await expect(currentCard).not.toContainText(/flash\s*sale|kết thúc sau|còn\s*\d+\s*suất|đã bán\s*\d+/i);
        return;
      }
      await currentCard.click();
      await expect(page).toHaveURL(BASE + PRODUCTS[p].path);
      await ready(page);
      await expect(page.getByRole('heading', { level: 1, name: PRODUCTS[p].name, exact: true })).toBeVisible();
      expect(await readPrices(priceBox(page))).toEqual(prices);
      if (n === 3) {
        expect(prices.original).toBeUndefined();
        expect(prices.percent).toBeUndefined();
      } else expect(prices.original).toBeGreaterThan(prices.sale);
      if (n === 20) {
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(BASE + '/');
        expect(await readPrices(card(page, p), true)).toEqual(prices);
      }
      return;
    }
    let blockedImages = 0;
    if (n === 30) await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (request.resourceType() === 'image' && url.pathname.includes('/products/')) {
        blockedImages++;
        return route.abort('failed');
      }
      return route.fallback();
    });
    const prices = await productPage(page, p);
    const saving = (prices.original ?? prices.sale) - prices.sale;
    switch (n) {
      case 4:
        expect(prices.original).toBeGreaterThan(prices.sale);
        await expect(priceBox(page)).toContainText(/đ/);
        break;
      case 5: case 6:
        expect(prices.original).toBeGreaterThan(prices.sale);
        expect(prices.percent).toBe(Math.round((prices.original! - prices.sale) / prices.original! * 100));
        expect(prices.percent).toBeGreaterThan(0);
        expect(prices.percent).toBeLessThan(100);
        break;
      case 8:
        await expect(promotion(page).getByText('Giá và khuyến mãi có thể kết thúc sớm hơn dự kiến', { exact: true })).toBeVisible();
        break;
      case 9:
        await expect(promotion(page).locator('li').filter({ hasText: 'HSSV/TXCN' })).toContainText(/giảm thêm đến 5% tối đa 500K/);
        break;
      case 10: {
        const line = promotion(page).locator('li').filter({ hasText: /Kredivo/ });
        await expect(line).toContainText(/Giảm 5%, tối đa 200,000đ.*6, 9, 12 Tháng/);
        await expect(line.getByRole('link', { name: /Xem chi tiết/ })).toHaveAttribute('href', /^https:\/\/didongviet\.vn\/dchannel\/tra-gop-kredivo-di-dong-viet\/?$/);
        break;
      }
      case 11:
        await page.getByRole('button', { name: /^Xem thêm \d+ ưu đãi thanh toán$/ }).click();
        await expect(page.getByRole('button', { name: /^Thu gọn.*thanh toán/ })).toBeVisible();
        expect(await readPrices(priceBox(page))).toEqual(prices);
        await page.getByRole('button', { name: /^Thu gọn.*thanh toán/ }).click();
        await expect(page.getByRole('button', { name: /^Xem thêm \d+ ưu đãi thanh toán$/ })).toBeVisible();
        expect(await readPrices(priceBox(page))).toEqual(prices);
        break;
      case 12: {
        const box = promotion(page), extra = box.locator(':scope > div.grid > ol');
        // Nội dung thu gọn vẫn có trong DOM, bị inert và grid 0fr che lại.
        // :visible chỉ xét bounding box riêng nên không phát hiện phần bị cắt.
        const accessibleCount = () => box.locator('ol > li').evaluateAll(
          elements => elements.filter(element => !element.closest('[inert]')).length
        );
        const initial = await accessibleCount();
        await expect.poll(() => extra.evaluate(element => element.clientHeight)).toBe(0);
        await box.getByRole('button', { name: /^Xem thêm \d+ ưu đãi$/ }).click();
        await expect(box.getByRole('button', { name: 'Thu gọn', exact: true })).toHaveAttribute('aria-expanded', 'true');
        await expect.poll(accessibleCount).toBeGreaterThan(initial);
        await expect.poll(() => extra.evaluate(element => element.clientHeight)).toBeGreaterThan(0);
        await box.getByRole('button', { name: 'Thu gọn', exact: true }).click();
        await expect(box.getByRole('button', { name: /^Xem thêm \d+ ưu đãi$/ })).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(accessibleCount).toBe(initial);
        await expect.poll(() => extra.evaluate(element => element.clientHeight)).toBe(0);
        expect(await readPrices(priceBox(page))).toEqual(prices);
        break;
      }
      case 13: await chooseColor(page, 'Tím'); break;
      case 14: expect(await chooseColor(page, 'Hồng')).not.toBe(prices.sale); break;
      case 15:
        await chooseColor(page, 'Hồng');
        expect(await chooseColor(page, 'Đen')).toBe(prices.sale);
        break;
      case 16: case 18:
        await page.getByRole('link', { name: '128GB', exact: true }).click();
        await expect(page).toHaveURL(BASE + '/dien-thoai/samsung-galaxy-a07.html');
        await ready(page);
        await expect(page.getByRole('heading', { level: 1, name: 'Samsung Galaxy A07 128GB Chính Hãng', exact: true })).toBeVisible();
        expect((await readPrices(priceBox(page))).sale).toBeLessThan(prices.sale);
        if (n === 18) {
          await page.getByRole('link', { name: '5G 128GB', exact: true }).click();
          await expect(page).toHaveURL(BASE + PRODUCTS.A.path);
          expect(await readPrices(priceBox(page))).toEqual(prices);
        }
        break;
      case 17: {
        const disabled = page.locator('main [aria-disabled="true"]').filter({ hasText: /^256GB$/ });
        await expect(disabled).toBeVisible();
        await expect(disabled).not.toHaveJSProperty('tagName', 'A');
        await expect(disabled).not.toHaveJSProperty('tagName', 'BUTTON');
        await expect(disabled.locator('a, button')).toHaveCount(0);
        break;
      }
      case 19:
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        expect(await readPrices(priceBox(page))).toEqual(prices);
        break;
      default: {
        await addToCart(page, p);
        await assertCart(page, p, prices);
        await assertTotals(page, prices.sale, saving);
        if (n === 22) {
          const second = await productPage(page, 'B');
          await addToCart(page, 'B');
          await assertCart(page, 'A', prices);
          await assertCart(page, 'B', second);
          await expect(page.getByRole('button', { name: 'Xóa sản phẩm', exact: true })).toHaveCount(2);
          await assertTotals(page, prices.sale + second.sale, saving + second.original! - second.sale);
        } else if ([23, 24, 27].includes(n)) {
          const item = cartItem(page, 'A');
          await item.getByRole('button', { name: 'Tăng số lượng', exact: true }).click();
          await assertCart(page, 'A', prices, 2);
          await assertTotals(page, prices.sale * 2, saving * 2);
          if (n === 24) {
            await item.getByRole('button', { name: 'Giảm số lượng', exact: true }).click();
            await assertCart(page, 'A', prices);
            await assertTotals(page, prices.sale, saving);
          } else if (n === 27) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await assertCart(page, 'A', prices, 2);
            await assertTotals(page, prices.sale * 2, saving * 2);
          }
        } else if ([25, 26].includes(n)) {
          await removeProduct(page, 'A');
          if (n === 25) {
            await expect(page.locator('main')).toContainText(/giỏ hàng.*trống/i);
            await expect(page.getByRole('button', { name: /^MUA NGAY \(/ })).toHaveCount(0);
          } else {
            expect(await productPage(page, 'A')).toEqual(prices);
            await addToCart(page, 'A');
            await assertCart(page, 'A', prices);
            await expect(page.getByRole('button', { name: 'Xóa sản phẩm', exact: true })).toHaveCount(1);
            await assertTotals(page, prices.sale, saving);
          }
        } else if (n === 28) {
          await page.getByRole('button', { name: 'MUA NGAY (1)', exact: true }).click();
          await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
          const order = page.getByRole('region', { name: 'Sản phẩm trong đơn hàng', exact: true });
          await expect(order.getByRole('link', { name: PRODUCTS.A.name, exact: true }).filter({ hasText: PRODUCTS.A.name })).toBeVisible();
          await expect(order.getByText('Số lượng: 1', { exact: true })).toBeVisible();
          await expect.poll(async () => money(await order.locator('span.text-primary-500').first().innerText())).toBe(prices.sale);
          const subtotal = page.getByRole('region', { name: 'Thông tin đơn hàng', exact: true }).getByText('Tạm tính', { exact: true }).locator('xpath=..');
          await expect.poll(async () => money(await subtotal.innerText())).toBe(prices.sale);
          await expect(page.getByRole('button', { name: /^ĐẶT HÀNG/ })).toBeVisible();
        } else if (n === 30) expect(blockedImages).toBeGreaterThan(0);
      }
    }
  });
});
