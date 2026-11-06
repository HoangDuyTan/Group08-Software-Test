# Group08 – Assignment 8 | Automation Testing Integration & Execution

**Website:** https://didongviet.vn/  
**Stack:** TypeScript + Playwright Test + Chromium  
**Repository:** https://github.com/HoangDuyTan/Group08-Software-Test  
**Project:** `Automation Testing Project - Group08/`

## 1. Tình trạng thực tế của bản giao

- **Đã tích hợp source** của 5 thành viên: F01–F15, mỗi thành viên 3 chức năng, 15 file `*.spec.ts`, 2 helper.
- **Dự kiến theo source:** 460 test được định nghĩa (14 chức năng × 30 và F10 × 40). Cần chạy lệnh Playwright `--list` trên máy đã cài dependency để xác nhận con số này.
- **Chưa có kết quả chạy một lần full-suite nhóm** trong ZIP `dev` đầu vào. Không sử dụng các kết quả chạy riêng để báo cáo như một lần tích hợp nhóm.
- **Có bằng chứng lịch sử cá nhân TV3** ở `Test Report - Group08/Individual_Baselines/`, không thay thế group run.
- **Còn thiếu truy vết Excel:** merged Excel mới có 11 sheet chức năng (320 TC); thiếu F02/F03/F11/F12, F01 Excel 20 vs script 30, F10 Excel 30 vs script 40. File cá nhân TV1 trong ZIP là **0 byte, không mở được**. Xem `docs/ASM08_TRACEABILITY_GAPS.md`.

## 2. Cấu trúc

```text
Group08-Software-Test/
├── Automation Testing Project - Group08/
│   ├── package.json / package-lock.json / playwright.config.ts
│   ├── tests/<MSSV_HoTen>/*.spec.ts
│   └── scripts/run-group-suite.ps1, summarize-report.mjs
├── Test Report - Group08/
│   ├── README.md, TEST_REPORT_PENDING.md
│   ├── Individual_Baselines/TV3_*
│   └── [html-report, JSON, JUnit, summary, defects after FULL run]
├── Envidence - Group08/
│   ├── screenshots/ (ảnh GitHub / PR gốc, KHÔNG phải screenshots run)
│   ├── test-screenshots/ (mẫu ảnh thử nghiệm TV3 lịch sử)
│   └── logs/ (tạo log khi chạy full-suite)
├── docs/individual/; docs/merged/; docs/ASM08_TRACEABILITY_GAPS.md
└── README.md
```

`Envidence - Group08` giữ **đúng cách viết trong đề Assignment 8** (dù có lỗi chính tả tiếng Anh).

## 3. Cài đặt trên Windows (PowerShell)

```powershell
cd 'Automation Testing Project - Group08'
npm ci
npx playwright install chromium
npm run test:list
```

- Node.js LTS và Chrome/Chromium tương thích với Playwright.
- Không cần giải nén `node_modules` từ người khác; không commit `.env`, cookie thật hoặc dữ liệu đơn của khách.
- Dữ liệu test môi trường cho các ca đơn hàng thật chỉ cung cấp nếu nhóm có quyền sử dụng.

## 4. Chạy độc lập và chạy toàn nhóm

```powershell
# Một file cụ thể
npx playwright test tests/23130291_HoangDuyTan/23130291_HoangDuyTan_F09.spec.ts --workers=1

# Toàn bộ project, 15 file chức năng
npm test

# Cách khuyến nghị: tự lưu log, thời gian bắt đầu/kết thúc, exit code
.\scripts\run-group-suite.ps1
```

**Chú ý:** Full suite chạy trên website online nên kết quả có thể đổi theo dữ liệu/cấu trúc UI hiện tại. Không đặt hàng/thanh toán/tạo lead thật. Mặc định `workers=1`, `retries=0` để tránh va chạm session và không che lỗi flaky.

## 5. Test Report (HTML / XML / JSON)

Cấu hình `playwright.config.ts` xuất tự động:

| Định dạng | Đường dẫn |
|---|---|
| HTML | `Test Report - Group08/html-report/index.html` |
| JSON | `Test Report - Group08/group08-results.json` |
| JUnit XML | `Test Report - Group08/group08-junit.xml` |
| Tổng hợp Markdown | `Test Report - Group08/GroupSuite_Summary.md` |
| Các case thất bại | `Test Report - Group08/Defect_Log.md` |
| Log và metadata | `Envidence - Group08/logs/` |

Sau khi chạy xong, nếu không dùng script PowerShell, chạy thêm:

```powershell
npm run report:summary
npm run test:report
```

Khi có fail, HTML report lưu ảnh/trace/video theo cấu hình `retain-on-failure` / `only-on-failure`. Mở report tại **đường dẫn local** để xem tài liệu đã được ghi thật. Khi commit lên GitHub, tránh đẩy thông tin người mua, số điện thoại hoặc chi tiết đơn thật lên kho public.

## 6. Flaky test / Failed test

- **Rerun test Fail** trên đúng trình duyệt/viewport bằng `--grep 'DDV_F##_###' --workers=1` và lưu log lần 2.
- Nếu lần 1 Fail, lần 2 Passed mà code và dữ liệu không đổi → đánh dấu *suspected flaky*, điều tra wait/locator/mạng/trạng thái UI.
- Không biến Failed thành Passed bằng cách `test.skip`, `force-click`, nới assertions hay thêm retries vô căn cứ.
- Tổng hợp nguyên nhân **website bug / automation script issue / thiếu fixture / lỗi môi trường** trong `Test Report - Group08/Defect_Log.md`.
- Đối chiếu từng Expected trong Excel với Actual sau chạy trước khi đổi Status; nếu Excel thiếu ID, dùng `docs/ASM08_TRACEABILITY_GAPS.md` để lập kế hoạch đồng bộ.

### Rerun tự động cùng một danh sách Failed

```powershell
.\scripts\rerun-failed.ps1
```

Sau đó đối chiếu hai log `Envidence - Group08/logs/rerun-failed-*.log` với JSON gốc; cập nhật `FLAKY_RERUN_LOG.md`.

## 7. Bàn giao nhóm & buổi báo cáo

Nộp Git: project tích hợp, report HTML/XML/JSON sau chạy, folder `Envidence - Group08` chứa log, screenshots, và README này. Ngoài ra, **mỗi TV nộp riêng PPTX và ZIP script minh chứng cá nhân** lên Classroom; hai bộ sản phẩm có mục đích khác nhau.

**Cần thực hiện trước khi tuyên bố Assignment 8 hoàn tất:** máy nhóm chạy `npm ci`, `npm run test:list`, `npm test`, rerun Failed, lưu file kết quả và cập nhật Excel cho 15 chức năng. Chưa có các bước này thì không thể công bố Pass/Fail toàn nhóm.
