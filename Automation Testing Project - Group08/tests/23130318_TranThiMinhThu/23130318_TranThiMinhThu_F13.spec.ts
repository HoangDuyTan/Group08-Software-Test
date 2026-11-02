import { test as base, expect, type BrowserContext, type Page, type Locator } from '@playwright/test';

/** F13 – 30 case UI thực tế. Dữ liệu nằm trong spec; đồng bộ Excel cá nhân.
 * Mỗi case có context mới. Seed giỏ lấy qua UI thật, cache trong từng worker.
 * Không mock API nghiệp vụ; chặn tracker, ảnh sản phẩm/font/media không thuộc phạm vi.
 * Logo đối tác vẫn tải thật. Không nhập khách hàng/thẻ hoặc xác nhận hồ sơ.
 */
const BASE = 'https://didongviet.vn';
const PRODUCTS = {
  A: { url: `${BASE}/dien-thoai/iphone-16-128gb.html`, name: 'iPhone 16 128GB' },
  B: { url: `${BASE}/dien-thoai/samsung-galaxy-a07.html`, name: 'Samsung Galaxy A07 128GB' },
};
const COMPANY = 'Trả góp qua công ty tài chính';
const CREDIT = 'Trả góp qua thẻ tín dụng';
const PARTNERS = ['Home Credit', 'HD Saison', 'MCredit', 'Shinhan Finance', 'AEON Finance'];
type Product = keyof typeof PRODUCTS;
type Mode = 'company' | 'credit' | 'product';
type State = Awaited<ReturnType<BrowserContext['storageState']>>;
type Seed = { state: State; price: number; product: Product };
type F13Case = { id: string; title: string; group: string; steps: string[]; expected: string[]; product?: Product; mode?: Mode };

