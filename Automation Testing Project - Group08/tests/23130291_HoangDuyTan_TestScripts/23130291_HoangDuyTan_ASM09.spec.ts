import {test, expect, type Locator, type Page} from '@playwright/test';
import {
    openCheckout, openDeliveryPanel, chooseDelivery, choosePickup,
    openAddressPicker, chooseCity, chooseWard, fillStreet,
    saveAddressOnly, addressOpenButton, assertCheckoutSafe,
} from './checkout-helpers';


/**
 * ASSIGNMENT 9 – DEFECT HUNTING – 23130291_HoangDuyTan
 *
 * Put THIS ONE FILE beside the existing F07/F08/F09 specs and checkout-helpers.ts.
 * No new source folders/config and no changes to the existing 90 tests.
 *
 * These are hypotheses, NOT pre-confirmed defects. A failed assertion is only a
 * defect CANDIDATE. Manually reproduce it, exclude script/environment errors,
 * obtain real evidence and deduplicate by behavior/root cause before reporting.
 *
 * Read-only/product browsing, edits in guest forms, and synthetic INVALID
 * order IDs only; NEVER click the final checkout "ĐẶT HÀNG" button.
 * Stop if the production website starts responding HTTP 403 / access denied.
 * Run one probe at a time, headed, 1 worker and no retries.
 */


const HOME = 'https://didongviet.vn/';
const TRACKING = `${HOME}order-tracking`;
const PHONE = '0900000000'; // synthetic, not related to any real order
const ORDER_A = 'INVALID_XYZ_999';
const ORDER_B = 'INVALID_QA_CASE_B_2026';
const HCM = process.env.F08_CITY_A ?? 'Thành phố Hồ Chí Minh';
const HANOI = process.env.F08_CITY_B ?? 'Thành phố Hà Nội';
const WARD = process.env.F08_WARD_A ?? 'Phường Bến Thành';
const STREET = '12A Đường Kiểm Thử';


type Outcome = 'technical-error' | 'raw-route-error' | 'denied' | 'validation' | 'pending';


const recipient = (p: Page): Locator => p.getByRole('dialog').filter({
    has: p.getByRole('heading', {name: 'Thông tin giao hàng', exact: true}),
});
const storeDialog = (p: Page): Locator => p.getByRole('dialog').filter({
    has: p.getByRole('heading', {name: 'Danh sách cửa hàng', exact: true}),
});
const nameInput = (p: Page) => p.getByPlaceholder('Họ và tên', {exact: true});
const phoneInput = (p: Page) => p.getByPlaceholder(/Số điện thoại|SĐT/i).first();
const orderInput = (p: Page) => p.getByPlaceholder('VD: 10000001').first()
    .or(p.getByRole('textbox', {name: /mã đơn hàng/i}).first()).first();
const trackingPhone = (p: Page) => p.getByPlaceholder('SĐT khi đặt hàng').first()
    .or(p.getByRole('textbox', {name: /số điện thoại/i}).first()).first();
const searchButton = (p: Page) => p.getByRole('button', {name: /^Tra cứu ngay$/i}).first();


function note(text: string) {
    test.info().annotations.push({type: 'observation', description: text});
}


async function accessible(p: Page, url: string) {
    const response = await p.goto(url, {waitUntil: 'domcontentloaded', timeout: 45_000});
    test.skip(response?.status() === 403, 'ENVIRONMENT BLOCKED: HTTP 403; not a functional defect.');
    expect(response?.status(), `Không mở được ${new URL(url).pathname || '/'}; kiểm tra môi trường trước`).toBeLessThan(400);
}


async function checkout(p: Page): Promise<Page> {
    const current = await openCheckout(p);
    await openDeliveryPanel(current);
    await expect(recipient(current)).toBeVisible();
    return current;
}


async function tracking(p: Page) {
    try {
        await expect(orderInput(p)).toBeVisible({
            timeout: 15000
        });
    } catch {
        const bodyText = await p.locator('body')
            .innerText()
            .catch(() => '(Không đọc được body)');


        const diagnostic = [
            `URL: ${p.url()}`,
            `Title: ${await p.title().catch(() => '')}`,
            '=== PAGE CONTENT ===',
            bodyText.slice(0, 5000)
        ].join('\n');


        console.log('\n===== F09 PAGE DIAGNOSTIC =====');
        console.log(diagnostic);
        console.log('===== END DIAGNOSTIC =====\n');


        await test.info().attach('F09_page_diagnostic.txt', {
            body: Buffer.from(diagnostic, 'utf8'),
            contentType: 'text/plain'
        });


        test.skip(
            /403 Forbidden|Access Denied/i.test(bodyText),
            'Website từ chối truy cập; không phải defect nghiệp vụ'
        );


        throw new Error(
            'Không tìm thấy form tra cứu đơn hàng. ' +
            'Cần kiểm tra trang thực tế và screenshot trước khi tiếp tục.'
        );
    }


    await expect(trackingPhone(p)).toBeVisible();
    await expect(searchButton(p)).toBeVisible();
}


async function enterTracking(p: Page, code: string, phone = PHONE) {
    await orderInput(p).fill(code);
    await trackingPhone(p).fill(phone);
}


function hasTechnicalError(p: Page) {
    return p.getByText(/^Internal server error$/i).filter({visible: true});
}


function hasRawRouteError(p: Page) {
    return p.getByText(/^Cannot GET\b/i).filter({visible: true});
}


async function lookupState(p: Page): Promise<Outcome> {
    if ((await hasTechnicalError(p).count()) > 0) return 'technical-error';
    if ((await hasRawRouteError(p).count()) > 0) return 'raw-route-error';
    if (await p.getByText(/^Unauthorized$/i).filter({visible: true}).count()) return 'denied';
    if (await p.getByText(/không tìm thấy|không tồn tại|không hợp lệ|không khớp|bắt buộc|vui lòng nhập/i)
        .filter({visible: true}).count()) return 'validation';
    for (const field of [orderInput(p), trackingPhone(p)]) {
        const invalid = await field.evaluate((el: HTMLInputElement) =>
            !el.checkValidity() || el.getAttribute('aria-invalid') === 'true').catch(() => false);
        if (invalid) return 'validation';
    }
    return 'pending';
}


async function waitLookup(p: Page): Promise<Outcome> {
    await expect.poll(() => lookupState(p), {
        message: 'Cần quan sát được phản hồi từ form trước khi đánh giá',
        intervals: [300, 600, 1000], timeout: 13_000,
    }).not.toBe('pending');
    return lookupState(p);
}


async function expectNoOrderDetails(p: Page) {
    await expect(p.getByText(/Chi tiết đơn hàng|Thông tin đơn hàng/i)).toHaveCount(0);
}


async function assertSafeNegativeResponse(p: Page) {
    const state = await waitLookup(p);
    note(`Kết quả tra cứu mã tổng hợp: ${state}. Unauthorized = từ chối quyền, không chứng minh format validation.`);
    await expectNoOrderDetails(p);
    expect(state, 'Lộ thông báo lỗi kỹ thuật của website (cần xác minh lỗi server)').not.toBe('technical-error');
    expect(state, 'Lộ đường dẫn routing nội bộ Cannot GET').not.toBe('raw-route-error');
}


async function openStore(p: Page): Promise<Locator> {
    await choosePickup(p);
    const pane = recipient(p);
    await pane.getByText('Chọn cửa hàng gần nhất', {exact: true}).click();
    await expect(storeDialog(p)).toBeVisible();
    return storeDialog(p);
}




async function storeNames(p: Page): Promise<string[]> {
    const dlg = storeDialog(p);
    await expect(dlg).toBeVisible();


    const extract = (text: string): string[] =>
        [...text.matchAll(/(?:Cửa hàng\s+)?Di Động Việt[^\r\n]*/gi)]
            .map(match => match[0].replace(/\s+/g, ' ').trim())
            .filter(name => name.length > 15 && name.length < 150);


    // Có thể cửa hàng được render ngoài phần tử dialog.
    const readStores = async () => {
        const modalText = await dlg.innerText();
        const pageText = await p.locator('body').innerText();


        return [...new Set([
            ...extract(modalText),
            ...extract(pageText),
        ])];
    };


    // Chờ dữ liệu bất đồng bộ thay vì đọc ngay.
    let stores: string[] = [];


    for (let attempt = 0; attempt < 5; attempt++) {
        stores = await readStores();
        if (stores.length > 0) break;
        await p.waitForTimeout(1000);
    }


    if (stores.length === 0) {
        const modalText = await dlg.innerText();
        const pageText = await p.locator('body').innerText();


        console.log('===== MODAL =====');
        console.log(modalText);


        console.log('===== PAGE TEXT =====');
        console.log(pageText.slice(-8000));


        await test.info().attach('ASM09_store_page.txt', {
            body: Buffer.from(pageText, 'utf8'),
            contentType: 'text/plain',
        });
    }


    console.log('[ASM09] Stores found:', stores);


    return stores;
}




async function selectStore(p: Page, store: string) {
    const dlg = storeDialog(p);
    await expect(dlg.getByText(store, {exact: true}).first()).toBeVisible();
    await dlg.getByText(store, {exact: true}).first().click();
    const confirm = dlg.getByRole('button', {name: 'Xác nhận', exact: true});
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(dlg).toBeHidden();
    await expect(recipient(p).getByText(store, {exact: true}).first()).toBeVisible();
}


async function dismissStore(p: Page) {
    const dlg = storeDialog(p);
    await dlg.getByRole('button', {name: 'Đóng', exact: true}).first().click();
    await expect(dlg).toBeHidden();
    await expect(recipient(p)).toBeVisible();
}


async function openSavedStore(p: Page) {
    await recipient(p).getByText('Thay đổi', {exact: true}).first().click();
    await expect(storeDialog(p)).toBeVisible();
}


// Evidence is attached to the existing Playwright test-results/ output; no
// custom folder, no extra Playwright config, and no report overwrite required.
test.use({video: 'on', trace: 'on', screenshot: 'only-on-failure'});


