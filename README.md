# Group08 – Assignment 6: Test Design & Automation Test Planning

**Website kiểm thử:** [Di Động Việt](https://didongviet.vn/)  
**GitHub:** https://github.com/HoangDuyTan/Group08-Software-Test  
**Hạn nộp:** 23/10/2026  
**Nhóm trưởng / TV3:** Hoàng Duy Tân – 23130291

## Phạm vi & phân công theo file gốc

| TV | Mã chức năng | Tên chức năng (đúng bản phân công) |
|---|---|---|
| TV1 | F01 | Tìm kiếm sản phẩm và gợi ý tìm kiếm |
| TV1 | F02 | Lọc sản phẩm theo nhiều tiêu chí kết hợp |
| TV1 | F03 | So sánh nhiều sản phẩm |
| TV2 | F04 | Lựa chọn phiên bản, dung lượng và màu sắc |
| TV2 | F05 | Quản lý giỏ hàng |
| TV2 | F06 | Sản phẩm mua kèm và ưu đãi mua kèm |
| TV3 | F07 | Nhập và xác thực thông tin đặt hàng |
| TV3 | F08 | Lựa chọn giao hàng / nhận tại cửa hàng |
| TV3 | F09 | Tra cứu trạng thái đơn hàng |
| TV4 | F10 | Thu cũ đổi mới: tham khảo giá, đăng ký định giá |
| TV4 | F11 | Tìm kiếm cửa hàng theo khu vực |
| TV4 | F12 | Đăng ký tư vấn / tham gia khuyến mãi |
| TV5 | F13 | Lựa chọn phương án trả góp |
| TV5 | F14 | Lựa chọn phương thức thanh toán |
| TV5 | F15 | Flash Sale: giá và trạng thái ưu đãi |

## Hồ sơ nhóm và đường dẫn nộp

- `planning/Assignment6_DiDongViet_450_TestCases_5ThanhVien.xlsx` – bảng phân công và **kịch bản dự thảo**, không phải bản tổng hợp cuối theo mẫu giảng viên.
- `docs/individual/Group08_MaSV_HoTen.xlsx` – từng thành viên một file; 3 chức năng/người, cập nhật theo tiến độ. Giai đoạn tuần 1 tối thiểu 20–30 test case thuộc một chức năng.
- `docs/individual/Group08_23130291_HoangDuyTan.xlsx` – hiện là bản tuần 1 của TV3 với F07 (30 TC). Sẽ cập nhật thêm F08 và F09 sau.
- `docs/merged/Group08_DiDongViet.xlsx` – nhóm trưởng gộp các file cá nhân *đã được duyệt*, theo mẫu giảng viên, thành đủ 15 chức năng. **Chưa tạo file này khi chưa gộp thật.**
- `automation/Group08_AutomationPlan.md` – kế hoạch/checklist automation cấp nhóm.
- `evidence/` – tùy chọn lưu bản sao minh chứng; mỗi người vẫn phải có `MaSV_HoTen.png` trong ZIP cá nhân.
- `Group08.txt` – đường dẫn GitHub chung.

## Quy ước mã hóa và format

- Mã chức năng: `F01`–`F15` như file `PHAN CONG`.
- Mã thiết kế: `D01`–`D15` trong file kế hoạch nguồn.
- Mã test case: `DDV_F07_001` (mẫu chung `DDV_F##_###`). Mã phải duy nhất, không tự đổi thành `[F07-1]`.
- Trạng thái test chưa chạy: `Untested`. Không tự ghi `Passed`/`Failed` nếu chưa thực thi.
- Định dạng workbook cá nhân bám mẫu cô: Cover, Test case List, TestDesign, sheet Test Case theo chức năng, Test Report.
- Mẫu file cá nhân: `Group08_MaSV_HoTen.xlsx` (không thêm `_Tuan1` trong tên file nộp cuối).

## Git workflow

1. Mỗi thành viên tạo nhánh từ `dev`, ví dụ `feature/tv3-23130291-testcases`.
2. Chỉ sửa file Excel cá nhân của mình trong `docs/individual/`.
3. Commit có ý nghĩa, ví dụ `docs(tv3): add 30 F07 test cases`.
4. Push branch, tạo Pull Request với **base `dev`**. Nhóm trưởng review trước khi merge.
5. Nhóm trưởng cập nhật `docs/merged/Group08_DiDongViet.xlsx` và `automation/Group08_AutomationPlan.md` trên nhánh riêng của mình, rồi PR vào `dev`.
6. Giữ lịch sử push, PR, merge để chứng minh đóng góp. Repo để **Public** và kiểm tra trong cửa sổ ẩn danh.

## Minh chứng nộp cá nhân

Mỗi người nộp ZIP `MaSV_HoTen.zip` gồm **đúng 3 file**:

1. `Group08.txt` – URL repo chung.
2. `MaSV_HoTen.png` – ảnh THẬT minh chứng push nhánh riêng và merge vào `dev`, có thể ghép hai ảnh chụp thật vào một PNG.
3. `Group08_MaSV_HoTen.xlsx` – workbook cá nhân.

Ngoài ZIP, theo yêu cầu tiến độ tuần này, nộp Excel cá nhân lên Classroom. Nhóm trưởng gửi repo qua biểu mẫu của cô: https://forms.gle/qbtm1tGikURpgpzXA

> Lưu ý: Bộ dữ liệu nguồn là bản nháp, cần xác minh UI/điều kiện và expected output trước khi chạy test. Assignment 6 chỉ yêu cầu kế hoạch tự động hóa, chưa bắt buộc chạy toàn bộ automation.
