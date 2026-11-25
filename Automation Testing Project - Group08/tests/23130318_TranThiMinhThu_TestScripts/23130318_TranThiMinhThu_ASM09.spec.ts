import { test, expect, type Page, type Locator, type BrowserContext, type Response } from '@playwright/test';
import {
  dismissCookies, waitForHydration, paymentDialog, openMethods, closeMethods,
  method as asmPaymentMethod, total as asmCheckoutTotal,
} from './payment-helpers';

/**
 * Bài tập 9 – Trần Thị Minh Thư – 23130318.
 * 10 ca kiểm thử hồi quy tương ứng với DDV-THU-01…10 trong báo cáo cá nhân.
 * Bảy lỗi giữ minh chứng ngày 12/11; thay 07/08/10 bằng lỗi độc lập ngày 25/11/2026.
 * Kịch bản mở rộng liên kết tới testcase ASM08 qua annotation; mã ca chạy là DDV-THU-xx.
 * Các phép kiểm tra mô tả hành vi đúng: lỗi còn tồn tại sẽ làm ca kiểm thử thất bại.
 * Hết thời gian chờ, sản phẩm hết hàng hoặc API đổi cấu trúc là lỗi chuẩn bị kiểm thử;
 * các trường hợp này chưa đủ để kết luận website có lỗi chức năng.
 * Mỗi ca dùng phiên khách mới. Không nhập thông tin khách hàng, thẻ hoặc OTP.
 * Chỉ sửa giỏ khách, đọc báo giá và xác nhận cấu hình trả góp đã được cho phép.
 * Dừng trước bước đặt đơn hoặc thanh toán cuối cùng.
 *
 * Chỉ chạy file này với một tiến trình kiểm thử, không tự chạy lại ca thất bại:
 * npx playwright test tests/23130318_TranThiMinhThu_TestScripts/23130318_TranThiMinhThu_ASM09.spec.ts --project=chromium --workers=1 --retries=0
 * Cấu hình mặc định trong playwright.config.ts lưu kết quả vào thư mục báo cáo nhóm.
 * Khi kiểm tra riêng, dùng --reporter=list --output=<thu-muc-tam> để lưu kết quả tạm.
 */

const ASM_BASE = 'https://didongviet.vn';
const asmBlockedWrites = new WeakMap<BrowserContext, string[]>();
const relatedTestcases: Record<string, string> = {
  '01': 'DDV_F13_021', '02': 'DDV_F13_018', '03': 'DDV_F13_019', '04': 'DDV_F13_018',
  '05': 'DDV_F14_026', '06': 'DDV_F14_019', '07': 'DDV_F14_029', '08': 'DDV_F15_028',
  '09': 'DDV_F15_023', '10': 'DDV_F13_018',
};

test.use({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
test.describe.configure({ mode: 'default', timeout: 120_000, retries: 0 });

async function asmGuard(context: BrowserContext) {
  const blocked: string[] = [];
  asmBlockedWrites.set(context, blocked);
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method());
    if (url.origin === ASM_BASE && write && /\/(?:orders?|leads?|loan-applications?|transactions?|payments?)(?:\/|$)/i.test(url.pathname)) {
      blocked.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    // Chặn dịch vụ theo dõi bên thứ ba; ảnh sản phẩm và logo thanh toán vẫn tải thật.
    if (/(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net|googleadservices\.com|facebook\.net|clarity\.ms|cdp\.asia)$/i.test(url.hostname)) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}

async function asmClick(control: Locator) {
  await expect(control).toBeVisible();
  await waitForHydration(control);
  await control.click();
}

async function asmOpenProduct(page: Page, url: string) {
  expect(new URL(url).origin).toBe(ASM_BASE);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `Không truy cập được sản phẩm: ${url}; lỗi chuẩn bị kiểm thử chưa được tính là lỗi chức năng`).toBeLessThan(400);
  await dismissCookies(page);
}

function asmMoney(text: string): number {
  const match = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*[đ₫]/i)
    ?? text.match(/[đ₫]\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/i);
  expect(match, `Không tìm thấy số tiền Việt Nam trong: ${text}`).not.toBeNull();
  return Number(match![1].replace(/[.,]/g, ''));
}

