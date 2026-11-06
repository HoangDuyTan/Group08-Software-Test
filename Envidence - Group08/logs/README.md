# Log và thông tin môi trường khi chạy Test Suite nhóm

Chạy `Automation Testing Project - Group08/scripts/run-group-suite.ps1` để tạo:
- `group-suite-YYYYMMDD-HHMMSS.log`: terminal output nguyên bản.
- `group-suite-YYYYMMDD-HHMMSS-metadata.txt`: giờ bắt đầu/kết thúc, thời lượng, commit, Node/npm, exit code.

Rerun các case fail và lưu log riêng; có thể dùng template `FLAKY_RERUN_LOG.md` dưới đây.

**Không đính kèm cookie/session token, số điện thoại khách hoặc thông tin đơn hàng thật** khi đẩy lên repo Public.

### Kiểm tra lại các ca Failed (2 lượt)

Sau khi chạy full suite và **giữ lại group08-results.json**, tại thư mục project:

```powershell
.\scripts\rerun-failed.ps1
```

Lệnh dùng chính danh sách ID Failed trong JSON gốc, chạy lại **cùng một tập test** hai lượt và lưu log riêng. Rerun chỉ ghi log, không ghi đè HTML/JSON full suite. Điền kết luận vào `FLAKY_RERUN_LOG.md` sau khi xem log.