test.describe('ASM09 TV3 | F07 F08 F09 | Defect hunting', () => {
    test.describe.configure({timeout: 180_000, retries: 0, mode: 'default'});


    test.beforeEach(async ({page}, info) => {
        const target = info.title.includes('| F09 |') ? TRACKING : HOME;
        await accessible(page, target);
    });


    test.afterEach(async ({page}, info) => {
        if (info.status === 'skipped' || page.isClosed()) return;
        const pathname = (() => {
            try {
                return new URL(page.url()).pathname;
            } catch {
                return '(unknown)';
            }
        })();
        const lines = [
            `Test: ${info.title}`,
            `Status: ${info.status}`,
            `Pathname: ${pathname}`,
            'CANDIDATE ONLY: failed test must be manually reproduced, checked for locator/fixture errors and deduplicated.',
            ...info.annotations.filter(a => a.type === 'observation').map(a => `Observation: ${a.description}`),
        ];
        await info.attach('ASM09_observation.txt', {
            body: Buffer.from(lines.join('\n'), 'utf8'), contentType: 'text/plain',
        });
        // Mask inputs, especially phone/name; no real orders/customer information.
        try {
            await info.attach('ASM09_UI_masked.png', {
                body: await page.screenshot({
                    fullPage: true,
                    mask: [page.locator('input, textarea')],
                    timeout: 12_000
                }), contentType: 'image/png',
            });
        } catch (error) {
            note(`Không chụp được screenshot: ${String(error).slice(0, 100)}`);
        }
    });


    // ====================== F07: ORDER / RECIPIENT FORM ======================


    test('ASM09_TV3_01 | F07 | Whitespace-only name cannot pass recipient validation', async ({page}) => {
        const p = await checkout(page);
        await nameInput(p).fill('       ');
        await phoneInput(p).fill(PHONE);
        await nameInput(p).press('Tab');
        const pane = recipient(p);
        const confirm = pane.getByRole('button', {name: 'Xác nhận', exact: true}).first();
        await expect(confirm).toBeVisible();
        if (await confirm.isEnabled()) await confirm.click(); // only confirms recipient, never purchase
        const paneStillOpen = await pane.isVisible().catch(() => false);
        const fieldInvalid = paneStillOpen ? await nameInput(p).evaluate((el: HTMLInputElement) =>
            !el.checkValidity() || el.getAttribute('aria-invalid') === 'true').catch(() => false) : false;
        const feedback = paneStillOpen ? await pane.getByText(/bắt buộc|không được để trống|vui lòng nhập/i)
            .filter({visible: true}).count() : 0;
        expect(paneStillOpen && (fieldInvalid || feedback > 0 || !(await confirm.isEnabled())),
            'Form đã chấp nhận tên chỉ có khoảng trắng hoặc thiếu cảnh báo bắt buộc').toBe(true);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_02 | F07 | Invalid phone after valid entry must be rejected', async ({page}) => {
        const p = await checkout(page);
        await nameInput(p).fill('Nguyễn Văn Kiểm Thử');
        await phoneInput(p).fill(PHONE);
        await phoneInput(p).fill('abc!');
        await phoneInput(p).press('Tab');
        const kept = await phoneInput(p).inputValue();
        const pane = recipient(p);
        const confirm = pane.getByRole('button', {name: 'Xác nhận', exact: true}).first();
        if (await confirm.isEnabled()) await confirm.click();
        const open = await pane.isVisible().catch(() => false);
        const invalid = open ? await phoneInput(p).evaluate((el: HTMLInputElement) =>
            !el.checkValidity() || el.getAttribute('aria-invalid') === 'true').catch(() => false) : false;
        const feedback = open ? await pane.getByText(/vui lòng|bắt buộc|không hợp lệ|không đúng|không được/i).filter({visible: true}).count() : 0;
        note(`Phone input after letters: length=${kept.length} (content redacted).`);
        expect(open && (invalid || feedback > 0 || !(await confirm.isEnabled())),
            'SĐT sau khi sửa thành không hợp lệ lại được xác nhận mà không bị chặn').toBe(true);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_03 | F07 | Changing city must clear former ward selection', async ({page}) => {
        const p = await checkout(page);
        await chooseDelivery(p);
        await openAddressPicker(p);
        await chooseCity(p, HCM);
        await chooseWard(p, WARD);
        await fillStreet(p, STREET);
        const cityLink = p.getByText(HCM, {exact: true}).first();
        await expect(cityLink).toBeVisible();
        await cityLink.click();
        const selector = p.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i);
        test.skip(!(await selector.isVisible()), 'UI không hỗ trợ chỉnh thành phố tại breadcrumb này; cần thực hiện manual.');
        await chooseCity(p, HANOI);
        await expect(p.getByPlaceholder(/Tìm kiếm Phường\/Xã/i)).toBeVisible();
        await expect(p.getByText(WARD, {exact: true})).toHaveCount(0);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_04 | F07 | 300-char Unicode street must not corrupt UI', async ({page}) => {
        const p = await checkout(page);
        await chooseDelivery(p);
        await openAddressPicker(p);
        await chooseCity(p, HCM);
        await chooseWard(p, WARD);
        const street = p.getByPlaceholder('Nhập số nhà, tên đường', {exact: true});
        const supplied = ('Đường Kiểm Thử 🍀 ').repeat(30).slice(0, 300);
        const before = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        await street.fill(supplied);
        await street.press('Tab');
        const actual = await street.inputValue();
        expect(actual.length).toBeGreaterThan(0);
        expect(supplied.startsWith(actual), 'Unicode bị biến đổi sai thứ tự sau khi nhập').toBe(true);
        const after = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        expect(after - before, 'Dữ liệu biên làm phát sinh tràn ngang giao diện').toBeLessThanOrEqual(8);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_05 | F07 | Leading zero must be preserved in phone input', async ({page}) => {
        const p = await checkout(page);
        await phoneInput(p).fill(PHONE);
        await phoneInput(p).press('Tab');
        const actual = await phoneInput(p).inputValue();
        expect(actual, 'Không được xóa số 0 đầu của số điện thoại').toBe(PHONE);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_06 | F07 | Harmless HTML in recipient name must not render markup', async ({page}) => {
        const p = await checkout(page);
        await nameInput(p).fill('<b>QA_NAME</b>');
        await nameInput(p).press('Tab');
        await expect(p.locator('b').filter({hasText: /^QA_NAME$/})).toHaveCount(0);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_07 | F07 | Address street can recover after clearing input', async ({page}) => {
        const p = await checkout(page);
        await chooseDelivery(p);
        await openAddressPicker(p);
        await chooseCity(p, HCM);
        await chooseWard(p, WARD);
        const street = p.getByPlaceholder('Nhập số nhà, tên đường', {exact: true});
        await street.fill(STREET);
        await street.fill('');
        await expect(street).toHaveValue('');
        await street.fill('24B Nguyễn Thị Minh Khai');
        await expect(street).toHaveValue('24B Nguyễn Thị Minh Khai');
        await assertCheckoutSafe(p);
    });


    // ======================== F08: DELIVERY / PICKUP =========================


    test('ASM09_TV3_08 | F08 | Store list must not auto-save without confirmation', async ({page}) => {
        const p = await checkout(page);
        const dlg = await openStore(p);
        const stores = await storeNames(p);
        expect(stores.length).toBeGreaterThan(0);
        await dlg.getByText(stores[0], {exact: true}).first().click();
        await expect(dlg.getByRole('button', {name: 'Xác nhận', exact: true})).toBeEnabled();
        await dismissStore(p);
        await expect(recipient(p).getByText('Chọn cửa hàng gần nhất', {exact: true})).toBeVisible();
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_09 | F08 | Saved store must survive cancelled alternative search', async ({page}) => {
        const p = await checkout(page);
        await openStore(p);
        const stores = await storeNames(p);
        expect(stores.length).toBeGreaterThan(0);
        await selectStore(p, stores[0]);
        await openSavedStore(p);
        const dlg = storeDialog(p);
        await dlg.getByPlaceholder('Tìm kiếm bằng tên đường', {exact: true}).fill('NOT_A_REAL_STREET_QA_2026');
        await expect(dlg.getByText(/Không tìm thấy cửa hàng phù hợp/i)).toBeVisible();
        await dismissStore(p);
        await expect(recipient(p).getByText(stores[0], {exact: true}).first()).toBeVisible();
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_10 | F08 | Empty store filter then reset must restore candidates', async ({page}) => {
        const p = await checkout(page);
        const dlg = await openStore(p);
        const stores = await storeNames(p);
        expect(stores.length).toBeGreaterThan(0);
        const search = dlg.getByPlaceholder('Tìm kiếm bằng tên đường', {exact: true});
        await search.fill('NOT_A_REAL_STREET_QA_2026');
        await expect(dlg.getByText(/Không tìm thấy cửa hàng phù hợp/i)).toBeVisible();
        await search.fill('');
        await expect(dlg.getByText(stores[0], {exact: true}).first()).toBeVisible();
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_11 | F08 | Delivery → pickup → delivery must restore address step', async ({page}) => {
        const p = await checkout(page);
        await chooseDelivery(p);
        await openAddressPicker(p);
        await chooseCity(p, HCM);
        await chooseWard(p, WARD);
        await fillStreet(p, STREET);
        await saveAddressOnly(p);
        await choosePickup(p);
        await expect(recipient(p).getByText('Chọn cửa hàng gần nhất', {exact: true})).toBeVisible();
        await p.getByRole('button', {name: /^Giao hàng tận nơi$/i}).first().click();
        const saved = await recipient(p).innerText();
        const button = await addressOpenButton(p).isVisible().catch(() => false);
        expect(button || saved.includes(STREET) || saved.includes(WARD),
            'Chế độ giao tận nơi không hiển thị địa chỉ đã lưu hoặc điều khiển chọn địa chỉ').toBe(true);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_12 | F08 | Chosen store must no longer be active delivery destination', async ({page}) => {
        const p = await checkout(page);
        await openStore(p);
        const stores = await storeNames(p);
        expect(stores.length).toBeGreaterThan(0);
        await selectStore(p, stores[0]);
        await p.getByRole('button', {name: /^Giao hàng tận nơi$/i}).first().click();
        await expect(addressOpenButton(p)).toBeVisible();
        const deliveryText = await recipient(p).innerText();
        expect(deliveryText.includes(`Nhận tại\n${stores[0]}`),
            'Đã chuyển sang giao tận nơi nhưng vẫn hiển thị điểm nhận cửa hàng như đích giao').toBe(false);
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_13 | F08 | Invalid city search then reset must restore city options', async ({page}) => {
        const p = await checkout(page);
        await chooseDelivery(p);
        await openAddressPicker(p);
        const search = p.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i);
        await search.fill(HCM);
        await expect(p.getByText(HCM, {exact: true}).last()).toBeVisible();
        await search.fill('ZXCV_TINH_THANH_QA_98765');
        await expect(p.getByText(HCM, {exact: true}).last()).toBeHidden();
        await search.fill(HCM);
        await expect(p.getByText(HCM, {exact: true}).last()).toBeVisible();
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_14 | F08 | Store selection remains possible after search reset', async ({page}) => {
        const p = await checkout(page);
        const dlg = await openStore(p);
        const stores = await storeNames(p);
        expect(stores.length).toBeGreaterThan(0);
        const search = dlg.getByPlaceholder('Tìm kiếm bằng tên đường', {exact: true});
        await search.fill('NO_STORE_MATCH_QA_999');
        await expect(dlg.getByText(/Không tìm thấy cửa hàng phù hợp/i)).toBeVisible();
        await search.fill('');
        await selectStore(p, stores[0]);
        await expect(recipient(p).getByText(stores[0], {exact: true}).first()).toBeVisible();
        await assertCheckoutSafe(p);
    });


    // ========================== F09: ORDER TRACKING ==========================


    test('ASM09_TV3_15 | F09 | Invalid synthetic order code must not show server exception', async ({page}) => {
        await tracking(page);
        await enterTracking(page, ORDER_A);
        await searchButton(page).click();
        await assertSafeNegativeResponse(page);
    });


    test('ASM09_TV3_16 | F09 | Oversized order code must not show server exception', async ({page}) => {
        await tracking(page);
        await enterTracking(page, 'X'.repeat(200));
        await searchButton(page).click();
        await assertSafeNegativeResponse(page);
        note('Chỉ báo defect riêng ASM09_15 nếu hành vi/nguồn lỗi có bản chất khác, không chia một Internal server error thành nhiều bug.');
    });


    test('ASM09_TV3_17 | F09 | HTML order code must not render markup or expose raw route', async ({page}) => {
        await tracking(page);
        await enterTracking(page, '<b>TEST</b>');
        await searchButton(page).click();
        const state = await waitLookup(page);
        note(`Phản hồi với markup vô hại: ${state}. Nếu trùng server-error ASM09_15, KHÔNG lập defect mới.`);
        await expect(page.locator('b').filter({hasText: /^TEST$/})).toHaveCount(0);
        await expectNoOrderDetails(page);
        expect(state, 'Cannot GET lộ đường dẫn kỹ thuật/routing').not.toBe('raw-route-error');
        expect(state, 'Internal server error là lỗi server, không phải validation').not.toBe('technical-error');
    });


    test('ASM09_TV3_18 | F09 | Whitespace-only order code must not trigger valid lookup', async ({page}) => {
        await tracking(page);
        await enterTracking(page, '   ');
        await searchButton(page).click();
        await expectNoOrderDetails(page);
        await expect(hasTechnicalError(page)).toHaveCount(0);
        await page.waitForTimeout(750); // allow async page feedback without repeated requests
        await expect(hasTechnicalError(page)).toHaveCount(0);
        const param = new URL(page.url()).searchParams.get('orderId');
        expect((param ?? '').trim(), 'Không được gửi orderId có nội dung khác rỗng khi chỉ nhập khoảng trắng').toBe('');
    });


    test('ASM09_TV3_19 | F09 | Overlong phone is constrained or rejected without order disclosure', async ({page}) => {
        await tracking(page);
        const invalidPhone = '090123456789'; // 12 synthetic digits
        await enterTracking(page, ORDER_A, invalidPhone);
        const kept = await trackingPhone(page).inputValue();
        if (kept.length <= 10) {
            expect(invalidPhone.startsWith(kept), 'Cắt SĐT phải giữ nguyên thứ tự các chữ số đầu').toBe(true);
            note(`Input length policy truncated ${invalidPhone.length} digits to ${kept.length}; backend validation NOT tested.`);
            return;
        }
        await searchButton(page).click();
        await assertSafeNegativeResponse(page);
    });


    test('ASM09_TV3_20 | F09 | Two tracking tabs keep independent unsent form data', async ({page, context}) => {
        await tracking(page);
        await enterTracking(page, ORDER_A);
        const second = await context.newPage();
        try {
            await accessible(second, TRACKING);
            await tracking(second);
            await enterTracking(second, ORDER_B);
            await expect(orderInput(page)).toHaveValue(ORDER_A);
            await expect(orderInput(second)).toHaveValue(ORDER_B);
            await expectNoOrderDetails(page);
            await expectNoOrderDetails(second);
        } finally {
            await second.close();
        }
    });


    test('ASM09_TV3_21 | F09 | Input remains editable after unsuccessful lookup', async ({page}) => {
        await tracking(page);
        await enterTracking(page, ORDER_A);
        await searchButton(page).click();
        const state = await waitLookup(page);
        note(`Phản hồi đầu tiên: ${state}; test này CHỈ kiểm tra form sửa tiếp sau lỗi.`);
        await orderInput(page).fill(ORDER_B);
        await expect(orderInput(page)).toHaveValue(ORDER_B);
        await expectNoOrderDetails(page);
    });


    test('ASM09_TV3_22 | F09 | Tracking type tab changes without auto-submission', async ({page}) => {
        await tracking(page);
        const order = page.getByRole('button', {name: 'Đơn hàng', exact: true}).first()
            .or(page.getByRole('tab', {name: 'Đơn hàng', exact: true}).first()).first();
        const deposit = page.getByRole('button', {name: 'Đơn đặt cọc', exact: true}).first()
            .or(page.getByRole('tab', {name: 'Đơn đặt cọc', exact: true}).first()).first();
        await expect(order).toBeVisible();
        await expect(deposit).toBeVisible();
        const signature = async () => deposit.evaluate(el => {
            const css = getComputedStyle(el);
            return JSON.stringify({
                className: el.className, selected: el.getAttribute('aria-selected'),
                dataState: el.getAttribute('data-state'), bg: css.backgroundColor, color: css.color,
                fontWeight: css.fontWeight
            });
        });
        const before = await signature();
        await deposit.click();
        await expect.poll(signature, {timeout: 7_000}).not.toBe(before);
        await order.click();
        expect(new URL(page.url()).searchParams.has('orderId'), 'Đổi tab không được tự gọi tra cứu').toBe(false);
        await expectNoOrderDetails(page);
    });


// ================= ASM09 ADVANCED: F07 =================


    test('ASM09_TV3_23 | F07 | Empty phone after valid name must block confirmation', async ({page}) => {
        const p = await checkout(page);
        const pane = recipient(p);


        await nameInput(p).fill('Nguyễn Văn Kiểm Thử');
        await phoneInput(p).fill(PHONE);
        await phoneInput(p).fill('');
        await nameInput(p).click();


        const confirm = pane.getByRole('button', {
            name: 'Xác nhận', exact: true
        }).first();


        if (await confirm.isEnabled()) await confirm.click();


        await expect(pane).toBeVisible();
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_24 | F07 | Unicode phone must be normalized or rejected', async ({page}) => {
        const p = await checkout(page);
        const pane = recipient(p);


        await nameInput(p).fill('Nguyễn Văn Kiểm Thử');
        await phoneInput(p).fill('０９０１２３４５６７');
        await phoneInput(p).press('Tab');


        const kept = await phoneInput(p).inputValue();
        const normalized = '0901234567';


        if (kept === normalized) {
            note('Unicode digits were normalized to ASCII.');
        } else {
            const confirm = pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first();


            if (await confirm.isEnabled()) await confirm.click();
            await expect(pane).toBeVisible();
        }


        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_25 | F07 | Recipient phone exceeding 10 digits must not be accepted unchanged', async ({page}) => {
        const p = await checkout(page);
        const pane = recipient(p);


        await nameInput(p).fill('Nguyễn Văn Kiểm Thử');


        const supplied = '090123456789';
        await phoneInput(p).fill(supplied);
        await phoneInput(p).press('Tab');


        const actual = await phoneInput(p).inputValue();


        if (actual.length <= 10) {
            note(`Phone constrained to length ${actual.length}.`);
            expect(supplied.startsWith(actual)).toBe(true);
        } else {
            const confirm = pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first();


            if (await confirm.isEnabled()) await confirm.click();
            await expect(pane).toBeVisible();
        }


        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_26 | F07 | Saved recipient name must not render HTML markup', async ({page}) => {
        const p = await checkout(page);
        const pane = recipient(p);
        const marker = 'ASM09_SAFE_NAME_26';


        await nameInput(p).fill(`<b>${marker}</b>`);
        await phoneInput(p).fill(PHONE);


        const confirm = pane.getByRole('button', {
            name: 'Xác nhận', exact: true
        }).first();


        if (await confirm.isEnabled()) await confirm.click();


        await expect(
            p.locator('b').filter({hasText: marker})
        ).toHaveCount(0);


        note('Checked harmless markup after attempting to confirm recipient.');
        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_27 | F07 | Saved delivery address must remain available after mode switching', async ({page}) => {
        const p = await checkout(page);


        await chooseDelivery(p);
        await openAddressPicker(p);
        await chooseCity(p, HCM);
        await chooseWard(p, WARD);
        await fillStreet(p, STREET);
        await saveAddressOnly(p);


        await choosePickup(p);


        await recipient(p)
            .getByRole('button', {name: /^Giao hàng tận nơi$/i})
            .first()
            .click();


        await expect(recipient(p)).toBeVisible();


        const paneText = await recipient(p).innerText();


        if (!paneText.includes(STREET)) {
            await expect(addressOpenButton(p)).toBeVisible();
            await openAddressPicker(p);


            const savedInPicker =
                (await p.locator('body').innerText()).includes(STREET);


            expect(
                savedInPicker,
                'Địa chỉ đã lưu không còn hiển thị sau khi chuyển phương thức nhận'
            ).toBe(true);
        }


        await assertCheckoutSafe(p);
    });


// ================= ASM09 ADVANCED: F08 =================




    async function visibleStoreNames(
        p: Page,
        minimum = 1
    ): Promise<string[]> {
        const dlg = storeDialog(p);
        await expect(dlg).toBeVisible();


        let visibleNames: string[] = [];


        await expect.poll(async () => {
            const text = await p.locator('body').innerText();


            const candidates = [...new Set(
                text.split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line =>
                        /^Cửa hàng Di Động Việt\s+\S/i.test(line) &&
                        line.length < 120
                    )
            )];


            const found: string[] = [];


            for (const name of candidates) {
                const target = dlg
                    .getByText(name, {exact: true})
                    .first();


                if (await target.isVisible().catch(() => false)) {
                    found.push(name);
                }


                if (found.length >= minimum) break;
            }


            visibleNames = found;
            return visibleNames.length;
        }, {
            message: 'Chờ danh sách cửa hàng thực sự xuất hiện trong dialog',
            timeout: 20000,
            intervals: [500, 1000, 1500]
        }).toBeGreaterThanOrEqual(minimum);


        return visibleNames;
    }


    async function twoVisibleStores(
        p: Page
    ): Promise<[string, string]> {
        const names = await visibleStoreNames(p, 2);
        return [names[0], names[1]];
    }




    async function alternativeStore(
        p: Page,
        currentStore: string
    ): Promise<string> {
        const dlg = storeDialog(p);
        await expect(dlg).toBeVisible();


        // Danh sách mới phải được lấy sau khi mở lại modal.
        const names = await visibleStoreNames(p, 1);
        let other = names.find(name => name !== currentStore);


        if (!other) {
            // Thử tìm cửa hàng khác bằng tên đường.
            const search = dlg.getByPlaceholder(
                'Tìm kiếm bằng tên đường',
                {exact: true}
            );


            const query = currentStore.includes('Trần Não')
                ? 'Hàm Nghi'
                : 'Trần Não';


            await search.fill(query);


            const filtered = await visibleStoreNames(p, 1)
                .catch(() => []);


            other = filtered.find(name => name !== currentStore);
        }


        note(
            `Store A: ${currentStore}; ` +
            `alternative available: ${Boolean(other)}`
        );


        test.skip(
            !other,
            'Không có cửa hàng B khả dụng trong modal hiện tại; ' +
            'chưa thể kiểm tra thao tác A → B.'
        );


        return other!;
    }




    test('ASM09_TV3_28 | F08 | Confirmed store A to B must update active pickup store', async ({page}) => {
        const p = await checkout(page);


        await openStore(p);
        const [storeA, storeB] = await twoVisibleStores(p);


        await selectStore(p, storeA);
        await openSavedStore(p);
        await asm09ClearWardForRetest(p);
        const newStoreB = await alternativeStore(p, storeA);
        await selectStore(p, newStoreB);


        await expect(
            recipient(p).getByText(newStoreB, {exact: true}).first()
        ).toBeVisible();


        await expect(
            recipient(p).getByText(storeA, {exact: true})
        ).toHaveCount(0);


        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_29 | F08 | Selecting store B then cancelling must preserve confirmed store A', async ({page}) => {
        const p = await checkout(page);


        await openStore(p);
        const [storeA, storeB] = await twoVisibleStores(p);


        await selectStore(p, storeA);
        await openSavedStore(p);
        await asm09ClearWardForRetest(p);


        const newStoreB = await alternativeStore(p, storeA);
        const dlg = storeDialog(p);


        await dlg.getByText(
            newStoreB, {exact: true}
        ).first().click();


        await dismissStore(p);


        await expect(
            recipient(p).getByText(storeA, {exact: true}).first()
        ).toBeVisible();


        await expect(
            recipient(p).getByText(newStoreB, {exact: true})
        ).toHaveCount(0);


        await assertCheckoutSafe(p);
    });


    test('ASM09_TV3_30 | F08 | Store street search should be case insensitive', async ({page}) => {
        const p = await checkout(page);


        const dlg = await openStore(p);
        const [storeA] = await visibleStoreNames(p, 1);
        const terms = storeA.split(/\s+/).slice(-2).join(' ');
        const query = terms.toLowerCase();


        const search = dlg.getByPlaceholder(
            'Tìm kiếm bằng tên đường', {exact: true}
        );


        await search.fill(query);


        await expect(
            dlg.getByText(storeA, {exact: true}).first()
        ).toBeVisible();


        note(`Search query used lowercase street terms: ${query}`);
        await assertCheckoutSafe(p);
    });




    test('ASM09_TV3_31 | F08 | Store search should handle surrounding whitespace', async ({page}) => {
        const p = await checkout(page);
        const dlg = await openStore(p);


        const [storeA] = await visibleStoreNames(p, 1);


        const street = storeA
            .replace(/^Cửa hàng Di Động Việt\s+/i, '')
            .split(',')[0]
            .trim();


        const search = dlg.getByPlaceholder(
            'Tìm kiếm bằng tên đường',
            {exact: true}
        );


        const store = dlg.getByText(
            storeA, {exact: true}
        ).first();


        // Đối chứng: từ khóa bình thường tìm thấy cửa hàng.
        await search.fill(street);
        await expect(store).toBeVisible();


        note(`Baseline search succeeded: ${street}`);


        // Chỉ thay đổi khoảng trắng đầu/cuối.
        await search.fill(`  ${street}  `);




        // Đối chứng lần 2: thêm khoảng trắng đầu/cuối.
        const spacedQuery = `  ${street}  `;
        await search.fill(spacedQuery);


        // Chờ tối đa 6 giây để tránh kết luận sai
        // do debounce hoặc React chưa cập nhật danh sách.
        const foundWithSpaces = await store
            .waitFor({state: 'visible', timeout: 6000})
            .then(() => true)
            .catch(() => false);


        note(`Normal query: ${street}`);
        note(`Whitespace query matched: ${foundWithSpaces}`);


        if (!foundWithSpaces) {
            const modalText = await dlg.innerText();


            await test.info().attach(
                'ASM09_31_whitespace_evidence.txt',
                {
                    body: Buffer.from(
                        [
                            `Normal query: ${street}`,
                            `Query with spaces: "${spacedQuery}"`,
                            `Matched: ${foundWithSpaces}`,
                            '=== MODAL CONTENT ===',
                            modalText.slice(0, 2500)
                        ].join('\n'),
                        'utf8'
                    ),
                    contentType: 'text/plain'
                }
            );
        }


        // Kiểm tra ngược: bỏ khoảng trắng thì tìm lại được.
        await search.fill(street);
        await expect(store).toBeVisible();


        expect(
            foundWithSpaces,
            'Tên đường bình thường tìm được, nhưng thêm ' +
            'khoảng trắng đầu/cuối thì không tìm được.'
        ).toBe(true);


        await assertCheckoutSafe(p);
    });




    test('ASM09_TV3_32 | F08 | Closing filtered store dialog must allow a new search', async ({page}) => {
        const p = await checkout(page);


        const dlg = await openStore(p);


        await dlg.getByPlaceholder(
            'Tìm kiếm bằng tên đường', {exact: true}
        ).fill('NO_STORE_MATCH_ASM09_32');


        await expect(
            dlg.getByText(/Không tìm thấy cửa hàng phù hợp/i)
        ).toBeVisible();


        await dismissStore(p);
        await openStore(p);


        const search = storeDialog(p).getByPlaceholder(
            'Tìm kiếm bằng tên đường', {exact: true}
        );


        // Cho phép UI giữ từ khóa cũ, nhưng phải sửa được để tiếp tục tìm.
        await search.fill('Trần Não');


        await expect(
            storeDialog(p).getByText(
                /Di Động Việt Trần Não/i
            ).first()
        ).toBeVisible();


        await assertCheckoutSafe(p);
    });


