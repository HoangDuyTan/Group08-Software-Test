# Group08 – Automation Test Plan (Assignment 6)

**Project:** Di Động Việt (didongviet.vn)  
**Phase:** Test design and automation planning  
**Status:** Dự thảo – chưa thực thi  
**Target:** 15 chức năng (F01–F15), theo đúng `planning/Assignment6_DiDongViet_450_TestCases_5ThanhVien.xlsx`

## 1. Mục tiêu

Xác định chức năng ưu tiên, phạm vi có thể tự động hóa, công cụ dự kiến, dữ liệu và cách xác minh kết quả. Không trình bày kết quả chạy thực tế nếu chưa thực thi.

## 2. Công cụ đề xuất

- Browser: Chrome/Chromium
- Framework ưu tiên: Playwright + TypeScript (hoặc Katalon Recorder nếu giảng viên/phòng lab thống nhất); đây là **đề xuất**, nhóm chưa xác nhận triển khai.
- Version control: GitHub; workflow `feature/*` → Pull Request → `dev`.
- Report nếu triển khai: HTML report, screenshot khi fail, console/log theo cấu hình công cụ.

## 3. Danh sách chức năng / mức ưu tiên

| TV | Mã | Chức năng | Mức ưu tiên | Kịch bản ưu tiên tự động hóa | Điều kiện/giới hạn |
|---|---|---|---|---|---|
| TV1 | F01 | Tìm kiếm sản phẩm và gợi ý tìm kiếm | P1 | Tìm từ khóa hợp lệ, không có kết quả | Dữ liệu sản phẩm động |
| TV1 | F02 | Lọc sản phẩm theo nhiều tiêu chí kết hợp | P1 | Lọc theo 1 hoặc nhiều điều kiện | Bộ lọc tùy danh mục |
| TV1 | F03 | So sánh nhiều sản phẩm | P2 | Thêm/bớt sản phẩm so sánh | Xác minh chức năng khả dụng |
| TV2 | F04 | Lựa chọn phiên bản, dung lượng và màu sắc | P1 | Chọn phiên bản và kiểm tra hiển thị | Variant phụ thuộc SKU |
| TV2 | F05 | Quản lý giỏ hàng | P0 | Thêm/sửa/xóa sản phẩm giỏ hàng | Không tạo đơn thật |
| TV2 | F06 | Sản phẩm mua kèm và ưu đãi mua kèm | P2 | Chọn/bỏ chọn sản phẩm mua kèm | Chương trình khuyến mãi thay đổi |
| TV3 | F07 | Nhập và xác thực thông tin đặt hàng | P0 | Trường bắt buộc, định dạng SĐT, thông báo lỗi | Không gửi đơn thật; dữ liệu thử nghiệm |
| TV3 | F08 | Lựa chọn giao hàng / nhận tại cửa hàng | P0 | Chuyển phương thức, chọn địa chỉ/cửa hàng | Phụ thuộc địa bàn và tồn kho |
| TV3 | F09 | Tra cứu trạng thái đơn hàng | P1 | Mã đơn hợp lệ/không hợp lệ, dữ liệu trống | Cần mã đơn test hợp lệ được cấp phép |
| TV4 | F10 | Thu cũ đổi mới: tham khảo giá, đăng ký định giá | P2 | Chọn thiết bị/kiểm tra trường nhập | Không gửi yêu cầu thật |
| TV4 | F11 | Tìm kiếm cửa hàng theo khu vực | P1 | Tìm theo khu vực và trạng thái rỗng | Danh sách cửa hàng biến động |
| TV4 | F12 | Đăng ký tư vấn / tham gia khuyến mãi | P2 | Validation của form | Không tạo lead thật hoặc spam |
| TV5 | F13 | Lựa chọn phương án trả góp | P1 | Hiển thị/tính điều kiện trả góp | Không gửi đơn tài chính thật |
| TV5 | F14 | Lựa chọn phương thức thanh toán | P0 | Hiển thị và lựa chọn phương thức | Không thanh toán tiền thật |
| TV5 | F15 | Flash Sale: giá và trạng thái ưu đãi | P2 | Hiển thị giá/nhãn theo chương trình | Lịch chạy sale biến động |

## 4. Checklist trước khi thực thi

- [ ] Xác nhận 15 chức năng đang tồn tại và truy cập được trên web.
- [ ] Review expected result của mỗi test case, đối chiếu hành vi và yêu cầu thực tế.
- [ ] Phân loại TC: có thể tự động hóa / thủ công / chưa đủ dữ liệu.
- [ ] Chuẩn bị SKU và test data ổn định, tránh phụ thuộc dữ liệu sản xuất biến động.
- [ ] Chuẩn bị môi trường test hoặc quyền cho phép; tránh tạo đơn, khách hàng hay thanh toán thật.
- [ ] Xác định điều kiện trước, locator và assertion của từng test case.
- [ ] Ưu tiên smoke cases P0 trước, sau đó regression P1/P2.
- [ ] Thống nhất tên test script/map ID theo chuẩn `DDV_F##_###`.
- [ ] Quy định nơi lưu screenshot/log và quy trình báo lỗi.
- [ ] Review kết quả; chỉ đánh Passed/Failed khi có chạy test thật.

## 5. Định nghĩa trạng thái

- `Untested`: chưa thực thi.
- `Passed`: đã chạy và kết quả thực tế đạt expected.
- `Failed`: đã chạy và kết quả thực tế không đạt expected.
- `Blocked`: không thể chạy do tiền điều kiện/môi trường.
- `Skipped`: chủ động bỏ qua, có lý do được ghi rõ.

## 6. Traceability

- File phân công: `planning/Assignment6_DiDongViet_450_TestCases_5ThanhVien.xlsx`.
- Test Design: `D01`–`D15`; chức năng `F01`–`F15`.
- Test Case: `DDV_F01_001` … `DDV_F15_030` trong kế hoạch dự thảo; số lượng thực tế phụ thuộc file cá nhân cuối.
- File cá nhân: `docs/individual/Group08_MaSV_HoTen.xlsx`.
- File tổng hợp nhóm: `docs/merged/Group08_DiDongViet.xlsx` (chỉ xuất sau khi gộp và review đủ).

## 7. Tiến độ

- Trước 23/10/2026: hoàn thành Excel tuần (mỗi người ít nhất một chức năng 20–30 TC), push nhánh cá nhân, merge `dev`, chụp minh chứng, nộp các gói theo yêu cầu.
- Sau đó: tiếp tục hoàn thiện ba chức năng/người, cập nhật bản merged và kế hoạch automation trên GitHub.
