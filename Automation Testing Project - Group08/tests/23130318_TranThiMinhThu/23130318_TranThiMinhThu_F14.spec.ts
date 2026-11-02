import { test, expect, type Page } from '@playwright/test';
import {
  COD, VNPAY, METHODS, HIGH_PRODUCT, openCheckout, dismissCookies,
  paymentDialog, method, openMethods, closeMethods, assertExclusive, selectMethod,
  total, summaryRow, money, orderSnapshot, assertNoPurchase, assertNoCardInputs,
  openDeliveryDraft, closeDeliveryDraft, addressDialog,
} from './payment-helpers';

/**
 * F14 / 23130318 Trần Thị Minh Thư – 30 case CHECKOUT thực tế.
 * Mảng cases bên dưới chứa ID/tên/bước/kỳ vọng đã đồng bộ Excel và TestDesign.
 * Phạm vi được đổi theo yêu cầu: chọn phương thức trên Chromium, chưa chuyển cổng.
 * Không sandbox, dữ liệu khách hàng, thẻ/OTP, xác nhận người nhận hay ĐẶT HÀNG.
 */
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 120_000 });

type F14Case = {
  id: string;
  title: string;
  group: string;
  steps: string[];
  expected: string[];
  highValue?: boolean;
};

const cases: F14Case[] = [
  {
    "id": "DDV_F14_001",
    "title": "Chọn thanh toán khi nhận hàng (COD)",
    "group": "F14.1 – Lựa chọn phương thức",
    "steps": [
      "Mở bộ chọn thanh toán, chọn Thanh toán khi nhận hàng và Xác nhận.",
      "Kiểm tra phương thức hiện hành và các trường thông tin thẻ."
    ],
    "expected": [
      "Checkout hiển thị Thanh toán khi nhận hàng; chỉ một phương thức được chọn.",
      "Không yêu cầu số thẻ, CVV hoặc OTP tại bước chọn COD."
    ]
  },
  {
    "id": "DDV_F14_002",
    "title": "Chọn OnePay tại checkout",
    "group": "F14.1 – Lựa chọn phương thức",
    "steps": [
      "Chọn OnePay và xác nhận phương thức."
    ],
    "expected": [
      "Thông tin thanh toán hiển thị OnePay; chưa điều hướng đến cổng hoặc tạo giao dịch."
    ]
  },
  {
    "id": "DDV_F14_003",
    "title": "Chọn Payoo tại checkout",
    "group": "F14.1 – Lựa chọn phương thức",
    "steps": [
      "Chọn Payoo và xác nhận phương thức."
    ],
    "expected": [
      "Thông tin thanh toán hiển thị Payoo, chỉ một lựa chọn hiện hành."
    ]
  },
  {
    "id": "DDV_F14_004",
    "title": "Chọn VNPay cho giỏ dưới hạn mức",
    "group": "F14.1 – Lựa chọn phương thức",
    "steps": [
      "Kiểm tra tổng giỏ dưới 20.000.000 đ.",
      "Chọn VNPay và xác nhận; mở lại bộ chọn."
    ],
    "expected": [
      "VNPay khả dụng và được lưu là phương thức hiện hành; chỉ một radio được chọn."
    ]
  },
  {
    "id": "DDV_F14_005",
    "title": "Chọn chuyển khoản ngân hàng SePay",
    "group": "F14.1 – Lựa chọn phương thức",
    "steps": [
      "Đọc mô tả SePay của Chuyển khoản ngân hàng.",
      "Chọn và xác nhận Chuyển khoản ngân hàng."
    ],
    "expected": [
      "Mô tả nhận diện SePay; checkout hiển thị Chuyển khoản ngân hàng sau xác nhận."
    ]
  },
  {
    "id": "DDV_F14_006",
    "title": "Chuyển từ COD sang VNPay",
    "group": "F14.2 – Chuyển đổi phương thức",
    "steps": [
      "Xác nhận COD, sau đó xác nhận VNPay.",
      "Mở lại bộ chọn và kiểm tra radio."
    ],
    "expected": [
      "VNPay được chọn; COD không còn được chọn; đúng một phương thức hiện hành."
    ]
  },
  {
    "id": "DDV_F14_007",
    "title": "Chuyển từ VNPay về COD",
    "group": "F14.2 – Chuyển đổi phương thức",
    "steps": [
      "Xác nhận VNPay, sau đó xác nhận COD.",
      "Kiểm tra phương thức và trường thông tin thẻ."
    ],
    "expected": [
      "COD được chọn duy nhất; không mở cổng thanh toán hoặc yêu cầu thẻ/OTP."
    ]
  },
  {
    "id": "DDV_F14_008",
    "title": "Chuyển từ OnePay sang Payoo",
    "group": "F14.2 – Chuyển đổi phương thức",
    "steps": [
      "Xác nhận OnePay, sau đó xác nhận Payoo.",
      "Mở lại bộ chọn."
    ],
    "expected": [
      "Payoo được chọn, OnePay bỏ chọn; không có hai lựa chọn đồng thời."
    ]
  },
  {
    "id": "DDV_F14_009",
    "title": "Đổi COD – VNPay – COD giữ nguyên đơn hàng",
    "group": "F14.2 – Chuyển đổi phương thức",
    "steps": [
      "Ghi tên sản phẩm, số lượng và tổng tiền.",
      "Lần lượt xác nhận COD, VNPay, COD; đối chiếu thông tin đơn."
    ],
    "expected": [
      "Kết thúc ở COD; tên sản phẩm, số lượng và tổng tiền không đổi."
    ]
  },
  {
    "id": "DDV_F14_010",
    "title": "Chọn lại phương thức COD đang dùng",
    "group": "F14.2 – Chuyển đổi phương thức",
    "steps": [
      "Xác nhận COD rồi chọn và xác nhận COD lần nữa."
    ],
    "expected": [
      "COD vẫn được chọn duy nhất; thông tin đơn không đổi, không tạo module thanh toán trùng."
    ]
  },
  {
    "id": "DDV_F14_011",
    "title": "Hiển thị nhãn COD và không yêu cầu trả trước",
    "group": "F14.3 – Thông tin phương thức",
    "steps": [
      "Chọn COD rồi mở lại bộ chọn.",
      "Đọc nhãn/mô tả COD và kiểm tra trường thẻ."
    ],
    "expected": [
      "Nhãn Thanh toán khi nhận hàng hiển thị; mục COD không yêu cầu thanh toán trước, số thẻ hoặc OTP."
    ]
  },
  {
    "id": "DDV_F14_012",
    "title": "Chọn Kim Ngân Pay tại checkout",
    "group": "F14.3 – Thông tin phương thức",
    "steps": [
      "Đọc mô tả Kim Ngân Pay.",
      "Chọn Kim Ngân Pay và xác nhận."
    ],
    "expected": [
      "Có mô tả thanh toán online qua ngân hàng; checkout lưu đúng Kim Ngân Pay."
    ]
  },
  {
    "id": "DDV_F14_013",
    "title": "Chọn EVO TPBank tại checkout",
    "group": "F14.3 – Thông tin phương thức",
    "steps": [
      "Đọc mô tả EVO TPBank.",
      "Chọn EVO TPBank và xác nhận."
    ],
    "expected": [
      "Nhãn/mô tả nhận diện EVO TPBank; checkout lưu đúng phương thức này."
    ]
  },
  {
    "id": "DDV_F14_014",
    "title": "Hiển thị tên và logo các phương thức thanh toán",
    "group": "F14.3 – Thông tin phương thức",
    "steps": [
      "Mở bộ chọn, đọc danh sách phương thức và logo tương ứng."
    ],
    "expected": [
      "Mỗi phương thức có tên và ảnh logo có alt phù hợp; chỉ một radio được chọn."
    ]
  },
  {
    "id": "DDV_F14_015",
    "title": "Chọn Zalopay cho giỏ dưới hạn mức",
    "group": "F14.3 – Thông tin phương thức",
    "steps": [
      "Chọn Zalopay và xác nhận phương thức."
    ],
    "expected": [
      "Zalopay khả dụng với giỏ hiện tại và được lưu trên checkout, chưa tạo giao dịch."
    ]
  },
  {
    "id": "DDV_F14_016",
    "title": "Chọn Apple Pay trên giao diện checkout Chromium",
    "group": "F14.3 – Thông tin phương thức",
    "steps": [
      "Chọn Apple Pay và xác nhận phương thức trên checkout Chromium.",
      "Dừng trước ĐẶT HÀNG; không mở xác thực thiết bị."
    ],
    "expected": [
      "Checkout lưu Apple Pay; không mở cổng, cửa sổ mới hoặc yêu cầu Face ID/Touch ID. Không kết luận khả năng thanh toán Apple Pay thật."
    ]
  },
  {
    "id": "DDV_F14_017",
    "title": "Mở giao hàng tận nơi không làm đổi COD",
    "group": "F14.4 – Giao nhận và hạn mức",
    "steps": [
      "Chọn COD và ghi thông tin đơn.",
      "Mở Thông tin giao hàng, chọn Giao hàng tận nơi; kiểm tra ô chọn địa chỉ và các trường người đặt còn trống.",
      "Đóng panel mà không xác nhận thông tin khách hàng."
    ],
    "expected": [
      "Panel cho chọn địa chỉ giao tận nơi; khi đóng panel, COD và thông tin đơn giữ nguyên. Không lưu người nhận hoặc gửi đơn."
    ]
  },
  {
    "id": "DDV_F14_018",
    "title": "Đổi tỉnh trong địa chỉ nháp không làm đổi thanh toán",
    "group": "F14.4 – Giao nhận và hạn mức",
    "steps": [
      "Chọn COD, mở panel giao hàng và bộ chọn địa chỉ.",
      "Chọn Thành phố Hồ Chí Minh; Thiết lập lại và chọn Thành phố Hà Nội.",
      "Kiểm tra tỉnh mới, đóng các panel mà không lưu người nhận."
    ],
    "expected": [
      "Bộ chọn địa chỉ nháp hiển thị tỉnh đang chọn là Hà Nội và yêu cầu chọn phường/xã; COD và thông tin đơn không đổi sau khi hủy bản nháp."
    ]
  },
  {
    "id": "DDV_F14_019",
    "title": "Giỏ dưới 40 triệu cho phép chọn COD",
    "group": "F14.4 – Giao nhận và hạn mức",
    "steps": [
      "Đọc tổng thanh toán và xác nhận tổng dưới 40.000.000 đ.",
      "Chọn và xác nhận COD."
    ],
    "expected": [
      "COD khả dụng và được lưu trên checkout cho giỏ dưới 40 triệu."
    ]
  },
  {
    "id": "DDV_F14_020",
    "title": "Giỏ giá trị cao khóa VNPay theo hạn mức hiển thị",
    "group": "F14.4 – Giao nhận và hạn mức",
    "steps": [
      "Mua ngay iPhone 18 Pro Max 256GB; ghi nhận tổng thực tế trên 40.000.000 đ.",
      "Mở bộ chọn, đọc hạn mức VNPay và kiểm tra radio bị khóa.",
      "Chọn OnePay và xác nhận làm phương thức thay thế."
    ],
    "expected": [
      "Tổng giỏ vượt hạn mức VNPay 20.000.000 đ; VNPay bị khóa và không được chọn. OnePay vẫn khả dụng và được lưu. Không kiểm tra chính sách chặn COD từ 40 triệu trong case này."
    ],
    "highValue": true
  },
  {
    "id": "DDV_F14_021",
    "title": "Chọn COD không đổi tổng tiền",
    "group": "F14.5 – Số tiền và số lượng",
    "steps": [
      "Ghi tổng tiền, xác nhận COD rồi đọc lại tổng."
    ],
    "expected": [
      "Tổng tiền không đổi chỉ do chọn COD; không có phụ phí không công bố."
    ]
  },
  {
    "id": "DDV_F14_022",
    "title": "Chọn OnePay không đổi tổng tiền checkout",
    "group": "F14.5 – Số tiền và số lượng",
    "steps": [
      "Ghi tổng tiền, xác nhận OnePay rồi đọc lại tổng tại checkout."
    ],
    "expected": [
      "Tổng tiền checkout trước và sau chọn OnePay bằng nhau; chưa kiểm tra số tiền tại cổng."
    ]
  },
  {
    "id": "DDV_F14_023",
    "title": "Chọn VNPay không đổi tổng tiền checkout",
    "group": "F14.5 – Số tiền và số lượng",
    "steps": [
      "Ghi tổng tiền, xác nhận VNPay rồi đọc lại tổng tại checkout."
    ],
    "expected": [
      "Tổng tiền checkout không đổi và VNPay là phương thức hiện hành; không tạo mã QR hoặc giao dịch."
    ]
  },
  {
    "id": "DDV_F14_024",
    "title": "Tăng số lượng từ 1 lên 2 cập nhật tiền checkout",
    "group": "F14.5 – Số tiền và số lượng",
    "steps": [
      "Ghi tạm tính khi có 1 máy, quay lại giỏ hàng.",
      "Tăng số lượng từ 1 lên 2; bấm MUA NGAY để trở lại checkout."
    ],
    "expected": [
      "Checkout hiển thị 2 máy; tạm tính bằng tạm tính của 1 máy nhân 2."
    ]
  },
  {
    "id": "DDV_F14_025",
    "title": "Tổng tiền khớp tạm tính và phí vận chuyển",
    "group": "F14.5 – Số tiền và số lượng",
    "steps": [
      "Chọn OnePay; đọc tạm tính, phí vận chuyển và tổng tiền của giỏ mới không mã ưu đãi."
    ],
    "expected": [
      "Tổng tiền bằng tạm tính cộng phí vận chuyển; Miễn phí được tính là 0. Không có NaN, undefined hoặc Infinity."
    ]
  },
  {
    "id": "DDV_F14_026",
    "title": "Mở lại bộ chọn giữ phương thức đã xác nhận",
    "group": "F14.6 – Đóng mở và điều hướng",
    "steps": [
      "Xác nhận MoMo rồi mở lại bộ chọn phương thức."
    ],
    "expected": [
      "MoMo vẫn được chọn duy nhất, khớp tên hiển thị trên checkout."
    ]
  },
  {
    "id": "DDV_F14_027",
    "title": "Refresh checkout trước khi đặt hàng",
    "group": "F14.6 – Đóng mở và điều hướng",
    "steps": [
      "Chọn COD, ghi thông tin đơn và làm mới trang.",
      "Nếu trang trở về giỏ, mở lại checkout bằng MUA NGAY; đối chiếu thông tin đơn và radio với phương thức đang hiển thị."
    ],
    "expected": [
      "Không tự đặt đơn hoặc thanh toán; sản phẩm, số lượng và tổng tiền giữ đúng. Phương thức được giữ hoặc reset nhưng phải khớp radio khi mở lại bộ chọn."
    ]
  },
  {
    "id": "DDV_F14_028",
    "title": "Đóng bằng nút X hủy phương thức chưa xác nhận",
    "group": "F14.6 – Đóng mở và điều hướng",
    "steps": [
      "Xác nhận COD, mở bộ chọn và chọn VNPay nhưng không bấm Xác nhận.",
      "Đóng bằng nút Đóng rồi mở lại bộ chọn."
    ],
    "expected": [
      "COD vẫn là phương thức đã lưu; radio VNPay nháp không được lưu khi đóng bằng X. Thông tin đơn không đổi."
    ]
  },
  {
    "id": "DDV_F14_029",
    "title": "Phím Escape hủy phương thức chưa xác nhận",
    "group": "F14.6 – Đóng mở và điều hướng",
    "steps": [
      "Xác nhận COD, mở bộ chọn và chọn VNPay nhưng không xác nhận.",
      "Nhấn Escape, kiểm tra panel đóng và mở lại bộ chọn."
    ],
    "expected": [
      "COD vẫn được lưu và được chọn duy nhất; không điều hướng sang cổng hoặc mở cửa sổ mới."
    ]
  },
  {
    "id": "DDV_F14_030",
    "title": "Dừng tại nút ĐẶT HÀNG trước giao dịch thật",
    "group": "F14.6 – Đóng mở và điều hướng",
    "steps": [
      "Chọn COD; kiểm tra nút ĐẶT HÀNG và các trường thanh toán.",
      "Dừng ở checkout, không nhấn ĐẶT HÀNG."
    ],
    "expected": [
      "Nút ĐẶT HÀNG hiển thị; không có yêu cầu số thẻ/OTP, thông báo thành công hoặc cửa sổ thanh toán mới."
    ]
  }
];