// ================= ASM09 ADVANCED: F09 =================


    test('ASM09_TV3_33 | F09 | Empty tracking phone must not reveal order or server exception', async ({page}) => {
        await tracking(page);
        await enterTracking(page, ORDER_A, '');


        if (await searchButton(page).isEnabled()) {
            await searchButton(page).click();
        }


        await page.waitForTimeout(800);


        await expectNoOrderDetails(page);
        await expect(hasTechnicalError(page)).toHaveCount(0);
        await expect(hasRawRouteError(page)).toHaveCount(0);
    });


    test('ASM09_TV3_34 | F09 | Alphabetic phone input must not reveal order details', async ({page}) => {
        await tracking(page);
        await enterTracking(page, ORDER_A, 'abcXYZ');


        if (await searchButton(page).isEnabled()) {
            await searchButton(page).click();
        }


        await page.waitForTimeout(800);


        await expectNoOrderDetails(page);
        await expect(hasTechnicalError(page)).toHaveCount(0);
        await expect(hasRawRouteError(page)).toHaveCount(0);
    });


    test('ASM09_TV3_35 | F09 | Unicode order identifier must fail gracefully', async ({page}) => {
        await tracking(page);


        await enterTracking(page, 'ＭＡ－ＱＡ－２０２６');


        if (await searchButton(page).isEnabled()) {
            await searchButton(page).click();
        }


        await page.waitForTimeout(1000);


        const state = await lookupState(page);
        note(`Unicode order code state: ${state}.`);


        await expectNoOrderDetails(page);


        expect(
            state,
            'Không được hiển thị lỗi kỹ thuật với mã đơn Unicode'
        ).not.toBe('technical-error');


        expect(
            state,
            'Không được hiển thị Cannot GET với mã đơn Unicode'
        ).not.toBe('raw-route-error');
    });




    test(
        'ASM09_TV3_36 | F09 | Failed lookup in one tab must not affect another tab',
        async ({page, context}) => {
            await tracking(page);
            await enterTracking(page, ORDER_A);


            const other = await context.newPage();
            const navigations: string[] = [];


            other.on('framenavigated', frame => {
                if (frame === other.mainFrame()) {
                    navigations.push(frame.url());
                }
            });


            try {
                await accessible(other, TRACKING);
                await tracking(other);
                await enterTracking(other, ORDER_B);


                // Xác nhận tab B thực sự có dữ liệu.
                await expect(orderInput(other)).toHaveValue(ORDER_B);


                // Kiểm tra đối chứng khi chưa submit tab A.
                await page.waitForTimeout(1200);
                await expect(orderInput(other)).toHaveValue(ORDER_B);


                const urlBefore = other.url();


                // Chỉ tra cứu mã giả ở tab A.
                await searchButton(page).click();
                const state = await waitLookup(page);


                await expect(orderInput(other)).toBeVisible();


                const after = await orderInput(other).inputValue();
                const urlAfter = other.url();


                const diagnostic = [
                    `First tab result: ${state}`,
                    `Tab B value before: ${ORDER_B}`,
                    `Tab B value after: ${after}`,
                    `Tab B URL before: ${urlBefore}`,
                    `Tab B URL after: ${urlAfter}`,
                    `Tab B navigations: ${JSON.stringify(navigations)}`
                ].join('\n');


                console.log('\n===== ASM09 CROSS-TAB =====');
                console.log(diagnostic);
                console.log('===== END CROSS-TAB =====\n');


                await test.info().attach(
                    'ASM09_36_cross_tab.txt',
                    {
                        body: Buffer.from(diagnostic, 'utf8'),
                        contentType: 'text/plain'
                    }
                );


                await test.info().attach(
                    'ASM09_36_other_tab.png',
                    {
                        body: await other.screenshot({
                            fullPage: true,
                            mask: [other.locator('input, textarea')]
                        }),
                        contentType: 'image/png'
                    }
                );


                expect(
                    after,
                    'Tra cứu ở tab A làm thay đổi mã đơn chưa gửi ở tab B'
                ).toBe(ORDER_B);


                await expectNoOrderDetails(other);
                await expect(hasTechnicalError(other)).toHaveCount(0);
                await expect(hasRawRouteError(other)).toHaveCount(0);
            } finally {
                await other.close();
            }
        }
    );




    // ============ ASM09 STAGE 3: F07 ============


    async function asm09SaveDeliveryAddress(
        p: Page,
        streetValue: string
    ) {
        await chooseDelivery(p);
        await openAddressPicker(p);
        await chooseCity(p, HCM);
        await chooseWard(p, WARD);
        await fillStreet(p, streetValue);
        await saveAddressOnly(p);


        await expect(recipient(p)).toBeVisible();
    }


    test(
        'ASM09_TV3_37 | F07 | Valid recipient data must be confirmed successfully',
        async ({ page }) => {
            const p = await checkout(page);
            const name = 'Nguyễn Văn Kiểm Thử';


            await asm09SaveDeliveryAddress(p, STREET);


            await nameInput(p).fill(name);
            await phoneInput(p).fill(PHONE);


            await expect(nameInput(p)).toHaveValue(name);
            await expect(phoneInput(p)).toHaveValue(PHONE);


            const pane = recipient(p);
            const confirm = pane.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            }).first();


            await expect(confirm).toBeEnabled();


            // Chỉ xác nhận thông tin người nhận.
            // Tuyệt đối không nhấn nút ĐẶT HÀNG.
            await confirm.click();


            const stillOpen = await pane.isVisible()
                .catch(() => false);


            const body = await p.locator('body').innerText();


            note(
                `Recipient dialog still open: ${stillOpen}; ` +
                `name visible in page: ${body.includes(name)}`
            );


            // Kỳ vọng: hoàn tất xác nhận, không bị kẹt form.
            await expect(
                pane,
                'Đã nhập đủ dữ liệu hợp lệ nhưng form người nhận không đóng'
            ).toBeHidden({ timeout: 10000 });


            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_38 | F07 | Saved address survives repeated delivery mode switches',
        async ({ page }) => {
            const p = await checkout(page);


            await asm09SaveDeliveryAddress(p, STREET);


            // Thử chuyển chế độ liên tục ba lần.
            for (let i = 0; i < 3; i++) {
                await choosePickup(p);


                await recipient(p)
                    .getByRole('button', {
                        name: /^Giao hàng tận nơi$/i
                    })
                    .first()
                    .click();


                await expect(recipient(p)).toBeVisible();
            }


            const summary = await recipient(p).innerText();


            note(
                `Address visible after 3 switches: ` +
                `${summary.includes(STREET)}`
            );


            if (!summary.includes(STREET)) {
                // Nếu địa chỉ nằm trong bộ chọn thì phải
                // có cách mở lại và xem được địa chỉ.
                await expect(addressOpenButton(p)).toBeVisible();
                await openAddressPicker(p);


                await expect(
                    p.locator('body')
                ).toContainText(STREET);
            }


            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_39 | F07 | Saved street data must not render HTML markup',
        async ({ page }) => {
            const p = await checkout(page);


            const marker = 'ASM09_STREET_39';
            const street =
                `12A <b>${marker}</b> Đường Kiểm Thử`;


            await asm09SaveDeliveryAddress(p, street);


            // Không được biến dữ liệu tên đường
            // thành thẻ HTML thật trong trang.
            await expect(
                p.locator('b').filter({
                    hasText: marker
                })
            ).toHaveCount(0);


            const text = await recipient(p).innerText();


            note(
                `Street marker visible after save: ` +
                `${text.includes(marker)}`
            );


            // Chưa kết luận có lỗi lưu nếu website
            // chủ động từ chối ký tự HTML.
            await assertCheckoutSafe(p);
        }
    );




    // ===== ASM09 STAGE 4: POST-CONFIRM DISCOVERY =====


    test(
        'ASM09_TV3_40 | F07 | Inspect saved recipient editing controls',
        async ({ page }) => {
            const p = await checkout(page);
            const name = 'Nguyễn Văn Kiểm Thử';


            // Tận dụng helper đã chạy thành công ở test 37.
            await asm09SaveDeliveryAddress(p, STREET);


            await nameInput(p).fill(name);
            await phoneInput(p).fill(PHONE);


            const pane = recipient(p);
            await pane.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            }).first().click();


            await expect(pane).toBeHidden();


            // Thu thập danh sách các nút sau khi xác nhận.
            const buttons = await p.locator('button')
                .evaluateAll(elements =>
                    elements.map(el => ({
                        text: (el as HTMLElement).innerText
                            .replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, 100),
                        aria: el.getAttribute('aria-label'),
                        title: el.getAttribute('title')
                    }))
                );


            const relevant = buttons.filter(button =>
                /sửa|thay đổi|chỉnh|người nhận|giao hàng|địa chỉ|liên hệ/i
                    .test(
                        [
                            button.text,
                            button.aria,
                            button.title
                        ].join(' ').toLowerCase()
                    )
            );


            const body = await p.locator('body').innerText();
            const namePosition = body.indexOf(name);


            const recipientContext = namePosition >= 0
                ? body.slice(
                    Math.max(0, namePosition - 300),
                    namePosition + 600
                )
                : 'Không tìm thấy tên người nhận trong body';


            const report = [
                '=== CURRENT URL ===',
                p.url(),
                '=== RELEVANT BUTTONS ===',
                JSON.stringify(relevant, null, 2),
                '=== ALL BUTTONS ===',
                JSON.stringify(buttons, null, 2),
                '=== RECIPIENT CONTEXT ===',
                recipientContext
            ].join('\n');


            console.log(
                '\n===== ASM09 POST-CONFIRM UI =====\n' +
                report +
                '\n===== END UI =====\n'
            );


            await test.info().attach(
                'ASM09_40_post_confirm_UI.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            note(
                `Recipient saved; edit-related controls: ${relevant.length}`
            );


            await assertCheckoutSafe(p);
        }
    );




    // ========== ASM09 STAGE 5: F07 UPDATE / CANCEL ==========


    const ASM09_NAME_A = 'Nguyễn Văn Kiểm Thử';
    const ASM09_NAME_B = 'Trần Văn Thử Nghiệm';
    const ASM09_PHONE_B = '0910000000';


    // Thiết lập cùng một trạng thái ban đầu cho từng test.
    async function asm09PrepareSavedRecipient(p: Page) {
        await asm09SaveDeliveryAddress(p, STREET);


        await nameInput(p).fill(ASM09_NAME_A);
        await phoneInput(p).fill(PHONE);


        await recipient(p).getByRole('button', {
            name: 'Xác nhận',
            exact: true
        }).first().click();


        await expect(recipient(p)).toBeHidden();


        const summary = p.getByRole('button', {
            name: 'Chỉnh sửa địa chỉ nhận hàng'
        });


        await expect(summary).toContainText(ASM09_NAME_A);
        await expect(summary).toContainText(PHONE);


        return summary;
    }


    async function asm09OpenSavedRecipient(p: Page) {
        await p.getByRole('button', {
            name: 'Chỉnh sửa địa chỉ nhận hàng'
        }).click();


        await expect(recipient(p)).toBeVisible();


        return recipient(p);
    }


    test(
        'ASM09_TV3_41 | F07 | Updating recipient name must replace saved name',
        async ({page}) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            const pane = await asm09OpenSavedRecipient(p);


            // Xác minh form thực sự tải tên đã lưu.
            await expect(nameInput(p))
                .toHaveValue(ASM09_NAME_A);


            await nameInput(p).fill(ASM09_NAME_B);


            await pane.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            }).first().click();


            await expect(pane).toBeHidden();


            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            await expect(summary).toContainText(ASM09_NAME_B);
            await expect(summary).not.toContainText(ASM09_NAME_A);
            await expect(summary).toContainText(PHONE);


            note('Recipient name updated; phone retained.');
            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_42 | F07 | Updating phone must replace saved phone only',
        async ({page}) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            const pane = await asm09OpenSavedRecipient(p);


            await expect(phoneInput(p)).toHaveValue(PHONE);


            await phoneInput(p).fill(ASM09_PHONE_B);


            await pane.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            }).first().click();


            await expect(pane).toBeHidden();


            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            await expect(summary).toContainText(ASM09_PHONE_B);
            await expect(summary).not.toContainText(PHONE);
            await expect(summary).toContainText(ASM09_NAME_A);


            note('Recipient phone updated; name retained.');
            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_43 | F07 | Cancelling edits must retain saved recipient',
        async ({ page }) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            const pane = await asm09OpenSavedRecipient(p);


            // Sửa hai trường nhưng chưa xác nhận.
            await nameInput(p).fill(ASM09_NAME_B);
            await phoneInput(p).fill(ASM09_PHONE_B);


            await expect(nameInput(p)).toHaveValue(ASM09_NAME_B);
            await expect(phoneInput(p)).toHaveValue(ASM09_PHONE_B);


            // Nút Đóng đã được xác định trong log test 44.
            const close = pane.getByRole('button', {
                name: 'Đóng',
                exact: true
            });


            await expect(close).toBeVisible();
            await close.click();


            // Chờ modal đóng thực sự.
            await expect(pane).toBeHidden({ timeout: 10000 });


            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            // Bản lưu không được thay đổi khi nhấn Đóng.
            await expect(summary).toContainText(ASM09_NAME_A);
            await expect(summary).toContainText(PHONE);


            await expect(summary).not.toContainText(ASM09_NAME_B);
            await expect(summary).not.toContainText(ASM09_PHONE_B);


            // Mở lại để phát hiện trường hợp form giữ dữ liệu
            // chưa lưu dù phần hiển thị bên ngoài vẫn đúng.
            await asm09OpenSavedRecipient(p);


            await expect(nameInput(p)).toHaveValue(ASM09_NAME_A);
            await expect(phoneInput(p)).toHaveValue(PHONE);


            note('Cancel rollback checked in summary and reopened form.');
            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_44 | F07 | Inspect saved address editing controls',
        async ({page}) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            const pane = await asm09OpenSavedRecipient(p);


            const controls = await pane.locator('button')
                .evaluateAll(elements =>
                    elements.map(el => ({
                        text: (el as HTMLElement).innerText
                            .replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, 120),
                        aria: el.getAttribute('aria-label')
                    }))
                );


            const streetField = p.getByPlaceholder(
                'Nhập số nhà, tên đường',
                {exact: true}
            );


            const report = [
                '=== RECIPIENT EDIT CONTROLS ===',
                JSON.stringify(controls, null, 2),
                '=== ADDRESS INPUT ===',
                `Visible: ${await streetField.isVisible().catch(() => false)}`,
                '=== RECIPIENT DIALOG ===',
                (await pane.innerText()).slice(0, 3000)
            ].join('\n');


            console.log('\n===== ASM09 ADDRESS EDIT =====');
            console.log(report);
            console.log('===== END ADDRESS EDIT =====\n');


            await test.info().attach(
                'ASM09_44_address_edit_UI.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_45 | F07 | Inspect saved address change workflow',
        async ({ page }) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            const pane = await asm09OpenSavedRecipient(p);


            const change = pane.getByText(
                'Thay đổi',
                { exact: true }
            ).first();


            await expect(change).toBeVisible();
            await change.click();


            const dialogs = await p.getByRole('dialog')
                .allInnerTexts();


            const inputs = await p.locator('input')
                .evaluateAll(elements =>
                    elements
                        .filter(el => el.getClientRects().length > 0)
                        .map(el => ({
                            placeholder: el.placeholder,
                            name: el.name,
                            type: el.type,
                            // Không ghi lại thông tin cá nhân.
                            streetValue:
                                /Nhập số nhà, tên đường/i.test(el.placeholder)
                                    ? el.value
                                    : '[masked]'
                        }))
                );


            const controls = await p.locator('button')
                .evaluateAll(elements =>
                    elements
                        .filter(el => el.getClientRects().length > 0)
                        .map(el => ({
                            text: el.innerText.replace(/\s+/g, ' ').trim()
                                .slice(0, 100),
                            aria: el.getAttribute('aria-label')
                        }))
                        .filter(el =>
                            /địa chỉ|tỉnh|phường|xã|quay lại|đóng|lưu|xác nhận/i
                                .test(`${el.text} ${el.aria}`)
                        )
                );


            const report = [
                '=== ADDRESS CHANGE WORKFLOW ===',
                `URL: ${p.url()}`,
                '=== DIALOGS ===',
                JSON.stringify(dialogs, null, 2),
                '=== VISIBLE INPUTS ===',
                JSON.stringify(inputs, null, 2),
                '=== CONTROLS ===',
                JSON.stringify(controls, null, 2)
            ].join('\n');


            console.log('\n===== ASM09 ADDRESS CHANGE =====');
            console.log(report);
            console.log('===== END ADDRESS CHANGE =====\n');


            await test.info().attach(
                'ASM09_45_address_change.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_46 | F07 | Inspect alternate recipient workflow',
        async ({ page }) => {
            const p = await checkout(page);
            const pane = recipient(p);


            const trigger = pane.getByText(
                'Nhờ người khác nhận hàng',
                { exact: true }
            ).first();


            await expect(trigger).toBeVisible();


            const before = await pane.innerText();
            await trigger.click();
            const after = await pane.innerText();


            const visibleInputs = await pane.locator('input')
                .evaluateAll(elements =>
                    elements
                        .filter(el => el.getClientRects().length > 0)
                        .map(el => ({
                            placeholder: el.placeholder,
                            type: el.type,
                            name: el.name,
                            required: el.required
                        }))
                );


            const report = [
                '=== ALTERNATE RECIPIENT ===',
                `UI changed: ${before !== after}`,
                '=== VISIBLE INPUTS ===',
                JSON.stringify(visibleInputs, null, 2),
                '=== DIALOG CONTENT ===',
                after.slice(0, 3000)
            ].join('\n');


            console.log('\n===== ASM09 OTHER RECIPIENT =====');
            console.log(report);
            console.log('===== END OTHER RECIPIENT =====\n');


            await test.info().attach(
                'ASM09_46_other_recipient.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            await assertCheckoutSafe(p);
        }
    );




    // ===== ASM09 STAGE 6: ADDRESS + ALTERNATE RECIPIENT =====


    const ASM09_STREET_B = '24B Nguyễn Thị Minh Khai';
    const ASM09_RECEIVER_NAME = 'Trần Văn Thử Nghiệm';
    const ASM09_RECEIVER_PHONE = '0910000000';


    async function asm09OpenAddressEditor(p: Page) {
        const pane = recipient(p);
        await expect(pane).toBeVisible();


        await pane.getByText(
            'Thay đổi', { exact: true }
        ).first().click();


        const street = p.getByPlaceholder(
            'Nhập số nhà, tên đường',
            { exact: true }
        );


        await expect(street).toBeVisible();


        const dialog = p.getByRole('dialog')
            .filter({ has: street });


        await expect(dialog).toBeVisible();


        return { dialog, street };
    }




    test(
        'ASM09_TV3_47 | F07 | Editing saved street must update checkout summary',
        async ({ page }) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            await asm09OpenSavedRecipient(p);
            const { street } = await asm09OpenAddressEditor(p);


            await expect(street).toHaveValue(STREET);


            await street.fill(ASM09_STREET_B);
            await expect(street).toHaveValue(ASM09_STREET_B);


            await saveAddressOnly(p);


            const pane = recipient(p);
            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            // Hai trạng thái UI hợp lệ sau lưu:
            // 1. Form người nhận còn mở, đã cập nhật địa chỉ.
            // 2. Form đã đóng và checkout summary được cập nhật.
            await expect.poll(async () => {
                if (await pane.isVisible().catch(() => false)) {
                    if ((await pane.innerText()).includes(ASM09_STREET_B)) {
                        return 'updated';
                    }
                }


                if (await summary.isVisible().catch(() => false)) {
                    if ((await summary.innerText()).includes(ASM09_STREET_B)) {
                        return 'updated';
                    }
                }


                return 'pending';
            }, {
                message: 'Địa chỉ mới phải xuất hiện sau khi lưu',
                timeout: 15000
            }).toBe('updated');


            if (await pane.isVisible().catch(() => false)) {
                const confirm = pane.getByRole('button', {
                    name: 'Xác nhận',
                    exact: true
                }).first();


                if (await confirm.isVisible().catch(() => false)) {
                    await confirm.click();
                }
            }


            await expect(pane).toBeHidden();
            await expect(summary).toContainText(ASM09_STREET_B);
            await expect(summary).not.toContainText(STREET);


            // Mở lại cả form và bộ chọn địa chỉ để kiểm tra
            // giá trị mới có thật sự được giữ hay không.
            await asm09OpenSavedRecipient(p);
            const reopened = await asm09OpenAddressEditor(p);


            await expect(reopened.street).toHaveValue(ASM09_STREET_B);


            note('Address B persisted in summary and reopened editor.');
            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_48 | F07 | Closing address editor must discard unsaved street changes',
        async ({ page }) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            const pane = await asm09OpenSavedRecipient(p);
            const { dialog, street } = await asm09OpenAddressEditor(p);


            await expect(street).toHaveValue(STREET);


            // Sửa tên đường nhưng KHÔNG lưu.
            await street.fill(ASM09_STREET_B);


            const close = dialog.getByRole('button', {
                name: 'Đóng',
                exact: true
            }).first();


            await expect(close).toBeVisible();
            await close.click();


            await expect(dialog).toBeHidden();


            // Địa chỉ xác nhận trước đó phải được giữ nguyên.
            await expect(pane).toContainText(STREET);
            await expect(pane).not.toContainText(ASM09_STREET_B);


            // Mở lại để kiểm tra cả draft, không chỉ summary.
            const reopened = await asm09OpenAddressEditor(p);


            await expect(reopened.street).toHaveValue(STREET);


            note('Unsaved address edit discarded after closing editor.');
            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_49 | F07 | Alternate recipient requires recipient details',
        async ({ page }) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);


            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            await pane.getByText(
                'Nhờ người khác nhận hàng',
                { exact: true }
            ).first().click();


            const receiverName = pane.getByPlaceholder(
                'Họ và tên người nhận',
                { exact: true }
            );


            const receiverPhone = pane.getByPlaceholder(
                'Số điện thoại người nhận',
                { exact: true }
            );


            await expect(receiverName).toBeVisible();
            await expect(receiverPhone).toBeVisible();


            await expect(receiverName).toHaveValue('');
            await expect(receiverPhone).toHaveValue('');


            const confirm = pane.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            }).first();


            if (await confirm.isEnabled()) {
                await confirm.click();
            }


            await expect(
                pane,
                'Không được hoàn tất khi người nhận hộ thiếu thông tin'
            ).toBeVisible();


            const invalidName = await receiverName.evaluate(
                (el: HTMLInputElement) =>
                    !el.checkValidity() ||
                    el.getAttribute('aria-invalid') === 'true'
            );


            const invalidPhone = await receiverPhone.evaluate(
                (el: HTMLInputElement) =>
                    !el.checkValidity() ||
                    el.getAttribute('aria-invalid') === 'true'
            );


            const feedback = await pane.getByText(
                /vui lòng|bắt buộc|không được để trống|không hợp lệ/i
            ).filter({ visible: true }).count();


            const blocked = !(await confirm.isEnabled());


            note(
                `Alternate recipient validation: ` +
                `invalidName=${invalidName}, ` +
                `invalidPhone=${invalidPhone}, ` +
                `feedback=${feedback}, blocked=${blocked}`
            );


            expect(
                invalidName || invalidPhone ||
                feedback > 0 || blocked,
                'Form không hiển thị validation rõ ràng cho thông tin người nhận hộ'
            ).toBe(true);


            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_50 | F07 | Alternate recipient data persists after reopening',
        async ({ page }) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);


            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            await pane.getByText(
                'Nhờ người khác nhận hàng',
                { exact: true }
            ).first().click();


            const receiverName = pane.getByPlaceholder(
                'Họ và tên người nhận',
                { exact: true }
            );


            const receiverPhone = pane.getByPlaceholder(
                'Số điện thoại người nhận',
                { exact: true }
            );


            await receiverName.fill(ASM09_RECEIVER_NAME);
            await receiverPhone.fill(ASM09_RECEIVER_PHONE);


            await pane.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            }).first().click();


            await expect(pane).toBeHidden({ timeout: 10000 });


            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            await expect(summary).toBeVisible();


            note(
                `Recipient visible in summary: ` +
                `${(await summary.innerText()).includes(ASM09_RECEIVER_NAME)}`
            );


            await asm09OpenSavedRecipient(p);


            await expect(
                pane.getByPlaceholder(
                    'Họ và tên người nhận',
                    { exact: true }
                )
            ).toHaveValue(ASM09_RECEIVER_NAME);


            await expect(
                pane.getByPlaceholder(
                    'Số điện thoại người nhận',
                    { exact: true }
                )
            ).toHaveValue(ASM09_RECEIVER_PHONE);


            note('Alternate recipient data preserved after save and reopen.');
            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_51 | F07 | Changing saved city must invalidate old ward',
        async ({ page }) => {
            const p = await checkout(page);


            // Chuẩn bị địa chỉ đã lưu tại TP.HCM.
            await asm09PrepareSavedRecipient(p);
            await asm09OpenSavedRecipient(p);


            const { dialog, street } =
                await asm09OpenAddressEditor(p);


            await expect(street).toHaveValue(STREET);


            const selectedHeader = async () => {
                const text = await dialog.innerText();


                // Chỉ lấy phần đầu chứa địa chỉ đang chọn.
                // Không xét danh sách hàng trăm phường/xã bên dưới.
                return text.split('\n')
                    .map(line => line.trim())
                    .filter(Boolean)
                    .slice(0, 8)
                    .join('\n');
            };


            const before = await selectedHeader();


            expect(before).toContain(HCM);
            expect(before).toContain(WARD);






            // BƯỚC 1: Quay lại bước chọn Tỉnh/Thành phố.
            // Đây là bước bắt buộc vì modal đang ở màn hình nhập tên đường.
            const currentCityButton = dialog.getByRole('button', {
                name: HCM,
                exact: true
            });


            await expect(currentCityButton).toBeVisible();
            await currentCityButton.click();


            // BƯỚC 2: Tìm tỉnh mới trong đúng màn hình chọn tỉnh.
            const citySearch = dialog.getByPlaceholder(
                /Tìm kiếm Tỉnh\/Thành phố/i
            );


            await expect(citySearch).toBeVisible();


            await citySearch.fill(HANOI);


            // BƯỚC 3: Click đúng lựa chọn Hà Nội.
            // Không dùng .first()/.last() trên toàn trang.
            const cityOption = dialog.getByRole('button', {
                name: HANOI,
                exact: true
            });


            await expect(cityOption).toBeVisible({
                timeout: 10000
            });


            await cityOption.click({
                timeout: 10000
            });


            // BƯỚC 4: Kiểm tra tỉnh đã được cập nhật
            // và phường cũ không còn là lựa chọn đang áp dụng.
            await expect.poll(selectedHeader, {
                timeout: 10000
            }).toContain(HANOI);


            await expect.poll(selectedHeader, {
                timeout: 10000
            }).not.toContain(WARD);


            const after = await selectedHeader();


            const report = [
                '=== BEFORE CITY CHANGE ===',
                before,
                '=== AFTER CITY CHANGE ===',
                after
            ].join('\n');


            console.log('\n===== ASM09 CITY-WARD =====');
            console.log(report);
            console.log('===== END CITY-WARD =====\n');


            await test.info().attach(
                'ASM09_51_city_ward.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            expect(
                after,
                'Đã chọn Hà Nội nhưng địa chỉ không cập nhật tỉnh'
            ).toContain(HANOI);


            expect(
                after,
                'Đổi sang Hà Nội nhưng vẫn giữ Phường Bến Thành'
            ).not.toContain(WARD);


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_52 | F07 | Cannot save changed city without a new ward',
        async ({ page }) => {
            const p = await checkout(page);


            await asm09PrepareSavedRecipient(p);
            await asm09OpenSavedRecipient(p);


            const { dialog } = await asm09OpenAddressEditor(p);


            // Quay lại bước chọn tỉnh đã lưu.
            await dialog.getByRole('button', {
                name: HCM,
                exact: true
            }).click();


            const citySearch = dialog.getByPlaceholder(
                /Tìm kiếm Tỉnh\/Thành phố/i
            );


            await citySearch.fill(HANOI);


            await dialog.getByRole('button', {
                name: HANOI,
                exact: true
            }).click();


            // Hà Nội đã chọn, nhưng chưa chọn phường mới.
            await expect(dialog).toContainText(HANOI);


            await expect(
                dialog.getByText(/Vui lòng chọn Phường\/Xã/i)
            ).toBeVisible();


            const confirm = dialog.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            });


            const canConfirm =
                await confirm.isVisible().catch(() => false) &&
                await confirm.isEnabled().catch(() => false);


            note(`Incomplete address confirm enabled: ${canConfirm}`);


            if (canConfirm) {
                // Thử xác nhận địa chỉ thiếu phường.
                await confirm.click();


                // Nếu modal đóng, kiểm tra địa chỉ chưa hoàn chỉnh
                // không được thay thế địa chỉ cũ.
                const pickerClosed = await dialog.waitFor({
                    state: 'hidden',
                    timeout: 2500
                }).then(() => true).catch(() => false);


                if (pickerClosed) {
                    const pane = recipient(p);
                    const summary = p.getByRole('button', {
                        name: 'Chỉnh sửa địa chỉ nhận hàng'
                    });


                    const activeAddress = await pane.isVisible()
                        .catch(() => false)
                        ? await pane.innerText()
                        : await summary.innerText();


                    note(`Address after invalid confirm: ${activeAddress}`);


                    expect(
                        activeAddress,
                        'Địa chỉ thiếu phường đã thay thế địa chỉ hợp lệ'
                    ).toContain(HCM);


                    expect(activeAddress).toContain(WARD);
                } else {
                    // Modal còn mở: thao tác lưu chưa hoàn tất.
                    await expect(dialog).toBeVisible();
                }
            } else {
                note('No enabled confirm button before selecting ward.');
            }


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_53 | F08 | Previously available alternative store remains selectable',
        async ({ page }) => {
            const p = await checkout(page);


            await openStore(p);


            // Đối chứng: hai cửa hàng đều xuất hiện ban đầu.
            const [storeA, storeB] = await twoVisibleStores(p);


            expect(storeA).not.toBe(storeB);


            note(`Initial store A: ${storeA}`);
            note(`Initial store B: ${storeB}`);


            // Lưu cửa hàng A.
            await selectStore(p, storeA);


            await expect(
                recipient(p).getByText(storeA, { exact: true }).first()
            ).toBeVisible();


            // Mở lại chức năng thay đổi cửa hàng.


            // Mở lại danh sách sau khi xác nhận cửa hàng A.
            await openSavedStore(p);


            const dlg = storeDialog(p);
            await expect(dlg).toBeVisible();


            // Quan sát và loại bỏ bộ lọc Phường/Xã được
            // tự động áp dụng theo cửa hàng A.
            const wardFilter = dlg.getByRole('button', {
                name: /^(Phường|Xã|Thị trấn|Đặc khu)\s/i
            }).first();


            const beforeSearch = await dlg.innerText();


            if (await wardFilter.isVisible().catch(() => false)) {
                const selectedWard = await wardFilter.innerText();


                note(`Auto-selected ward filter: ${selectedWard}`);


                // Nút × nằm bên trong nút chọn phường.


                // Ưu tiên click trực tiếp icon X nếu có.
                const clearIcon = wardFilter
                    .locator('svg.lucide-x')
                    .first();


                if (await clearIcon.count() > 0) {
                    await clearIcon.click();
                } else {
                    // Fallback theo vị trí nút X trên bộ lọc:
                    // nút X nằm trước mũi tên dropdown.
                    const rect = await wardFilter.boundingBox();


                    expect(
                        rect,
                        'Không xác định được vị trí bộ lọc phường'
                    ).not.toBeNull();


                    await wardFilter.click({
                        position: {
                            x: Math.max(4, rect!.width - 40),
                            y: rect!.height / 2
                        },
                        timeout: 5000
                    });
                }


                // Xác nhận bộ lọc phường cũ đã được xóa thật.
                await expect(wardFilter).toBeHidden({
                    timeout: 10000
                });


                note('Ward filter cleared successfully.');




                note('Cleared ward filter before searching store B.');
            }


            const search = dlg.getByPlaceholder(
                'Tìm kiếm bằng tên đường',
                { exact: true }
            );


            const query = storeB
                .replace(/^Cửa hàng Di Động Việt\s+/i, '')
                .trim();


            await search.fill(query);


            const targetB = dlg.getByText(
                storeB,
                { exact: true }
            ).first();


            const foundB = await targetB
                .waitFor({
                    state: 'visible',
                    timeout: 10000
                })
                .then(() => true)
                .catch(() => false);


            const report = [
                `Store A: ${storeA}`,
                `Store B: ${storeB}`,
                `Search query: ${query}`,
                `Store B found: ${foundB}`,
                '=== BEFORE SEARCH ===',
                beforeSearch.slice(0, 1500),
                '=== AFTER SEARCH ===',
                (await dlg.innerText()).slice(0, 1500)
            ].join('\n');


            console.log('\n===== ASM09 STORE CHANGE =====');
            console.log(report);
            console.log('===== END STORE CHANGE =====\n');


            await test.info().attach(
                'ASM09_53_store_change.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            expect(
                foundB,
                'Cửa hàng B từng xuất hiện nhưng không thể tìm lại ' +
                'sau khi xác nhận cửa hàng A'
            ).toBe(true);


            await targetB.click();


            const confirm = dlg.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            });


            await expect(confirm).toBeEnabled();
            await confirm.click();


            await expect(dlg).toBeHidden();


            await expect(
                recipient(p).getByText(storeB, { exact: true }).first()
            ).toBeVisible();


            await assertCheckoutSafe(p);
        }
    );




    // ========== ASM09 STAGE 7: FOCUSED DEFECT PROBES ==========


    async function asm09ClearWardForRetest(p: Page) {
        const dlg = storeDialog(p);
        const ward = dlg.getByRole('button', {
            name: /^(Phường|Xã|Thị trấn|Đặc khu)\s/i
        }).first();


        if (!(await ward.isVisible().catch(() => false))) return;


        const icon = ward.locator('svg.lucide-x').first();


        if (await icon.count() > 0 &&
            await icon.isVisible().catch(() => false)) {
            await icon.click();
        } else {
            const rect = await ward.boundingBox();
            expect(rect).not.toBeNull();


            await ward.click({
                position: {
                    x: Math.max(4, rect!.width - 40),
                    y: rect!.height / 2
                }
            });
        }


        await expect(ward).toBeHidden({ timeout: 10000 });
        note('Store ward filter cleared.');
    }


    // 54: EMAIL INVALID
    test('ASM09_TV3_54 | F07 | Invalid email must block recipient confirmation',
        async ({page}) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);
            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            const email = pane.getByPlaceholder(
                'Email (không bắt buộc)', {exact: true}
            );


            await expect(email).toBeVisible();
            await email.fill('not-an-email');


            await pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first().click();


            await expect(
                pane,
                'Email sai định dạng nhưng vẫn xác nhận thành công'
            ).toBeVisible();


            await assertCheckoutSafe(p);
        }
    );


    // 55: EMAIL PERSISTENCE
    test('ASM09_TV3_55 | F07 | Valid email persists after save and reopen',
        async ({page}) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);


            const pane = await asm09OpenSavedRecipient(p);
            const email = pane.getByPlaceholder(
                'Email (không bắt buộc)', {exact: true}
            );


            const value = 'asm09.qa@example.com';
            await email.fill(value);


            await pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first().click();


            await expect(pane).toBeHidden();
            await asm09OpenSavedRecipient(p);


            await expect(email).toHaveValue(value);
            await assertCheckoutSafe(p);
        }
    );


    // 56: INVALID ALTERNATE RECEIVER PHONE
    test('ASM09_TV3_56 | F07 | Invalid alternate receiver phone must be rejected',
        async ({page}) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);
            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            await pane.getByText(
                'Nhờ người khác nhận hàng', {exact: true}
            ).first().click();


            await pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            ).fill('Trần Văn Thử Nghiệm');


            await pane.getByPlaceholder(
                'Số điện thoại người nhận', {exact: true}
            ).fill('abc123');


            await pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first().click();


            await expect(
                pane,
                'SĐT người nhận hộ không hợp lệ vẫn được chấp nhận'
            ).toBeVisible();


            await assertCheckoutSafe(p);
        }
    );


    // 57: DISABLE ALTERNATE RECEIVER
    test('ASM09_TV3_57 | F07 | Disabling alternate receiver restores primary recipient',
        async ({page}) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);
            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            const toggle = pane.getByText(
                'Nhờ người khác nhận hàng', {exact: true}
            ).first();


            await toggle.click();


            await pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            ).fill('Trần Văn Thử Nghiệm');


            await pane.getByPlaceholder(
                'Số điện thoại người nhận', {exact: true}
            ).fill('0910000000');


            await toggle.click();


            await expect(pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            )).toBeHidden();


            await pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first().click();


            await expect(pane).toBeHidden();


            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            await expect(summary).toContainText(ASM09_NAME_A);
            await expect(summary).toContainText(PHONE);
            await expect(summary).not.toContainText('Trần Văn Thử Nghiệm');


            await assertCheckoutSafe(p);
        }
    );


    // 58: KEEP PRIMARY DATA WHEN ALTERNATE RECEIVER ENABLED
    test('ASM09_TV3_58 | F07 | Alternate receiver must not overwrite buyer identity',
        async ({page}) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);
            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            await pane.getByText(
                'Nhờ người khác nhận hàng', {exact: true}
            ).first().click();


            await pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            ).fill('Trần Văn Thử Nghiệm');


            await pane.getByPlaceholder(
                'Số điện thoại người nhận', {exact: true}
            ).fill('0910000000');


            await pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first().click();


            await expect(pane).toBeHidden();
            await asm09OpenSavedRecipient(p);


            await expect(nameInput(p)).toHaveValue(ASM09_NAME_A);
            await expect(phoneInput(p)).toHaveValue(PHONE);


            await expect(pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            )).toHaveValue('Trần Văn Thử Nghiệm');


            await expect(pane.getByPlaceholder(
                'Số điện thoại người nhận', {exact: true}
            )).toHaveValue('0910000000');


            await assertCheckoutSafe(p);
        }
    );


    // 59: INVALID ADDRESS UPDATE
    test('ASM09_TV3_59 | F07 | Blank edited street must not overwrite saved address',
        async ({page}) => {
            const p = await checkout(page);
            await asm09PrepareSavedRecipient(p);
            await asm09OpenSavedRecipient(p);


            const {dialog, street} = await asm09OpenAddressEditor(p);


            await expect(street).toHaveValue(STREET);
            await street.fill('   ');


            const confirm = dialog.getByRole('button', {
                name: 'Xác nhận', exact: true
            });


            if (await confirm.isEnabled()) {
                await confirm.click();
            }


            const pickerStillOpen = await dialog.isVisible()
                .catch(() => false);


            note(`Picker still open after blank street: ${pickerStillOpen}`);


            if (!pickerStillOpen) {
                const pane = recipient(p);
                const summary = p.getByRole('button', {
                    name: 'Chỉnh sửa địa chỉ nhận hàng'
                });


                const activeText = await pane.isVisible()
                    .catch(() => false)
                    ? await pane.innerText()
                    : await summary.innerText();


                expect(
                    activeText,
                    'Địa chỉ trống đã ghi đè địa chỉ đã lưu'
                ).toContain(STREET);
            } else {
                await expect(dialog).toBeVisible();
            }


            await assertCheckoutSafe(p);
        }
    );


    // 60: ACCENT-NORMALIZED STORE SEARCH
    test('ASM09_TV3_60 | F08 | Store search handles Vietnamese accents consistently',
        async ({page}) => {
            const p = await checkout(page);
            const dlg = await openStore(p);


            const names = await visibleStoreNames(p, 1);
            const store = names[0];
            const street = store.replace(
                /^Cửa hàng Di Động Việt\s+/i, ''
            ).trim();


            const ascii = street.normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[đĐ]/g, 'd');


            const search = dlg.getByPlaceholder(
                'Tìm kiếm bằng tên đường', {exact: true}
            );


            const target = dlg.getByText(store, {
                exact: true
            }).first();


            await search.fill(street);
            await expect(target).toBeVisible();




            await search.fill(ascii);


            const foundWithoutAccents = await target
                .waitFor({
                    state: 'visible',
                    timeout: 8000
                })
                .then(() => true)
                .catch(() => false);


            const contentWithoutAccents = await dlg.innerText();


// Kiểm tra ngược để loại trừ lỗi dữ liệu hoặc timing.
            await search.fill(street);
            await expect(target).toBeVisible({
                timeout: 10000
            });


            const report = [
                `Normal query: ${street}`,
                `Without accents: ${ascii}`,
                `Found without accents: ${foundWithoutAccents}`,
                '=== NO-ACCENT SEARCH RESULT ===',
                contentWithoutAccents
            ].join('\n');


            console.log('\n===== ASM09 ACCENT SEARCH =====');
            console.log(report);
            console.log('===== END ACCENT SEARCH =====\n');


            await test.info().attach(
                'ASM09_60_accent_search.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            expect(
                foundWithoutAccents,
                'Từ khóa có dấu tìm được, nhưng bỏ dấu không tìm được'
            ).toBe(true);




            await assertCheckoutSafe(p);
        }
    );


    // 61: SWITCH STORE A -> B -> A
    test('ASM09_TV3_61 | F08 | Repeated pickup store changes keep final selection',
        async ({page}) => {
            const p = await checkout(page);
            await openStore(p);


            const [a, b] = await twoVisibleStores(p);


            await selectStore(p, a);
            await openSavedStore(p);
            await asm09ClearWardForRetest(p);


            let dlg = storeDialog(p);
            let search = dlg.getByPlaceholder(
                'Tìm kiếm bằng tên đường', {exact: true}
            );


            await search.fill(
                b.replace(/^Cửa hàng Di Động Việt\s+/i, '')
            );


            await selectStore(p, b);


            await openSavedStore(p);
            await asm09ClearWardForRetest(p);


            dlg = storeDialog(p);
            search = dlg.getByPlaceholder(
                'Tìm kiếm bằng tên đường', {exact: true}
            );


            await search.fill(
                a.replace(/^Cửa hàng Di Động Việt\s+/i, '')
            );


            await selectStore(p, a);


            await expect(
                recipient(p).getByText(a, {exact: true}).first()
            ).toBeVisible();


            await expect(
                recipient(p).getByText(b, {exact: true})
            ).toHaveCount(0);


            await assertCheckoutSafe(p);
        }
    );


    // 62: F09 ERROR MUST NOT LEAK INTO OTHER TRACKING MODE
    test('ASM09_TV3_62 | F09 | Switching tracking modes must clear previous error',
        async ({page}) => {
            await tracking(page);
            await enterTracking(page, ORDER_A);


            await searchButton(page).click();


            const state = await waitLookup(page);
            note(`Order tracking state before tab switch: ${state}`);


            const deposit = page.getByRole('button', {
                name: 'Đơn đặt cọc', exact: true
            }).first().or(page.getByRole('tab', {
                name: 'Đơn đặt cọc', exact: true
            }).first()).first();


            await expect(
                deposit,
                'Không thể chuyển sang tab đơn đặt cọc sau tra cứu lỗi'
            ).toBeVisible();


            await deposit.click();


            await expect(hasTechnicalError(page)).toHaveCount(0);
            await expect(hasRawRouteError(page)).toHaveCount(0);
            await expectNoOrderDetails(page);
        }
    );


    // ========== ASM09 STAGE 8: ADDITIONAL DEFECT PROBES ==========


    test(
        'ASM09_TV3_63 | F07 | Whitespace-only alternate receiver name must be rejected',
        async ({page}) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);


            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            await pane.getByText(
                'Nhờ người khác nhận hàng', {exact: true}
            ).first().click();


            await pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            ).fill('      ');


            await pane.getByPlaceholder(
                'Số điện thoại người nhận', {exact: true}
            ).fill(ASM09_RECEIVER_PHONE);


            const confirm = pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first();


            if (await confirm.isEnabled()) {
                await confirm.click();
            }


            await expect(
                pane,
                'Tên người nhận hộ chỉ chứa khoảng trắng vẫn được chấp nhận'
            ).toBeVisible();


            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_64 | F07 | Nine-digit alternate receiver phone must be rejected',
        async ({page}) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);


            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            await pane.getByText(
                'Nhờ người khác nhận hàng', {exact: true}
            ).first().click();


            await pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            ).fill(ASM09_RECEIVER_NAME);


            const receiverPhone = pane.getByPlaceholder(
                'Số điện thoại người nhận', {exact: true}
            );


            await receiverPhone.fill('091234567');
            await receiverPhone.press('Tab');


            const confirm = pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first();


            if (await confirm.isEnabled()) {
                await confirm.click();
            }


            await expect(
                pane,
                'SĐT người nhận hộ chỉ có 9 chữ số vẫn được chấp nhận'
            ).toBeVisible();


            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_65 | F07 | Disabling saved alternate receiver restores buyer',
        async ({page}) => {
            const p = await checkout(page);
            await asm09SaveDeliveryAddress(p, STREET);


            const pane = recipient(p);


            await nameInput(p).fill(ASM09_NAME_A);
            await phoneInput(p).fill(PHONE);


            const toggle = pane.getByText(
                'Nhờ người khác nhận hàng', {exact: true}
            ).first();


            await toggle.click();


            await pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            ).fill(ASM09_RECEIVER_NAME);


            await pane.getByPlaceholder(
                'Số điện thoại người nhận', {exact: true}
            ).fill(ASM09_RECEIVER_PHONE);


            const confirm = pane.getByRole('button', {
                name: 'Xác nhận', exact: true
            }).first();


            await confirm.click();
            await expect(pane).toBeHidden();


            await asm09OpenSavedRecipient(p);


            const otherName = pane.getByPlaceholder(
                'Họ và tên người nhận', {exact: true}
            );


            await expect(otherName).toHaveValue(
                ASM09_RECEIVER_NAME
            );


            // Disable the previously saved alternate recipient.
            await toggle.click();
            await expect(otherName).toBeHidden();


            await confirm.click();
            await expect(pane).toBeHidden();


            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            await expect(summary).toContainText(ASM09_NAME_A);
            await expect(summary).toContainText(PHONE);
            await expect(summary).not.toContainText(
                ASM09_RECEIVER_NAME
            );


            await assertCheckoutSafe(p);
        }
    );


    test(
        'ASM09_TV3_66 | F09 | Deposit tracking invalid ID must fail gracefully',
        async ({page}) => {
            await tracking(page);


            const deposit = page.getByRole('button', {
                name: 'Đơn đặt cọc', exact: true
            }).first().or(
                page.getByRole('tab', {
                    name: 'Đơn đặt cọc', exact: true
                }).first()
            ).first();


            await expect(deposit).toBeVisible();
            await deposit.click();


            const code = page.getByPlaceholder(
                /VD:|Mã đơn|Mã cọc|Mã đặt cọc/i
            ).filter({visible: true}).first();


            const phone = page.getByPlaceholder(
                /SĐT|Số điện thoại/i
            ).filter({visible: true}).first();


            const visibleInputs = await page
                .locator('input:visible')
                .evaluateAll(elements =>
                    elements.map(el => ({
                        placeholder: el.placeholder,
                        type: el.type
                    }))
                );


            note(
                'Deposit form fields: ' +
                JSON.stringify(visibleInputs)
            );


            test.skip(
                !(await code.isVisible().catch(() => false)) ||
                !(await phone.isVisible().catch(() => false)),
                'Deposit form uses different inputs; inspect recorded field metadata.'
            );


            await code.fill('INVALID_DEPOSIT_QA_66');
            await phone.fill(PHONE);


            const submit = page.getByRole('button', {
                name: /Tra cứu ngay|^Tra cứu$/i
            }).first();


            await expect(submit).toBeVisible();


            if (await submit.isEnabled()) {
                await submit.click();


                const state = await waitLookup(page);


                note(`Deposit lookup result: ${state}`);


                expect(
                    state,
                    'Deposit lookup returned a technical server exception'
                ).not.toBe('technical-error');


                expect(
                    state,
                    'Deposit lookup exposed a raw routing error'
                ).not.toBe('raw-route-error');


                await expectNoOrderDetails(page);
            } else {
                note('Deposit lookup rejected synthetic data before submission.');
            }
        }
    );


    test(
        'ASM09_TV3_67 | F08 | Pickup store state remains consistent after mode switching',
        async ({page}) => {
            const p = await checkout(page);


            await openStore(p);
            const [storeA, storeB] = await twoVisibleStores(p);


            await selectStore(p, storeA);
            await openSavedStore(p);
            await asm09ClearWardForRetest(p);


            const dlg = storeDialog(p);
            const search = dlg.getByPlaceholder(
                'Tìm kiếm bằng tên đường', {exact: true}
            );


            await search.fill(
                storeB.replace(/^Cửa hàng Di Động Việt\s+/i, '')
            );


            await selectStore(p, storeB);


            // Switch to home delivery.
            await recipient(p).getByRole('button', {
                name: /^Giao hàng tận nơi$/i
            }).first().click();


            await expect(addressOpenButton(p)).toBeVisible();


            // Switch back to pickup.
            await recipient(p).getByRole('button', {
                name: /^Nhận tại cửa hàng$/i
            }).first().click();


            const paneText = await recipient(p).innerText();


            note(`Pickup state after mode switch: ${paneText.slice(0, 450)}`);


            expect(
                paneText.includes(storeA),
                'Checkout restored an older store A after confirming store B'
            ).toBe(false);


            expect(
                paneText.includes(storeB) ||
                paneText.includes('Chọn cửa hàng gần nhất'),
                'Pickup mode has neither saved store B nor a way to choose store'
            ).toBe(true);


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_68 | F08 | Changing pickup city must invalidate old store selection',
        async ({page}) => {
            const p = await checkout(page);


            await openStore(p);
            const [storeA] = await twoVisibleStores(p);


            await selectStore(p, storeA);
            await openSavedStore(p);


            const dlg = storeDialog(p);
            await expect(dlg).toBeVisible();


            // Ban đầu cửa hàng thuộc TP.HCM.
            const currentCity = dlg.getByRole('button', {
                name: HCM,
                exact: true
            }).first();


            await expect(currentCity).toBeVisible();
            await currentCity.click();


            // Chọn Hà Nội trong bước chọn tỉnh.
            const hanoi = dlg.getByRole('button', {
                name: HANOI,
                exact: true
            }).first();


            await expect(hanoi).toBeVisible();
            await hanoi.click();


            // Chờ bộ lọc khu vực cập nhật.
            await expect(dlg.getByRole('button', {
                name: HANOI,
                exact: true
            }).first()).toBeVisible();


            const selected = dlg.getByRole('radio', {
                checked: true
            });


            const selectedText = await selected.allInnerTexts();
            const after = await dlg.innerText();


            const oldStoreStillSelected = selectedText.some(
                value => value.includes(storeA)
            );


            const report = [
                `Previous store: ${storeA}`,
                `New city: ${HANOI}`,
                `Old store still checked: ${oldStoreStillSelected}`,
                `Selected entries: ${JSON.stringify(selectedText)}`,
                '=== STORE MODAL ===',
                after.slice(0, 1800)
            ].join('\n');


            console.log('\n===== ASM09 PICKUP CITY CHANGE =====');
            console.log(report);
            console.log('===== END PICKUP CITY CHANGE =====\n');


            await test.info().attach(
                'ASM09_68_pickup_city.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            expect(
                oldStoreStillSelected,
                'Đã đổi sang Hà Nội nhưng cửa hàng TP.HCM vẫn được chọn'
            ).toBe(false);


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_69 | F09 | Compare order and deposit lookup routing',
        async ({page, context}) => {
            type Mode = 'order' | 'deposit';


            const results: Array<{
                mode: Mode;
                selectedBefore: string | null;
                selectedAfter: string | null;
                outcome: string;
                requests: Array<{
                    method: string;
                    path: string;
                    status: number;
                }>;
            }> = [];


            async function probe(
                p: Page,
                mode: Mode,
                invalidCode: string
            ) {
                await tracking(p);


                const tab = p.getByRole('button', {
                    name: mode === 'order'
                        ? 'Đơn hàng'
                        : 'Đơn đặt cọc',
                    exact: true
                });


                await tab.click();


                // Xác nhận đúng chế độ TRƯỚC khi nhập mã.
                await expect(tab).toHaveAttribute(
                    'aria-pressed',
                    'true',
                    {timeout: 7000}
                );


                const selectedBefore =
                    await tab.getAttribute('aria-pressed');


                const requests: Array<{
                    method: string;
                    path: string;
                    status: number;
                }> = [];


                p.on('response', response => {
                    try {
                        const request = response.request();
                        const url = new URL(response.url());


                        if (!/api|order|deposit|track|lookup/i
                            .test(url.pathname)) return;


                        if (!['fetch', 'xhr', 'document']
                            .includes(request.resourceType())) return;


                        requests.push({
                            method: request.method(),
                            path: url.pathname
                                .replace(/INVALID[^/]+/gi, '[test-code]')
                                .replace(/\b0\d{9}\b/g, '[phone]'),
                            status: response.status()
                        });
                    } catch {
                        // Ignore unrelated responses.
                    }
                });


                const codeInput = p.getByPlaceholder(
                    /VD:|Mã đơn|Mã cọc|Mã đặt cọc/i
                ).filter({visible: true}).first();


                const phone = p.getByPlaceholder(
                    /SĐT|Số điện thoại/i
                ).filter({visible: true}).first();


                await expect(codeInput).toBeVisible();
                await expect(phone).toBeVisible();


                await codeInput.fill(invalidCode);
                await phone.fill(PHONE);


                await searchButton(p).click();


                const detect = async () => {
                    if (await hasTechnicalError(p).count()) {
                        return 'technical-error';
                    }


                    if (await hasRawRouteError(p).count()) {
                        return 'raw-route-error';
                    }


                    if (await p.getByText(
                        /không tìm thấy|không tồn tại|không hợp lệ|không khớp/i
                    ).filter({visible: true}).count()) {
                        return 'validation';
                    }


                    return 'pending';
                };


                let outcome = 'pending';


                try {
                    await expect.poll(detect, {
                        timeout: 14000
                    }).not.toBe('pending');


                    outcome = await detect();
                } catch {
                    outcome = 'no-feedback';
                }


                const selectedAfter =
                    await tab.getAttribute('aria-pressed');


                results.push({
                    mode,
                    selectedBefore,
                    selectedAfter,
                    outcome,
                    requests
                });
            }


            // Luồng 1: Tra cứu đơn hàng.
            await probe(page, 'order', ORDER_A);


            // Luồng 2: Mở tab mới với trang tra cứu sạch.
            const depositPage = await context.newPage();


            try {
                await accessible(depositPage, TRACKING);


                await probe(
                    depositPage,
                    'deposit',
                    'INVALID_DEPOSIT_QA_66'
                );
            } finally {
                await depositPage.close();
            }


            const report = JSON.stringify(results, null, 2);


            console.log('\n===== ASM09 F09 ROUTING COMPARISON =====');
            console.log(report);
            console.log('===== END F09 ROUTING COMPARISON =====\n');


            await test.info().attach(
                'ASM09_69_routing.json',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'application/json'
                }
            );


            expect(results).toHaveLength(2);


            for (const result of results) {
                expect(result.selectedBefore).toBe('true');
                expect(result.outcome).not.toBe('no-feedback');
            }
        }
    );




    test(
        'ASM09_TV3_70 | F09 | Deposit tab must activate on a fresh page',
        async ({page}) => {
            await tracking(page);


            const order = page.getByRole('button', {
                name: 'Đơn hàng',
                exact: true
            });


            const deposit = page.getByRole('button', {
                name: 'Đơn đặt cọc',
                exact: true
            });


            await expect(order).toBeVisible();
            await expect(deposit).toBeVisible();
            await expect(deposit).toBeEnabled();


            const before = {
                orderPressed: await order.getAttribute('aria-pressed'),
                depositPressed: await deposit.getAttribute('aria-pressed'),
                content: (await page.locator('main').innerText())
                    .slice(0, 1200)
            };




            // Lần 1: Click ngay khi form đã hiển thị.
            await deposit.click();


            const firstActivated = await expect(deposit)
                .toHaveAttribute('aria-pressed', 'true', {
                    timeout: 2000
                })
                .then(() => true)
                .catch(() => false);


            const firstState = {
                orderPressed: await order.getAttribute('aria-pressed'),
                depositPressed: await deposit.getAttribute('aria-pressed'),
                content: (await page.locator('main').innerText())
                    .slice(0, 1200)
            };


            // Lần 2: Chỉ thử lại nếu click đầu tiên không hoạt động.
            // Đây là bước CHẨN ĐOÁN, không phải cách che lỗi test.
            let secondActivated = firstActivated;


            if (!firstActivated) {
                await page.waitForTimeout(2000);
                await deposit.click();


                secondActivated = await expect(deposit)
                    .toHaveAttribute('aria-pressed', 'true', {
                        timeout: 4000
                    })
                    .then(() => true)
                    .catch(() => false);
            }


            const activated = secondActivated;


            const after = {
                orderPressed: await order.getAttribute('aria-pressed'),
                depositPressed: await deposit.getAttribute('aria-pressed'),
                content: (await page.locator('main').innerText())
                    .slice(0, 1200),
                firstActivated,
                secondActivated
            };


            console.log('FIRST CLICK:', JSON.stringify(firstState));
            console.log('FIRST ACTIVATED:', firstActivated);
            console.log('SECOND ACTIVATED:', secondActivated);


            const report = [
                '=== BEFORE CLICK ===',
                JSON.stringify(before, null, 2),
                '=== AFTER CLICK ===',
                JSON.stringify(after, null, 2),
                `Deposit activated: ${activated}`
            ].join('\n');


            console.log('\n===== ASM09 DEPOSIT TAB =====');
            console.log(report);
            console.log('===== END DEPOSIT TAB =====\n');


            await test.info().attach(
                'ASM09_70_deposit_tab.txt',
                {
                    body: Buffer.from(report, 'utf8'),
                    contentType: 'text/plain'
                }
            );


            // Chụp đúng trang vừa click, trước assertion thất bại.
            await test.info().attach(
                'ASM09_70_deposit_after_click.png',
                {
                    body: await page.screenshot({
                        fullPage: true
                    }),
                    contentType: 'image/png'
                }
            );


            expect(
                activated,
                'Nút Đơn đặt cọc hiển thị và cho click nhưng không kích hoạt'
            ).toBe(true);


            await expect(order).toHaveAttribute(
                'aria-pressed',
                'false'
            );
        }
    );




    // ===== ASM09 FAST DEFECT HUNT: 71-76 =====


    test('ASM09_TV3_71 | F09 | Alphabetic phone must be validated before lookup',
        async ({page}) => {
            await tracking(page);
            await orderInput(page).fill(ORDER_A);


            const phone = trackingPhone(page);
            await phone.fill('abcXYZ');
            await phone.press('Tab');


            const actual = await phone.inputValue();
            const valid = await phone.evaluate(
                (el: HTMLInputElement) => el.checkValidity()
            );
            const enabled = await searchButton(page).isEnabled();


            const report = {actual, valid, enabled};
            console.log('F09_71 PHONE VALIDATION:', report);
            note(JSON.stringify(report));


            // Validation phải chặn dữ liệu không phải SĐT.
            const rejected =
                actual !== 'abcXYZ' || !valid || !enabled;


            expect(
                rejected,
                'Form chấp nhận SĐT chữ và cho phép gửi tra cứu'
            ).toBe(true);
        }
    );


    test('ASM09_TV3_72 | F09 | Oversized order ID must be constrained',
        async ({page}) => {
            await tracking(page);


            const field = orderInput(page);
            const code = 'X'.repeat(200);


            await field.fill(code);
            await trackingPhone(page).fill(PHONE);


            const actual = await field.inputValue();
            const valid = await field.evaluate(
                (el: HTMLInputElement) => el.checkValidity()
            );
            const maxLength = await field.evaluate(
                (el: HTMLInputElement) => el.maxLength
            );
            const enabled = await searchButton(page).isEnabled();


            const report = {
                suppliedLength: code.length,
                acceptedLength: actual.length,
                maxLength,
                valid,
                enabled
            };


            console.log('F09_72 ORDER BOUNDARY:', report);
            note(JSON.stringify(report));


            // Kiểm tra thiếu giới hạn đầu vào.
            const rejected =
                actual.length < 200 || !valid || !enabled;


            expect(
                rejected,
                'Mã đơn dài 200 ký tự vẫn vượt qua validation form'
            ).toBe(true);
        }
    );


    test('ASM09_TV3_73 | F08 | Cannot confirm pickup without any matching store',
        async ({page}) => {
            const p = await checkout(page);
            const dlg = await openStore(p);


            const search = dlg.getByPlaceholder(
                'Tìm kiếm bằng tên đường',
                {exact: true}
            );


            await search.fill('NO_STORE_MATCH_QA_73');


            await expect(dlg.getByText(
                /Không tìm thấy cửa hàng phù hợp/i
            )).toBeVisible();


            const checked = await dlg.getByRole('radio', {
                checked: true
            }).count();


            expect(checked).toBe(0);


            const confirm = dlg.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            });


            const enabled = await confirm.isEnabled();


            console.log('F08_73 CONFIRM ENABLED:', enabled);
            note(`No stores; confirm enabled=${enabled}`);


            if (enabled) {
                await confirm.click();


                const closed = await dlg.isHidden()
                    .catch(() => false);


                console.log('F08_73 DIALOG CLOSED:', closed);
                note(`No stores; dialog closed=${closed}`);


                // Không được hoàn tất lựa chọn khi
                // chưa có cửa hàng hợp lệ.
                expect(
                    closed,
                    'Xác nhận không có cửa hàng nhưng modal vẫn đóng'
                ).toBe(false);
            }


            await assertCheckoutSafe(p);
        }
    );


    test('ASM09_TV3_74 | F08 | Cancelling pickup city change retains saved store',
        async ({page}) => {
            const p = await checkout(page);


            await openStore(p);


            const [storeA] = await twoVisibleStores(p);
            await selectStore(p, storeA);
            await openSavedStore(p);


            const dlg = storeDialog(p);


            await dlg.getByRole('button', {
                name: HCM,
                exact: true
            }).first().click();


            await dlg.getByRole('button', {
                name: HANOI,
                exact: true
            }).first().click();


            await expect(dlg.getByRole('button', {
                name: HANOI,
                exact: true
            }).first()).toBeVisible();


            // Hủy lựa chọn tỉnh mới.
            await dismissStore(p);


            await expect(
                recipient(p).getByText(
                    storeA, {exact: true}
                ).first()
            ).toBeVisible();


            await openSavedStore(p);


            // Chọn lại cửa hàng cũ phải không bị
            // ràng buộc nhầm theo Hà Nội.
            const currentCity = storeDialog(p).getByRole(
                'button', {name: HCM, exact: true}
            ).first();


            await expect(currentCity).toBeVisible();
            await assertCheckoutSafe(p);
        }
    );


    test('ASM09_TV3_75 | F07 | Cancelling changed city retains saved address',
        async ({page}) => {
            const p = await checkout(page);


            await asm09PrepareSavedRecipient(p);
            const pane = await asm09OpenSavedRecipient(p);


            const {dialog} = await asm09OpenAddressEditor(p);


            await dialog.getByRole('button', {
                name: HCM,
                exact: true
            }).click();


            const search = dialog.getByPlaceholder(
                /Tìm kiếm Tỉnh\/Thành phố/i
            );


            await search.fill(HANOI);


            await dialog.getByRole('button', {
                name: HANOI,
                exact: true
            }).click();


            await expect(dialog).toContainText(HANOI);


            await dialog.getByRole('button', {
                name: 'Đóng',
                exact: true
            }).first().click();


            await expect(dialog).toBeHidden();


            // Dữ liệu đã lưu phải được rollback đầy đủ.
            await expect(pane).toContainText(HCM);
            await expect(pane).toContainText(WARD);
            await expect(pane).toContainText(STREET);


            const reopened = await asm09OpenAddressEditor(p);


            await expect(reopened.dialog).toContainText(HCM);
            await expect(reopened.dialog).toContainText(WARD);
            await expect(reopened.street).toHaveValue(STREET);


            await assertCheckoutSafe(p);
        }
    );


    test('ASM09_TV3_76 | F07 | Saved checkout recipient survives page refresh',
        async ({page}) => {
            const p = await checkout(page);


            await asm09PrepareSavedRecipient(p);


            const summary = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            await expect(summary).toContainText(ASM09_NAME_A);
            await expect(summary).toContainText(PHONE);
            await expect(summary).toContainText(STREET);


            // Refresh sau khi lưu.
            await p.reload({waitUntil: 'domcontentloaded'});


            await expect(p).toHaveURL(
                /\/checkout(?:[/?#]|$)/
            );


            const restored = p.getByRole('button', {
                name: 'Chỉnh sửa địa chỉ nhận hàng'
            });


            await expect(restored).toBeVisible({
                timeout: 15000
            });


            await expect(restored).toContainText(ASM09_NAME_A);
            await expect(restored).toContainText(PHONE);
            await expect(restored).toContainText(STREET);


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_77 | F08 | Cannot confirm changed city without selecting a new store',
        async ({page}) => {
            const p = await checkout(page);


            await openStore(p);
            const [storeA] = await twoVisibleStores(p);
            await selectStore(p, storeA);


            await openSavedStore(p);


            const dlg = storeDialog(p);


            await dlg.getByRole('button', {
                name: HCM, exact: true
            }).first().click();


            await dlg.getByRole('button', {
                name: HANOI, exact: true
            }).first().click();


            await expect(dlg.getByRole('button', {
                name: HANOI, exact: true
            }).first()).toBeVisible();


            await expect(
                dlg.getByRole('radio', {checked: true})
            ).toHaveCount(0);


            const confirm = dlg.getByRole('button', {
                name: 'Xác nhận', exact: true
            });


            const enabled = await confirm.isEnabled();
            note(`Changed city, no store selected, confirm enabled=${enabled}`);


            if (enabled) {
                await confirm.click();


                const closed = await dlg.isHidden().catch(() => false);
                note(`Dialog closed without new store=${closed}`);


                // Không được chấp nhận thao tác thay đổi
                // khi không có cửa hàng hợp lệ.
                expect(
                    closed,
                    'Đổi sang Hà Nội nhưng xác nhận không cần chọn cửa hàng'
                ).toBe(false);
            }


            await assertCheckoutSafe(p);
        }
    );




    test(
        'ASM09_TV3_78 | F08 | Confirmed pickup store survives checkout refresh',
        async ({page}) => {
            const p = await checkout(page);


            await openStore(p);
            const [storeA] = await twoVisibleStores(p);


            await selectStore(p, storeA);


            await expect(
                recipient(p).getByText(
                    storeA, {exact: true}
                ).first()
            ).toBeVisible();


            const before = {
                pathname: new URL(p.url()).pathname,
                selectedStore: storeA
            };


            const navigations: string[] = [];


            p.on('framenavigated', frame => {
                if (frame !== p.mainFrame()) return;


                try {
                    navigations.push(
                        new URL(frame.url()).pathname
                    );
                } catch {
                    // Ignore invalid URLs.
                }
            });


            // Refresh checkout after selecting pickup.
            const response = await p.reload({
                waitUntil: 'domcontentloaded'
            });


            // Diagnostic delay: detect redirects that happen
            // after the initial document load.
            await p.waitForTimeout(2500);


            const afterPath = new URL(p.url()).pathname;


            const storeVisible = await p.getByText(
                storeA, {exact: true}
            ).first().isVisible().catch(() => false);


            const mainText = await p.locator('main')
                .innerText()
                .catch(() => '');


            const report = {
                before,
                reloadStatus: response?.status(),
                afterPath,
                navigations,
                storeVisible,
                mainText: mainText.slice(0, 1500)
            };


            console.log('\n===== ASM09 PICKUP REFRESH =====');
            console.log(JSON.stringify(report, null, 2));
            console.log('===== END PICKUP REFRESH =====\n');


            await test.info().attach(
                'ASM09_78_pickup_refresh.json',
                {
                    body: Buffer.from(
                        JSON.stringify(report, null, 2),
                        'utf8'
                    ),
                    contentType: 'application/json'
                }
            );


            await test.info().attach(
                'ASM09_78_after_refresh.png',
                {
                    body: await p.screenshot({
                        fullPage: true,
                        mask: [p.locator('input, textarea')]
                    }),
                    contentType: 'image/png'
                }
            );


            expect(
                afterPath,
                'Refresh checkout khi nhận tại cửa hàng ' +
                'đã chuyển người dùng sang trang khác'
            ).toBe('/checkout');


            expect(
                storeVisible,
                'Cửa hàng đã xác nhận không còn hiển thị sau Refresh'
            ).toBe(true);


            await assertCheckoutSafe(p);
        }
    );




    // ======================================================
    // ASM09 – AUTOMATED EVIDENCE FROM MANUAL VERIFICATION
    // F09_86–91
    // ======================================================


    test.describe('ASM09 Manual Verification Evidence', () => {


        // Dữ liệu sử dụng trong nhóm này hoàn toàn là dữ liệu giả.
        async function evCapture(
            p: Page,
            id: string,
            details: Record<string, unknown> = {}
        ) {
            const evidence = {
                testId: id,
                url: p.url(),
                pathname: new URL(p.url()).pathname,
                details,
                pageContent: (
                    await p.locator('main').innerText()
                        .catch(() => '')
                ).slice(0, 2500)
            };


            const json = JSON.stringify(evidence, null, 2);


            console.log(`\n===== ${id} EVIDENCE =====`);
            console.log(json);
            console.log(`===== END ${id} =====\n`);


            await test.info().attach(`${id}.json`, {
                body: Buffer.from(json, 'utf8'),
                contentType: 'application/json'
            });


            try {
                await test.info().attach(`${id}.png`, {
                    body: await p.screenshot({
                        fullPage: false,
                        animations: 'disabled',
                        timeout: 7000
                    }),
                    contentType: 'image/png'
                });
            } catch (error) {
                console.log('[ASM09] Screenshot failed:', String(error));
            }
        }


        // Chuyển sang tab Đơn đặt cọc và xác nhận
        // đã chuyển thật trước khi tiến hành tra cứu.
        async function evOpenDeposit(p: Page) {
            await tracking(p);


            await p.waitForLoadState('load');


            const deposit = p.getByRole('button', {
                name: 'Đơn đặt cọc',
                exact: true
            });


            await expect(deposit).toBeVisible();


            // Chờ giao diện xử lý tương tác.
            await p.waitForTimeout(1200);


            let activated = false;


            for (let attempt = 0; attempt < 3; attempt++) {
                await deposit.click();


                activated = await expect(deposit)
                    .toHaveAttribute('aria-pressed', 'true', {
                        timeout: 1800
                    })
                    .then(() => true)
                    .catch(() => false);


                if (activated) break;


                // Thử thao tác bàn phím thực tế.
                await deposit.focus();
                await deposit.press('Enter');


                activated = await expect(deposit)
                    .toHaveAttribute('aria-pressed', 'true', {
                        timeout: 1800
                    })
                    .then(() => true)
                    .catch(() => false);


                if (activated) break;


                await p.waitForTimeout(800);
            }


            if (!activated) {
                await evCapture(p, 'ASM09_DEPOSIT_SETUP', {
                    reason: 'Automation could not activate deposit tab'
                });


                test.skip(
                    true,
                    'Không chuyển được tab bằng automation. ' +
                    'Đây là vấn đề setup cần kiểm tra, ' +
                    'không được tính thành defect website.'
                );
            }


            await expect(p.getByRole('button', {
                name: 'Đơn hàng',
                exact: true
            })).toHaveAttribute('aria-pressed', 'false');


            await expect(
                p.locator('main')
            ).toContainText('Mã đơn đặt cọc');


            return p;
        }


        async function evDepositLookup(
            p: Page,
            id: string,
            code: string
        ) {
            await evOpenDeposit(p);


            const inputs = p.locator('main input')
                .filter({visible: true});


            await expect(inputs.first()).toBeVisible();
            await expect(inputs.nth(1)).toBeVisible();


            await inputs.first().fill(code);
            await inputs.nth(1).fill(PHONE);


            const requests: Array<{
                method: string;
                path: string;
                status: number;
            }> = [];


            p.on('response', response => {
                try {
                    const request = response.request();


                    if (!['xhr', 'fetch'].includes(
                        request.resourceType()
                    )) return;


                    const url = new URL(response.url());


                    if (!/order|deposit|tracking|api/i.test(
                        url.pathname
                    )) return;


                    requests.push({
                        method: request.method(),
                        path: url.pathname,
                        status: response.status()
                    });
                } catch {
                    // Ignore unrelated network responses.
                }
            });


            await p.getByRole('button', {
                name: 'Tra cứu ngay',
                exact: true
            }).click();


            const classify = async () => {
                const content = await p.locator('main')
                    .innerText();


                if (/Cannot GET\b/i.test(content)) {
                    return 'cannot-get';
                }


                if (/Validation failed/i.test(content)) {
                    return 'raw-validation';
                }


                if (/Internal server error/i.test(content)) {
                    return 'internal-server-error';
                }


                if (/\bUnauthorized\b/i.test(content)) {
                    return 'unauthorized';
                }


                if (/không tìm thấy|không hợp lệ|không tồn tại/i
                    .test(content)) {
                    return 'validation';
                }


                return 'pending';
            };


            await expect.poll(classify, {
                timeout: 12000
            }).not.toBe('pending').catch(() => {});


            const outcome = await classify();


            await evCapture(p, id, {
                inputCode: code,
                selectedTab: await p.getByRole('button', {
                    name: 'Đơn đặt cọc',
                    exact: true
                }).getAttribute('aria-pressed'),
                outcome,
                requests
            });


            return outcome;
        }


        // 86 — HTML trong mã đơn đặt cọc.
        test(
            'ASM09_TV3_86 | F09 | Deposit HTML code exposes raw route',
            async ({page}) => {
                const outcome = await evDepositLookup(
                    page,
                    'ASM09_TV3_86',
                    '<b>TEST</b>'
                );


                expect(
                    outcome,
                    'Mã đặt cọc chứa HTML làm lộ Cannot GET'
                ).not.toBe('cannot-get');
            }
        );


        // 87 — Thông báo validation mang tính kỹ thuật.
        test(
            'ASM09_TV3_87 | F09 | Deposit numeric validation error',
            async ({page}) => {
                const outcome = await evDepositLookup(
                    page,
                    'ASM09_TV3_87',
                    'ABC123'
                );


                expect(
                    outcome,
                    'Website hiển thị nguyên văn lỗi validation kỹ thuật'
                ).not.toBe('raw-validation');
            }
        );


        // 88 — Đối chứng phản hồi Unauthorized.
        test(
            'ASM09_TV3_88 | F09 | Deposit special code response',
            async ({page}) => {
                const outcome = await evDepositLookup(
                    page,
                    'ASM09_TV3_88',
                    'QA_TEST_@#2026'
                );


                // Đây là test ghi nhận phản hồi, không tự động
                // coi Unauthorized là defect bảo mật.
                expect(outcome).not.toBe('pending');
                await expectNoOrderDetails(page);
            }
        );


        // 89 — Mã chỉ chứa khoảng trắng.
        test(
            'ASM09_TV3_89 | F09 | Whitespace code needs feedback',
            async ({page}) => {
                await tracking(page);


                await orderInput(page).fill('   ');
                await trackingPhone(page).fill(PHONE);


                const enabled =
                    await searchButton(page).isEnabled();


                if (enabled) {
                    await searchButton(page).click();
                }


                await page.waitForTimeout(1500);


                const inputInvalid = await orderInput(page)
                    .evaluate((el: HTMLInputElement) =>
                        !el.checkValidity() ||
                        el.getAttribute('aria-invalid') === 'true'
                    );


                const content = await page.locator('main')
                    .innerText();


                const visibleValidation =
                    /vui lòng|bắt buộc|không hợp lệ|không được để trống/i
                        .test(content);


                await evCapture(page, 'ASM09_TV3_89', {
                    input: 'three spaces',
                    searchEnabled: enabled,
                    inputInvalid,
                    visibleValidation
                });


                expect(
                    !enabled || inputInvalid || visibleValidation,
                    'Mã chỉ có khoảng trắng không được xử lý rõ ràng'
                ).toBe(true);
            }
        );


        // 90 — SĐT chữ: đối chứng validation đúng khi submit.
        test(
            'ASM09_TV3_90 | F09 | Alphabetic phone validation on submit',
            async ({page}) => {
                await tracking(page);


                await orderInput(page).fill(ORDER_A);
                await trackingPhone(page).fill('abcXYZ');


                await evCapture(page, 'ASM09_TV3_90_BEFORE', {
                    action: 'Before submit',
                    phone: 'abcXYZ'
                });


                await searchButton(page).click();


                await expect(
                    page.getByText('Số điện thoại không hợp lệ', {
                        exact: true
                    })
                ).toBeVisible();


                await evCapture(page, 'ASM09_TV3_90_AFTER', {
                    action: 'After submit',
                    result: 'Số điện thoại không hợp lệ'
                });


                await expect(hasTechnicalError(page))
                    .toHaveCount(0);
            }
        );


        // 91 — Mã đặt cọc giả, chỉ chạy khi đã xác nhận
        // automation chuyển đúng tab Đơn đặt cọc.
        test(
            'ASM09_TV3_91 | F09 | Invalid deposit code handling',
            async ({page}) => {
                const outcome = await evDepositLookup(
                    page,
                    'ASM09_TV3_91',
                    'INVALID_DEPOSIT_QA_66'
                );


                expect(
                    outcome,
                    'Tra cứu đặt cọc trả về lỗi server'
                ).not.toBe('internal-server-error');


                expect(
                    outcome,
                    'Tra cứu đặt cọc trả về lỗi routing'
                ).not.toBe('cannot-get');
            }
        );
    });


});


/* =========================================================
 * ASM09 – FINAL EVIDENCE RUN
 * 23130291_HoangDuyTan
 *
 * Append at END OF EXISTING SPEC.
 * No extra imports and no test.use inside describe.
 * Never submit a real order.
 * ========================================================= */


const ASM09_FINAL_PATTERN =
    /ASM09_TV3_(15|17|31|60|78|84|85|86|87)(?!\d)|ASM09_FINAL_(98|99|100|101)(?!\d)/;


type ASM09FinalEvent = {
    kind: string;
    method?: string;
    path?: string;
    status?: number;
    message?: string;
};


const ASM09_FINAL_EVENTS =
    new WeakMap<Page, ASM09FinalEvent[]>();


function asm09IsFinalTest(title: string): boolean {
    return ASM09_FINAL_PATTERN.test(title);
}


async function asm09Evidence(
    page: Page,
    name: string,
    details: Record<string, unknown> = {}
) {
    const info = test.info();


    const data = {
        evidenceName: name,
        testTitle: info.title,
        capturedAt: new Date().toISOString(),
        pathname: (() => {
            try {
                return new URL(page.url()).pathname;
            } catch {
                return 'unknown';
            }
        })(),
        details
    };


    await info.attach(`${name}.json`, {
        body: Buffer.from(
            JSON.stringify(data, null, 2),
            'utf8'
        ),
        contentType: 'application/json'
    });


    try {
        await info.attach(`${name}.png`, {
            body: await page.screenshot({
                fullPage: false,
                animations: 'disabled',
                timeout: 7000
            }),
            contentType: 'image/png'
        });
    } catch (error) {
        console.log(
            '[ASM09] Screenshot unavailable:',
            String(error)
        );
    }
}


/* =========================================================
 * GLOBAL EVIDENCE HOOKS
 *
 * Apply only to selected final evidence tests.
 * Record result even when an assertion fails.
 * ========================================================= */


test.beforeEach(async ({page}, info) => {
    if (!asm09IsFinalTest(info.title)) return;


    const events: ASM09FinalEvent[] = [];


    ASM09_FINAL_EVENTS.set(page, events);


    page.on('response', response => {
        try {
            const request = response.request();
            const path = new URL(response.url()).pathname;


            if (!/order|tracking|pre-order|checkout|cart|store|address/i
                .test(path)) {
                return;
            }


            if (events.length >= 120) return;


            events.push({
                kind: 'response',
                method: request.method(),
                path,
                status: response.status()
            });
        } catch {
            // Ignore non-HTTP resources.
        }
    });


    page.on('requestfailed', request => {
        if (events.length >= 120) return;


        let path = '';


        try {
            path = new URL(request.url()).pathname;
        } catch {
            path = '(unknown)';
        }


        events.push({
            kind: 'requestfailed',
            path,
            message: request.failure()?.errorText
        });
    });


    page.on('pageerror', error => {
        if (events.length >= 120) return;


        events.push({
            kind: 'pageerror',
            message: error.message
        });
    });
});


test.afterEach(async ({page, context}, info) => {
    if (!asm09IsFinalTest(info.title)) return;


    const pages = context.pages()
        .filter(p => !p.isClosed());


    const activePage = pages.find(p =>
        /\/checkout|\/order-tracking|\/cart/.test(p.url())
    ) || pages[pages.length - 1] || page;


    const bodyText = activePage.isClosed()
        ? '(Page closed)'
        : await activePage.locator('body')
            .innerText()
            .catch(() => '(Unable to read page)');


    const pathname = (() => {
        try {
            return new URL(activePage.url()).pathname;
        } catch {
            return '(unknown)';
        }
    })();


    const result = {
        title: info.title,
        status: info.status,
        expectedStatus: info.expectedStatus,
        durationMs: info.duration,
        pathname,
        assertionError: info.error?.message ?? null,
        observations: info.annotations
            .filter(a => a.type === 'observation')
            .map(a => a.description),
        network: ASM09_FINAL_EVENTS.get(page) ?? [],
        pageText: bodyText.slice(0, 4000),
        warning:
            'Failed test is a defect candidate only. ' +
            'Check setup, actual behavior and duplicates.'
    };


    const json = JSON.stringify(result, null, 2);


    console.log(
        '\n===== ASM09 FINAL EVIDENCE =====\n' +
        json +
        '\n===== END FINAL EVIDENCE =====\n'
    );


    await info.attach('ASM09_FINAL_RESULT.json', {
        body: Buffer.from(json, 'utf8'),
        contentType: 'application/json'
    });


    if (!activePage.isClosed()) {
        try {
            await info.attach('ASM09_FINAL_SCREENSHOT.png', {
                body: await activePage.screenshot({
                    fullPage: false,
                    animations: 'disabled',
                    timeout: 7000
                }),
                contentType: 'image/png'
            });
        } catch (error) {
            console.log(
                '[ASM09] Final screenshot unavailable:',
                String(error)
            );
        }
    }
});


/* =========================================================
 * ADDITIONAL FINAL TESTS 98–101
 *
 * Existing F09_15/17, F08_31/60/78/84,
 * F07_85 and F09_86/87 are reused unchanged.
 * ========================================================= */


test.describe('ASM09 FINAL EVIDENCE | Additional Tests', () => {


    test.describe.configure({
        timeout: 180_000,
        retries: 0,
        mode: 'default'
    });


    test.beforeEach(async ({page}, info) => {
        await accessible(
            page,
            info.title.includes('| F09 |')
                ? TRACKING
                : HOME
        );
    });


    // --------------------------------------------------
    // FINAL 98: Ward accent normalization
    // --------------------------------------------------


    test(
        'ASM09_FINAL_98 | F07 | Ward search without accents',
        async ({page}) => {
            const p = await checkout(page);


            await chooseDelivery(p);
            await openAddressPicker(p);
            await chooseCity(p, HCM);


            const search = p.getByPlaceholder(
                /Tìm kiếm Phường\/Xã/i
            );


            const target = p.getByText(
                WARD,
                {exact: true}
            ).last();


            await search.fill(WARD);
            await expect(target).toBeVisible();


            await asm09Evidence(
                p,
                'FINAL_98_BASELINE',
                {
                    query: WARD,
                    resultVisible: true
                }
            );


            const query = 'Phuong Ben Thanh';


            await search.fill(query);


            const found = await target.waitFor({
                state: 'visible',
                timeout: 5000
            }).then(() => true).catch(() => false);


            await asm09Evidence(
                p,
                'FINAL_98_NO_ACCENTS',
                {
                    baseline: WARD,
                    query,
                    found
                }
            );


            await search.fill(WARD);
            await expect(target).toBeVisible();


            expect(
                found,
                'Phường có dấu tìm thấy nhưng không dấu không thấy'
            ).toBe(true);
        }
    );


    // --------------------------------------------------
    // FINAL 99: All-zero phone in tracking
    // --------------------------------------------------


    test(
        'ASM09_FINAL_99 | F09 | Reject all-zero tracking phone',
        async ({page}) => {
            await tracking(page);


            const code = 'INVALID_QA_99';
            const invalidPhone = '0000000000';


            await orderInput(page).fill(code);
            await trackingPhone(page).fill(invalidPhone);


            await asm09Evidence(
                page,
                'FINAL_99_BEFORE',
                {
                    orderCode: code,
                    phone: invalidPhone
                }
            );


            const requestedPhones: string[] = [];


            page.on('request', request => {
                try {
                    const url = new URL(request.url());
                    const phone = url.searchParams.get('phone');


                    if (phone !== null) {
                        requestedPhones.push(phone);
                    }
                } catch {
                    // Ignore invalid URLs.
                }
            });


            const search = searchButton(page);


            if (await search.isEnabled()) {
                await search.click();
            }


            await page.waitForTimeout(1200);


            const submittedPhone = (() => {
                try {
                    return new URL(page.url())
                        .searchParams.get('phone');
                } catch {
                    return null;
                }
            })();


            const submitted =
                submittedPhone === invalidPhone ||
                requestedPhones.includes(invalidPhone);


            const invalid = await trackingPhone(page)
                .evaluate((el: HTMLInputElement) =>
                    !el.checkValidity() ||
                    el.getAttribute('aria-invalid') === 'true'
                )
                .catch(() => false);


            const visibleError =
                await page.getByText(
                    /số điện thoại không hợp lệ|số điện thoại không đúng/i
                ).filter({visible: true}).count() > 0;


            const report = {
                inputPhone: invalidPhone,
                submittedPhone,
                submitted,
                invalid,
                visibleError
            };


            await asm09Evidence(
                page,
                'FINAL_99_AFTER',
                report
            );


            expect(
                !submitted || invalid || visibleError,
                'SĐT toàn số 0 vẫn được gửi mà không bị validation chặn'
            ).toBe(true);
        }
    );


    // --------------------------------------------------
    // FINAL 100: Whitespace-only order code
    // --------------------------------------------------


    test(
        'ASM09_FINAL_100 | F09 | Reject whitespace-only order code',
        async ({page}) => {
            await tracking(page);


            const code = '   ';


            await orderInput(page).fill(code);
            await trackingPhone(page).fill(PHONE);


            const inputBefore =
                await orderInput(page).inputValue();


            await asm09Evidence(
                page,
                'FINAL_100_BEFORE',
                {
                    codeLength: inputBefore.length,
                    onlyWhitespace: inputBefore.trim() === '',
                    phone: PHONE
                }
            );


            const requestedCodes: string[] = [];


            page.on('request', request => {
                try {
                    const url = new URL(request.url());
                    const orderId =
                        url.searchParams.get('orderId');


                    if (orderId !== null) {
                        requestedCodes.push(orderId);
                    }
                } catch {
                    // Ignore invalid URLs.
                }
            });


            const search = searchButton(page);
            const buttonEnabled = await search.isEnabled();


            if (buttonEnabled) {
                await search.click();
            }


            await page.waitForTimeout(1200);


            const submittedCode = (() => {
                try {
                    return new URL(page.url())
                        .searchParams.get('orderId');
                } catch {
                    return null;
                }
            })();


            const submitted =
                submittedCode === code ||
                requestedCodes.includes(code);


            await asm09Evidence(
                page,
                'FINAL_100_AFTER',
                {
                    originalCode: '[3 spaces]',
                    buttonEnabled,
                    submittedCodeLength:
                        submittedCode?.length ?? null,
                    submitted,
                    pathname: new URL(page.url()).pathname
                }
            );


            expect(
                submitted,
                'Mã đơn chỉ có khoảng trắng vẫn được gửi tra cứu'
            ).toBe(false);
        }
    );


    // --------------------------------------------------
    // FINAL 101: Emoji-only delivery address
    // --------------------------------------------------


    test(
        'ASM09_FINAL_101 | F07 | Reject emoji-only delivery address',
        async ({page}) => {
            const p = await checkout(page);


            const emojiStreet = '🏠🏠🏠';


            await chooseDelivery(p);
            await openAddressPicker(p);
            await chooseCity(p, HCM);
            await chooseWard(p, WARD);
            await fillStreet(p, emojiStreet);


            await asm09Evidence(
                p,
                'FINAL_101_ADDRESS_BEFORE',
                {
                    city: HCM,
                    ward: WARD,
                    street: emojiStreet
                }
            );


            // Confirm address selection only.
            await saveAddressOnly(p);


            const pane = recipient(p);
            await expect(pane).toBeVisible();


            const addressText = await pane.innerText();


            const acceptedAtPicker =
                addressText.includes(emojiStreet);


            await nameInput(p).fill(
                'Nguyễn Văn Kiểm Thử'
            );


            await phoneInput(p).fill(PHONE);


            const confirm = pane.getByRole('button', {
                name: 'Xác nhận',
                exact: true
            }).first();


            const enabled = await confirm.isEnabled();


            if (enabled) {
                await confirm.click();
            }


            const paneClosed = await expect(pane)
                .toBeHidden({timeout: 7000})
                .then(() => true)
                .catch(() => false);


            const mainText = await p.locator('main')
                .innerText()
                .catch(() => '');


            const savedInCheckout =
                paneClosed && mainText.includes(emojiStreet);


            await asm09Evidence(
                p,
                'FINAL_101_ADDRESS_AFTER',
                {
                    acceptedAtPicker,
                    confirmEnabled: enabled,
                    paneClosed,
                    savedInCheckout,
                    emojiStreet
                }
            );


            expect(
                savedInCheckout,
                'Địa chỉ chỉ gồm emoji đã được lưu hoàn chỉnh'
            ).toBe(false);


            await assertCheckoutSafe(p);
        }
    );
});




/* ================= ASM09 MISSING FINAL CASES =================
   F08_84/F07_85 restored as isolated defect evidence tests.
   These do not submit a purchase.                                */
test.describe('ASM09 Final Recovery | F08_84 and F07_85', () => {
    test.describe.configure({timeout: 180_000, retries: 0, mode: 'default'});


    test.beforeEach(async ({page}) => {
        await accessible(page, HOME);
    });


    test('ASM09_TV3_84 | F08 | Store search handles repeated internal spaces', async ({page}) => {
        const p = await checkout(page);
        const dialog = await openStore(p);
        const search = dialog.getByPlaceholder('Tìm kiếm bằng tên đường', {exact: true});
        const target = dialog.getByText('Cửa hàng Di Động Việt Trần Não', {exact: true}).first();
        const baseline = 'Trần Não';
        const altered = 'Trần   Não';


        await search.fill(baseline);
        await expect(target, 'Baseline store must be visible before the comparison').toBeVisible({timeout: 15000});
        await asm09Evidence(p, 'F08_84_BASELINE', {query: baseline, found: true});


        await search.fill(altered);
        const foundWithSpaces = await target.waitFor({
            state: 'visible', timeout: 6000
        }).then(() => true).catch(() => false);
        await asm09Evidence(p, 'F08_84_WITH_SPACES', {
            query: altered, foundWithSpaces
        });


        await search.fill(baseline);
        await expect(target, 'Baseline must still be searchable after clearing').toBeVisible({timeout: 12000});
        expect(foundWithSpaces, 'Repeated internal spaces removed the matching store').toBe(true);
    });


    test('ASM09_TV3_85 | F07 | City search handles unaccented Vietnamese query', async ({page}) => {
        const p = await checkout(page);
        await chooseDelivery(p);
        await openAddressPicker(p);


        const search = p.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i).first();
        await expect(search).toBeVisible({timeout: 12000});
        const target = p.getByText(HANOI, {exact: true}).last();
        const unaccented = 'Thanh pho Ha Noi';


        await search.fill(HANOI);
        await expect(target).toBeVisible({timeout: 12000});
        await asm09Evidence(p, 'F07_85_BASELINE', {query: HANOI, found: true});


        await search.fill(unaccented);
        const foundWithoutAccents = await target.waitFor({
            state: 'visible', timeout: 6000
        }).then(() => true).catch(() => false);
        await asm09Evidence(p, 'F07_85_WITHOUT_ACCENTS', {
            query: unaccented, foundWithoutAccents
        });


        await search.fill(HANOI);
        await expect(target).toBeVisible({timeout: 12000});
        expect(foundWithoutAccents, 'Unaccented city query did not return Hanoi').toBe(true);
    });
});

