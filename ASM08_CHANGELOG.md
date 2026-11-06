# Group08 – ASM08 Integration Updates (06/11/2026)

## Đã điều chỉnh trong gói này

- Giữ nguyên 15 file source chức năng và helpers từ ZIP dev (không tự sửa nội dung test để chạy Passed).
- Sửa `package.json` để `npm test` chạy Playwright, thêm `test:list`, `report:summary` và các lệnh chạy cá nhân phổ biến.
- Cấu hình HTML/JSON/JUnit reporter vào folder **`Test Report - Group08`**; chỉnh comment timeout 180000ms = 3 phút.
- Bổ sung `scripts/run-group-suite.ps1` để thu thập log/metadata thực thi thật trên Windows.
- Bổ sung `scripts/summarize-report.mjs` để sinh số liệu/Failed list từ JSON sau khi chạy.
- Viết mới README/AutomationPlan cho Assignment 8 và checklist flaky.
- Giữ nguyên tên folder `Envidence - Group08` theo đề, phân biệt ảnh PR/GitHub và ảnh test website.
- Thêm các **individual HTML Report TV3 lịch sử** vào `Test Report - Group08/Individual_Baselines` và 6 ảnh website có thật vào `Envidence - Group08/test-screenshots`.
- Bổ sung workbook TV3 đã chỉnh vào `docs/individual`, không sửa merged workbook cũ khi thiếu XLSX TV1 và group execution.

## Chưa làm / không được trình bày là xong

- `npm ci` trong môi trường kiểm tra thất bại do không phân giải `registry.npmjs.org`; không chạy live Playwright suite.
- Chưa có ảnh/log report full-suite 15 chức năng: cần chạy trên Windows có Internet.
- Chưa sửa merged workbook 15 functions 460 TC, đang thiếu Excel TV1 và có mismatch.
- Chưa có bằng chứng rerun flaky của nhóm.