async function asmAttach(page: Page, name: string, data?: unknown): Promise<void> {
  await test.info().attach(`${name}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  if (data !== undefined) await test.info().attach(`${name}.json`, {
    body: Buffer.from(JSON.stringify(data, null, 2), 'utf8'), contentType: 'application/json',
  });
}

test.beforeEach(async ({ context }, info) => {
  await asmGuard(context);
  const number = info.title.match(/\[DDV-THU-(\d{2})\]/)?.[1];
  if (number) info.annotations.push(
    { type: 'defect', description: `DDV-THU-${number}` },
    { type: 'related-testcase', description: `${relatedTestcases[number]} (mở rộng)` },
  );
});
test.afterEach(async ({ page, context }, info) => {
  await context.setOffline(false);
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    await asmAttach(page, 'final-observation', { url: page.url(), text: await page.locator('body').innerText().catch(() => '') });
  }
  expect(asmBlockedWrites.get(context) ?? [], 'Ca kiểm thử đã cố gửi yêu cầu giao dịch cuối cùng ngoài phạm vi cho phép').toEqual([]);
});


// F13: viết theo minh chứng thực tế ngày 12/11/2026 trong ZIP bài nộp.
// Số tiền kỳ vọng lấy từ phản hồi hiện tại; không cố định theo giá trong ảnh cũ.
const f13Product = process.env.ASM09_INSTALLMENT_PRODUCT_URL ?? `${ASM_BASE}/dien-thoai/samsung-galaxy-a07-5g.html`;

function f13Logo(page: Page, name: string) {
    return page.locator('main button').filter({ has: page.getByRole('img', { name, exact: true }) });
}
function f13Table(page: Page) {
    return page.locator('main table').filter({ has: page.getByRole('cell', { name: 'Giá mua trả góp', exact: true }) });
}
function f13Row(page: Page, label: string) {
    return f13Table(page).getByRole('row').filter({ has: page.getByRole('cell', { name: label, exact: true }) });
}
function f13Objects(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) return value.flatMap(f13Objects);
    if (value && typeof value === 'object') {
        return [value as Record<string, unknown>, ...Object.values(value).flatMap(f13Objects)];
    }
    return [];
}
async function f13Open(page: Page, mode: 'company' | 'credit') {
    await asmOpenProduct(page, f13Product);
    const chooser = page.getByRole('dialog', { name: 'Chọn hình thức trả góp', exact: true });
    await asmClick(page.getByRole('button', { name: /^Trả góp 0%$/i }).first());
    await expect(chooser).toBeVisible();
    const name = mode === 'company' ? 'Trả góp qua công ty tài chính' : 'Trả góp qua thẻ tín dụng';
    await asmClick(chooser.getByRole('button').filter({ has: page.getByText(name, { exact: true }) }));
    await expect(page).toHaveURL(new RegExp(`/installment\\?method=${mode === 'company' ? 'OFFLINE' : 'ONLINE'}(?:&|$)`));
    if (mode === 'company') await expect(f13Table(page)).toBeVisible();
    else await expect(page.getByText('Chọn ngân hàng trả góp', { exact: true })).toBeVisible();
}
async function f13Select(page: Page, label: 'Số tháng' | 'Trả trước', value: number) {
    const trigger = page.getByText(label, { exact: true }).first().locator('xpath=..').getByRole('button');
    await asmClick(trigger);
    const id = await trigger.getAttribute('aria-controls');
    expect(id, `Không tìm thấy dropdown ${label}`).toBeTruthy();
    const popup = page.locator(`[id="${id}"]`);
    await expect(popup).toBeVisible();
    await asmClick(popup.getByRole('button', {
        name: label === 'Số tháng' ? new RegExp(`^${value} tháng$`) : new RegExp(`^${value}%\\s*\\(`),
    }));
    await expect(popup).toBeHidden();
    await expect(trigger).toHaveText(label === 'Số tháng' ? `${value} tháng` : `${value}%`);
}
async function f13ExpandBanks(page: Page) {
    const more = page.locator('main').getByRole('button', { name: 'Xem thêm', exact: true });
    if (await more.isVisible()) await asmClick(more);
}
async function f13BankNames(page: Page) {
    const names = await page.locator('main button img').evaluateAll(elements => elements.map(el => el.getAttribute('alt') ?? ''));
    return names.filter(name => name && !/\(Trả góp\)|^(Visa|Mastercard|JCB|American Express|AMEX)$/i.test(name));
}
function f13RequestData(response: Response): Record<string, unknown> {
    try { return response.request().postDataJSON() as Record<string, unknown>; }
    catch { return {}; }
}

test('[DDV-THU-01] F13 – Gốc + Lãi gồm tiền lãi của đúng báo giá Home Credit', async ({ page }) => {
    const [cartRequest] = await Promise.all([
        page.waitForRequest(request => new URL(request.url()).pathname === '/api/fe/carts/add' && request.method() === 'POST'),
        f13Open(page, 'company'),
    ]);
    const seed = cartRequest.postDataJSON() as Record<string, unknown>;
    await asmClick(f13Logo(page, 'Home Credit'));
    await f13Select(page, 'Số tháng', 4);
    await f13Select(page, 'Trả trước', 20);
    expect(seed.productId, 'Lấy mã sản phẩm từ chính lần thêm giỏ qua giao diện').toBeTruthy();
    expect(seed.productVariantId, 'Lấy mã phiên bản sản phẩm từ chính lần thêm giỏ qua giao diện').toBeTruthy();
    const input = {
        price: asmMoney(await f13Row(page, 'Giá mua trả góp').innerText()),
        productIds: [String(seed.productId)], productVariantIds: [String(seed.productVariantId)],
    };
    // Chỉ gọi API tính báo giá, giống bước đối chiếu trong minh chứng đã ghi nhận.
    const response = await page.request.post('https://didongviet.vn/api/fe/installment/calculate-all', { data: input });
    const data: unknown = await response.json();
    const company = f13Objects(data).find(value => value.gatewayId === 11 && Array.isArray(value.plans));
    const plan = f13Objects(company?.plans).find(value => Number(value.tenor) === 4 && Number(value.prepaidPercent) === 20);
    await asmAttach(page, 'DDV-THU-01-live-plan', { status: response.status(), input, plan, data });
    expect(response.ok(), 'calculate-all phải trả dữ liệu thật thành công').toBe(true);
    expect(plan, 'Dữ liệu hiện tại phải có Home Credit / 4 tháng / trả trước 20%; thiếu gói là thay đổi dữ liệu, chưa đủ để kết luận lỗi chức năng').toBeTruthy();
    expect(Number(plan!.totalInterest), 'Gói đối chứng cần có lãi dương').toBeGreaterThan(0);
    await expect.poll(async () => asmMoney(await f13Row(page, 'Góp mỗi tháng').innerText())).toBe(Number(plan!.monthlyPayment));
    const shown = asmMoney(await f13Row(page, 'Gốc + Lãi').innerText());
    const expected = Number(plan!.loanAmount) + Number(plan!.totalInterest);
    await asmAttach(page, 'DDV-THU-01-breakdown', { shown, expected, plan });
    expect(shown, 'Gốc + Lãi phải bằng loanAmount + totalInterest của cùng gói').toBe(expected);
});

test('[DDV-THU-02] F13 – OnePay hiển thị American Express khi VietBank có gói AE', async ({ page }) => {
    await f13Open(page, 'credit');
    const banksPromise = page.waitForResponse(response => /\/api\/fe\/installment\/19\/banks$/.test(new URL(response.url()).pathname));
    await asmClick(f13Logo(page, 'OnePay (Trả góp)'));
    const response = await banksPromise;
    const data: unknown = await response.json();
    await f13ExpandBanks(page);
    await asmClick(f13Logo(page, 'VietBank'));
    const bank = f13Objects(data).find(value => value.bankCode === 'BFTVVNVX' && Array.isArray(value.cards));
    const amex = f13Objects(bank?.cards).find(value => value.type === 'AE' && Array.isArray(value.times));
    const cardButtons = page.locator('main button').filter({ has: page.getByRole('img', { name: /^(Visa|Mastercard|JCB|American Express|AMEX|AE)$/i }) });
    const shownNames = await cardButtons.getByRole('img').evaluateAll(elements => elements.map(el => el.getAttribute('alt')));
    await asmAttach(page, 'DDV-THU-02-card-selector', { status: response.status(), bank, amex, shownNames });
    expect(response.ok(), 'Danh sách OnePay phải tải thành công').toBe(true);
    expect(amex, 'Chỉ đánh giá thiếu AE khi phản hồi ngân hàng hiện tại thực sự cung cấp AE').toBeTruthy();
    expect((amex!.times as unknown[]).length, 'AE phải có các gói trả góp khả dụng').toBeGreaterThan(0);
    // Đối chứng: cùng ngân hàng và sản phẩm phải tính được báo giá cho thẻ Visa.
    const visaPromise = page.waitForResponse(response => /\/api\/fe\/installment\/19\/loan-calculator$/.test(new URL(response.url()).pathname)
        && f13RequestData(response).bankCode === 'BFTVVNVX');
    await asmClick(f13Logo(page, 'Visa'));
    const visaResponse = await visaPromise;
    await expect(f13Table(page)).toBeVisible();
    await asmAttach(page, 'DDV-THU-02-visa-control', { status: visaResponse.status(), data: await visaResponse.json() });
    expect(visaResponse.ok(), 'Visa đối chứng của chính VietBank phải tính được báo giá').toBe(true);
    expect(shownNames.some(name => /^(American Express|AMEX|AE)$/i.test(name ?? '')),
        'Bộ chọn thẻ phải cung cấp AE/American Express có trong dữ liệu VietBank').toBe(true);
});

test('[DDV-THU-03] F13 – Payoo giữ bộ chọn ngân hàng sau khi chọn ACB', async ({ page }) => {
    await f13Open(page, 'credit');
    await asmClick(f13Logo(page, 'Payoo (Trả góp)'));
    await expect(f13Logo(page, 'ACB')).toBeVisible();
    await expect(f13Logo(page, 'BIDV')).toBeVisible();
    const before = await f13BankNames(page);
    await asmAttach(page, 'DDV-THU-03-before', { banks: before });
    const quotePromise = page.waitForResponse(response => /\/api\/fe\/installment\/20\/payoo-quote$/.test(new URL(response.url()).pathname)
        && f13RequestData(response).bankCode === 'ACB');
    await asmClick(f13Logo(page, 'ACB'));
    const response = await quotePromise;
    const quote: unknown = await response.json();
    await expect(f13Table(page)).toBeVisible();
    const afterSelect = await f13BankNames(page);
    await asmAttach(page, 'DDV-THU-03-after-ACB', { banks: afterSelect, quote, status: response.status() });
    const search = page.getByPlaceholder('Tìm tên ngân hàng', { exact: true });
    await search.fill('BIDV');
    await asmAttach(page, 'DDV-THU-03-search-BIDV', { banks: await f13BankNames(page) });
    await search.fill('');
    const afterClear = await f13BankNames(page);
    await asmAttach(page, 'DDV-THU-03-search-cleared', { banks: afterClear });
    // Đối chứng: đổi cổng trả góp khôi phục danh sách ngân hàng từ dữ liệu thật.
    await asmClick(f13Logo(page, 'Kim Ngân (Trả góp)'));
    await asmClick(f13Logo(page, 'Payoo (Trả góp)'));
    await expect(f13Logo(page, 'BIDV')).toBeVisible();
    const restored = await f13BankNames(page);
    await asmAttach(page, 'DDV-THU-03-provider-control', { banks: restored });
    expect(response.ok(), 'Báo giá ACB phải thành công; lỗi mạng chưa chứng minh được lỗi chức năng này').toBe(true);
    expect(afterClear, 'Chọn ACB rồi xóa tìm kiếm phải tiếp tục cho phép chọn BIDV').toContain('BIDV');
    expect(afterSelect, 'Ngân hàng ACB đã chọn phải còn được thể hiện trong bộ chọn').toContain('ACB');
});

test('[DDV-THU-04] F13 – SHB không được xác nhận bằng báo giá Sacombank còn cũ', async ({ page }) => {
    await f13Open(page, 'credit');
    const banksPromise = page.waitForResponse(response => /\/api\/fe\/installment\/19\/banks$/.test(new URL(response.url()).pathname));
    await asmClick(f13Logo(page, 'OnePay (Trả góp)'));
    await banksPromise;
    await f13ExpandBanks(page);
    await asmClick(f13Logo(page, 'Sacombank'));
    const oldPromise = page.waitForResponse(response => /\/api\/fe\/installment\/19\/loan-calculator$/.test(new URL(response.url()).pathname)
        && f13RequestData(response).bankCode === 'SACLVNVX');
    await asmClick(f13Logo(page, 'Visa'));
    const oldResponse = await oldPromise;
    const oldData: unknown = await oldResponse.json();
    await expect(f13Table(page)).toBeVisible();
    const oldPlan = f13Objects(oldData).find(value => Number(value.month) === 3 && value.totalAmount !== undefined);
    await asmAttach(page, 'DDV-THU-04-Sacombank-ready', { data: oldData });
    expect(oldResponse.ok(), 'Báo giá Sacombank đối chứng phải tải thành công').toBe(true);
    expect(oldPlan, 'Sacombank hiện tại phải hỗ trợ kỳ hạn 3 tháng').toBeTruthy();
    await asmClick(page.locator('main').getByRole('button', { name: '3 tháng', exact: true }));
    await expect.poll(async () => asmMoney(await f13Row(page, 'Trả mỗi tháng').innerText())).toBe(Number(oldPlan!.amountByMonth));

    // Giữ ổn định khoảng thời gian đang chờ báo giá để tái hiện lỗi.
    // Lấy phản hồi SHB thật rồi trì hoãn việc chuyển về giao diện;
    // không sửa số tiền hoặc ngân hàng trong phản hồi.
    // Các lần ghi minh chứng ban đầu dùng độ trễ mạng tự nhiên.
    let releaseHeld: () => void = () => {};
    const gate = new Promise<void>(resolve => { releaseHeld = resolve; });
    let heldReady = false;
    let routeFailure: string | undefined;
    let newData: unknown;
    let fulfillFinished: Promise<void> = Promise.resolve();
    let finishFulfill: () => void = () => {};
    fulfillFinished = new Promise<void>(resolve => { finishFulfill = resolve; });
    const quoteUrl = '**/api/fe/installment/19/loan-calculator';
    await page.route(quoteUrl, async route => {
        const input = route.request().postDataJSON() as Record<string, unknown>;
        if (input.bankCode !== 'SHBAVNVX' || input.methodCode !== 'VISA') { await route.fallback(); return; }
        try {
            const original = await route.fetch();
            expect(original.ok(), 'Báo giá SHB thật phải thành công').toBe(true);
            newData = await original.json();
            heldReady = true;
            await gate;
            await route.fulfill({ response: original });
        } catch (error) {
            routeFailure = String(error);
            heldReady = true;
            await route.abort().catch(() => {});
        } finally { finishFulfill(); }
    });
    try {
        await asmClick(f13Logo(page, 'SHB'));
        await asmClick(f13Logo(page, 'Visa'));
        await expect.poll(() => heldReady, { timeout: 30_000, message: 'Phải nhận được báo giá SHB thật để kiểm tra lúc giao diện đang chờ phản hồi' }).toBe(true);
        await asmAttach(page, 'DDV-THU-04-quote-route', { routeFailure, originalSHBResponse: newData });
        expect(routeFailure, 'Không được tính lỗi lấy hoặc chuyển tiếp phản hồi thành lỗi chức năng ngân hàng').toBeUndefined();
        const confirm = page.getByRole('button', { name: /^XÁC NHẬN TRẢ GÓP$/i });
        const enabledWhilePending = await confirm.isEnabled();
        await asmAttach(page, 'DDV-THU-04-SHB-pending', { enabledWhilePending, originalSHBResponse: newData });
        // Chỉ xác nhận cấu hình trả góp đã được cho phép; không gửi đơn hàng.
        if (enabledWhilePending) {
            await confirm.click();
            await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
        }
        releaseHeld();
        await fulfillFinished;
        if (!enabledWhilePending) {
            await expect.poll(async () => asmMoney(await f13Row(page, 'Trả mỗi tháng').innerText()))
                .toBe(Number(f13Objects(newData).find(value => Number(value.month) === 3)?.amountByMonth));
            await expect(confirm).toBeEnabled();
            await asmClick(confirm);
            await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
        }
        // Dùng cùng khoảng quan sát như minh chứng trang thanh toán đã ghi nhận.
        await page.waitForTimeout(2_000);
        const config = await page.evaluate(() => {
            const raw = localStorage.getItem('ddv-checkout');
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed.state ?? parsed).installmentData;
        });
        const correct = f13Objects(newData).find(value => Number(value.month) === 3 && value.totalAmount !== undefined);
        await asmAttach(page, 'DDV-THU-04-checkout-after-response', { enabledWhilePending, config, correct, originalSHBResponse: newData });
        expect.soft(enabledWhilePending, 'Nút xác nhận phải bị khóa khi đang chờ báo giá SHB').toBe(false);
        expect(config, 'Trang thanh toán cần có cấu hình trả góp').toBeTruthy();
        expect(config.bankCode).toBe('SHBAVNVX');
        expect(config.cardType).toBe('VISA');
        expect(correct, 'Báo giá SHB hiện tại cần gói 3 tháng').toBeTruthy();
        expect(config.monthlyPayment, 'Khoản góp phải thuộc SHB, không phải Sacombank').toBe(Number(correct!.amountByMonth));
        expect(config.totalAmount, 'Tổng tiền phải thuộc cùng báo giá SHB').toBe(Number(correct!.totalAmount));
        expect(config.totalInterestAndFee).toBe(Number(correct!.fee));
    } finally {
        releaseHeld();
        await page.unroute(quoteUrl);
    }
});


async function f14Checkout(page: Page, product: string) {
  await asmOpenProduct(page, product);
  await asmClick(page.getByRole('button', { name: /^MUA NGAY$/i }).first());
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
  await dismissCookies(page);
  await expect(page.locator('#payment-change-btn')).toBeVisible();
}

test('[DDV-THU-05] F14 – tải lại phương thức thanh toán sau lỗi mạng', async ({ page, context }) => {
  const isMethods = (url: URL) => url.pathname === '/api/fe/payment-gateways' && url.searchParams.get('type') === 'PAYMENT';
  let failedURL = '';
  let requestCount = 0;
  // Chỉ gây lỗi mạng ở yêu cầu tải danh sách đầu tiên.
  // Các yêu cầu sau vẫn nhận phản hồi thật từ máy chủ.
  await context.route(isMethods, async route => {
    requestCount++;
    if (!failedURL) {
      failedURL = route.request().url();
      await route.abort('internetdisconnected');
    } else await route.continue();
  });
  // Màu mặc định của A07 4G trong minh chứng cũ có thể đã hết hàng.
  // Dùng sản phẩm còn hàng hoặc đặt đường dẫn qua ASM09_PAYMENT_PRODUCT_URL.
  await Promise.all([
    page.waitForEvent('requestfailed', { predicate: r => isMethods(new URL(r.url())) }),
    f14Checkout(page, process.env.ASM09_PAYMENT_PRODUCT_URL ?? `${ASM_BASE}/dien-thoai/samsung-galaxy-a07-5g.html`),
  ]);
  expect(failedURL, 'Phải gây lỗi đúng yêu cầu tải danh sách phương thức thanh toán đầu tiên').toBeTruthy();

  const controlResponse = await context.request.get(failedURL);
  expect(controlResponse.ok(), 'Yêu cầu đối chứng khi có mạng phải thành công').toBe(true);
  const controlBody = await controlResponse.json();
  const onlineMethods = controlBody.data?.data;
  expect(Array.isArray(onlineMethods), 'Cấu trúc phản hồi API phương thức thanh toán đã thay đổi').toBe(true);
  expect(onlineMethods.length).toBeGreaterThan(0);

  const observations: { reopen: number; radioCount: number; requestCount: number }[] = [];
  for (let reopen = 1; reopen <= 3; reopen++) {
    await openMethods(page);
    // Quan sát trong thời gian xác định sau khi hết trạng thái đang tải;
    // đây là bước quan sát giao diện, không phải chạy lại ca kiểm thử.
    await expect(paymentDialog(page).getByText(/đang tải/i)).toHaveCount(0);
    await page.waitForTimeout(1000);
    observations.push({ reopen, radioCount: await paymentDialog(page).getByRole('radio').count(), requestCount });
    await asmAttach(page, `DDV-THU-05-reopen-${reopen}`, { failedURL, onlineMethods, observations });
    await closeMethods(page);
  }
  // Vào lại trang thanh toán từ giỏ hiện tại để làm đối chứng.
  // Tải lại trực tiếp có thể mất lựa chọn và chuyển về giỏ hàng.
  await page.goto(`${ASM_BASE}/cart`, { waitUntil: 'domcontentloaded' });
  const cartBuy = page.getByRole('button', { name: /^MUA NGAY\s*\(1\)$/i }).filter({ visible: true }).first();
  await expect(cartBuy, 'Giỏ đối chứng phải giữ đúng sản phẩm đã chọn').toBeVisible();
  await Promise.all([
    page.waitForResponse(response => isMethods(new URL(response.url())) && response.ok()),
    asmClick(cartBuy),
  ]);
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
  await expect(page.locator('#payment-change-btn')).toContainText('Chuyển khoản ngân hàng');
  await openMethods(page);
  await expect(paymentDialog(page).getByRole('radio').first()).toBeVisible();
  await asmAttach(page, 'DDV-THU-05-reentry-control', { onlineMethodCount: onlineMethods.length, observations });
  expect(observations.some(o => o.radioCount > 0), 'Mở lại bộ chọn khi có mạng phải khôi phục danh sách thanh toán mà không cần tải lại trang').toBe(true);
});

test('[DDV-THU-06] F14 – COD tuân theo chính sách đơn từ 40 triệu', async ({ page, context }) => {
  const policy = await context.newPage();
  const policyURL = `${ASM_BASE}/chinh-sach-ban-hang.html`;
  const response = await policy.goto(policyURL, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), 'Phải truy cập được chính sách bán hàng đang công bố').toBeLessThan(400);
  await dismissCookies(policy);
  const policyParagraphs = await policy.locator('main p').allTextContents();
  const clause = policyParagraphs.find(text => /từ\s*40\s*(?:\(bốn mươi\)\s*)?triệu\s*trở lên/i.test(text)) ?? '';
  expect(clause, 'Điều khoản đơn từ 40 triệu đã thay đổi; cần đối chiếu lại báo cáo trước khi kết luận').toMatch(/từ\s*40\s*(?:\(bốn mươi\)\s*)?triệu\s*trở lên/i);
  expect(clause, 'Chỉ kết luận không nhất quán khi chính sách hiện tại quy định rõ phải thanh toán trước').toMatch(/chỉ chấp nhận hình thức thanh toán trước/i);
  await asmAttach(policy, 'DDV-THU-06-published-policy', { policyURL, clause });
  await policy.close();

  await f14Checkout(page, `${ASM_BASE}/dien-thoai/iphone-18-pro-max.html`);
  const total = await asmCheckoutTotal(page);
  expect(total, 'Đơn kiểm thử phải đạt ngưỡng từ 40 triệu theo chính sách').toBeGreaterThanOrEqual(40_000_000);
  await openMethods(page);
  const cod = asmPaymentMethod(page, 'Thanh toán khi nhận hàng');
  const available = await cod.count() > 0 && await cod.locator('input[type="radio"]').isEnabled();
  let saved = false;
  if (available) {
    await cod.click();
    await expect(cod).toHaveAttribute('aria-checked', 'true');
    await paymentDialog(page).getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(paymentDialog(page)).toBeHidden();
    saved = (await page.locator('#payment-change-btn').innerText()).includes('Thanh toán khi nhận hàng');
  }
  await asmAttach(page, 'DDV-THU-06-COD-over-threshold', { total, policyURL, clause, available, saved });
  expect(available && saved, 'Trang thanh toán không được cho lưu COD nếu chính sách yêu cầu đơn hàng phải thanh toán trước').toBe(false);
});


// F15: chỉ thao tác giỏ và xem trang thanh toán; không nhấn ĐẶT HÀNG/ĐẶT MUA TRẢ GÓP.
const f15Base = 'https://didongviet.vn';
const f15A07 = `${f15Base}/dien-thoai/samsung-galaxy-a07-5g.html`;

function f15CartRows(page: Page): Locator {
  return page.locator('main div.rounded-xl').filter({
    has: page.getByRole('button', { name: 'Xóa sản phẩm', exact: true }),
  }).filter({ has: page.getByRole('button', { name: 'Tăng số lượng', exact: true }) });
}
function f15Quantity(row: Locator): Locator {
  return row.getByRole('button', { name: 'Tăng số lượng', exact: true }).locator('xpath=../span');
}
function f15CartBuy(page: Page): Locator {
  return page.getByRole('button', { name: /^MUA NGAY\s*\(\d+\)$/i }).filter({ visible: true }).first();
}
function f15CheckoutOrder(page: Page): Locator {
  return page.getByRole('region', { name: 'Sản phẩm trong đơn hàng', exact: true });
}
async function f15CartReady(page: Page): Promise<void> {
  await page.getByRole('heading', { name: 'Giỏ hàng của bạn', exact: true }).waitFor();
  await expect(f15CartRows(page).first()).toBeVisible();
  await expect(f15Quantity(f15CartRows(page).first())).toHaveText(/^\d+$/);
}
async function f15Mutation(page: Page, path: string, method: string, action: () => Promise<unknown>): Promise<void> {
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === path && r.request().method() === method),
    action(),
  ]);
  expect(response.ok(), `${method} ${path}: HTTP ${response.status()}`).toBeTruthy();
}
async function f15Add(page: Page): Promise<void> {
  await f15Mutation(page, '/api/fe/carts/add', 'POST', () =>
    asmClick(page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).first()));
}
async function f15OpenCart(page: Page): Promise<void> {
  await asmClick(page.getByRole('link', { name: 'Giỏ hàng', exact: true }).first());
  await expect(page).toHaveURL(/\/cart(?:[/?#]|$)/);
  await f15CartReady(page);
}
async function f15Totals(page: Page): Promise<{ total: number; saving: number }> {
  // Thanh tổng tiền cố định có cùng cấu trúc ở giỏ và trang thanh toán; chọn bản đang hiển thị.
  const cta = page.getByRole('button', { name: /^(?:MUA NGAY|ĐẶT HÀNG)\s*\(\d+\)$/i })
    .filter({ visible: true }).first();
  const moneyBox = cta.locator('xpath=../..').locator('div.items-end').filter({ visible: true }).first();
  const total = asmMoney(await moneyBox.locator(':scope > span').first().innerText());
  const savingLabel = moneyBox.getByText('Tiết kiệm', { exact: true });
  const saving = await savingLabel.count() ? asmMoney(await savingLabel.locator('xpath=..').innerText()) : 0;
  return { total, saving };
}
async function f15Snapshot(page: Page): Promise<Record<string, unknown>> {
  return {
    url: page.url(),
    main: await page.locator('main').innerText(),
    quantities: await page.getByRole('button', { name: 'Tăng số lượng', exact: true })
      .locator('xpath=../span').allTextContents(),
    checked: await page.locator('main input[type="checkbox"]').evaluateAll(es =>
      es.map(e => (e as HTMLInputElement).checked)),
    notices: await page.locator('[role="alert"], [role="status"]').allTextContents(),
  };
}

test('[DDV-THU-07] [DDV_F14_029 mở rộng] F14 – Bộ chọn thanh toán giữ focus trong panel', async ({ page }) => {
  await asmOpenProduct(page, f15A07);
  await f15Add(page);
  await f15OpenCart(page);
  await asmClick(f15CartBuy(page));
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
  await expect(page.locator('#payment-change-btn')).toContainText('Chuyển khoản ngân hàng');
  await asmClick(page.locator('#payment-change-btn'));
  const dialog = paymentDialog(page);
  await expect(dialog).toBeVisible();
  const focusRecords: { step: string; tag: string | null; id: string | null; text: string; inside: boolean }[] = [];
  async function record(step: string) {
    focusRecords.push(await dialog.evaluate((element, label) => ({
      step: label,
      tag: document.activeElement?.tagName ?? null,
      id: document.activeElement?.id ?? null,
      text: document.activeElement?.textContent?.trim() ?? '',
      inside: element.contains(document.activeElement),
    }), step));
  }
  await record('opened');
  for (let index = 1; index <= 5; index++) {
    await page.keyboard.press('Tab');
    await record(`Tab ${index}`);
  }
  await asmAttach(page, 'DDV-THU-07-focus-before-escape', { focusRecords });
  // Chỉ di chuyển focus; không kích hoạt bất kỳ nút nào phía sau panel.
  await page.keyboard.press('Escape');
  // Escape có hiệu ứng đóng; không dùng isVisible tức thời để kết luận không đóng.
  await expect(dialog).toBeHidden();
  await asmAttach(page, 'DDV-THU-07-after-escape', { focusRecords, dialogClosed: true });
  expect.soft(focusRecords[0].inside, 'Mở panel thanh toán phải chuyển focus vào panel').toBe(true);
  expect.soft(focusRecords.every(record => record.inside), 'Tab không được đi tới nội dung nền khi panel đang mở').toBe(true);
  await expect(page.locator('#payment-change-btn'), 'Đóng panel cần trả focus về nút mở').toBeFocused();
});

test('[DDV-THU-08] [DDV_F15_028 mở rộng] F15 – Quà tặng đã công bố được thể hiện trong giỏ và checkout', async ({ page }) => {
  const product = `${ASM_BASE}/dien-thoai/samsung-galaxy-a08.html`;
  const publishedGift = 'Tặng bộ sạc Samsung 25W kèm cáp Type-C to Type-C';
  await asmOpenProduct(page, product);
  const offer = page.getByText(publishedGift, { exact: true });
  await expect(offer, 'SETUP: sản phẩm cần đang công bố đúng quà tặng được kiểm tra').toBeVisible();
  const offerRow = await offer.locator('xpath=ancestor::li[1]').innerText();
  await asmAttach(page, 'DDV-THU-08-published-gift', { product, offerRow });
  const giftResponses: unknown[] = [];
  const pending: Promise<void>[] = [];
  const listener = (response: Response) => {
    if (new URL(response.url()).pathname === '/api/fe/carts/gifts') {
      pending.push((async () => {
        giftResponses.push({ url: response.url(), status: response.status(), body: await response.json() });
      })().catch(() => undefined));
    }
  };
  page.on('response', listener);
  try {
    await f15Add(page);
    await f15OpenCart(page);
    const giftButton = page.getByRole('button', { name: 'Xem quà tặng', exact: true });
    const cartCount = await giftButton.innerText();
    await asmClick(giftButton);
    let drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Quà tặng');
    const cartGiftText = await drawer.innerText();
    await asmAttach(page, 'DDV-THU-08-cart-gifts', { publishedGift, offerRow, cartCount, cartGiftText });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await asmClick(f15CartBuy(page));
    await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
    await expect(f15CheckoutOrder(page)).toContainText('Samsung Galaxy A08 64GB');
    const checkoutCount = await giftButton.innerText();
    await asmClick(giftButton);
    drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    const checkoutGiftText = await drawer.innerText();
    await Promise.all(pending);
    await asmAttach(page, 'DDV-THU-08-checkout-gifts', {
      product, publishedGift, offerRow, cartCount, cartGiftText, checkoutCount, checkoutGiftText, giftResponses,
    });
    // Chỉ đối chiếu thông tin ưu đãi, không suy luận về quà trong lần giao hàng thực tế.
    expect.soft(cartGiftText, 'Giỏ cần thể hiện bộ sạc đã được công bố cho sản phẩm').toMatch(/Samsung.*25W|25W.*Type.C/i);
    expect(checkoutGiftText, 'Checkout cần giữ thông tin quà tặng đã công bố').toMatch(/Samsung.*25W|25W.*Type.C/i);
  } finally {
    page.off('response', listener);
  }
});

test('[DDV-THU-09] F15 – Cập nhật số lượng thất bại phải có hoàn tác, phản hồi hoặc lưu lại sau nối mạng', async ({ page, context }) => {
  test.setTimeout(120_000);
  await asmOpenProduct(page, f15A07);
  await f15Add(page);
  await f15OpenCart(page);
  const row = f15CartRows(page).first();
  await expect(f15Quantity(row)).toHaveText('1');
  await expect(row.getByRole('button', { name: 'Tăng số lượng', exact: true }), 'Sản phẩm kiểm thử phải còn đủ hàng để tăng số lượng').toBeEnabled();
  const initial = { state: await f15Snapshot(page), totals: await f15Totals(page) };
  await asmAttach(page, 'DDV-THU-09-initial-online', initial);
  await page.evaluate(() => {
    const win = window as unknown as { f15Asm09Messages: string[]; f15Asm09Observer: MutationObserver };
    win.f15Asm09Messages = [];
    const collect = () => {
      for (const el of document.querySelectorAll('[role="alert"], [role="status"], [data-sonner-toast]')) {
        const text = el.textContent?.trim();
        if (text && !win.f15Asm09Messages.includes(text)) win.f15Asm09Messages.push(text);
      }
    };
    win.f15Asm09Observer = new MutationObserver(collect);
    win.f15Asm09Observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    collect();
  });
  let failure: { url: string; method: string; error: string | null } | undefined;
  let offlineQuantity = 0;
  let feedback: string[] = [];
  try {
    const failedRequest = page.waitForEvent('requestfailed', {
      predicate: request => request.method() === 'PUT' && new URL(request.url()).pathname === '/api/fe/carts/items/quantity',
      timeout: 20_000,
    });
    await context.setOffline(true);
    await asmClick(row.getByRole('button', { name: 'Tăng số lượng', exact: true }));
    const request = await failedRequest;
    failure = { url: request.url(), method: request.method(), error: request.failure()?.errorText ?? null };
    // Chờ lỗi mạng thật, sau đó theo dõi việc hoàn tác hoặc thông báo trong 8 giây.
    await page.waitForTimeout(8_000);
    offlineQuantity = Number(await f15Quantity(row).innerText());
    feedback = await page.evaluate(() =>
      (window as unknown as { f15Asm09Messages: string[] }).f15Asm09Messages.slice());
    await asmAttach(page, 'DDV-THU-09-failed-write-offline', {
      failure, offlineQuantity, feedback, state: await f15Snapshot(page), totals: await f15Totals(page),
    });
    await context.setOffline(false);
    await page.waitForTimeout(1_500);
    await asmAttach(page, 'DDV-THU-09-online-again', { feedback, state: await f15Snapshot(page), totals: await f15Totals(page) });
    feedback = await page.evaluate(() => {
      const win = window as unknown as { f15Asm09Messages: string[]; f15Asm09Observer: MutationObserver };
      win.f15Asm09Observer.disconnect();
      return win.f15Asm09Messages.slice();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await f15CartReady(page);
    const persisted = Number(await f15Quantity(f15CartRows(page).first()).innerText());
    await asmAttach(page, 'DDV-THU-09-server-after-reload', {
      failure, initial, offlineQuantity, persisted, feedback, state: await f15Snapshot(page), totals: await f15Totals(page),
    });
    expect(failure.error, 'Phải thực sự xảy ra mất mạng; không giả dữ liệu phản hồi').toMatch(/INTERNET_DISCONNECTED|OFFLINE/i);
    const warned = feedback.some(text => /mất (?:mạng|kết nối)|không có kết nối|thất bại|chưa lưu|đang chờ|không thể cập nhật|thử lại|offline|network/i.test(text));
    expect(offlineQuantity === 1 || persisted === 2 || warned,
      'Không được hiển thị cập nhật như đã lưu rồi âm thầm mất thay đổi; cần rollback, đồng bộ lại hoặc cảnh báo').toBeTruthy();
  } finally {
    await context.setOffline(false);
    await page.evaluate(() => {
      (window as unknown as { f15Asm09Observer?: MutationObserver }).f15Asm09Observer?.disconnect();
    }).catch(() => undefined);
  }
});

test('[DDV-THU-10] [DDV_F13_018 mở rộng] F13 – Lỗi mạng báo giá không được kết luận thẻ không có gói phù hợp', async ({ page, context }) => {
  await f13Open(page, 'credit');
  const calculator = '/api/fe/installment/19/loan-calculator';
  const banks = page.waitForResponse(response => new URL(response.url()).pathname === '/api/fe/installment/19/banks' && response.ok());
  await asmClick(f13Logo(page, 'OnePay (Trả góp)'));
  await banks;
  await asmClick(f13Logo(page, 'Sacombank'));
  const noPlan = page.getByText('Không có gói trả góp phù hợp cho thẻ này.', { exact: true });
  const notices: string[] = [];
  const collectNotices = () => page.locator('[role="alert"], [role="status"], [data-sonner-toast]').allTextContents();
  let failedMessage = false;
  try {
    const failure = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === calculator });
    await context.setOffline(true);
    await asmClick(f13Logo(page, 'Visa'));
    const request = await failure;
    await expect(page.getByRole('button', { name: /^XÁC NHẬN TRẢ GÓP$/i })).toBeDisabled();
    // Chờ trạng thái tải kết thúc; thông báo lỗi có thể được sửa thành thông báo mạng.
    await page.waitForTimeout(1500);
    failedMessage = await noPlan.isVisible();
    notices.push(...await collectNotices());
    const input = request.postDataJSON() as Record<string, unknown>;
    const requestFailure = request.failure();
    await asmAttach(page, 'DDV-THU-10-offline-quote', { input, requestFailure, failedMessage, notices, main: await page.locator('main').innerText() });
    expect(requestFailure?.errorText, 'SETUP: phải quan sát được lỗi mạng thật').toMatch(/INTERNET_DISCONNECTED|OFFLINE/i);
    await context.setOffline(false);
    const control = await context.request.post(`${ASM_BASE}${calculator}`, { data: input });
    const controlBody = await control.json();
    expect(control.ok(), 'SETUP: cùng báo giá khi có mạng phải thành công').toBe(true);
    expect(Array.isArray(controlBody.data), 'SETUP: cần dữ liệu các gói thật từ OnePay').toBe(true);
    expect(controlBody.data.length, 'SETUP: thẻ được kiểm tra phải thực sự có gói trả góp').toBeGreaterThan(0);
    const recovery = page.waitForResponse(response => new URL(response.url()).pathname === calculator && response.ok());
    await asmClick(f13Logo(page, 'Visa'));
    const recovered = await recovery;
    await expect(f13Table(page)).toBeVisible();
    await asmAttach(page, 'DDV-THU-10-identical-online-control', { input, control: { status: control.status(), body: controlBody }, recovered: await recovered.json(), failedMessage, notices });
    // Cùng loại thẻ bấm lại khôi phục được: đây là lỗi thông báo sai, không phải lỗi không retry.
    expect(failedMessage, 'Lỗi kết nối chưa cho phép kết luận thẻ không có gói trả góp phù hợp').toBe(false);
  } finally {
    await context.setOffline(false);
  }
});