test(
    'ASM09_FINAL_102 | F09 | Cross-tab isolation diagnostic',
    async ({page, context}) => {
        test.setTimeout(90000);

        const observations: Array<Record<string, unknown>> = [];
        const navigations: string[] = [];

        const watch = (p: Page, name: string) => {
            p.on('framenavigated', frame => {
                if (frame === p.mainFrame()) {
                    navigations.push(`${name}: ${frame.url()}`);
                }
            });
        };

        const snapshot = async (
            stage: string,
            second?: Page
        ) => {
            const firstCode = await orderInput(page)
                .inputValue().catch(() => '(missing)');

            const secondCode = second
                ? await orderInput(second)
                    .inputValue().catch(() => '(missing)')
                : null;

            const result = {
                stage,
                tabA: {
                    code: firstCode,
                    url: page.url()
                },
                tabB: second ? {
                    code: secondCode,
                    url: second.url()
                } : null
            };

            observations.push(result);

            console.log(
                '\nASM09 CROSS-TAB CHECKPOINT:\n' +
                JSON.stringify(result, null, 2)
            );

            return result;
        };

        watch(page, 'A');

        await accessible(page, TRACKING);
        await tracking(page);

        await enterTracking(page, ORDER_A);

        await expect(orderInput(page))
            .toHaveValue(ORDER_A);

        await snapshot('A_FILLED');

        const second = await context.newPage();
        watch(second, 'B');

        try {
            await accessible(second, TRACKING);
            await tracking(second);

            await snapshot('B_OPENED', second);

            await enterTracking(second, ORDER_B);

            await expect(orderInput(second))
                .toHaveValue(ORDER_B);

            await snapshot('B_FILLED', second);

            await page.bringToFront();
            await page.waitForTimeout(600);

            const finalState = await snapshot(
                'A_REFOCUSED',
                second
            );

            const report = {
                test: 'ASM09_FINAL_102',
                observations,
                navigations,
                expectedA: ORDER_A,
                expectedB: ORDER_B
            };

            await test.info().attach(
                'ASM09_FINAL_102_CROSSTAB.json',
                {
                    body: Buffer.from(
                        JSON.stringify(report, null, 2),
                        'utf8'
                    ),
                    contentType: 'application/json'
                }
            );

            for (const [name, p] of [
                ['TAB_A', page],
                ['TAB_B', second]
            ] as const) {
                try {
                    await test.info().attach(
                        `ASM09_FINAL_102_${name}.png`,
                        {
                            body: await p.screenshot({
                                fullPage: false,
                                animations: 'disabled',
                                timeout: 5000
                            }),
                            contentType: 'image/png'
                        }
                    );
                } catch {
                    console.log(`Screenshot ${name} unavailable`);
                }
            }

            const a = (
                finalState.tabA as {code: string}
            ).code;

            expect(
                a,
                'Du lieu chua submit o Tab A bi thay doi sau khi mo Tab B'
            ).toBe(ORDER_A);

            await expect(orderInput(second))
                .toHaveValue(ORDER_B);
        } finally {
            await second.close();
        }
    }
);

