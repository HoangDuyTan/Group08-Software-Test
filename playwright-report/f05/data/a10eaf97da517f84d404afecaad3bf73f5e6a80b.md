# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 23130082_NguyenTruongGiang\23130082_NguyenTruongGiang_F05.spec.ts >> ASM07 | F05 | D05 | 30 test cases from Assignment 6 >> DDV_F05_026 - Nhấn tăng số lượng ba lần từ 1
- Location: Automation Testing Project - Group08\tests\23130082_NguyenTruongGiang\23130082_NguyenTruongGiang_F05.spec.ts:834:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 33560000
Received: 25170000

Call Log:
- Timeout 15000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - complementary "Thông tin nhanh" [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]:
            - link "Z Fold8 ưu đãi giá sốc" [ref=e7] [cursor=pointer]:
              - /url: https://didongviet.vn/dien-thoai/samsung-galaxy-z-fold8.html
            - link "Cửa hàng" [ref=e9] [cursor=pointer]:
              - /url: /cua-hang-gan-ban
          - generic [ref=e11]:
            - generic [ref=e12]: Mở cửa 8:00 - 21:30
            - link "Tra cứu đơn hàng" [ref=e14] [cursor=pointer]:
              - /url: /order-tracking
      - banner [ref=e16]:
        - generic [ref=e19]:
          - link [ref=e20] [cursor=pointer]:
            - /url: /
            - img "Di Động Việt" [ref=e21]
          - button "Danh mục" [ref=e22] [cursor=pointer]
          - searchbox "Tìm kiếm sản phẩm" [ref=e33]
          - generic [ref=e34]:
            - link "1800.6018 – Gọi đặt hàng ngay" [ref=e35] [cursor=pointer]:
              - /url: tel:18006018
              - generic [ref=e38]: "1800.6018"
            - link "Giỏ hàng" [ref=e39] [cursor=pointer]:
              - /url: /cart
            - button "Đăng nhập" [ref=e46] [cursor=pointer]
      - navigation "Điều hướng đầu trang" [ref=e53]:
        - group [ref=e54]:
          - generic [ref=e56]:
            - group [ref=e57]:
              - link "Điện thoại" [ref=e58] [cursor=pointer]:
                - /url: /dien-thoai.html
            - group [ref=e60]:
              - link "Tablet" [ref=e61] [cursor=pointer]:
                - /url: /may-tinh-bang.html
            - group [ref=e63]:
              - link "Macbook" [ref=e64] [cursor=pointer]:
                - /url: /apple-macbook-imac.html
            - group [ref=e66]:
              - link "Hệ sinh thái Apple" [ref=e67] [cursor=pointer]:
                - /url: https://didongviet.vn/he-sinh-thai-apple.html
            - group [ref=e69]:
              - link "Máy cũ" [ref=e70] [cursor=pointer]:
                - /url: /may-cu-gia-re.html
            - group [ref=e72]:
              - link "Gia dụng Bear" [ref=e73] [cursor=pointer]:
                - /url: https://didongviet.vn/gia-dung-bear.html
            - group [ref=e75]:
              - link "Đồng hồ" [ref=e76] [cursor=pointer]:
                - /url: /dong-ho-thong-minh.html
            - group [ref=e78]:
              - link "Âm thanh" [ref=e79] [cursor=pointer]:
                - /url: /thiet-bi-am-thanh.html
            - group [ref=e81]:
              - link "Phụ kiện" [ref=e82] [cursor=pointer]:
                - /url: /phu-kien.html
            - group [ref=e84]:
              - link "Thu cũ đổi mới" [ref=e85] [cursor=pointer]:
                - /url: /trade-in.html
    - main [ref=e87]:
      - generic [ref=e89]:
        - generic [ref=e90]:
          - generic [ref=e92]:
            - button "Quay lại" [ref=e93] [cursor=pointer]
            - heading "Giỏ hàng của bạn" [level=1]
          - generic [ref=e94]:
            - generic [ref=e96]:
              - generic [ref=e97] [cursor=pointer]:
                - checkbox "Chọn tất cả (1)" [checked] [ref=e98]
                - generic [ref=e102]: Chọn tất cả (1)
              - button "Xoá tất cả" [ref=e104] [cursor=pointer]
            - generic [ref=e109]:
              - generic [ref=e110]:
                - checkbox [checked] [ref=e113]
                - link [ref=e117] [cursor=pointer]:
                  - /url: /dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html?sku=CMH858S1190-TitanXanh-DDVNew
                  - img "Samsung Galaxy S25 Ultra 256GB Chính Hãng" [ref=e118]
                - generic [ref=e119]:
                  - generic [ref=e120]:
                    - generic [ref=e121]:
                      - link "Samsung Galaxy S25 Ultra 256GB Chính Hãng" [ref=e122] [cursor=pointer]:
                        - /url: /dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html?sku=CMH858S1190-TitanXanh-DDVNew
                      - button "Titan Xanh" [ref=e125] [cursor=pointer]
                    - button "Xóa sản phẩm" [ref=e130] [cursor=pointer]
                  - generic [ref=e134]:
                    - generic [ref=e135]:
                      - generic [ref=e136]: 24.990.000 đ
                      - generic [ref=e137]: 33.380.000 đ
                    - generic [ref=e139]:
                      - button "Giảm số lượng" [ref=e140] [cursor=pointer]: −
                      - generic [ref=e141]: "3"
                      - button "Tăng số lượng" [disabled] [ref=e142]: +
              - button "Mua kèm tiết kiệm hơn" [ref=e143] [cursor=pointer]
        - generic [ref=e152]:
          - button "Xem quà tặng" [ref=e153] [cursor=pointer]:
            - generic [ref=e159]: 0 Quà tặng
          - generic [ref=e160]:
            - generic [ref=e161]:
              - generic [ref=e162]: 74.970.000 đ
              - generic [ref=e163]:
                - generic [ref=e164]: Tiết kiệm
                - generic [ref=e165]: 25.170.000 đ
            - button "Trả góp 0%" [ref=e166] [cursor=pointer]
            - button "MUA NGAY (1)" [ref=e167] [cursor=pointer]
    - contentinfo [ref=e168]:
      - generic [ref=e170]:
        - generic [ref=e172]:
          - paragraph [ref=e173]:
            - button "Về chúng tôi"
          - list [ref=e177]:
            - listitem [ref=e178]:
              - link "Giới thiệu về công ty" [ref=e179] [cursor=pointer]:
                - /url: /gioi-thieu.html
            - listitem [ref=e180]:
              - link "Liên hệ hợp tác kinh doanh (B2B)" [ref=e181] [cursor=pointer]:
                - /url: /dich-vu-khach-hang-doanh-nghiep.html
            - listitem [ref=e182]:
              - link "Ưu đãi dành cho giáo dục" [ref=e183] [cursor=pointer]:
                - /url: /apple-giao-duc.html
            - listitem [ref=e184]:
              - link "Danh sách cửa hàng" [ref=e185] [cursor=pointer]:
                - /url: /cua-hang-gan-ban.html
            - listitem [ref=e186]:
              - link "Tuyển dụng mới nhất" [ref=e187] [cursor=pointer]:
                - /url: https://tuyendung.didongviet.vn/
            - listitem [ref=e188]:
              - link "Hướng dẫn mua hàng online" [ref=e189] [cursor=pointer]:
                - /url: https://didongviet.vn/dchannel/huong-dan-mua-hang-online-tai-di-dong-viet/
            - listitem [ref=e190]:
              - link "Hướng dẫn mua hàng trả góp" [ref=e191] [cursor=pointer]:
                - /url: /mua-hang-tra-gop.html
            - listitem [ref=e192]:
              - link "Hướng dẫn thanh toán VNPay" [ref=e193] [cursor=pointer]:
                - /url: https://didongviet.vn/dchannel/huong-dan-thanh-toan-vnpay-tren-website-di-dong-viet/
        - generic [ref=e195]:
          - paragraph [ref=e196]:
            - button "Chính sách"
          - list [ref=e200]:
            - listitem [ref=e201]:
              - link "Chính sách bảo hành" [ref=e202] [cursor=pointer]:
                - /url: /chinh-sach-bao-hanh.html
            - listitem [ref=e203]:
              - link "Chính sách bán hàng" [ref=e204] [cursor=pointer]:
                - /url: /chinh-sach-ban-hang.html
            - listitem [ref=e205]:
              - link "Chính sách bảo mật" [ref=e206] [cursor=pointer]:
                - /url: /chinh-sach-bao-mat.html
            - listitem [ref=e207]:
              - link "Chính sách mua hàng trả góp" [ref=e208] [cursor=pointer]:
                - /url: /mua-hang-tra-gop.html
            - listitem [ref=e209]:
              - link "Chính sách hoàn thuế" [ref=e210] [cursor=pointer]:
                - /url: https://didongviet.vn/vat-refund.html
            - listitem [ref=e211]:
              - link "Chính sách D-Member" [ref=e212] [cursor=pointer]:
                - /url: https://didongviet.vn/dchannel/nang-cap-chinh-sach-d-member/
            - listitem [ref=e213]:
              - link "Chính sách giao hàng" [ref=e214] [cursor=pointer]:
                - /url: https://didongviet.vn/dchannel/di-dong-viet-mien-phi-giao-hang-sieu-toc/
            - listitem [ref=e215]:
              - link "Trung tâm bảo hành Apple tại Việt Nam" [ref=e216] [cursor=pointer]:
                - /url: /trung-tam-bao-hanh-apple-tai-viet-nam.html
        - generic [ref=e217]:
          - generic [ref=e218]:
            - paragraph [ref=e219]:
              - button "Tổng đài hỗ trợ"
            - generic [ref=e223]:
              - generic [ref=e224]:
                - generic [ref=e225]: Mua ngay
                - generic [ref=e226]:
                  - link "1800.6018" [ref=e227] [cursor=pointer]:
                    - /url: tel:1800.6018
                  - generic [ref=e228]: (07:30 – 21:30)
              - generic [ref=e229]:
                - generic [ref=e230]: Bảo hành tại Di Động Việt
                - generic [ref=e231]:
                  - link "1800.6729" [ref=e232] [cursor=pointer]:
                    - /url: tel:1800.6729
                  - generic [ref=e233]: (08:00 – 21:00)
              - generic [ref=e234]:
                - generic [ref=e235]: Góp ý
                - generic [ref=e236]:
                  - link "1800.6306" [ref=e237] [cursor=pointer]:
                    - /url: tel:1800.6306
                  - generic [ref=e238]: (08:00 – 21:30)
          - generic [ref=e239]:
            - paragraph [ref=e240]:
              - button "Phương thức thanh toán"
            - list [ref=e244]:
              - listitem [ref=e245]:
                - img "Phương thức thanh toán" [ref=e246]
              - listitem [ref=e247]:
                - img "Phương thức thanh toán" [ref=e248]
              - listitem [ref=e249]:
                - img "Phương thức thanh toán" [ref=e250]
              - listitem [ref=e251]:
                - img "Phương thức thanh toán" [ref=e252]
              - listitem [ref=e253]:
                - img "Phương thức thanh toán" [ref=e254]
              - listitem [ref=e255]:
                - img "Phương thức thanh toán" [ref=e256]
              - listitem [ref=e257]:
                - link "Kim Ngân" [ref=e258] [cursor=pointer]:
                  - /url: https://didongviet.vn/dchannel/kimnganpay-kpay-tra-gop-di-dong-viet/
                  - img "Kim Ngân" [ref=e259]
        - generic [ref=e260]:
          - generic [ref=e261]:
            - paragraph [ref=e262]:
              - button "Kết nối với Di Động Việt"
            - list [ref=e266]:
              - listitem [ref=e267]:
                - link "Zalo" [ref=e268] [cursor=pointer]:
                  - /url: https://zalo.me/2858385037676592618
              - listitem [ref=e269]:
                - link "Facebook" [ref=e270] [cursor=pointer]:
                  - /url: https://www.facebook.com/didongviet/
              - listitem [ref=e271]:
                - link "Instagram" [ref=e272] [cursor=pointer]:
                  - /url: https://www.instagram.com/didongvietvn/
              - listitem [ref=e273]:
                - link "YouTube" [ref=e274] [cursor=pointer]:
                  - /url: https://www.youtube.com/channel/UCNNZS735ZP9lFpzRggHlBqQ
              - listitem [ref=e275]:
                - link "TikTok" [ref=e276] [cursor=pointer]:
                  - /url: https://www.tiktok.com/@didongviet_official
          - generic [ref=e277]:
            - paragraph [ref=e278]:
              - button "Đối tác của Di Động Việt"
            - list [ref=e282]:
              - listitem [ref=e283]:
                - link "Đối tác" [ref=e284] [cursor=pointer]:
                  - /url: https://viendidong.com/
                  - img "Đối tác" [ref=e285]
              - listitem [ref=e286]:
                - link "Đối tác" [ref=e287] [cursor=pointer]:
                  - /url: /
                  - img "Đối tác" [ref=e288]
          - generic [ref=e289]:
            - paragraph [ref=e290]:
              - button "Tải ứng dụng nhận nhiều ưu đãi"
            - generic [ref=e294]:
              - img "Mã QR tải ứng dụng Di Động Việt" [ref=e296]
              - list [ref=e297]:
                - listitem [ref=e298]:
                  - link "Tải ứng dụng" [ref=e299] [cursor=pointer]:
                    - /url: https://apps.apple.com/us/app/id1601673953
                    - img "Tải ứng dụng" [ref=e300]
                - listitem [ref=e301]:
                  - link "Tải ứng dụng" [ref=e302] [cursor=pointer]:
                    - /url: https://play.google.com/store/apps/details?id=com.didongviet.loyalty
                    - img "Tải ứng dụng" [ref=e303]
      - generic [ref=e306]:
        - generic [ref=e307]:
          - paragraph [ref=e308]: "Công Ty Cổ phần Công Nghệ Di Động Việt - 77 Trần Quang Khải, P. Tân Định, TP. Hồ Chí Minh. Mã số doanh nghiệp: 0312193244, nơi cấp: Sở Tài chính thành phố Hồ Chí Minh."
          - paragraph [ref=e309]: "MST: 0312193244. Đại diện theo pháp luật: Nguyễn Ngọc Đạt - Điện thoại: 1800.6018 (miễn phí) - Email: lienhe@didongviet.vn - Bản quyền thuộc về Di Động Việt."
        - list [ref=e310]:
          - listitem [ref=e311]:
            - link "NCSC" [ref=e312] [cursor=pointer]:
              - /url: https://tinnhiemmang.vn/danh-ba-tin-nhiem/didongvietvn-1637207046
              - img "NCSC" [ref=e313]
          - listitem [ref=e314]:
            - link "Bộ Công Thương" [ref=e315] [cursor=pointer]:
              - /url: http://online.gov.vn/nen-tang/c81604f6-5e12-43bd-b557-8e5db2f086f5
              - img "Bộ Công Thương" [ref=e316]
          - listitem [ref=e317]:
            - link "DMCA" [ref=e318] [cursor=pointer]:
              - /url: https://www.dmca.com/Protection/Status.aspx?ID=3fc62ff1-bd17-425f-8494-0cdeefb014bf&refurl=https://didongviet.vn
              - img "DMCA" [ref=e319]
    - button "Hỗ trợ" [ref=e322] [cursor=pointer]
  - region "Notifications alt+T"
  - alert [ref=e332]: Giỏ hàng | Di Động Việt
