import { test, expect, type Page, type Locator } from '@playwright/test';
import { openCheckout, openDeliveryPanel, chooseDelivery, choosePickup,
  deliveryButton, pickupButton, addressOpenButton, openAddressPicker,
  chooseCity, chooseWard, fillStreet, addressConfirm, saveAddressOnly,
  assertCheckoutSafe, addTestNote } from './checkout-helpers';

/**
 * Group08 | Hoàng Duy Tân | 23130291 | F08 (D08) | 30 cases: 18 retained from ASM06 + 12 refined test designs (014–025).
 * Baseline V11 user run 31/10/2026: 18 Passed, 12 Skipped, 0 Failed.
 * V13: only corrects 5 V12 selector/assertion failures (015,016,017,024,025).
 * Never clicks the checkout ĐẶT HÀNG CTA or completes a real purchase.
 * No real order is submitted. Historical V11 statuses must not be relabeled as V12 results.
 * F07 checkout navigation / two-stage address picker are based on F07 V8 (29 Passed, 1 Skipped).
 */

const HCM = process.env.F08_CITY_A ?? 'Thành phố Hồ Chí Minh';
const HANOI = process.env.F08_CITY_B ?? 'Thành phố Hà Nội';
const WARD = process.env.F08_WARD_A ?? 'Phường Bến Thành';
const STREET = '12A Đường Kiểm Thử';

async function ready(page: Page) {
  const p = await openCheckout(page);
  await openDeliveryPanel(p);
  return p;
}
async function addressStep2(page: Page) {
  await chooseDelivery(page);
  await openAddressPicker(page);
  await chooseCity(page, HCM);
}
async function addressStep3(page: Page) {
  await addressStep2(page);
  await chooseWard(page, WARD);
}
async function savedDeliveryAddress(page: Page) {
  await addressStep3(page);
  await fillStreet(page, STREET);
  await saveAddressOnly(page);
}
async function assertProductStillPresent(page: Page) {
  // Exact product selection is performed in openCheckout; do not assert volatile price.
  await expect(page.getByText(/iPhone (?:17 256GB|16 128GB)/i).first()).toBeVisible();
  await assertCheckoutSafe(page);
}
/**
 * Store picker observed in the user's screenshots (31/10/2026):
 * "Nhận tại cửa hàng" -> "Chọn cửa hàng gần nhất" -> "Danh sách cửa hàng".
 * The store list has City/Ward filters, a store radio/card, and its OWN confirm.
 * This is an address/store selection confirm, NOT the final purchase action.
 */
const STORE_PICKER_TITLE = 'Danh sách cửa hàng';

/** Scope every store operation to the OPEN Radix dialog, never the footer link. */
function storeDialog(page: Page): Locator {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: STORE_PICKER_TITLE, exact: true }),
  });
}
function recipientDialog(page: Page): Locator {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Thông tin giao hàng', exact: true }),
  });
}
async function openStorePicker(page: Page) {
  const dialog = storeDialog(page);
  if (await dialog.isVisible().catch(() => false)) return dialog;

  const deliveryPanel = recipientDialog(page);
  await expect(deliveryPanel, 'Panel Thông tin giao hàng chưa mở').toBeVisible();

  // F08_012: the picker is opened TWICE. Once a store has been saved,
  // checkout displays "Nhận tại" + "Thay đổi", NOT "Chọn cửa hàng gần nhất".
  // Do not call choosePickup() again in this state: its assertion expects
  // the *empty pickup* UI and falsely fails before we can switch stores.
  const savedPickup = deliveryPanel.getByText('Nhận tại', { exact: true });
  if (await savedPickup.isVisible().catch(() => false)) {
    const change = deliveryPanel.getByText('Thay đổi', { exact: true }).first();
    await expect(change,
      'Đã lưu cửa hàng nhưng thiếu nút Thay đổi để chọn chi nhánh B').toBeVisible();
    await change.click();
  } else {
    // Initial visit: switch from home delivery to pickup and open the list.
    await choosePickup(page);
    const open = deliveryPanel.getByText('Chọn cửa hàng gần nhất', { exact: true });
    await expect(open,
      'Nhận tại cửa hàng phải hiển thị Chọn cửa hàng gần nhất').toBeVisible({ timeout: 12_000 });
    await open.click();
  }

  await expect(dialog, 'Modal Danh sách cửa hàng chưa mở').toBeVisible({ timeout: 12_000 });
  return dialog;
}

function storeConfirm(page: Page): Locator {
  // Two buttons named "Xác nhận" may exist: recipient form and store modal.
  return storeDialog(page).getByRole('button', { name: 'Xác nhận', exact: true });
}

/** Read all *currently displayed* store names from modal text, not from
 * brittle getByText regex matching an entire nested React card. */
async function listedStores(page: Page): Promise<string[]> {
  const dialog = storeDialog(page);
  await expect(dialog).toBeVisible();
  const text = await dialog.innerText();
  const names = Array.from(text.matchAll(/Cửa hàng Di Động Việt[^\r\n]+/g), m =>
    m[0].replace(/\s+\d+(?:[.,]\d+)?\s*km\b.*$/i, '').replace(/\s+/g, ' ').trim()
  );
  return [...new Set(names.filter(s => /^Cửa hàng Di Động Việt\s+\S/i.test(s) && s.length <= 110))];
}

/** Use exact store name inside modal; verify confirm becomes enabled and saved
 * name appears in delivery panel. No purchase button is touched. */
async function selectListedStore(page: Page, name: string) {
  const dialog = storeDialog(page);
  await expect(dialog).toBeVisible();
  const option = dialog.getByText(name, { exact: true }).first();
  await expect(option, `Không thấy chi nhánh '${name}' trong modal`).toBeVisible({ timeout: 12_000 });
  await option.click();
  const confirm = storeConfirm(page);
  await expect(confirm, 'Chọn radio phải bật Xác nhận trong modal cửa hàng').toBeEnabled();
  await confirm.click();
  await expect(dialog, 'Modal cửa hàng chưa đóng sau khi xác nhận').toBeHidden({ timeout: 12_000 });
  const panel = recipientDialog(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByText(name, { exact: true }).first(),
    'Tên chi nhánh chưa được lưu vào Thông tin giao hàng').toBeVisible();
  await assertCheckoutSafe(page);
  return name;
}

async function pickStoreByName(page: Page, envName = 'F08_STORE_A') {
  await openStorePicker(page);
  const configured = (process.env[envName] ?? '').trim();
  const available = await listedStores(page);
  expect(available.length, 'Không đọc được tên chi nhánh từ modal đang mở').toBeGreaterThan(0);
  const target = configured || available[0];
  if (configured) {
    expect(available, `Fixture ${envName} không có trong danh sách hiện tại`).toContain(target);
  }
  return selectListedStore(page, target);
}

/**
 * V13: Close via the modal's real aria-label="Đóng" button (observed in
 * DDV_F08_025 Playwright trace). Escape FIRST caused a race: the dialog began
 * unmounting, then a positional `locator('button').first()` waited on a
 * detached element for 15 seconds. Re-resolve the semantic button if React
 * rerenders; Escape is a fallback only after direct X attempts.
 * Never touches the checkout ĐẶT HÀNG button.
 */