test(
    'ASM09_FINAL_103 | F09 | Cross-tab versus hydration',
    async ({page, context}) => {
        test.setTimeout(150000);

        const history: Array<Record<string, unknown>> = [];
        const navigations: string[] = [];

        const watch = (p: Page, name: string) => {
            p.on('framenavigated', frame => {
                if (frame === p.mainFrame()) {
                    navigations.push(`${name}: ${frame.url()}`);
                }
            });
        };

        const capture = async (
            stage: string,
            other?: Page
        ) => {
            const getCode = async (p: Page) =>
                orderInput(p).inputValue()
                    .catch(() => '(input missing)');

            const state = {
                stage,
                a: await getCode(page),
                b: other ? await getCode(other) : null,
                aUrl: page.url(),
                bUrl: other?.url() ?? null
            };

            history.push(state);

            console.log(
                'ASM09_103 ' + JSON.stringify(state)
            );

            return state;
        };

        watch(page, 'A');

        await accessible(page, TRACKING);
        await tracking(page);

        // Allow page initialization before entering data.
        await page.waitForTimeout(4000);

        await enterTracking(page, ORDER_A);
        await capture('A_TYPED');

        // Control: no second tab opened yet.
        await page.waitForTimeout(5000);

        const baseline = await capture('A_ALONE_5S');

        const other = await context.newPage();

        watch(other, 'B');

        try {
            await page.waitForTimeout(1000);

            const blank = await capture(
                'BLANK_TAB_OPENED',
                other
            );

            await accessible(other, TRACKING);
            await tracking(other);

            // Allow tab B initialization to settle.
            await other.waitForTimeout(5000);

            const opened = await capture(
                'B_TRACKING_OPENED',
                other
            );

            await enterTracking(other, ORDER_B);
            await other.waitForTimeout(5000);

            const filled = await capture(
                'B_TYPED_5S',
                other
            );

            await page.bringToFront();
            await page.waitForTimeout(1000);

            const returned = await capture(
                'A_REFOCUSED',
                other
            );

            const report = {
                testId: 'ASM09_FINAL_103',
                history,
                navigations,
                expectedA: ORDER_A,
                expectedB: ORDER_B
            };

            await test.info().attach(
                'ASM09_FINAL_103_DIAGNOSTIC.json',
                {
                    body: Buffer.from(
                        JSON.stringify(report, null, 2),
                        'utf8'
                    ),
                    contentType: 'application/json'
                }
            );

            expect(
                baseline.a,
                'BASELINE: Tab A lost data without another tab'
            ).toBe(ORDER_A);

            expect(
                blank.a,
                'FOCUS: Opening blank tab cleared A'
            ).toBe(ORDER_A);

            expect(
                opened.a,
                'CROSS-TAB: Opening tracking in B cleared A'
            ).toBe(ORDER_A);

            expect(
                filled.b,
                'TAB B: Input disappeared after entering it'
            ).toBe(ORDER_B);

            expect(
                returned.a,
                'CROSS-TAB: Tab A lost its unsent code'
            ).toBe(ORDER_A);

        } finally {
            await other.close();
        }
    }
);


