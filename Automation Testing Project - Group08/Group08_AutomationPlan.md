# Group08: Kế hoạch tích hợp và chạy test

**Website:** https://didongviet.vn/  
**Tools:** TypeScript, Playwright, Chromium  
**Dữ liệu:** sử dụng synthetic inputs và fixture có quyền; không tạo đơn hoặc thanh toán thật trên production.

## Đã xác minh từ ZIP dev đầu vào

- Có 5 folder thành viên và 15 file chức năng F01–F15.
- Có Playwright config và package-lock; đường dẫn test theo MSSV.
- Script TV3 F07–F09 có HTML report lịch sử riêng (đã kèm baseline).
- `docs/merged/Group08_Merged_TestCases.xlsx` chỉ có 11 chức năng / 320 TC, chưa khớp toàn bộ source.

## Các bước còn cần bằng chứng chạy thực tế

1. Cài dependency và Chromium theo README, ghi phiên bản Node/Playwright/OS.
2. `npm run test:list` và lưu output + số TC; kiểm tra ID không thiếu/trùng.
3. `npm test` hoặc `scripts/run-group-suite.ps1` chạy trên website, lưu HTML, JSON, JUnit, log và thời gian.
4. Đối chiếu từng Failed/Skipped, phân loại bug website / issue script / fixture / mạng.
5. Rerun ít nhất một lần những ca Failed nghi flaky ở cùng cấu hình; chụp trace và lưu rerun log.
6. Cập nhật `docs/merged` dựa trên source, **không bịa nội dung Expected cho các ca Excel chưa có**; mời thành viên TV1 bổ sung workbook hợp lệ.
7. Tổng hợp số liệu report, review nhóm, commit artifacts với kiểm tra bảo mật.

## Trạng thái báo cáo

- `Integration source`: ĐÃ CÓ.
- `Dependency install + test discovery trên môi trường nhóm`: CHƯA CÓ MINH CHỨNG (làm trên máy có npm network).
- `Full group suite report`: CHƯA CÓ.
- `Root-cause + rerun/flaky report`: CHƯA CÓ.
- `Individual PPTX`: mỗi thành viên nộp riêng, không thuộc gói source nhóm.

**Không sử dụng kết quả chạy riêng từng thành viên làm bằng chứng thay cho lần chạy group suite.**