const cases: F13Case[] = [
  {"id":"DDV_F13_001","title":"Mở trả góp công ty tài chính từ trang sản phẩm","group":"F13.1 – Hình thức trả góp","mode":"product","steps":["Mở Trả góp 0%, chọn Trả góp qua công ty tài chính."],"expected":["Đến installment?method=OFFLINE, đúng sản phẩm; bảng tính công ty tài chính có giá và tiền góp hợp lệ."]},
  {"id":"DDV_F13_002","title":"Mở trả góp thẻ tín dụng từ trang sản phẩm","group":"F13.1 – Hình thức trả góp","mode":"product","steps":["Mở Trả góp 0%, chọn Trả góp qua thẻ tín dụng."],"expected":["Đến installment?method=ONLINE; có các bước ngân hàng, loại thẻ, gói trả góp; không hiển thị bộ chọn trả trước của công ty tài chính."]},
  {"id":"DDV_F13_003","title":"Đổi trả trước cập nhật khoản góp hàng tháng","group":"F13.1 – Hình thức trả góp","steps":["Ghi tiền góp; đổi trả trước từ mức mặc định sang 50%."],"expected":["Nhãn và bảng ghi 50%; tiền góp thay đổi, vẫn là số dương."]},
  {"id":"DDV_F13_004","title":"Đọc gói ưu đãi không lãi suất và các khoản công bố","group":"F13.1 – Hình thức trả góp","steps":["Đọc gói ưu đãi nổi bật, giá, trả trước, kỳ hạn, góp hàng tháng và thông tin lãi/phí."],"expected":["Gói hiển thị Không lãi suất, số kỳ và tiền hợp lệ; không suy luận mọi phí đều bằng 0."]},
  {"id":"DDV_F13_005","title":"Chuyển công ty tài chính – thẻ tín dụng – công ty tài chính","group":"F13.1 – Hình thức trả góp","steps":["Dùng Thay đổi trên trang installment để chọn thẻ rồi quay lại công ty tài chính."],"expected":["URL và nội dung đổi đúng hình thức; giá và sản phẩm giữ nguyên, không cần tải lại trang sản phẩm."]},
  {"id":"DDV_F13_006","title":"Chọn kỳ hạn ngắn nhất đang hỗ trợ","group":"F13.2 – Kỳ hạn","steps":["Đọc danh sách kỳ hạn; chọn giá trị nhỏ nhất."],"expected":["Trigger hiển thị kỳ hạn nhỏ nhất; bảng tính vẫn hợp lệ."]},
  {"id":"DDV_F13_007","title":"Chọn kỳ hạn ở giữa danh sách","group":"F13.2 – Kỳ hạn","steps":["Đọc các kỳ hạn; chọn giá trị ở giữa, khác min/max."],"expected":["Kỳ hạn giữa được chọn đúng và bảng tính có khoản góp dương."]},
  {"id":"DDV_F13_008","title":"Chọn kỳ hạn dài nhất đang hỗ trợ","group":"F13.2 – Kỳ hạn","steps":["Đọc danh sách; chọn kỳ hạn lớn nhất."],"expected":["Trigger hiển thị kỳ hạn lớn nhất, bảng tính hợp lệ."]},
  {"id":"DDV_F13_009","title":"Đổi kỳ hạn ngắn sang dài giữ mức trả trước","group":"F13.2 – Kỳ hạn","steps":["Chọn min rồi max, ghi khoản góp và trả trước."],"expected":["Tiền góp thay đổi theo kỳ hạn; phần trăm trả trước không đổi."]},
  {"id":"DDV_F13_010","title":"Đổi kỳ hạn rồi quay về khôi phục khoản góp","group":"F13.2 – Kỳ hạn","steps":["Chọn max → min → max."],"expected":["Khoản góp ở max cuối bằng max đầu khi giá/đối tác/trả trước không đổi."]},
  {"id":"DDV_F13_011","title":"Chọn mức trả trước nhỏ nhất","group":"F13.3 – Trả trước","steps":["Đọc danh sách và chọn mức trả trước nhỏ nhất."],"expected":["Trigger và bảng khớp mức nhỏ nhất; tiền trả trước khớp giá nhân tỷ lệ."]},
  {"id":"DDV_F13_012","title":"Chọn mức trả trước ở giữa","group":"F13.3 – Trả trước","steps":["Chọn mức trả trước nằm giữa min/max."],"expected":["Trigger và bảng cùng tỷ lệ đã chọn; kỳ hạn không đổi."]},
  {"id":"DDV_F13_013","title":"Chọn mức trả trước lớn nhất","group":"F13.3 – Trả trước","steps":["Đọc danh sách và chọn mức trả trước lớn nhất."],"expected":["Tỷ lệ được lưu đúng; trả trước nhỏ hơn giá máy, khoản góp dương."]},
  {"id":"DDV_F13_014","title":"Đổi trả trước rồi quay về khôi phục khoản góp","group":"F13.3 – Trả trước","steps":["Chọn min → max → min và đối chiếu khoản góp."],"expected":["Tiền góp ở min cuối khớp min đầu; kỳ hạn giữ nguyên."]},
  {"id":"DDV_F13_015","title":"Trả trước chỉ chọn từ các mức cố định hợp lệ","group":"F13.3 – Trả trước","steps":["Mở dropdown trả trước, đọc các tỷ lệ và kiểm tra loại điều khiển."],"expected":["Các tỷ lệ duy nhất, tăng dần, từ 0 đến dưới 100%; điều khiển không có ô nhập tiền tự do. Không giả lập nhập ngoài phạm vi."]},
  {"id":"DDV_F13_016","title":"Chọn MCredit và đối chiếu logo bảng tính","group":"F13.4 – Đối tác và cổng trả góp","steps":["Chọn MCredit trong danh sách công ty tài chính."],"expected":["Chỉ MCredit được đánh dấu; logo Công ty trong bảng khớp logo đã chọn; bảng tính hợp lệ."]},
  {"id":"DDV_F13_017","title":"Đổi Home Credit – HD Saison – Home Credit","group":"F13.4 – Đối tác và cổng trả góp","steps":["Lần lượt chọn Home Credit, HD Saison và Home Credit."],"expected":["Mỗi lần chỉ một công ty được chọn, logo bảng tính đổi theo công ty; giá sản phẩm không đổi."]},
  {"id":"DDV_F13_018","title":"Chọn OnePay trong trả góp thẻ","group":"F13.4 – Đối tác và cổng trả góp","mode":"credit","steps":["Chọn logo OnePay (Trả góp)."],"expected":["OnePay được đánh dấu duy nhất trong danh sách cổng; vẫn ở hình thức thẻ, không chuyển đến cổng giao dịch."]},
  {"id":"DDV_F13_019","title":"Đổi cổng Kim Ngân sang Payoo trong trả góp thẻ","group":"F13.4 – Đối tác và cổng trả góp","mode":"credit","steps":["Chọn Kim Ngân (Trả góp), sau đó Payoo (Trả góp)."],"expected":["Chỉ cổng cuối Payoo được chọn; không nhập ngân hàng/thẻ hoặc gửi hồ sơ."]},
  {"id":"DDV_F13_020","title":"Đổi công ty giữ cấu hình kỳ hạn trả trước được hỗ trợ","group":"F13.4 – Đối tác và cổng trả góp","steps":["Chọn kỳ hạn lớn nhất ở Home Credit rồi chuyển AEON Finance.","Đọc kỳ hạn và tỷ lệ trả trước của AEON."],"expected":["Kỳ hạn và trả trước hiện hành nằm trong danh sách AEON hỗ trợ; bảng tính dùng đúng AEON. Không giả định một cặp SKU/đối tác bị cấm khi chưa có dữ liệu."]},
  {"id":"DDV_F13_021","title":"Đối chiếu tiền trả trước và khoản còn tài trợ","group":"F13.5 – Số tiền tham khảo","steps":["Chọn trả trước 30%; đọc giá, tiền trả trước và Gốc + Lãi của Home Credit."],"expected":["Tiền trả trước bằng giá × 30% (sai số tối đa 1đ); khoản Gốc + Lãi trong fixture bằng giá trừ trả trước."]},
  {"id":"DDV_F13_022","title":"Đối chiếu tổng tiền và chênh lệch với khoản góp","group":"F13.5 – Số tiền tham khảo","steps":["Chọn Home Credit kỳ hạn 12 tháng; đọc các dòng trong bảng tính."],"expected":["Tổng tiền khớp trả trước + tiền góp/tháng × số tháng trong sai số làm tròn tối đa bằng số tháng; chênh lệch bằng tổng tiền trừ giá máy."]},
  {"id":"DDV_F13_023","title":"Bảng trả góp đúng sản phẩm Galaxy A07","group":"F13.5 – Số tiền tham khảo","product":"B","steps":["Mở trả góp công ty tài chính cho Galaxy A07."],"expected":["Tên máy, giá và bảng tính khớp Galaxy A07 đã chọn; không dùng giá của iPhone."]},
  {"id":"DDV_F13_024","title":"Đổi sản phẩm sang mức giá cao hơn","group":"F13.5 – Số tiền tham khảo","product":"B","steps":["Từ Galaxy A07, mở iPhone 16 128GB và chọn trả góp."],"expected":["Tên và giá chuyển sang iPhone; giá tính góp mới lớn hơn giá Galaxy A07."]},
  {"id":"DDV_F13_025","title":"Đổi sản phẩm sang mức giá thấp hơn","group":"F13.5 – Số tiền tham khảo","steps":["Từ iPhone 16, mở Galaxy A07 và chọn trả góp."],"expected":["Tên và giá chuyển sang Galaxy A07; giá tính góp mới thấp hơn giá iPhone."]},
  {"id":"DDV_F13_026","title":"Đóng rồi mở lại bộ chọn trả góp không tải lại sản phẩm","group":"F13.6 – Đóng mở và điều hướng","mode":"product","steps":["Mở bộ chọn, đóng bằng X, rồi mở lại trên cùng trang."],"expected":["Bộ chọn đóng/mở đúng; chỉ một dialog, URL sản phẩm không đổi."]},
  {"id":"DDV_F13_027","title":"Chọn kỳ hạn sau khi đổi HD Saison","group":"F13.6 – Đóng mở và điều hướng","steps":["Chọn HD Saison, đọc và chọn kỳ hạn dài nhất của công ty này."],"expected":["HD Saison được chọn; kỳ hạn hiện hành đúng giá trị đã chọn và bảng tính không rỗng/NaN."]},
  {"id":"DDV_F13_028","title":"Back về đúng sản phẩm sau khi mở trả góp","group":"F13.6 – Đóng mở và điều hướng","mode":"product","steps":["Từ sản phẩm mở trả góp tài chính, sau đó dùng Back."],"expected":["Trở về đúng URL iPhone 16 128GB; nút Trả góp 0% còn hiển thị; không tạo đơn."]},
  {"id":"DDV_F13_029","title":"Refresh trả góp giữ đúng sản phẩm và bảng tính hợp lệ","group":"F13.6 – Đóng mở và điều hướng","steps":["Ghi tên/giá máy; đổi kỳ hạn rồi reload trang installment."],"expected":["Sau reload vẫn đúng sản phẩm và giá; lựa chọn được giữ hoặc reset phải thuộc danh sách hiện hành, bảng tính hợp lệ."]},
  {"id":"DDV_F13_030","title":"Đổi model không giữ giá và cấu hình cũ không hợp lệ","group":"F13.6 – Đóng mở và điều hướng","steps":["Ở iPhone chọn kỳ hạn dài nhất và trả trước lớn nhất; mở Galaxy A07 và chọn trả góp."],"expected":["Bảng dùng tên/giá Galaxy A07; kỳ hạn/trả trước hiện hành hợp lệ cho máy mới, không giữ giá iPhone."]}
];