test(
    'ASM09_FINAL_104 | F09 | Early input must survive page initialization',
    async ({page}) => {
        test.setTimeout(65000);

        const code = 'INVALID_EARLY_INPUT_104';
        const navigations: string[] = [];
        const samples: Array<{
            timeMs: number;
            value: string;
        }> = [];

        page.on('framenavigated', frame => {
            if (frame === page.mainFrame()) {
                navigations.push(frame.url());
            }
        });

        // Do not use the tracking() helper or extra
        // initialization delay in this diagnostic.
        const response = await page.goto(
            'https://didongviet.vn/order-tracking',
            {waitUntil: 'domcontentloaded'}
        );

        expect(response?.status()).toBeLessThan(400);

        const input = page.getByPlaceholder(
            'VD: 10000001',
            {exact: true}
        );

        await expect(input).toBeVisible({
            timeout: 15000
        });

        // Enter immediately when the input becomes visible.
        await input.fill(code);

        const started = Date.now();

        samples.push({
            timeMs: 0,
            value: await input.inputValue()
        });

        // Monitor value changes for 10 seconds.
        for (let i = 0; i < 20; i++) {
            await page.waitForTimeout(500);

            samples.push({
                timeMs: Date.now() - started,
                value: await input.inputValue()
                    .catch(() => '(input missing)')
            });
        }

        const unexpected = samples.filter(
            sample => sample.value !== code
        );

        const report = {
            testId: 'ASM09_FINAL_104',
            expected: code,
            navigations,
            samples,
            unexpected
        };

        console.log(
            '\n===== ASM09 FINAL 104 =====\n' +
            JSON.stringify(report, null, 2)
        );

        await test.info().attach(
            'ASM09_FINAL_104_INPUT_STATE.json',
            {
                body: Buffer.from(
                    JSON.stringify(report, null, 2),
                    'utf8'
                ),
                contentType: 'application/json'
            }
        );

        expect(
            unexpected,
            'Input value changed without user action'
        ).toHaveLength(0);

        await expect(input).toHaveValue(code);
    }
);
