# Group08 – ASM08 Traceability Audit (từ ZIP nhánh dev ngày 06/11/2026)

## Số lượng chức năng

15 file `*.spec.ts`: F01–F15, 5 thành viên. Theo cấu trúc vòng lặp/literal của source, mỗi F thường có 30, F10 có 40, tổng **dự kiến 460 test**. Đây là số từ đọc source, **chưa phải kết quả Playwright `--list`** vì chưa cài được Playwright trong môi trường kiểm tra.

## Vấn đề Excel

`docs/merged/Group08_Merged_TestCases.xlsx` có **11 sheet chức năng / 320 TC**, không đủ 15 chức năng 460 TC như source. Các điểm lệch:

| Chức năng | Script | Merged Excel | Cần hành động |
|---|---:|---:|---|
| F01 | 30 | 20 | Bổ sung 10 TC theo source, review Expected/Steps |
| F02 | 30 | 0 | Thêm sheet và 30 TC từ file cá nhân TV1 |
| F03 | 30 | 0 | Thêm sheet và 30 TC từ file cá nhân TV1 |
| F04 | 30 | 30 | Đối chiếu title/steps, giữ kết quả lịch sử nếu có bằng chứng |
| F05 | 30 | 30 | Đối chiếu Status với latest report |
| F06 | 30 | 30 | Đối chiếu Status với latest report |
| F07 | 30 | 30 | TV3 29 Passed/1 Skipped (report lịch sử riêng) |
| F08 | 30 | 30 | Merged Excel đang Untested, TV3 V13 báo 30 Passed lịch sử |
| F09 | 30 | 30 | Merged Excel đang Untested, TV3 V8 báo 21 Passed/4 Failed/5 Skipped lịch sử |
| F10 | 40 | 30 | Bổ sung 10 TC và review nội dung ID 022–040 |
| F11 | 30 | 0 | Thêm sheet theo Excel TV4 cá nhân |
| F12 | 30 | 0 | Thêm sheet theo Excel TV4 cá nhân |
| F13 | 30 | 30 | Đối chiếu runtime report |
| F14 | 30 | 30 | Đối chiếu runtime report |
| F15 | 30 | 30 | Đối chiếu runtime report |
| **Tổng** | **460** | **320** | **Còn thiếu 140 TC trong workbook gộp** |

Đặc biệt `docs/individual/Group08_23130067_PhamMinhDuc.xlsx` trong ZIP nguồn có dung lượng **0 byte**, không phải tệp XLSX hợp lệ. TV1 cần upload lại workbook chính xác trước khi merge/hoàn thiện 15 sheet. **Không được tự bịa Steps/Expected** cho 60 TC F02/F03 từ danh sách tên case.

## Bằng chứng và kết quả thực thi

- `Envidence - Group08/screenshots/` trong ZIP dev là ảnh GitHub/PR theo cá nhân; không chứng minh đã chạy 460 TC.
- Chưa có group HTML/JSON/XML report trong ZIP dev.
- Các trạng thái trong merged workbook là dữ liệu lịch sử từ những lần chạy khác nhau, **không thay thế một lần chạy full suite**.
- Có thể xem baseline TV3 riêng trong `Test Report - Group08/Individual_Baselines`.

## Kế hoạch đồng bộ

1. TV1 nộp lại XLSX hợp lệ cho F01–F03 và cập nhật 30 TC F01.
2. TV4 xác nhận 40 TC F10 mới và nội dung Expected/Steps; gộp F11/F12 từ XLSX cá nhân.
3. TV3 đưa workbook ASM08 V13/V8 cá nhân mới vào `docs/individual/`, cập nhật F08/F09 merged khi đối chiếu nguồn.
4. Rà soát Status từng thành viên theo report thực thi có timestamp.
5. Chạy group suite trên website, dùng JSON report làm kết quả cuối để ghi vào merged workbook.
