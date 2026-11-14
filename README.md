# Group08 – Final Project: Software Testing (Assignment 10)

**Website kiểm thử:** https://didongviet.vn/  
**GitHub:** https://github.com/HoangDuyTan/Group08-Software-Test  
**Công nghệ:** Playwright Test, TypeScript, Chromium  
**Automation Test Plan:** `Automation Testing Project - Group08/Group08_AutomationPlan.md` (giữ nguyên tên và nội dung hiện tại).

## 1. Tổng quan dự án

Nhóm 08 kiểm thử website Di Động Việt với 15 chức năng (F01–F15), phân công cho 5 thành viên, mỗi thành viên phụ trách 3 chức năng. Phạm vi bao gồm Function Analysis, Test Scenarios, Test Cases, Automation Test Scripts, Test Execution Reports và Defect Reports. Các kết quả và minh chứng Assignment 7–9 tiếp tục được lưu giữ để đối chiếu lịch sử.

## 2. Thành viên và phân công

| Mã sinh viên | Thành viên | Chức năng | Thư mục test hiện tại |
|---|---|---|---|
| 23130067 | Pham Minh Duc | F01, F02, F03 | `tests/23130067_PhamMinhDuc_TestScripts/` |
| 23130082 | Nguyen Truong Giang | F04, F05, F06 | `tests/23130082_NguyenTruongGiang_TestScripts/` |
| 23130291 | Hoang Duy Tan | F07, F08, F09 | `tests/23130291_HoangDuyTan_TestScripts/` |
| 23130087 | Nguyen Van Anh Han | F10, F11, F12 | `tests/23130087_NguyenVanAnhHan_TestScripts/` |
| 23130318 | Tran Thi Minh Thu | F13, F14, F15 | `tests/23130318_TranThiMinhThu_TestScripts/` |

Tên thư mục trong bảng phản ánh cấu trúc project lúc tạo README; việc đổi tên thư mục của thành viên khác cần có sự thống nhất của nhóm.

## 3. Cấu trúc repository

```text
Group08-Software-Test/
├── README.md                        # Hướng dẫn dự án
├── group08.txt                      # 8 loại liên kết/thông tin theo đề
├── docs/                            # Excel, tài liệu và bản lưu lịch sử
│   └── history/                     # Bản README trước khi chỉnh sửa
├── Automation Testing Project - Group08/
│   ├── package.json / package-lock.json
│   ├── playwright.config.ts
│   ├── playwright.asm09.config.ts
│   ├── Group08_AutomationPlan.md    # Giữ nguyên
│   ├── tests/                        # Scripts và helper theo thành viên
│   ├── scripts/                      # Công cụ chạy suite và xuất report
│   └── test-data/                    # Hướng dẫn dữ liệu kiểm thử
├── Test Report - Group08/           # Report và kết quả chạy cũ
├── Envidence - Group08/             # Giữ tên gốc để không hỏng liên kết
└── playwright-report/               # Report Playwright lịch sử
```

Một số report cũ cũng nằm trong thư mục `Automation Testing Project - Group08/`. Chúng được giữ nguyên vị trí phục vụ minh chứng, không được tự coi là kết quả của cùng một lần chạy.

## 4. Cài đặt môi trường

Máy cần Node.js, npm và Chromium. Trong PowerShell, **chuyển vào thư mục chứa `package.json`** trước khi chạy lệnh npm:

```powershell
cd "Automation Testing Project - Group08"
npm ci
npx playwright install chromium
npm run test:list
```

Nếu đang ở thư mục gốc repository, chạy `npm` ngay tại đó sẽ báo `ENOENT` vì không có `package.json` ở root.

## 5. Chạy Automation Tests

```powershell
# Chỉ liệt kê test, chưa truy cập website
npm run test:list

# Các chức năng của Hoàng Duy Tân
npm run test:f07
npm run test:f08
npm run test:f09

# Chạy toàn bộ tests theo Playwright configuration
npm test

# Script chạy nhóm, lưu log và metadata
.\scripts\run-group-suite.ps1
```

Chạy một test case cụ thể:

```powershell
npx playwright test --grep "DDV_F08_014" --project=chromium --workers=1
```

Với thành viên khác, chọn đúng file `.spec.ts` từ thư mục của họ dưới `tests/` hoặc dùng `npx playwright test "tests/<ten-thu-muc>/<ten-file>.spec.ts" --project=chromium --workers=1`.

**An toàn dữ liệu:** Dùng dữ liệu giả lập và fixture được phép sử dụng. Không tự đặt đơn, thanh toán hoặc sử dụng dữ liệu thật của khách hàng trên production. Khi không có fixture hợp lệ, ghi đúng trạng thái Skipped/Blocked.

## 6. Test Execution Report và Evidence

`playwright.config.ts` có cấu hình Chromium, screenshot, video, trace và các reporter HTML/JSON/JUnit. Vị trí báo cáo theo cấu hình hiện có:

| Loại minh chứng | Đường dẫn |
|---|---|
| HTML Report | `Test Report - Group08/html-report/index.html` |
| JSON Result | `Test Report - Group08/group08-results.json` |
| JUnit XML | `Test Report - Group08/group08-junit.xml` |
| Test Summary | `Test Report - Group08/GroupSuite_Summary.md` |
| Failed Test / Analysis | `Test Report - Group08/Defect_Log.md` |
| Minh chứng lịch sử (ảnh/video/trace/log) | `Envidence - Group08/`, `Test Report - Group08/`, các report cá nhân |

```powershell
npm run report:summary
npm run test:report
```

**Lưu ý tính chính xác:** Tổng số test, Passed, Failed, Skipped và thời gian thực thi phải lấy từ **cùng một lần chạy**. Report lịch sử khác ngày hoặc khác config phải ghi rõ nguồn. Khi Fail, xem assertion, screenshot, trace, video và log trước khi phân loại thành lỗi website, lỗi script, lỗi môi trường hay thiếu fixture. File README này không tự tạo kết quả chạy mới.

## 7. Tài liệu chung và Defect List

File `group08.txt` chứa các liên kết yêu cầu trong đề: GitHub, Google Sheets (Test Cases; Task Assignment & Progress; Defects), Google Slides, Google Drive minh chứng, website kiểm thử và danh sách thành viên kèm GitHub username.

- Mỗi thành viên cập nhật phần được giao trực tiếp trên tài liệu chung.
- Defect cần có bước tái hiện, dữ liệu đầu vào, Expected/Actual, Severity và evidence thực tế.
- Giữ nguyên toàn bộ screenshot, video, trace, log và report cũ phục vụ đối chiếu.
- Giữ nguyên `Group08_AutomationPlan.md` theo quyết định của nhóm.

## 8. GitHub Workflow, Demo và bàn giao

Mỗi thành viên làm việc trên branch riêng, tự commit, push và tạo Pull Request; nhóm tích hợp vào nhánh chung. Commit History và PR là bằng chứng đóng góp, không cần tạo lại nếu đã có.

Trước khi bảo vệ: kiểm tra `npm run test:list`, chạy bộ test cuối được nhóm thống nhất, gắn đúng report/evidence lên Drive, bảo đảm cô có quyền xem tài liệu và luyện demo 10 test case tiêu biểu cùng 10 defect của mỗi thành viên.

Bản README trước khi cập nhật được giữ trong `docs/history/` và bản backup bên ngoài repository.