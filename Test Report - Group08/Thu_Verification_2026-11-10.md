# Kiểm tra F13–F15 của Trần Thị Minh Thư ngày 10/11/2026

Kết quả hiện hành của 90 testcase được tổng hợp từ hai lượt chạy Chromium độc lập, mỗi lượt dùng 1 worker và retries=0.

| Lượt chạy | F13 | F14 | F15 | Nguồn |
|---|---|---|---|---|
| Trước sửa, 90 case, khoảng 16 phút 32 giây | 30 Passed | 22 Passed, 8 Failed | 30 Passed | [JSON](thu-90-2026-11-10_1030/results.json), [log](thu-90-2026-11-10_1030/run.log) |
| Sau sửa, chạy lại toàn bộ 30 case F14, khoảng 6 phút 53 giây | — | 30 Passed, 0 Failed, 0 Skipped | — | [JSON](thu-f14-fixed-2026-11-10-verified/results.json), [log](thu-f14-fixed-2026-11-10-verified/run.log) |

F13 và F15 giữ kết quả đã xác minh ở lượt trước sửa. F14 dùng kết quả của lượt chạy sau sửa. Tổng cộng 90 kết quả hiện hành là Passed; hai workbook ghi nguồn theo từng testcase.

Các thay đổi F14:

- Case 002, 003, 008, 014, 020, 022, 025 được cập nhật theo 8 phương thức thanh toán đang hiển thị trên checkout. OnePay và Payoo không có trong danh sách của giỏ kiểm thử.
- Case 024 dùng Galaxy A07 5G cho thao tác tăng số lượng lên 2, giữ kiểm tra đúng sản phẩm và tạm tính gấp đôi. Galaxy A07 4G màu Tím ở lượt trước sửa khóa nút tăng.
- Case 027 chờ dữ liệu sau reload và xử lý nhánh chuyển về giỏ ngay cả khi chuyển trang xảy ra trong lúc đối chiếu. Chỉ mở lại checkout một lần; vẫn kiểm tra toàn bộ sản phẩm, số lượng, tổng tiền và trạng thái phương thức thanh toán.
- Các case dừng trước đặt hàng/thanh toán. Không nhập dữ liệu người nhận, thẻ hoặc OTP.

Ảnh minh chứng được chọn:

- [Danh sách 8 phương thức checkout](../Envidence%20-%20Group08/test-screenshots/F14_Checkout_Methods_Thu_2026-11-10.png): chụp tại lỗi tìm OnePay của lượt trước sửa, thể hiện UI thực tế.
- [F14_024: Galaxy A07 5G số lượng 2](../Envidence%20-%20Group08/test-screenshots/F14_024_Thu_Quantity_2026-11-10.png).
- [F14_027: checkout sau reload/phục hồi](../Envidence%20-%20Group08/test-screenshots/F14_027_Thu_Reload_2026-11-10.png).

JSON, log và các ảnh trên được lưu trong Git. Bản HTML đầy đủ, video và trace giữ ở máy để tra cứu khi cần. Đường dẫn tuyệt đối của các attachment trong JSON thuộc máy chạy; các ảnh được chọn có liên kết tương đối ở trên.