function chooser(page: Page) { return page.getByRole('dialog', { name: 'Chọn hình thức trả góp', exact: true }); }
function table(page: Page) { return page.locator('main table').filter({ has: page.getByRole('cell', { name: 'Giá mua trả góp', exact: true }) }); }
function row(page: Page, label: string) { return table(page).getByRole('row').filter({ has: page.getByRole('cell', { name: label, exact: true }) }).getByRole('cell').nth(1); }
function trigger(page: Page, label: 'Số tháng' | 'Trả trước') { return page.getByText(label, { exact: true }).first().locator('xpath=..').getByRole('button'); }
function amount(raw: string) {
  const match = raw.match(/(\d[\d.,]*)\s*[đ₫]/i);
  expect(match, `Thiếu tiền VNĐ trong "${raw}"`).not.toBeNull();
  return Number(match![1].replace(/\D/g, ''));
}
async function initialConsent(page: Page) {
  if (!(await page.context().cookies(BASE)).some(cookie => cookie.name === 'ddv_consent')) {
    const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
    await reject.waitFor({ state: 'visible', timeout: 10_000 });
    await reject.click({ timeout: 10_000 });
    await expect(reject).toBeHidden();
  }
}
async function functionalResources(context: BrowserContext) {
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), type = request.resourceType();
    const tracker = /(^|\.)(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|googleadservices\.com|facebook\.net|facebook\.com|tiktok\.com|clarity\.ms|cdp\.asia|criteo\.com|chat-plugin\.pancake\.vn)$/i.test(url.hostname);
    const nonessential = type === 'font' || type === 'media' || (type === 'image' && !url.pathname.includes('/payment-gateway/'));
    if (tracker || nonessential) await route.abort();
    else await route.continue();
  });
}
async function openChooser(page: Page) {
  const button = page.getByRole('button', { name: /^Trả góp 0%$/i }).first();
  // SSR có thể hiện nút trước khi React hydrate. Chỉ thử lại hành động MỞ dialog,
  // không force-click và không retry bất kỳ thao tác xác nhận nào.
  await expect(async () => {
    if (!(await chooser(page).isVisible())) await button.click();
    await expect(chooser(page)).toBeVisible({ timeout: 1200 });
  }).toPass({ timeout: 10_000, intervals: [200, 400] });
}
async function chooseMode(page: Page, mode: 'company' | 'credit') {
  const name = mode === 'company' ? COMPANY : CREDIT;
  await chooser(page).getByRole('button').filter({ has: page.getByText(name, { exact: true }) }).click();
  await expect(page).toHaveURL(new RegExp(`/installment\\?method=${mode === 'company' ? 'OFFLINE' : 'ONLINE'}(?:&|$)`));
  await expect(page.locator('main').getByText(name, { exact: true })).toBeVisible();
  if (mode === 'company') await expect(table(page)).toBeVisible();
  else await expect(page.getByText('Chọn ngân hàng trả góp', { exact: true })).toBeVisible();
}
async function fromProduct(page: Page, product: Product, mode: 'company' | 'credit' = 'company') {
  const response = await page.goto(PRODUCTS[product].url, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBeLessThan(400);
  await initialConsent(page);
  await openChooser(page); await chooseMode(page, mode);
}

const test = base.extend<{ product: Product; mode: Mode; seed: Seed }, { getSeed: (product: Product) => Promise<Seed> }>({
  product: ['A', { option: true }],
  mode: ['company', { option: true }],
  getSeed: [async ({ browser }, use) => {
    const cache = new Map<Product, Promise<Seed>>();
    await use(product => {
      if (!cache.has(product)) cache.set(product, (async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        try {
          await functionalResources(context);
          const page = await context.newPage();
          await fromProduct(page, product);
          const state = await context.storageState();
          // Chỉ copy giỏ/checkout và cookie khách vãng lai/consent của context thử nghiệm.
          state.cookies = state.cookies.filter(cookie => ['guest_id', 'ddv_gr', 'ddv_consent'].includes(cookie.name));
          for (const origin of state.origins) origin.localStorage = origin.localStorage.filter(item => ['ddv-cart', 'ddv-checkout'].includes(item.name));
          return { state, price: amount(await row(page, 'Giá mua trả góp').innerText()), product };
        } finally { await context.close(); }
      })());
      return cache.get(product)!;
    });
  }, { scope: 'worker' }],
  seed: async ({ getSeed, product }, use) => { await use(await getSeed(product)); },
  storageState: async ({ seed }, use) => { await use(seed.state); },
  context: async ({ context }, use) => { await functionalResources(context); await use(context); },
  page: async ({ page, mode, product }, use) => {
    const url = mode === 'product' ? PRODUCTS[product].url : `${BASE}/installment?method=${mode === 'credit' ? 'ONLINE' : 'OFFLINE'}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (mode === 'company') await expect(table(page)).toBeVisible();
    if (mode === 'credit') await expect(page.getByText('Chọn ngân hàng trả góp', { exact: true })).toBeVisible();
    await use(page);
  },
});
test.use({ viewport: { width: 1440, height: 1000 }, video: 'off', trace: process.env.F13_TRACE === '1' ? 'retain-on-failure' : 'off' });
test.describe.configure({ mode: 'parallel', timeout: 60_000 });

async function current(page: Page, label: 'Số tháng' | 'Trả trước') { return Number((await trigger(page, label).innerText()).match(/\d+/)?.[0]); }
async function dropdown(page: Page, label: 'Số tháng' | 'Trả trước') {
  const button = trigger(page, label);
  await button.click();
  const id = await button.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  const popup = page.locator(`[id="${id}"]`);
  await expect(popup).toBeVisible();
  return popup;
}
async function options(page: Page, label: 'Số tháng' | 'Trả trước') {
  const popup = await dropdown(page, label);
  const values = (await popup.getByRole('button').allTextContents()).map(text => Number(text.match(/\d+/)?.[0]));
  expect(values.length).toBeGreaterThan(1);
  expect(values.every(Number.isFinite)).toBe(true);
  expect(new Set(values).size).toBe(values.length);
  expect(values).toEqual([...values].sort((a, b) => a - b));
  await page.keyboard.press('Escape'); await expect(popup).toBeHidden();
  return values;
}
async function select(page: Page, label: 'Số tháng' | 'Trả trước', value: number) {
  const popup = await dropdown(page, label);
  const expression = label === 'Số tháng' ? new RegExp(`^${value} tháng$`) : new RegExp(`^${value}%\\s*\\(`);
  await popup.getByRole('button', { name: expression }).click();
  await expect(popup).toBeHidden();
  await expect(trigger(page, label)).toHaveText(label === 'Số tháng' ? `${value} tháng` : `${value}%`);
}
function partner(page: Page, name: string) { return page.locator('main button').filter({ has: page.getByRole('img', { name, exact: true }) }); }
async function selectPartner(page: Page, name: string) {
  const button = partner(page, name); await button.click();
  await expect(button).toHaveClass(/\bborder-primary-500\b/);
  const selected = page.locator('main button.border-primary-500').filter({ has: page.getByRole('img', { name: /^(Home Credit|HD Saison|MCredit|Shinhan Finance|AEON Finance)$/ }) });
  await expect(selected).toHaveCount(1);
  const selectedSrc = await button.getByRole('img').getAttribute('src');
  const tableSrc = await row(page, 'Công ty').getByRole('img').getAttribute('src');
  expect(tableSrc?.split('?')[0]).toBe(selectedSrc?.split('?')[0]);
}
async function selectGateway(page: Page, name: string) {
  const button = partner(page, name); await button.click();
  await expect(button).toHaveClass(/\bborder-primary-500\b/);
  await expect(page.locator('main button.border-primary-500').filter({ has: page.getByRole('img', { name: /^(Kim Ngân|OnePay|Payoo) \(Trả góp\)$/ }) })).toHaveCount(1);
}
async function summary(page: Page) {
  const data = {
    price: amount(await row(page, 'Giá mua trả góp').innerText()),
    down: amount(await row(page, 'Trả trước').innerText()),
    monthly: amount(await row(page, 'Góp mỗi tháng').innerText()),
    total: amount(await row(page, 'Tổng tiền phải trả').innerText()),
    difference: amount(await row(page, 'Chênh lệch').innerText()),
    percent: await current(page, 'Trả trước'), months: await current(page, 'Số tháng'),
  };
  expect(data.price).toBeGreaterThan(0); expect(data.monthly).toBeGreaterThan(0);
  expect(data.down).toBeGreaterThanOrEqual(0); expect(data.down).toBeLessThan(data.price);
  expect(Math.abs(data.down - data.price * data.percent / 100)).toBeLessThanOrEqual(1);
  await expect(row(page, 'Trả trước')).toContainText(`${data.percent}%`);
  await expect(table(page)).not.toContainText(/NaN|undefined|Infinity/);
  return data;
}
async function productIs(page: Page, product: Product) {
  await expect(page.locator('main a').filter({ hasText: PRODUCTS[product].name }).first()).toBeVisible();
}
async function switchMode(page: Page, mode: 'company' | 'credit') {
  await page.locator('main').getByRole('button', { name: 'Thay đổi', exact: true }).click();
  await chooseMode(page, mode);
}

const actions: Record<string, (page: Page, seed: Seed) => Promise<void>> = {
  DDV_F13_001: async (page, seed) => { await openChooser(page); await chooseMode(page, 'company'); await productIs(page, 'A'); expect((await summary(page)).price).toBe(seed.price); },
  DDV_F13_002: async page => { await openChooser(page); await chooseMode(page, 'credit'); await productIs(page, 'A'); await expect(trigger(page, 'Trả trước')).toHaveCount(0); },
  DDV_F13_003: async page => { const before = await summary(page); await select(page, 'Trả trước', 50); const after = await summary(page); expect(after.percent).toBe(50); expect(after.monthly).not.toBe(before.monthly); },
  DDV_F13_004: async page => {
    const promo = page.getByText(/gói ưu đãi nổi bật/i).locator('xpath=..');
    await expect(promo).toContainText('Không lãi suất');
    await expect(promo).toContainText(/Phí thu hộ/);
    await expect(promo).toContainText(/\d+\s*tháng/);
    await expect(promo).not.toContainText(/NaN|undefined/);
    const promoPrice = amount(await promo.getByText('Giá mua trả góp:', { exact: true }).first().locator('xpath=..').innerText());
    const promoMonthly = amount(await promo.getByText('Góp mỗi tháng:', { exact: true }).first().locator('xpath=..').innerText());
    const promoTotal = amount(await promo.getByText('Tổng tiền:', { exact: true }).first().locator('xpath=..').innerText());
    expect(promoPrice).toBe((await summary(page)).price);
    expect(promoMonthly).toBeGreaterThan(0); expect(promoTotal).toBeGreaterThan(0);
  },
  DDV_F13_005: async (page, seed) => { await switchMode(page, 'credit'); await expect(table(page)).toHaveCount(0); await switchMode(page, 'company'); expect((await summary(page)).price).toBe(seed.price); },
  DDV_F13_006: async page => { const v = await options(page, 'Số tháng'); await select(page, 'Số tháng', v[0]); expect((await summary(page)).months).toBe(v[0]); },
  DDV_F13_007: async page => { const v = await options(page, 'Số tháng'); expect(v.length).toBeGreaterThanOrEqual(3); const mid = v[Math.floor(v.length / 2)]; await select(page, 'Số tháng', mid); expect((await summary(page)).months).toBe(mid); },
  DDV_F13_008: async page => { const v = await options(page, 'Số tháng'); await select(page, 'Số tháng', v.at(-1)!); expect((await summary(page)).months).toBe(v.at(-1)); },
  DDV_F13_009: async page => { const v = await options(page, 'Số tháng'); const down = await current(page, 'Trả trước'); await select(page, 'Số tháng', v[0]); const a = await summary(page); await select(page, 'Số tháng', v.at(-1)!); const b = await summary(page); expect(b.monthly).not.toBe(a.monthly); expect(b.percent).toBe(down); },
  DDV_F13_010: async page => { const v = await options(page, 'Số tháng'); await select(page, 'Số tháng', v.at(-1)!); const a = await summary(page); await select(page, 'Số tháng', v[0]); await select(page, 'Số tháng', v.at(-1)!); expect(await summary(page)).toEqual(a); },
  DDV_F13_011: async page => { const v = await options(page, 'Trả trước'); await select(page, 'Trả trước', v[0]); expect((await summary(page)).percent).toBe(v[0]); },
  DDV_F13_012: async page => { const v = await options(page, 'Trả trước'); expect(v.length).toBeGreaterThanOrEqual(3); const months = await current(page, 'Số tháng'); const mid = v[Math.floor(v.length / 2)]; await select(page, 'Trả trước', mid); const s = await summary(page); expect(s.percent).toBe(mid); expect(s.months).toBe(months); },
  DDV_F13_013: async page => { const v = await options(page, 'Trả trước'); await select(page, 'Trả trước', v.at(-1)!); expect((await summary(page)).percent).toBe(v.at(-1)); },
  DDV_F13_014: async page => { const v = await options(page, 'Trả trước'); await select(page, 'Trả trước', v[0]); const a = await summary(page); await select(page, 'Trả trước', v.at(-1)!); await select(page, 'Trả trước', v[0]); expect(await summary(page)).toEqual(a); },
  DDV_F13_015: async page => { const v = await options(page, 'Trả trước'); expect(v.every(x => x >= 0 && x < 100)).toBe(true); await expect(trigger(page, 'Trả trước').locator('xpath=..').locator('input')).toHaveCount(0); },
  DDV_F13_016: async page => { await selectPartner(page, 'MCredit'); await summary(page); },
  DDV_F13_017: async (page, seed) => { for (const name of ['Home Credit', 'HD Saison', 'Home Credit']) { await selectPartner(page, name); expect((await summary(page)).price).toBe(seed.price); } },
  DDV_F13_018: async page => { await selectGateway(page, 'OnePay (Trả góp)'); await expect(page.locator('main').getByText(CREDIT, { exact: true })).toBeVisible(); },
  DDV_F13_019: async page => { await selectGateway(page, 'Kim Ngân (Trả góp)'); await selectGateway(page, 'Payoo (Trả góp)'); },
  DDV_F13_020: async page => { const v = await options(page, 'Số tháng'); await select(page, 'Số tháng', v.at(-1)!); await selectPartner(page, 'AEON Finance'); const ts = await options(page, 'Số tháng'), ds = await options(page, 'Trả trước'); const s = await summary(page); expect(ts).toContain(s.months); expect(ds).toContain(s.percent); },
  DDV_F13_021: async page => { await select(page, 'Trả trước', 30); const s = await summary(page); expect(s.percent).toBe(30); expect(amount(await row(page, 'Gốc + Lãi').innerText())).toBe(s.price - s.down); },
  DDV_F13_022: async page => { await select(page, 'Số tháng', 12); const s = await summary(page); expect(Math.abs(s.total - (s.down + s.monthly * s.months))).toBeLessThanOrEqual(s.months); expect(Math.abs(s.difference - (s.total - s.price))).toBeLessThanOrEqual(1); },
  DDV_F13_023: async (page, seed) => { await productIs(page, 'B'); expect((await summary(page)).price).toBe(seed.price); },
  DDV_F13_024: async page => { const a = await summary(page); await fromProduct(page, 'A'); await productIs(page, 'A'); expect((await summary(page)).price).toBeGreaterThan(a.price); },
  DDV_F13_025: async page => { const a = await summary(page); await fromProduct(page, 'B'); await productIs(page, 'B'); expect((await summary(page)).price).toBeLessThan(a.price); },
  DDV_F13_026: async page => { await openChooser(page); await chooser(page).getByRole('button', { name: 'Đóng', exact: true }).click(); await expect(chooser(page)).toBeHidden(); await openChooser(page); await expect(chooser(page)).toHaveCount(1); await expect(page).toHaveURL(PRODUCTS.A.url); },
  DDV_F13_027: async page => { await selectPartner(page, 'HD Saison'); const v = await options(page, 'Số tháng'); await select(page, 'Số tháng', v.at(-1)!); expect((await summary(page)).months).toBe(v.at(-1)); },
  DDV_F13_028: async page => { await openChooser(page); await chooseMode(page, 'company'); await page.goBack({ waitUntil: 'domcontentloaded' }); await expect(page).toHaveURL(PRODUCTS.A.url); await expect(page.getByRole('button', { name: /^Trả góp 0%$/i }).first()).toBeVisible(); },
  DDV_F13_029: async (page, seed) => { const v = await options(page, 'Số tháng'); await select(page, 'Số tháng', v.at(-1)!); await page.reload({ waitUntil: 'domcontentloaded' }); await productIs(page, 'A'); const ts = await options(page, 'Số tháng'), ds = await options(page, 'Trả trước'); const s = await summary(page); expect(s.price).toBe(seed.price); expect(ts).toContain(s.months); expect(ds).toContain(s.percent); },
  DDV_F13_030: async page => { const ts = await options(page, 'Số tháng'), ds = await options(page, 'Trả trước'); await select(page, 'Số tháng', ts.at(-1)!); await select(page, 'Trả trước', ds.at(-1)!); const before = await summary(page); await fromProduct(page, 'B'); await productIs(page, 'B'); const tsB = await options(page, 'Số tháng'), dsB = await options(page, 'Trả trước'); const s = await summary(page); expect(s.price).not.toBe(before.price); expect(tsB).toContain(s.months); expect(dsB).toContain(s.percent); },
};

if (cases.length !== 30 || new Set(cases.map(c => c.id)).size !== 30 || Object.keys(actions).length !== 30) throw new Error('F13 cần đúng 30 case và 30 hàm kiểm thử.');
for (const scenario of cases) {
  test.describe(scenario.id, () => {
    test.use({ product: scenario.product ?? 'A', mode: scenario.mode ?? 'company' });
    test(`${scenario.id} - ${scenario.title}`, async ({ page, seed }, testInfo) => {
      await test.step(scenario.title, () => actions[scenario.id](page, seed));
      await expect(page.getByText(/đặt hàng thành công|đăng ký thành công|hồ sơ thành công/i)).toHaveCount(0);
      expect(page.context().pages()).toHaveLength(1);
      if (!['product'].includes(scenario.mode ?? 'company') || scenario.id === 'DDV_F13_001' || scenario.id === 'DDV_F13_002') {
        await expect(page).toHaveURL(/\/installment\?method=(?:OFFLINE|ONLINE)/);
        await expect(page.getByRole('button', { name: /^XÁC NHẬN TRẢ GÓP$/i })).toBeVisible();
      }
      await testInfo.attach('observation.txt', { body: `${scenario.id}: ${scenario.title}\n${page.url()}\nKhông bấm xác nhận trả góp hoặc gửi hồ sơ.`, contentType: 'text/plain; charset=utf-8' });
    });
  });
}