async function dismissStoreDialog(page: Page) {
  const dialog = storeDialog(page);
  await expect(dialog, 'Modal Danh sách cửa hàng phải đang mở').toBeVisible();
  const close = dialog.getByRole('button', { name: 'Đóng', exact: true }).first();
  await expect(close,
    'Không có nút Đóng trong modal Danh sách cửa hàng').toBeVisible({ timeout: 8_000 });

  // Clicking X is the primary behavior under test. Retrying uses the same
  // semantic locator so React DOM replacement cannot invalidate an index.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await dialog.isHidden().catch(() => false)) break;
    try {
      await close.click({ timeout: 6_000 });
    } catch (error) {
      if (await dialog.isHidden().catch(() => false)) break;
      await addTestNote(`[F08] Đóng modal lần ${attempt + 1}: ` +
        String(error).slice(0, 220));
    }
    try {
      await expect(dialog).toBeHidden({ timeout: 2_500 });
      break;
    } catch { /* Modal still visible; retry with a freshly resolved locator. */ }
  }

  if (await dialog.isVisible().catch(() => false)) {
    // Fallback is safe: not a purchase action. Final state MUST be checked.
    await page.keyboard.press('Escape');
  }
  await expect(dialog,
    'Đóng/hủy phải ẩn modal Danh sách cửa hàng').toBeHidden({ timeout: 10_000 });
  await expect(recipientDialog(page),
    'Đóng danh sách cửa hàng không được đóng form Thông tin giao hàng').toBeVisible();
  await assertCheckoutSafe(page);
}

async function markStoreWithoutConfirm(page: Page, name: string) {
  const dialog = storeDialog(page);
  await expect(dialog.getByText(name, { exact:true }).first()).toBeVisible({ timeout:10_000 });
  await dialog.getByText(name, { exact:true }).first().click();
  await expect(storeConfirm(page), 'Chọn radio phải bật Xác nhận trong modal').toBeEnabled();
}
function storeStreetSearch(page: Page): Locator {
  return storeDialog(page).getByPlaceholder('Tìm kiếm bằng tên đường', { exact:true });
}
function cityFilterButton(page: Page): Locator {
  return storeDialog(page).locator('button[aria-haspopup="listbox"]').first();
}
/** Get visible CITY choices strictly inside the popup below its unique
 * search input; underlying store cards are intentionally excluded. */
async function visibleCityPopupChoices(page: Page): Promise<string[]> {
  return page.getByPlaceholder('Tìm kiếm...', { exact:true }).evaluate(input => {
    const search = input.getBoundingClientRect();
    const choices: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const label = (node.textContent ?? '').trim().replace(/\s+/g, ' ');
      if (!/^(?:Thành phố|Tỉnh)\s+\S/i.test(label)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const x=r.x+r.width/2, y=r.y+r.height/2;
      if (x < search.left-24 || x > search.right+24 || y < search.bottom-2 || y > search.bottom+460) continue;
      const hit = document.elementFromPoint(x,y);
      if (!hit || !(el===hit || el.contains(hit))) continue;
      let cur: Element | null=el;
      let card=false;
      for(let i=0;cur && i<5;i++,cur=cur.parentElement){
        const t=(cur.textContent??'').trim();
        if(t.includes('Cửa hàng Di Động Việt') && t.includes('Xem chỉ đường')) { card=true; break; }
      }
      if (!card) choices.push(label);
    }
    return [...new Set(choices)];
  });
}

/**
 * F08 V6: The custom City dropdown contains an INNER search input
 * placeholder="Tìm kiếm..." (confirmed by screenshot 31/10/2026).
 * Its items are not exposed as role="option". Anchor the choice to that
 * search input and the visible popup geometry, NEVER to city strings on
 * underlying store cards. Dynamic geometry; no hard-coded screen positions.
 */
async function setStoreCity(page: Page, city: string, searchTerm?: string) {
  const dialog = storeDialog(page);
  await expect(dialog).toBeVisible();
  const trigger = dialog.locator('button[aria-haspopup="listbox"]').first();
  await expect(trigger, 'Không thấy nút bộ lọc Thành phố').toBeVisible();
  const cityShort = city.replace(/^Thành phố\s+/i, '').trim();
  if ((await trigger.innerText()).includes(cityShort)) return;

  await trigger.click();
  // Menu may be portaled outside the dialog DOM; the exact placeholder is unique.
  const popupSearch = page.getByPlaceholder('Tìm kiếm...', { exact: true });
  await expect(popupSearch,
    'Bộ lọc Thành phố phải mở ô tìm kiếm riêng "Tìm kiếm..."').toBeVisible({ timeout: 8_000 });
  // Search in the city popup, NOT the separate "Tìm kiếm bằng tên đường" input.
  await popupSearch.fill(searchTerm ?? cityShort);

  type Point = { x: number; y: number; label: string };
  const point = await page.evaluate(({ cityLabel, inputPlaceholder }) : Point | null => {
    const isVisible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const input = Array.from(document.querySelectorAll('input')).find(el =>
      el.placeholder === inputPlaceholder && isVisible(el));
    if (!input) return null;
    const searchBox = input.getBoundingClientRect();
    // Limit the hit target to the floating menu immediately BELOW the popup search.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const options: Array<{ x:number; y:number; label:string; score:number }> = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const value = (node.textContent ?? '').trim().replace(/\s+/g, ' ');
      if (value !== cityLabel) continue;
      const el = node.parentElement;
      if (!el || !isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const inPopup = x >= searchBox.left - 24 && x <= searchBox.right + 24 &&
        y >= searchBox.bottom - 2 && y <= Math.min(window.innerHeight, searchBox.bottom + 450);
      if (!inPopup) continue;
      // Store cards can mention the same city; ensure the element is actually
      // on TOP of the overlay, i.e. pointer hit-test resolves to this label.
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el === hit || el.contains(hit))) continue;
      let ancestor: Element | null = el;
      let storeCard = false;
      for (let i = 0; i < 5 && ancestor; i++, ancestor = ancestor.parentElement) {
        const t = (ancestor.textContent ?? '').trim();
        if (t.includes('Cửa hàng Di Động Việt') && t.includes('Xem chỉ đường')) {
          storeCard = true; break;
        }
      }
      if (storeCard) continue;
      options.push({x,y,label:value,score:y-searchBox.bottom});
    }
    options.sort((a,b)=>a.score-b.score);
    return options.length ? {x:options[0].x,y:options[0].y,label:options[0].label} : null;
  }, { cityLabel: city, inputPlaceholder: 'Tìm kiếm...' });

  if (!point) {
    // Report only city dropdown metadata, no recipient phone/name/email.
    const debug = await popupSearch.evaluate(el => {
      const r=el.getBoundingClientRect();
      const sample=Array.from(document.querySelectorAll('*'))
        .filter(e => {const b=e.getBoundingClientRect();return b.width>0 && b.height>0 &&
          b.left>=r.left-30 && b.right<=r.right+50 && b.top>r.bottom-5 && b.top<r.bottom+450;})
        .filter(e => !e.children.length && !!e.textContent?.trim())
        .slice(0,50).map(e=>({tag:e.tagName.toLowerCase(),role:e.getAttribute('role'),text:(e.textContent??'').trim().slice(0,140)}));
      return {popupSearch:{placeholder:(el as HTMLInputElement).placeholder,
        rect:{left:r.left,top:r.top,width:r.width,height:r.height}}, visibleOptionCandidates:sample};
    });
    await test.info().attach('F08_city_dropdown_debug.json', {
      body: Buffer.from(JSON.stringify({requestedCity:city, ...debug},null,2),'utf8'),
      contentType:'application/json',
    });
    await test.info().attach('F08_city_dropdown_open.png', {
      body: await page.screenshot(),contentType:'image/png',
    });
    throw new Error(`F08: Không thấy lựa chọn ${city} trong menu ngay dưới ô "Tìm kiếm...". `+
      'Xem attachment F08_city_dropdown_debug.json (không click nhầm thẻ cửa hàng).');
  }

  await page.mouse.click(point.x, point.y);
  await expect(trigger, `Bộ lọc Thành phố phải cập nhật thành ${city}`)
    .toContainText(cityShort,{timeout:12_000});
  await addTestNote(`[F08] Đã chọn thành phố qua popup: ${city}`);
}

