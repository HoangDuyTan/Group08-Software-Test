# Group08 — Software Testing | TV01 — Assignment 6

**Website kiểm thử:** https://didongviet.vn/  
**Nhánh làm việc:** tạo nhánh riêng của TV01 từ `dev` (chưa push tự động)  
**Trạng thái:** Bộ tài liệu chuẩn bị để đưa lên GitHub; không phải bản đã push.

## Cấu trúc repository

```text
Group08-Software-Test/
├── README.md
├── Group08.txt
├── automation/
│   └── Group08_AutomationPlan.md
├── docs/
│   ├── individual/
│   │   └── Group08_MaSV_HoTen.xlsx
│   └── merged/
│       └── .gitkeep
├── evidence/
│   └── .gitkeep
└── planning/
    └── Test_Plan_DiDongViet.xlsx
```

## Phần công việc TV01

- **CN01 / F01:** Tìm kiếm sản phẩm và gợi ý tìm kiếm — **20 test case** (`DDV_F01_001` đến `DDV_F01_020`) trong `docs/individual/`.
- **CN02:** Bộ lọc sản phẩm đa tiêu chí — phần kế tiếp.
- **CN03:** Sắp xếp và hiển thị thêm sản phẩm — phần kế tiếp.
- File Excel hiện trạng thái **Untested**; chỉ cập nhật Passed/Failed khi thực sự chạy.

## Trước khi push (bắt buộc)

1. Đổi `Group08_MaSV_HoTen.xlsx` thành `Group08_<MSSV>_<HoTenKhongDau>.xlsx`.
2. Mở Excel, thay các chỗ giữ chỗ `MaSV`, `HoTen` và kiểm tra nội dung 20 test case theo trình duyệt thực tế.
3. Clone repository chung (hoặc chuyển tới thư mục repository hiện có), checkout nhánh `dev`, cập nhật, rồi tạo nhánh **riêng** của bạn; KHÔNG `git init` một repo mới trên ZIP này.
4. Copy phần **file TV01** vào repository, kiểm tra các file dùng chung đã có trong `automation/`, `planning/`, `README.md` để tránh ghi đè tài liệu nhóm.
5. Commit và push nhánh riêng. Tạo Pull Request vào `dev`.
6. **Tự chụp màn hình kết quả push/PR thật**, lưu `evidence/<MSSV>_<HoTenKhongDau>.png`. ZIP này không chứa ảnh minh chứng giả.

Ví dụ lệnh (sửa tên nhánh theo MSSV):

```bash
git switch dev
git pull origin dev
git switch -c <MSSV>-tv01
git add docs/individual/Group08_<MSSV>_<HoTenKhongDau>.xlsx
git commit -m "docs: add TV01 F01 search test cases"
git push -u origin <MSSV>-tv01
```

**Lưu ý:** ZIP này mô phỏng **cấu trúc thư mục repository** theo minh chứng nhánh của thành viên khác. Tệp ZIP không phải Git branch thật và không có lịch sử commit/merge.
