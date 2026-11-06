# Test Report - Group08 (Assignment 8)

**Tại thời điểm dựng gói tích hợp:** chưa có kết quả chạy **15 file suite nhóm** trong source ZIP dev, nên chưa thể công bố một bảng Pass/Fail/Skipped nhóm hợp lệ.

Sau khi chạy `Automation Testing Project - Group08/scripts/run-group-suite.ps1` hoặc `npm test`, Playwright tạo tự động:
- `html-report/index.html` – tổng hợp cùng các screenshot/trace/video failed trong `data/`.
- `group08-results.json` – kết quả máy đọc được.
- `group08-junit.xml` – kết quả định dạng JUnit.
- `GroupSuite_Summary.md` – script `npm run report:summary` tạo từ JSON.
- `Defect_Log.md` – danh sách Failed/Skipped trích từ JSON; cần QA triage bổ sung nguyên nhân gốc.

`Individual_Baselines/TV3_*` chứa **kết quả riêng của TV3** từ lần chạy trước; không tự cộng chung vào kết quả nhóm.