/**
 * In the store list, location may be on a separate line from name and there
 * may be a distance badge between them. Parse a COMPLETE card slice up to the
 * next store name, rather than only the first two lines (V5 false Skipped).
 */
async function listedStoresInCity(page: Page, city: string): Promise<string[]> {
  const names=await listedStores(page);
  const text=await storeDialog(page).innerText();
  const cityShort=city.replace(/^Thành phố\s+/i,'').trim();
  return names.filter(name => {
    const i=text.indexOf(name);
    if (i<0) return false;
    const next=text.indexOf('Cửa hàng Di Động Việt',i+name.length);
    const slice=text.slice(i,next>i?next:undefined).slice(0,600);
    return slice.includes(cityShort) ||
      (cityShort==='Hồ Chí Minh' && /TP\.?\s*HCM|TP\.?\s*Hồ Chí Minh/i.test(slice));
  });
}

/**
 * F08_013: the city button can update BEFORE the asynchronously filtered store
 * cards are rendered. Do not treat the immediately-empty list as a failure.
 * Poll only the actual stores whose card includes the selected city. If no
 * matching cards ever arrive, report the displayed City/Ward filters and list
 * state; do not force Passed/Skipped or click checkout purchase CTA.
 */
async function waitForStoresInCityFor013(page: Page, city: string, stage: string): Promise<string[]> {
  const dialog = storeDialog(page);
  let names: string[] = [];
  try {
    await expect.poll(async () => {
      names = await listedStoresInCity(page, city);
      return names.length;
    }, {
      message: `F08_013: chờ danh sách chi nhánh thuộc ${city} cập nhật (${stage})`,
      timeout: 25_000,
      intervals: [250, 500, 900, 1400, 2000],
    }).toBeGreaterThan(0);
    return names;
  } catch {
    // Only inspect the store modal; do not put recipient PII into evidence.
    const filterButtons = dialog.locator('button[aria-haspopup="listbox"]');
    const cityFilter = await filterButtons.first().innerText().catch(() => '(không đọc được)');
    const wardFilter = await filterButtons.nth(1).innerText().catch(() => '(không đọc được)');
    const allNames = await listedStores(page).catch(() => []);
    const modalText = (await dialog.innerText().catch(() => '')).slice(0, 7000);
    await test.info().attach(`F08_013_${stage}_debug.txt`, {
      body: Buffer.from([
        `Mong đợi: ${city}`,
        `Nhãn lọc thành phố: ${cityFilter}`,
        `Nhãn lọc phường/xã: ${wardFilter}`,
        `Tổng số tên cửa hàng đọc được: ${allNames.length}`,
        `Tên cửa hàng: ${allNames.join(' | ')}`,
        `Nội dung modal:\n${modalText}`,
      ].join('\n'), 'utf8'),
      contentType: 'text/plain',
    });
    await test.info().attach(`F08_013_${stage}_screenshot.png`, {
      body: await page.screenshot(), contentType: 'image/png',
    });
    throw new Error(
      `F08_013: đã chọn ${city}, nhưng sau 25 giây vẫn không xác minh được ` +
      `cửa hàng thuộc thành phố này ở bước ${stage}. ` +
      `Bộ lọc hiển thị: thành phố="${cityFilter}", phường="${wardFilter}". ` +
      `Xem attachments để phân biệt dữ liệu rỗng, lọc phường còn lưu hay locator sai.`,
    );
  }
}