async function unchangedAmount(page: Page, name: string) {
  const before = await total(page);
  await selectMethod(page, name);
  expect(await total(page)).toBe(before);
}
async function draftChoice(page: Page) {
  await selectMethod(page, COD);
  await openMethods(page);
  await method(page, VNPAY).click();
  await expect(method(page, VNPAY)).toHaveAttribute('aria-checked', 'true');
}

const actions: Record<string, (page: Page) => Promise<void>> = {
  DDV_F14_001: async page => {
    await selectMethod(page, COD);
    await assertExclusive(page, COD);
    await assertNoCardInputs(page);
  },
  DDV_F14_002: async page => { await selectMethod(page, 'OnePay'); await assertExclusive(page, 'OnePay'); },
  DDV_F14_003: async page => { await selectMethod(page, 'Payoo'); await assertExclusive(page, 'Payoo'); },
  DDV_F14_004: async page => {
    expect(await total(page)).toBeLessThan(20_000_000);
    await selectMethod(page, VNPAY);
    await assertExclusive(page, VNPAY);
  },
  DDV_F14_005: async page => {
    await openMethods(page);
    await expect(method(page, 'Chuyển khoản ngân hàng')).toContainText(/SePay/i);
    await selectMethod(page, 'Chuyển khoản ngân hàng');
  },
  DDV_F14_006: async page => {
    await selectMethod(page, COD); await selectMethod(page, VNPAY);
    await assertExclusive(page, VNPAY);
  },
  DDV_F14_007: async page => {
    await selectMethod(page, VNPAY); await selectMethod(page, COD);
    await assertExclusive(page, COD); await assertNoCardInputs(page);
  },
  DDV_F14_008: async page => {
    await selectMethod(page, 'OnePay'); await selectMethod(page, 'Payoo');
    await assertExclusive(page, 'Payoo');
  },
  DDV_F14_009: async page => {
    const before = await orderSnapshot(page);
    for (const name of [COD, VNPAY, COD]) await selectMethod(page, name);
    await assertExclusive(page, COD);
    expect(await orderSnapshot(page)).toEqual(before);
  },
  DDV_F14_010: async page => {
    await selectMethod(page, COD);
    const before = await orderSnapshot(page);
    await selectMethod(page, COD); await assertExclusive(page, COD);
    expect(await orderSnapshot(page)).toEqual(before);
    await expect(page.locator('#payment-change-btn')).toHaveCount(1);
  },
  DDV_F14_011: async page => {
    await selectMethod(page, COD); await openMethods(page);
    await expect(method(page, COD)).toContainText(COD);
    await expect(method(page, COD)).not.toContainText(/thanh toán trước|nhập.*(?:thẻ|OTP)/i);
    await assertNoCardInputs(page); await closeMethods(page);
  },
  DDV_F14_012: async page => {
    await openMethods(page);
    await expect(method(page, 'Kim Ngân Pay')).toContainText(/Thanh toán Online.*Ngân hàng/i);
    await selectMethod(page, 'Kim Ngân Pay');
  },
  DDV_F14_013: async page => {
    await openMethods(page);
    await expect(method(page, 'EVO TPBank')).toContainText(/Cổng EVO TPBank/i);
    await selectMethod(page, 'EVO TPBank');
  },
  DDV_F14_014: async page => {
    await openMethods(page);
    for (const name of METHODS) {
      const radio = method(page, name);
      await expect(radio).toHaveCount(1);
      // scroll từng mục trong drawer trước khi xác minh ảnh logo.
      await radio.scrollIntoViewIfNeeded();
      await expect(radio.getByRole('img', { name, exact: true })).toBeVisible();
    }
    await expect(paymentDialog(page).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
    await closeMethods(page);
  },
  DDV_F14_015: async page => { await selectMethod(page, 'Zalopay'); await assertExclusive(page, 'Zalopay'); },
  DDV_F14_016: async page => {
    await selectMethod(page, 'Apple Pay'); await assertExclusive(page, 'Apple Pay');
    await assertNoCardInputs(page);
  },
  DDV_F14_017: async page => {
    await selectMethod(page, COD);
    const before = await orderSnapshot(page);
    await openDeliveryDraft(page);
    await closeDeliveryDraft(page);
    await assertExclusive(page, COD);
    expect(await orderSnapshot(page)).toEqual(before);
  },
  DDV_F14_018: async page => {
    await selectMethod(page, COD);
    const before = await orderSnapshot(page);
    const delivery = await openDeliveryDraft(page);
    await delivery.getByRole('button', { name: /Thêm Tỉnh\/Thành Phố/i }).click();
    const picker = addressDialog(page);
    await expect(picker).toBeVisible();
    for (const city of ['Thành phố Hồ Chí Minh', 'Thành phố Hà Nội']) {
      const search = picker.getByPlaceholder(/Tìm kiếm Tỉnh\/Thành phố/i);
      await search.fill(city);
      await picker.getByText(city, { exact: true }).last().click();
      await expect(picker.getByRole('button', { name: city, exact: true }).first()).toBeVisible();
      await expect(picker.getByText('Vui lòng chọn Phường/Xã', { exact: true })).toBeVisible();
      if (city.includes('Hồ Chí Minh')) await picker.getByRole('button', { name: 'Thiết lập lại', exact: true }).click();
    }
    await closeDeliveryDraft(page);
    await assertExclusive(page, COD);
    expect(await orderSnapshot(page)).toEqual(before);
  },
  DDV_F14_019: async page => {
    expect(await total(page)).toBeLessThan(40_000_000);
    await selectMethod(page, COD); await assertExclusive(page, COD);
  },
  DDV_F14_020: async page => {
    const amount = await total(page);
    expect(amount, 'Fixture giá trị cao phải đạt từ 40 triệu').toBeGreaterThanOrEqual(40_000_000);
    await openMethods(page);
    const vnpay = method(page, VNPAY);
    const limit = money(await vnpay.innerText());
    expect(limit).toBe(20_000_000);
    expect(amount).toBeGreaterThan(limit);
    await expect(vnpay.locator('input[type="radio"]')).toBeDisabled();
    await expect(vnpay).toHaveAttribute('aria-checked', 'false');
    await selectMethod(page, 'OnePay'); await assertExclusive(page, 'OnePay');
  },
  DDV_F14_021: async page => { await unchangedAmount(page, COD); },
  DDV_F14_022: async page => { await unchangedAmount(page, 'OnePay'); },
  DDV_F14_023: async page => { await unchangedAmount(page, VNPAY); },
  DDV_F14_024: async page => {
    const before = money(await summaryRow(page, 'Tạm tính').innerText());
    await page.getByRole('link', { name: 'Giỏ hàng', exact: true }).click();
    await expect(page).toHaveURL(/\/cart(?:[/?#]|$)/);
    const increase = page.getByRole('button', { name: 'Tăng số lượng', exact: true }).first();
    await expect(increase).toBeEnabled();
    const quantity = increase.locator('xpath=..');
    expect(Number((await quantity.innerText()).match(/\d+/)?.[0])).toBe(1);
    await increase.click(); await expect(quantity).toContainText('2');
    await page.getByRole('button', { name: /^MUA NGAY\s*\(\d+\)$/i }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/checkout(?:[/?#]|$)/);
    await expect(page.getByRole('region', { name: 'Sản phẩm trong đơn hàng', exact: true }).getByText(/^Số lượng:\s*2$/)).toBeVisible();
    expect(money(await summaryRow(page, 'Tạm tính').innerText())).toBe(before * 2);
  },
  DDV_F14_025: async page => {
    await selectMethod(page, 'OnePay');
    const subtotal = money(await summaryRow(page, 'Tạm tính').innerText());
    const shippingText = await summaryRow(page, 'Phí vận chuyển').innerText();
    const shipping = /Miễn phí/i.test(shippingText) ? 0 : money(shippingText);
    expect(await total(page)).toBe(subtotal + shipping);
    for (const name of ['Tạm tính', 'Phí vận chuyển', 'Tổng tiền']) {
      await expect(summaryRow(page, name)).not.toContainText(/NaN|undefined|Infinity/);
    }
  },
  DDV_F14_026: async page => { await selectMethod(page, 'MoMo'); await assertExclusive(page, 'MoMo'); },
  DDV_F14_027: async page => {
    await selectMethod(page, COD);
    const before = await orderSnapshot(page);
    await page.reload({ waitUntil: 'domcontentloaded' }); await dismissCookies(page);
    await expect(page).toHaveURL(/\/(?:checkout|cart)(?:[/?#]|$)/);
    if (new URL(page.url()).pathname === '/cart') {
      await expect(page.getByText(/đặt hàng thành công|thanh toán thành công/i)).toHaveCount(0);
      for (const name of before.products) await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible();
      await page.getByRole('button', { name: /^MUA NGAY\s*\(\d+\)$/i }).filter({ visible: true }).first().click();
      await dismissCookies(page);
    }
    expect(await orderSnapshot(page)).toEqual(before);
    const chosen = (await page.locator('#payment-change-btn').innerText()).replace(/\s*Thay đổi\s*$/, '').trim();
    expect(METHODS).toContain(chosen); await assertExclusive(page, chosen);
  },
  DDV_F14_028: async page => {
    const before = await orderSnapshot(page);
    await draftChoice(page); await closeMethods(page);
    await expect(page.locator('#payment-change-btn')).toContainText(COD);
    await assertExclusive(page, COD);
    expect(await orderSnapshot(page)).toEqual(before);
  },
  DDV_F14_029: async page => {
    await draftChoice(page); await page.keyboard.press('Escape');
    await expect(paymentDialog(page)).toBeHidden();
    await expect(page.locator('#payment-change-btn')).toContainText(COD);
    await assertExclusive(page, COD);
  },
  DDV_F14_030: async page => {
    await selectMethod(page, COD); await assertNoCardInputs(page);
    await expect(page.getByRole('button', { name: /^ĐẶT HÀNG\s*(?:\(\d+\))?$/i })).toBeVisible();
  },
};

if (cases.length !== 30 || new Set(cases.map(c => c.id)).size !== 30 || Object.keys(actions).length !== 30) {
  throw new Error('F14 phải có đúng 30 case duy nhất và 30 hàm kiểm thử.');
}
test.describe('F14 | Tran Thi Minh Thu | Checkout Chromium | 30 cases', () => {
  for (const scenario of cases) {
    test(`${scenario.id} - ${scenario.title}`, async ({ page }, testInfo) => {
      await openCheckout(page, scenario.highValue ? HIGH_PRODUCT : undefined);
      await test.step(scenario.title, () => actions[scenario.id](page));
      await assertNoPurchase(page);
      await testInfo.attach(`${scenario.id}.png`, { body: await page.screenshot(), contentType: 'image/png' });
      await testInfo.attach(`${scenario.id}.json`, {
        body: JSON.stringify({ id: scenario.id, title: scenario.title, ...(await orderSnapshot(page)), selected: await page.locator('#payment-change-btn').innerText(), scope: 'checkout; no order/payment submitted' }, null, 2),
        contentType: 'application/json',
      });
    });
  }
});