```

# Test source

```ts
  58  | async function showAction(page: Page, action: string) {
  59  |   await test.step(`Thao tác trên web: ${action}`, async () => {
  60  |     await test.info().attach(`F05_action_${Date.now()}.png`, {
  61  |       body: await page.screenshot({ fullPage: false, mask: [page.locator('input,textarea')] }),
  62  |       contentType: 'image/png',
  63  |     });
  64  |   });
  65  | }
  66  | async function unavailable(page: Page, kind: 'N/A' | 'BLOCKED', reason: string): Promise<never> {
  67  |   await note(page, `${kind}: ${reason}`);
  68  |   await showAction(page, `${kind}: ${reason}`);
  69  |   test.info().annotations.push({ type: kind, description: reason });
  70  |   test.skip(true, `${kind}: ${reason}`);
  71  |   throw new Error(`${kind}: ${reason}`);
  72  | }
  73  | async function closeCookieNotice(page: Page) {
  74  |   const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
  75  |   try { await reject.waitFor({ state: 'visible', timeout: 2500 }); }
  76  |   catch { return; } // Chỉ popup cookie là tùy chọn; không nuốt lỗi thao tác test.
  77  |   await reject.click();
  78  |   await expect(reject).toBeHidden();
  79  | }
  80  | async function visit(page: Page) {
  81  |   const response = await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  82  |   expect(response, 'Trang sản phẩm phải trả HTTP response').not.toBeNull();
  83  |   expect(response!.status(), 'HTTP trang sản phẩm').toBeLessThan(400);
  84  |   await closeCookieNotice(page);
  85  |   await expect(page).toHaveURL(new RegExp('/samsung-galaxy-s25-ultra-5g-256gb\\.html(?:[?#].*)?$'));
  86  |   await expect(main(page).getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  87  | }
  88  | async function selectColor(page: Page, color: Color): Promise<ProductSnapshot> {
  89  |   const option = colorOption(page, color);
  90  |   await expect(option, `Phải tìm đúng một thẻ màu ${color}`).toHaveCount(1);
  91  |   await expect(option).toBeVisible();
  92  |   if (await option.isDisabled()) return unavailable(page, 'BLOCKED', `Excel yêu cầu màu ${color}; thẻ màu bị vô hiệu hóa.`);
  93  |   await option.click();
  94  |   await expect(option, `Màu hiện hành phải là ${color}`).toHaveAttribute('aria-pressed', 'true');
  95  |   for (const other of COLORS.filter(c => c !== color)) {
  96  |     await expect(colorOption(page, other)).toHaveAttribute('aria-pressed', 'false');
  97  |   }
  98  |   const button = addButton(page);
  99  |   await expect(button, 'Phải có biểu tượng xe đẩy cạnh CTA chính').toBeVisible();
  100 |   if (await button.isDisabled()) return unavailable(page, 'BLOCKED', `SKU ${color} không cho thêm giỏ (hết hàng/CTA bị khóa).`);
  101 |   const body = await main(page).innerText();
  102 |   const priceRegion = body.slice(body.indexOf('Màu sắc sản phẩm'), body.indexOf('Hoặc'));
  103 |   const prices = [...priceRegion.matchAll(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/g)].map(m => parseVnd(m[0]));
  104 |   expect(prices.length, 'Đọc đủ giá bốn màu và giá bán chính').toBeGreaterThanOrEqual(COLORS.length + 1);
  105 |   const sale = prices[COLORS.length];
  106 |   expect(sale).toBe(parseVnd((await option.innerText()).match(/\d{1,3}(?:[.,]\d{3})+\s*[đ₫]/)![0]));
  107 |   const src = await option.locator('img').getAttribute('src');
  108 |   expect(src, 'Thẻ màu có ảnh của SKU').toBeTruthy();
  109 |   return { color, sale, crossed: prices[COLORS.length + 1], imagePath: new URL(src!, ORIGIN).pathname };
  110 | }
  111 | async function addSelected(page: Page) {
  112 |   const button = addButton(page);
  113 |   await expect(button.locator('svg.lucide-shopping-cart')).toHaveCount(1);
  114 |   await button.click(); // Đúng một click, không retry việc thêm hàng.
  115 |   await expect(page.getByText('Sản phẩm đã được thêm vào giỏ', { exact: true })).toBeVisible();
  116 |   await expect(page).toHaveURL(/samsung-galaxy-s25-ultra-5g-256gb\.html/);
  117 | }
  118 | async function openCart(page: Page) {
  119 |   await page.getByRole('link', { name: 'Giỏ hàng', exact: true }).filter({ visible: true }).click();
  120 |   await expect(page).toHaveURL(/\/cart(?:[?#].*)?$/);
  121 |   await expect(main(page).getByRole('heading', { name: 'Giỏ hàng của bạn', exact: true })).toBeVisible();
  122 | }
  123 | async function addProduct(page: Page, color: Color = 'Titan Xanh') {
  124 |   await visit(page);
  125 |   const product = await selectColor(page, color);
  126 |   await addSelected(page);
  127 |   await openCart(page);
  128 |   await expect(cartRow(page, color)).toHaveCount(1);
  129 |   return product;
  130 | }
  131 | async function assertItem(page: Page, product: ProductSnapshot, count = 1) {
  132 |   const row = cartRow(page, product.color);
  133 |   await expect(row, `Đúng một dòng ${product.color}`).toHaveCount(1);
  134 |   await expect(productLink(row)).toBeVisible();
  135 |   await expect(productLink(row)).toHaveAttribute('href', /samsung-galaxy-s25-ultra-5g-256gb\.html\?sku=/);
  136 |   await expect(row.getByRole('button', { name: product.color, exact: true })).toBeVisible();
  137 |   await expect(quantity(row)).toHaveText(String(count));
  138 |   await expect.poll(async () => parseVnd(await unitPrice(row).innerText()), { message: `Giá ${product.color} phải khớp trang sản phẩm` }).toBe(product.sale);
  139 |   const image = row.locator('img');
  140 |   await expect(image).toHaveCount(1);
  141 |   await expect.poll(async () => new URL((await image.getAttribute('src'))!, ORIGIN).pathname,
  142 |     { message: `Ảnh giỏ phải khớp thẻ màu ${product.color}` }).toBe(product.imagePath);
  143 | }
  144 | async function assertTotals(page: Page, products: { product: ProductSnapshot; count: number }[]) {
  145 |   const expected = products.reduce((total, item) => total + item.product.sale * item.count, 0);
  146 |   await expect(summaryTotal(page)).toBeVisible();
  147 |   await expect.poll(async () => parseVnd(await summaryTotal(page).innerText()),
  148 |     { message: 'Tổng giỏ = tổng đơn giá hiện hành × số lượng; không trừ ưu đãi hai lần' }).toBe(expected);
  149 |   expect(expected).toBeGreaterThan(0);
  150 |   // Bộ đếm của giỏ là Chọn tất cả và MUA NGAY (số SKU, không phải số chiếc).
  151 |   // Header desktop có thể không render badge; không giả định badge luôn tồn tại.
  152 |   await expect(main(page).getByText(`Chọn tất cả (${products.length})`, { exact: true })).toBeVisible();
  153 |   await expect(summary(page).getByRole('button', { name: `MUA NGAY (${products.length})`, exact: true })).toBeVisible();
  154 |   const savings = products.reduce((sum, item) => sum + ((item.product.crossed ?? item.product.sale) - item.product.sale) * item.count, 0);
  155 |   const savingsLabel = summary(page).getByText('Tiết kiệm', { exact: true });
  156 |   if (savings > 0) {
  157 |     await expect(savingsLabel).toBeVisible();
> 158 |     await expect.poll(async () => parseVnd(await savingsLabel.locator('xpath=..').innerText())).toBe(savings);
      |                                                                                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  159 |   }
  160 | }
  161 | async function changeQuantity(page: Page, color: Color, target: number) {
  162 |   const row = cartRow(page, color);
  163 |   const before = Number(await quantity(row).innerText());
  164 |   for (let count = before; count !== target;) {
  165 |     const next = count + (target > count ? 1 : -1);
  166 |     const control = target > count ? increase(row) : decrease(row);
  167 |     await expect(control).toBeEnabled();
  168 |     await control.click();
  169 |     await expect(quantity(row), `Mỗi click đổi đúng một chiếc: ${count} → ${next}`).toHaveText(String(next));
  170 |     count = next;
  171 |   }
  172 | }
  173 | async function removeItem(page: Page, color: Color, cancel = false) {
  174 |   await cartRow(page, color).getByRole('button', { name: 'Xóa sản phẩm', exact: true }).click();
  175 |   const dialog = page.getByRole('dialog').filter({ hasText: 'Xóa sản phẩm?' });
  176 |   if (cancel) {
  177 |     try { await dialog.waitFor({ state: 'visible', timeout: 3000 }); }
  178 |     catch {
  179 |       await expect(cartRow(page, color)).toHaveCount(0);
  180 |       return unavailable(page, 'N/A', 'F05_015: UI xóa ngay, không có hộp thoại Hủy/Xóa (Excel cho phép N/A).');
  181 |     }
  182 |   } else {
  183 |     await expect(dialog).toBeVisible();
  184 |   }
  185 |   await dialog.getByRole('button', { name: cancel ? 'Hủy' : 'Xóa', exact: true }).click();
  186 |   await expect(dialog).toBeHidden();
  187 |   if (!cancel) await expect(cartRow(page, color)).toHaveCount(0);
  188 | }
  189 | async function assertEmpty(page: Page) {
  190 |   await expect(cartRows(page)).toHaveCount(0);
  191 |   await expect(main(page).getByText('Giỏ hàng trống', { exact: true })).toBeVisible();
  192 |   await expect(main(page).getByText('Hãy thêm sản phẩm vào giỏ hàng', { exact: true })).toBeVisible();
  193 |   await expect(main(page).getByRole('button', { name: /^MUA NGAY/ })).toHaveCount(0);
  194 |   await expect(main(page).getByText(MONEY)).toHaveCount(0);
  195 |   await expect(page.getByRole('link', { name: 'Giỏ hàng', exact: true }).filter({ visible: true }).locator('span.bg-orange-500')).toHaveCount(0);
  196 | }
  197 | async function twoColors(page: Page, second: Color = 'Titan Đen') {
  198 |   const blue = await addProduct(page, 'Titan Xanh');
  199 |   const other = await addProduct(page, second);
  200 |   await expect(cartRows(page)).toHaveCount(2);
  201 |   await assertItem(page, blue);
  202 |   await assertItem(page, other);
  203 |   return [blue, other] as const;
  204 | }
  205 | async function editableQuantity(page: Page, color: Color) {
  206 |   const row = cartRow(page, color);
  207 |   const input = row.locator('input:not([type="checkbox"]):not([type="hidden"])');
  208 |   if (await input.count() === 0) {
  209 |     await expect(quantity(row)).toHaveText('1');
  210 |     await expect(increase(row)).toBeVisible();
  211 |     await expect(decrease(row)).toBeVisible();
  212 |     return unavailable(page, 'N/A', 'Excel: ca nhập trực tiếp là N/A khi chỉ có +/−. DOM giỏ có span hiển thị SL và hai nút +/−, không có ô nhập SL.');
  213 |   }
  214 |   await expect(input).toHaveCount(1);
  215 |   if (!(await input.isEditable())) return unavailable(page, 'N/A', 'Ô số lượng không cho sửa bằng bàn phím; Excel cho phép N/A khi không hỗ trợ nhập.');
  216 |   return input;
  217 | }
  218 | 
  219 | test.describe('ASM07 | F05 | D05 | 30 test cases from Assignment 6', () => {
  220 |   test.describe.configure({ timeout: 150_000 });
  221 |   const orderRequests = new WeakMap<Page, string[]>();
  222 | 
  223 |   test.beforeEach(async ({ page }) => {
  224 |     const requests: string[] = [];
  225 |     orderRequests.set(page, requests);
  226 |     page.on('request', request => {
  227 |       if (!['POST', 'PUT', 'PATCH'].includes(request.method())) return;
  228 |       const path = new URL(request.url()).pathname;
  229 |       if (/(?:^|\/)(?:orders?|create-order|place-order|payments?|checkout)(?:\/|$)/i.test(path)) {
  230 |         requests.push(`${request.method()} ${path}`);
  231 |       }
  232 |     });
  233 |   });
  234 |   test.afterEach(async ({ page }, testInfo) => {
  235 |     await testInfo.attach('F05_run_metadata.json', {
  236 |       body: JSON.stringify({ test: testInfo.title, status: testInfo.status, expectedStatus: testInfo.expectedStatus,
  237 |         time: new Date().toISOString(), url: page.url(), annotations: testInfo.annotations,
  238 |         orderRequests: orderRequests.get(page) ?? [] }, null, 2),
  239 |       contentType: 'application/json',
  240 |     });
  241 |     const image = await page.screenshot({ fullPage: false, mask: [page.locator('input,textarea')], timeout: 8000 }).catch(() => null);
  242 |     if (image) await testInfo.attach('F05_snapshot.png', { body: image, contentType: 'image/png' });
  243 |     expect(orderRequests.get(page), 'Thao tác giỏ không được gửi request tạo đơn/thanh toán').toEqual([]);
  244 |     await expect(page.getByText(/đặt hàng thành công|thanh toán thành công|đặt hàng hoàn tất/i)).toHaveCount(0);
  245 |   });
  246 | 
  247 |   /** Expected Output from ASM06 [DDV_F05_001]:
  248 |    * 1. Giỏ có Samsung Galaxy S25 Ultra 5G 256GB màu Titan Xanh, số lượng 1.
  249 |    * 2. Tên, giá, biến thể khớp với lựa chọn; không phát sinh đơn hàng hoặc thanh toán.
  250 |    *
  251 |    * Test Case Procedure (Excel):
  252 |    * 1. Mở https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html.
  253 |    * 2. Chọn phiên bản 256GB và màu Titan Xanh; ghi giá bán đang hiển thị.
  254 |    * 3. Nhấn biểu tượng xe đẩy viền đỏ ở bên phải nút 'MUA NGAY' đúng 1 lần.
  255 |    * 4. Mở giỏ hàng qua thông báo/đường dẫn giỏ trên giao diện và kiểm tra dòng Samsung S25 Ultra 256GB Titan Xanh.
  256 |    */
  257 |   test('DDV_F05_001 - Thêm Samsung Galaxy S25 Ultra 256GB Titan Xanh vào giỏ bằng biểu tượng xe đẩy', async ({ page }) => {
  258 |     let product!: ProductSnapshot;
```