async function cart(page: Page) {
  await page.goto('https://didongviet.vn/cart', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Giỏ hàng của bạn', { exact: true })).toBeVisible();
}
async function resumeFromCart(page: Page) {
  await expect(page).toHaveURL(/\/cart(?:[/?#]|$)/);
  const resume=page.getByRole('button',{name:/^MUA NGAY\s*\(\d+\)$/i}).first();
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/,{timeout:30000});
  await openDeliveryPanel(page);
}
/**
 * F08_029: user-confirmed behavior (31/10/2026) for the guest flow is:
 * home -> product -> MUA NGAY -> checkout -> header Back -> PRODUCT DETAIL.
 * A direct /cart assertion was WRONG. After verifying Back, enter the cart as
 * a SEPARATE setup/navigation action, then resume checkout from the cart.
 * Do not pretend that the Back button itself opened /cart.
 */
async function returnToCartFromCheckout(page: Page) {
  const deliveryDialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Thông tin giao hàng', exact: true }),
  });
  if (await deliveryDialog.isVisible().catch(() => false)) {
    const close = deliveryDialog.locator('button').first();
    await expect(close, 'Không tìm thấy nút đóng panel người nhận').toBeVisible();
    await close.click();
    await expect(deliveryDialog).toBeHidden({ timeout: 10_000 });
  }

  await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
  const title = page.getByRole('heading', { name: 'Thanh toán', exact: true });
  await expect(title, 'Không tìm thấy tiêu đề trang Thanh toán').toBeVisible();
  const headerBack = title.locator('xpath=..').locator('button').first();
  await expect(headerBack,
    'Không tìm thấy nút mũi tên quay lại cạnh tiêu đề Thanh toán').toBeVisible();
  await headerBack.click();

  // Wait for a real navigation, not just a click; reject unknown destinations.
  await expect(page, 'Nhấn Back phải rời trang checkout')
    .not.toHaveURL(/\/checkout(?:[/?#]|$)/, { timeout: 20_000 });
  const backPath = new URL(page.url()).pathname;
  if (backPath === '/cart') {
    await addTestNote('[F08_029] Back thực tế trở về /cart ở lần chạy này.');
  } else if (/^\/dien-thoai\/[^/]+/.test(backPath)) {
    // Observed URL: /dien-thoai/iphone-17-256gb.html (product detail).
    await expect(page.getByRole('button', { name: /^MUA NGAY$/i }).first(),
      'Back phải trở về đúng trang sản phẩm').toBeVisible({ timeout: 12_000 });
    await addTestNote(`[F08_029] Back -> ${backPath} (trang sản phẩm), KHÔNG PHẢI /cart. ` +
      'Mở /cart như bước tiếp theo riêng biệt để kiểm tra giỏ còn sản phẩm.');
    await cart(page); // Deliberate cart setup, NOT a claim about the Back button.
  } else {
    throw new Error(`F08_029: Back đến trang không nằm trong luồng đã xác minh: ${page.url()}`);
  }

  await expect(page).toHaveURL(/\/cart(?:[/?#]|$)/);
  await expect(page.getByText('Giỏ hàng của bạn', { exact: true })).toBeVisible();
  // Check that the originally selected product survived the round trip.
  await expect(page.getByText(/iPhone (?:17 256GB|16 128GB)/i).first(),
    'Sau khi Back, giỏ hàng phải còn sản phẩm kiểm thử').toBeVisible();
}

test.describe("ASM08 | F08 | D08 | 30 scenarios (12 refined after ASM06)", () => {
  test.describe.configure({ timeout: 165_000 });
  /** ASM06 DDV_F08_001
   * 1. Nhóm trường nhận địa chỉ giao hàng hiển thị và cho phép nhập theo yêu cầu; tóm tắt phương thức chính xác.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_001 - Chọn hình thức nhận: Chọn giao tận nơi", async ({ page }) => {
    const p=await ready(page); await chooseDelivery(p); await expect(addressOpenButton(p)).toBeVisible(); await assertProductStillPresent(p);
  });

  /** ASM06 DDV_F08_002
   * 1. Hiển thị điều khiển chọn điểm nhận phù hợp; không bắt nhập địa chỉ giao tận nơi khi nhận tại quầy.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_002 - Chọn hình thức nhận: Chọn nhận tại cửa hàng", async ({ page }) => {
    const p=await ready(page); await choosePickup(p); await assertProductStillPresent(p);
  });

  /** ASM06 DDV_F08_003
   * 1. Các trường địa chỉ giao không còn bắt buộc; mục chọn chi nhánh được hiển thị; tóm tắt cập nhật.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_003 - Chọn hình thức nhận: Chuyển giao sang cửa hàng", async ({ page }) => {
    const p=await ready(page); await chooseDelivery(p); await choosePickup(p); await expect(p.getByText(/chọn cửa hàng|chọn chi nhánh|điểm nhận/i).first()).toBeVisible(); await assertProductStillPresent(p);
  });

  /** ASM06 DDV_F08_004
   * 1. Trường nhập địa chỉ hiện lại; chi nhánh cũ không được dùng làm địa chỉ giao; tóm tắt cập nhật.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_004 - Chọn hình thức nhận: Chuyển cửa hàng sang giao", async ({ page }) => {
    const p=await ready(page); await choosePickup(p); await chooseDelivery(p); await expect(addressOpenButton(p)).toBeVisible(); await assertProductStillPresent(p);
  });

  /** ASM06 DDV_F08_005
   * 1. Không tạo bản ghi lựa chọn trùng, không làm đổi sai dữ liệu hay phí giao.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_005 - Chọn hình thức nhận: Chọn lại phương thức hiện tại", async ({ page }) => {
    const p=await ready(page); await chooseDelivery(p); const first=await deliveryButton(p).getAttribute('class'); await chooseDelivery(p); await expect(addressOpenButton(p)).toBeVisible(); const second=await deliveryButton(p).getAttribute('class'); expect(second,'Repeated selection changed mode styling unexpectedly').toBe(first); await assertProductStillPresent(p);
  });

  /** ASM06 DDV_F08_006
   * 1. Danh sách khu vực phụ thuộc cập nhật đúng với tỉnh A; không hiển thị dữ liệu tỉnh khác như lựa chọn hợp lệ.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_006 - Địa chỉ giao tận nơi: Chọn tỉnh/thành A", async ({ page }) => {
    const p=await ready(page); await chooseDelivery(p); await openAddressPicker(p); await chooseCity(p,HCM); await expect(p.getByPlaceholder(/Tìm kiếm Phường\/Xã/i)).toBeVisible(); await expect(p.getByRole('button', { name: HCM, exact: true })).toBeVisible();
  });

  /** ASM06 DDV_F08_007
   * 1. Danh sách Phường/Xã chỉ hiển thị các địa bàn thuộc Thành phố được chọn.
   * 2. Chọn Phường hợp lệ kích hoạt bước Số nhà, tên đường.
   * 3. Không làm thay đổi SKU/người nhận ngoài thao tác đã kiểm thử.
   */
  test("DDV_F08_007 - Địa chỉ giao tận nơi: Chọn Phường/Xã theo Thành phố", async ({ page }) => {
    const p=await ready(page); await addressStep2(p); await chooseWard(p,WARD); await expect(p.getByRole('button', { name: WARD, exact: true })).toBeVisible(); await expect(p.getByPlaceholder('Nhập số nhà, tên đường',{exact:true})).toBeEditable();
  });

  /** ASM06 DDV_F08_008
   * 1. Thành phố, Phường/Xã và số nhà/tên đường được lưu/hiển thị đúng thứ tự.
   * 2. Không chấp nhận địa chỉ không thuộc Thành phố đã chọn.
   * 3. Không tự tạo đơn.
   */
  test("DDV_F08_008 - Địa chỉ giao tận nơi: Hoàn tất Phường/Xã và địa chỉ đường", async ({ page }) => {
    const p=await ready(page); await savedDeliveryAddress(p); await expect(p.getByText(/Bến Thành|Hồ Chí Minh/i).first()).toBeVisible(); await assertCheckoutSafe(p);
  });

  /** ASM06 DDV_F08_009
   * 1. Phường/Xã cũ được reset khi Thành phố thay đổi, không để địa chỉ ghép sai địa giới.
   * 2. Form yêu cầu lựa chọn Phường/Xã hợp lệ của Thành phố mới.
   */
  test("DDV_F08_009 - Địa chỉ giao tận nơi: Đổi Thành phố làm mới Phường/Xã", async ({ page }) => {
    const p=await ready(page); await addressStep3(p); const reset=p.getByText('Thiết lập lại',{exact:true}); await expect(reset).toBeVisible(); await reset.click(); await chooseCity(p,HANOI); await expect(p.getByPlaceholder(/Tìm kiếm Phường\/Xã/i)).toBeVisible(); await expect(p.getByText(WARD,{exact:true})).toHaveCount(0); await addTestNote('Thiết lập lại -> đổi TP: lựa chọn Phường/Xã cũ không còn. Chuyển tỉnh trực tiếp không được giả định.');
  });

  /** ASM06 DDV_F08_010
   * 1. Nếu địa chỉ chi tiết bắt buộc: hiển thị cảnh báo, không chuyển đến xác nhận với địa chỉ thiếu.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_010 - Địa chỉ giao tận nơi: Xóa địa chỉ chi tiết", async ({ page }) => {
    const p=await ready(page); await addressStep3(p); const field=p.getByPlaceholder('Nhập số nhà, tên đường',{exact:true}); await field.fill(''); const save=addressConfirm(p); await expect(save).toBeVisible(); if(await save.isEnabled()){await save.click(); await expect(p.getByText('Thêm địa chỉ nhận hàng',{exact:true})).toBeVisible();} else {await expect(save).toBeDisabled();} await expect(field).toHaveValue(''); await assertCheckoutSafe(p);
  });

  /** ASM06 DDV_F08_011
   * 1. Hiển thị đúng tên và địa chỉ chi nhánh; chi nhánh được đánh dấu chọn.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_011 - Chọn cửa hàng nhận: Chọn chi nhánh đầu tiên", async ({ page }) => {
    const p = await ready(page);
    // Test 011 verifies selecting the first visible store, not city filtering.
    // Do not open the city dropdown unnecessarily.
    await openStorePicker(p);
    const available = await listedStores(p);
    expect(available.length).toBeGreaterThan(0);
    const chosen = await selectListedStore(p, available[0]);
    await expect(p.getByText('Nhận tại', { exact: true })).toBeVisible();
    await expect(p.getByText(chosen, { exact: true })).toBeVisible();
    await assertProductStillPresent(p);
    await addTestNote(`[F08_011] Đã chọn cửa hàng đang hiển thị: ${chosen}`);
  });

  /** ASM06 DDV_F08_012
   * 1. Tên/địa chỉ điểm nhận cập nhật theo điểm vừa chọn, không giữ chi nhánh cũ.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_012 - Chọn cửa hàng nhận: Chọn chi nhánh khác cùng tỉnh", async ({ page }) => {
    const p = await ready(page);
    await openStorePicker(p);
    const available = await listedStoresInCity(p, HCM);
    test.skip(available.length < 2,
      `BLOCKED: Chỉ đọc được ${available.length} cửa hàng thuộc ${HCM} trên danh sách đang hiển thị; không thể kiểm chứng đổi chi nhánh A → B cùng khu vực.`);
    // Preserve BOTH candidates before saving A. Reopening a stateful dialog
    // may restore a filter, pagination or scroll position, so re-parsing the
    // visible subset can incorrectly mark the test Skipped (observed in V7).
    const [storeA, storeB] = available;
    expect(storeB, 'Hai tên cửa hàng phải khác nhau').not.toBe(storeA);
    await addTestNote(`[F08_012] Hai cửa hàng cùng ${HCM}: ${storeA} | ${storeB}`);
    const old = await selectListedStore(p, storeA);
    await openStorePicker(p);
    const dialog = storeDialog(p);
    const nextLocator = dialog.getByText(storeB, { exact: true }).first();

    // V9 - VERIFIED FAILURE ROOT CAUSE (31/10/2026):
    // Reopening after saving Trần Não restores City=HCM AND Ward=An Khánh.
    // Hàm Nghi is in HCM but a DIFFERENT ward, therefore the inherited ward
    // filter hides it. Filling the street-search alone will return
    // "Không tìm thấy cửa hàng phù hợp". Reset the WARD filter first.
    const wardTrigger = dialog.locator('button[aria-haspopup="listbox"]').nth(1);
    const streetSearch = dialog.getByPlaceholder('Tìm kiếm bằng tên đường', { exact: true });
    if (await streetSearch.isVisible().catch(() => false)) {
      await streetSearch.fill('');
    }

    if (!(await nextLocator.isVisible().catch(() => false))) {
      const wardLabel = await wardTrigger.innerText().catch(() => '');
      const wardSelected = wardLabel.trim().length > 0 &&
        !/chọn\s*phường\s*\/?\s*xã/i.test(wardLabel);
      if (wardSelected) {
        await addTestNote(`[F08_012] Bộ lọc Phường/Xã còn lưu sau khi mở lại: ${wardLabel.trim()}`);
        // Prefer the real clear (X) control when the custom selector exposes it.
        const clearWard = wardTrigger.locator(
          'svg.lucide-x, svg[data-lucide="x"], [aria-label="Xóa"], [aria-label="Bỏ chọn"]'
        ).first();
        if (await clearWard.isVisible().catch(() => false)) {
          await clearWard.click();
        }
        // Fallback: changing City away and back must clear its dependent Ward.
        // City selector was independently confirmed in DDV_F08_013.
        const wardStillSelected = (await wardTrigger.innerText().catch(() => '')).trim();
        if (wardStillSelected && !/chọn\s*phường\s*\/?\s*xã/i.test(wardStillSelected)) {
          await setStoreCity(p, HANOI);
          await setStoreCity(p, HCM);
        }
        await expect(wardTrigger,
          'Bộ lọc Phường/Xã phải được xóa trước khi chọn chi nhánh B cùng thành phố'
        ).toContainText(/chọn\s*phường\s*\/?\s*xã/i, { timeout: 12_000 });
        await addTestNote('[F08_012] Đã xóa bộ lọc Phường/Xã; giữ/khôi phục Thành phố Hồ Chí Minh.');
      }
    }
    if (!(await nextLocator.isVisible().catch(() => false))) {
      // The City filter is an independent verified action; do not click any
      // matching city text in store cards.
      await setStoreCity(p, HCM);
    }
    if (!(await nextLocator.isVisible().catch(() => false))) {
      // Some lists virtualize the cards. Search for the distinctive store name.
      if (await streetSearch.isVisible().catch(() => false)) {
        const storeQuery = storeB.replace(/^Cửa hàng Di Động Việt\s+/i, '').trim();
        await streetSearch.fill(storeQuery);
      }
    }
    if (!(await nextLocator.isVisible().catch(() => false))) {
      await test.info().attach('F08_012_reopened_store_list.txt', {
        body: Buffer.from(
          `Cửa hàng A: ${storeA}\nCửa hàng B dự kiến: ${storeB}\n` +
          `Bộ lọc thành phố: ${await dialog.locator('button[aria-haspopup="listbox"]').first().innerText().catch(() => 'not-found')}\n` +
          `Bộ lọc phường/xã: ${await wardTrigger.innerText().catch(() => 'not-found')}\n` +
          `Danh sách đang hiển thị sau khi mở lại:\n${await dialog.innerText()}`,
          'utf8',
        ),
        contentType: 'text/plain',
      });
      await test.info().attach('F08_012_reopened_store_list.png', {
        body: await p.screenshot(),
        contentType: 'image/png',
      });
    }
    await expect(nextLocator,
      `Đã tìm thấy ${storeB} cùng thành phố lúc đầu, nhưng không thể chọn lại ` +
      'sau khi lưu A. Kiểm tra ảnh và danh sách cửa hàng đính kèm.'
    ).toBeVisible({ timeout: 10_000 });
    await selectListedStore(p, storeB);
    const panel = recipientDialog(p);
    await expect(panel.getByText(storeB, { exact: true }),
      'Form giao hàng phải hiển thị cửa hàng B sau khi thay đổi').toBeVisible();
    await expect(panel.getByText(old, { exact: true }),
      'Form giao hàng không được giữ cửa hàng A sau khi chọn B').toBeHidden();
    await assertCheckoutSafe(p);
    await addTestNote(`[F08_012] Đổi chi nhánh cùng thành phố: ${old} -> ${storeB}`);
  });

  /** ASM06 DDV_F08_013
   * 1. Danh sách cửa hàng làm mới theo khu vực; lựa chọn cửa hàng cũ không hợp lệ bị xóa.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_013 - Chọn cửa hàng nhận: Đổi tỉnh trước khi chọn", async ({ page }) => {
    // This case filters twice and waits for two async results; avoid the
    // default 30s test deadline while keeping bounded, explicit waits.
    test.setTimeout(100_000);
    const p = await ready(page);
    await openStorePicker(p);
    await setStoreCity(p, HCM);
    const initial = await waitForStoresInCityFor013(p, HCM, 'hcm');
    await addTestNote(`[F08_013] ${HCM}: ${initial.length} cửa hàng có địa bàn khớp`);
    await setStoreCity(p, HANOI);
    const changed = await waitForStoresInCityFor013(p, HANOI, 'hanoi');
    await addTestNote(`[F08_013] ${HANOI}: ${changed.length} cửa hàng có địa bàn khớp`);
    // Assert a genuine change in regional store results, not just the label.
    expect(changed.some(name => !initial.includes(name)),
      'Đổi thành phố phải làm xuất hiện chi nhánh khác với danh sách ban đầu').toBeTruthy();
    // No store is selected yet. Confirm must remain disabled.
    await expect(storeConfirm(p)).toBeDisabled();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_014 (replaces unavailable-stock fixture).
   * Negative test: pickup store is mandatory; the store modal cannot confirm
   * until an explicit radio choice is made.
   */
  test('DDV_F08_014 - Điểm nhận bắt buộc: Chưa chọn chi nhánh không thể xác nhận', async ({ page }) => {
    const p=await ready(page);
    await openStorePicker(p);
    expect((await listedStores(p)).length).toBeGreaterThan(0);
    await expect(storeConfirm(p), 'Không được xác nhận khi chưa chọn cửa hàng').toBeDisabled();
    await expect(recipientDialog(p).getByText('Nhận tại', { exact:true })).toHaveCount(0);
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_015 (single-choice radio cannot be de-selected).
   * State transition: close an unmodified store selector using Escape/X.
   */
  test('DDV_F08_015 - Hủy mở danh sách: Không tự chọn điểm nhận', async ({ page }) => {
    const p=await ready(page);
    await openStorePicker(p);
    await expect(storeConfirm(p)).toBeDisabled();
    await dismissStoreDialog(p);
    await expect(recipientDialog(p).getByText('Chọn cửa hàng gần nhất', { exact:true }),
      'Đóng modal không được tự lưu chi nhánh').toBeVisible();
    await assertProductStillPresent(p);
  });

  /** REVISED DDV_F08_016 (replaces unverified HCM shipping fee).
   * Address city search negative partition: invalid city is not selectable;
   * search can be corrected to a real city without a reload.
   */
  test('DDV_F08_016 - Địa chỉ giao: Tìm tỉnh thành không tồn tại rồi nhập lại', async ({ page }) => {
    const p=await ready(page);
    await chooseDelivery(p);
    await openAddressPicker(p);
    const search=p.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i);
    await expect(search).toBeVisible();
    const realCityOption=p.getByText(HCM,{exact:true}).last();
    // First prove the valid city is actually in the search results.
    await search.fill(HCM);
    await expect(realCityOption,
      'Từ khóa hợp lệ phải hiện lựa chọn Thành phố Hồ Chí Minh').toBeVisible();
    // An invalid query must remove the VALID city option, not hide next-step
    // inputs: DDV renders those inputs throughout the address wizard.
    await search.fill('ZXCV_TINH_THANH_KHONG_TON_TAI_98765');
    await expect(realCityOption,
      'Từ khóa không tồn tại không được tiếp tục gợi ý TP.HCM').toHaveCount(0);
    await chooseCity(p,HCM);
    await expect(p.getByRole('button',{name:HCM,exact:true}),
      'Sau khi sửa từ khóa, TP.HCM phải được chọn').toBeVisible();
    await expect(p.getByPlaceholder(/Tìm kiếm Phường\/Xã/i)).toBeVisible();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_017 (replaces unverified inter-province shipping fee).
   * Address ward search negative partition and correction.
   */
  test('DDV_F08_017 - Địa chỉ giao: Tìm phường không tồn tại rồi chọn phường hợp lệ', async ({ page }) => {
    const p=await ready(page);
    await addressStep2(p);
    const search=p.getByPlaceholder(/Tìm kiếm Phường\/Xã/i);
    await expect(search).toBeVisible();
    const validWardOption=p.getByText(WARD,{exact:true}).last();
    await search.fill(WARD);
    await expect(validWardOption,
      'Từ khóa hợp lệ phải tìm thấy Phường Bến Thành').toBeVisible();
    // The street input remains mounted and visible even during ward search.
    // Verify that the valid choice is FILTERED OUT by the impossible query.
    await search.fill('ZXCV_PHUONG_KHONG_TON_TAI_98765');
    await expect(validWardOption,
      'Từ khóa phường không tồn tại không được gợi ý Phường Bến Thành').toHaveCount(0);
    await chooseWard(p,WARD);
    await expect(p.getByRole('button',{name:WARD,exact:true}),
      'Sau khi sửa từ khóa, phường hợp lệ phải được chọn').toBeVisible();
    await expect(p.getByPlaceholder('Nhập số nhà, tên đường',{exact:true})).toBeEditable();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_018 (replaces unverified pickup shipping fee).
   * Positive input-data class: street addresses with Vietnamese accents,
   * house number, punctuation; modal confirm is safe, never purchase CTA.
   */
  test('DDV_F08_018 - Địa chỉ giao: Lưu số nhà và tên đường có dấu tiếng Việt', async ({ page }) => {
    const p=await ready(page);
    await addressStep3(p);
    const street='24B, Đường Nguyễn Thị Minh Khai';
    await fillStreet(p,street);
    await saveAddressOnly(p);
    await expect(p.getByText(/Nguyễn Thị Minh Khai/i).first(),
      'Tóm tắt giao hàng phải giữ đúng tên đường tiếng Việt sau khi lưu').toBeVisible();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_019 (replaces SKU change and cart removal).
   * City picker negative search: invalid query yields no selectable cities,
   * city filter itself must not change.
   */
  test('DDV_F08_019 - Lọc điểm nhận: Tìm thành phố không tồn tại', async ({ page }) => {
    const p=await ready(page);
    await openStorePicker(p);
    const city=cityFilterButton(p);
    await expect(city).toContainText(/Chọn Tỉnh\/Thành Phố/i);
    await city.click();
    const search=p.getByPlaceholder('Tìm kiếm...', { exact:true });
    await expect(search).toBeVisible();
    const before=await visibleCityPopupChoices(p);
    expect(before.length, 'Popup phải có ít nhất một lựa chọn thành phố trước khi tìm').toBeGreaterThan(0);
    await search.fill('ZXCV_CITY_NOT_FOUND_98765');
    await expect.poll(() => visibleCityPopupChoices(p), {
      message:'Không được hiển thị lựa chọn thành phố khi tìm kiếm không hợp lệ',
      timeout: 8_000,
    }).toEqual([]);
    await expect(city).toContainText(/Chọn Tỉnh\/Thành Phố/i);
    await search.fill('');
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_020 (replaces unmapped cart quantity DOM).
   * Positive city autocomplete: a PARTIAL query resolves to the exact city.
   */
  test('DDV_F08_020 - Lọc điểm nhận: Tìm thành phố bằng từ khóa một phần', async ({ page }) => {
    const p=await ready(page);
    await openStorePicker(p);
    await setStoreCity(p,HANOI,'Hà');
    await expect(cityFilterButton(p)).toContainText('Hà Nội');
    const names=await waitForStoresInCityFor013(p,HANOI,'partial-city');
    expect(names.length).toBeGreaterThan(0);
    await expect(storeConfirm(p)).toBeDisabled();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_021 (replaces unavailable accessory fixture).
   * Negative search: no unrelated store may be offered as a match.
   */
  test('DDV_F08_021 - Tìm tên đường không tồn tại: Hiển thị danh sách rỗng', async ({ page }) => {
    const p=await ready(page);
    await openStorePicker(p);
    const search=storeStreetSearch(p);
    await expect(search).toBeVisible();
    await search.fill('ZXCV_DUONG_KHONG_TON_TAI_98765');
    await expect(storeDialog(p).getByText('Không tìm thấy cửa hàng phù hợp', { exact:true }),
      'Tìm đường không tồn tại phải hiển thị không có kết quả').toBeVisible({ timeout:15_000 });
    expect(await listedStores(p),'Kết quả không khớp không được còn thẻ cửa hàng').toEqual([]);
    await expect(storeConfirm(p)).toBeDisabled();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_022 (replaces multicart fixture).
   * Reversibility: clearing a no-match road query restores eligible stores.
   */
  test('DDV_F08_022 - Xóa từ khóa tên đường: Danh sách cửa hàng được khôi phục', async ({ page }) => {
    const p=await ready(page);
    await openStorePicker(p);
    const initial=await listedStores(p);
    expect(initial.length).toBeGreaterThan(0);
    const search=storeStreetSearch(p);
    await expect(search).toBeVisible();
    await search.fill('ZXCV_DUONG_KHONG_TON_TAI_98765');
    await expect(storeDialog(p).getByText('Không tìm thấy cửa hàng phù hợp', { exact:true }))
      .toBeVisible({ timeout:15_000 });
    await search.fill('');
    await expect.poll(async()=> (await listedStores(p)).filter(n=>initial.includes(n)).length, {
      message:'Xóa từ khóa phải trả lại ít nhất một chi nhánh ban đầu', timeout:15_000,
    }).toBeGreaterThan(0);
    await expect(storeConfirm(p)).toBeDisabled();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_023 (replaces authorized available-variant fixture).
   * Positive filter using a street name sourced from LIVE displayed stores.
   */
  test('DDV_F08_023 - Tìm tên đường có thật: Lọc đúng chi nhánh tương ứng', async ({ page }) => {
    const p=await ready(page);
    await openStorePicker(p);
    const names=await listedStores(p);
    expect(names.length).toBeGreaterThan(0);
    const knownStreets=['Trần Não','Hàm Nghi','Quang Trung','Nguyễn Oanh','Hoàng Văn Thụ',
      'Trần Quang Khải','Huỳnh Tấn Phát','3/2','Đường 3/2','Bà Hom','Lê Văn Việt',
      'Phạm Văn Đồng','Nguyễn Thị Minh Khai','Nguyễn Văn Linh','Lê Hồng Phong'];
    const match=names.flatMap(name => knownStreets.filter(street => name.includes(street))
      .map(street => ({name,street})))[0];
    expect(match,
      'Danh sách thực tế không chứa tên đường xác minh được; cần đọc DOM để chọn fixture đường phù hợp'
    ).toBeDefined();
    const search=storeStreetSearch(p);
    await expect(search).toBeVisible();
    await search.fill(match!.street);
    await expect(storeDialog(p).getByText(match!.name,{exact:true}).first(),
      `Tìm '${match!.street}' phải hiển thị cửa hàng '${match!.name}'`).toBeVisible({timeout:15_000});
    await expect(storeDialog(p).getByText('Không tìm thấy cửa hàng phù hợp',{exact:true}))
      .toHaveCount(0);
    await expect(storeConfirm(p)).toBeDisabled();
    await assertCheckoutSafe(p);
  });

  /** REVISED DDV_F08_024 (replaces unavailable-variant fixture).
   * Persistence: reopening the saved pickup and cancelling without change
   * must not overwrite the saved store.
   */
  test('DDV_F08_024 - Điểm nhận đã lưu: Mở lại rồi đóng không thay đổi chi nhánh', async ({ page }) => {
    const p=await ready(page);
    const saved=await pickStoreByName(p);
    await openStorePicker(p);
    await dismissStoreDialog(p);
    await expect(recipientDialog(p).getByText(saved,{exact:true}).first(),
      'Đóng modal không được làm mất chi nhánh đang lưu').toBeVisible();
    await assertProductStillPresent(p);
  });

  /** REVISED DDV_F08_025 (replaces combo/multicart fixture).
   * Cancellation: edit the store road search but exit without confirming;
   * currently saved pickup must remain unchanged.
   */
  test('DDV_F08_025 - Điểm nhận đã lưu: Hủy tìm kiếm khác không đổi lựa chọn cũ', async ({ page }) => {
    const p=await ready(page);
    const saved=await pickStoreByName(p);
    await openStorePicker(p);
    const search=storeStreetSearch(p);
    await expect(search).toBeVisible();
    await search.fill('ZXCV_DUONG_KHONG_TON_TAI_98765');
    await expect(storeDialog(p).getByText('Không tìm thấy cửa hàng phù hợp',{exact:true}))
      .toBeVisible({timeout:15_000});
    await dismissStoreDialog(p);
    await expect(recipientDialog(p).getByText(saved,{exact:true}).first(),
      'Từ khóa tìm kiếm không được tự thay điểm nhận đã lưu').toBeVisible();
    await assertProductStillPresent(p);
  });

  /** ASM06 DDV_F08_026
   * 1. Tóm tắt không còn hiển thị địa chỉ A như điểm nhận hiện tại; chi nhánh mới quyết định giao nhận.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_026 - Trạng thái điều hướng: Điền địa chỉ rồi đổi sang cửa hàng", async ({ page }) => {
    const p=await ready(page);await savedDeliveryAddress(p);await choosePickup(p);await expect(p.getByText(/chọn cửa hàng|chọn chi nhánh|điểm nhận/i).first()).toBeVisible(); await assertCheckoutSafe(p);
  });

  /** ASM06 DDV_F08_027
   * 1. Địa chỉ B là đích giao, không phải cửa hàng A; trường địa chỉ được kiểm tra bắt buộc.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_027 - Trạng thái điều hướng: Chọn cửa hàng rồi đổi giao", async ({ page }) => {
    const p = await ready(page);
    const name = await pickStoreByName(p);
    await expect(recipientDialog(p).getByText(name, { exact: true }).first()).toBeVisible();
    await chooseDelivery(p);
    await expect(addressOpenButton(p)).toBeVisible();
    await expect(recipientDialog(p).getByText(name, { exact: true })).toBeHidden();
    await assertCheckoutSafe(p);
    await addTestNote(`[F08_027] Đã chọn cửa hàng ${name} -> chuyển giao tận nơi; cửa hàng cũ không còn hiển thị là địa chỉ giao.`);
  });

  /** ASM06 DDV_F08_028
   * 1. Trạng thái cuối là giao tận nơi; các trường phụ thuộc và tóm tắt phản ánh lựa chọn cuối.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_028 - Trạng thái điều hướng: Đổi qua lại 2 lần", async ({ page }) => {
    const p=await ready(page);await chooseDelivery(p);await choosePickup(p);await chooseDelivery(p);await expect(addressOpenButton(p)).toBeVisible();await assertCheckoutSafe(p);
  });

  /** ASM06 DDV_F08_029
   * 1. Giỏ hàng không bị đổi; phương thức được khôi phục hoặc yêu cầu chọn lại rõ ràng, không tự chọn sai.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_029 - Trạng thái điều hướng: Quay lại giỏ rồi trở lại", async ({ page }) => {
    const p=await ready(page);
    await chooseDelivery(p);
    await returnToCartFromCheckout(p);
    await resumeFromCart(p);
    await expect(deliveryButton(p)).toBeVisible();
    await expect(pickupButton(p)).toBeVisible();
    // If the mode was reset during navigation, the user can explicitly select it again.
    await chooseDelivery(p);
    await expect(addressOpenButton(p)).toBeVisible();
    await assertProductStillPresent(p);
    await addTestNote('[F08_029] Trở lại checkout từ giỏ; nút chọn giao/nhận và SKU còn hiển thị. ' +
      'Trạng thái phương thức giữ/reset cần đặc tả chính thức để kết luận sâu hơn.');
  });

  /** ASM06 DDV_F08_030
   * 1. Không phát sinh đơn; hệ thống giữ/đặt lại lựa chọn nhất quán và không hiển thị điểm nhận sai.
   * 2. Sản phẩm và thông tin người nhận không bị thay đổi ngoài thao tác đã nêu.
   * 3. Nếu không có điều kiện dữ liệu kiểm thử, ghi Blocked khi thực thi.
   */
  test("DDV_F08_030 - Trạng thái điều hướng: Refresh trước khi xác nhận", async ({ page }) => {
    const p = await ready(page);
    const selectedStoreName = await pickStoreByName(p);

    // Only refresh checkout. Never press the final ĐẶT HÀNG button.
    await p.reload({ waitUntil: 'domcontentloaded' });

    // F07_030 verified that DDV can redirect /checkout -> /cart AFTER the
    // reload resolves. Do not decide the route immediately while hydration
    // is still replacing the temporary checkout DOM.
    await p.waitForURL(url => url.pathname === '/cart', {
      timeout: 7_000,
    }).catch(() => {});

    let routeAfterRefresh = new URL(p.url()).pathname;
    if (routeAfterRefresh === '/cart') {
      // Safe CART MUA NGAY returns to checkout; this is NOT checkout's
      // ĐẶT HÀNG final-order action.
      await resumeFromCart(p);
    } else if (routeAfterRefresh === '/checkout') {
      await expect(p.getByRole('button', {
        name: /^ĐẶT HÀNG\s*(?:\(\d+\))?$/i,
      }).first(), 'Checkout chưa render xong sau khi tải lại')
        .toBeVisible({ timeout: 20_000 });

      try {
        // React may re-create #delivery-address-card repeatedly during
        // hydration. Retry the WHOLE open-panel action, not a stale element.
        await expect(async () => {
          await expect(p).toHaveURL(/\/checkout(?:[/?#]|$)/, { timeout: 2_500 });
          if (await recipientDialog(p).isVisible().catch(() => false)) return;
          const edit = p.locator('#delivery-address-card');
          await expect(edit, 'Nút chỉnh sửa người nhận chưa sẵn sàng')
            .toBeVisible({ timeout: 3_500 });
          await edit.click({ timeout: 3_500 });
          await expect(recipientDialog(p), 'Panel giao hàng chưa mở sau Refresh')
            .toBeVisible({ timeout: 3_500 });
        }).toPass({ timeout: 28_000, intervals: [400, 800, 1_400, 2_400] });
      } catch (error) {
        // A late SPA redirect can occur while attempting to click. Recover
        // only from the known /cart route; do not hide genuine UI failures.
        if (new URL(p.url()).pathname !== '/cart') throw error;
        routeAfterRefresh = '/cart';
        await resumeFromCart(p);
      }
    } else {
      throw new Error(
        `F08_030: Refresh dẫn đến đường dẫn chưa được xác minh: ${p.url()}`,
      );
    }

    const panel = recipientDialog(p);
    await expect(panel, 'Không mở lại được Thông tin giao hàng sau Refresh')
      .toBeVisible({ timeout: 15_000 });
    await expect(deliveryButton(p)).toBeVisible();
    await expect(pickupButton(p)).toBeVisible();
    await assertProductStillPresent(p);

    // All three observable outcomes are consistent with an UNSPECIFIED
    // retention policy: selected store retained, pickup reset to unselected,
    // or checkout reset to home delivery. Never assert a made-up policy.
    const storeRetained = await panel.getByText(selectedStoreName, { exact: true })
      .first().isVisible().catch(() => false);
    const emptyPickup = await panel.getByText('Chọn cửa hàng gần nhất', { exact: true })
      .isVisible().catch(() => false);
    const defaultDelivery = await addressOpenButton(p).isVisible().catch(() => false);

    expect(
      Number(storeRetained) + Number(emptyPickup) + Number(defaultDelivery),
      'Sau Refresh: không xác định được phương thức giao/nhận hoặc UI đang hiển thị các trạng thái mâu thuẫn',
    ).toBe(1);

    const outcome = storeRetained ? 'pickup-store-retained'
      : emptyPickup ? 'pickup-needs-store' : 'delivery-mode-reset';
    await addTestNote(
      `[F08_030] Refresh /checkout -> ${routeAfterRefresh} -> /checkout; ` +
      `store=${selectedStoreName}; observed=${outcome}; no real order submitted. ` +
      'Chính sách giữ/xóa lựa chọn sau refresh cần đối chiếu đặc tả chính thức.',
    );
    await assertCheckoutSafe(p);
  });

});
