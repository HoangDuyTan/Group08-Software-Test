# Group08 - Assignment 10 Compliance Audit

- Generated: 2026-11-14 16:56:10 (local Windows time)
- Repository: `D:\Learning\DHNam4\Software Test\CK\Group08-Software-Test`
- Git branch: 23130291-tan
- Mode: Read-only audit; chi tao 2 file muc luc khi dung `-Apply`.

## 1. Kiem tra theo source hien tai

| Muc | Ket qua | Ghi chu |
|---|---|---|
| Automation project | OK | Co package.json va tests/. |
| README.md | OK | File ton tai; can doc lai huong dan bang mat truoc khi nop. |
| Group08_AutomationPlan.md | OK | Co san. Script giu nguyen ten va noi dung. |
| group08.txt | WARN | group08.txt: con 10 placeholder; can dien link va GitHub usernames that. |
| 15 function files F01-F15 | OK | Tim thay 15 file Function, va 5 file ASM09. |
| Member TestScripts folders | WARN | Can dong y cua nhom truoc khi doi ten: 23130067_PhamMinhDuc, 23130082_NguyenTruongGiang, 23130087_NguyenVanAnhHan, 23130291_HoangDuyTan, 23130318_TranThiMinhThu |
| npm scripts | OK | Co test, test:list, test:f07/08/09, report:summary va test:report. |
| npm test:f07 | OK | Tim thay tests/23130291_HoangDuyTan/23130291_HoangDuyTan_F07.spec.ts |
| npm test:f08 | OK | Tim thay tests/23130291_HoangDuyTan/23130291_HoangDuyTan_F08.spec.ts |
| npm test:f09 | OK | Tim thay tests/23130291_HoangDuyTan/23130291_HoangDuyTan_F09.spec.ts |
| JSON report | OK | Tim thay 630 test; bat dau 2026-11-14T09:24:38.426Z; stats expected/unexpected/skipped: 0/0/630 |
| JUnit XML | OK | Tim thay 630 test. |
| GroupSuite_Summary.md | OK | So test ghi trong summary: 460 |
| Report coherence | FAIL | JSON, XML va Summary KHONG cung so test. Tuyet doi khong cong bo la 1 lan chay. Can nhom chon report chinh thuc. |
| HTML report | WARN | html-report ton tai; chua xac minh duoc co phai cung run voi JSON/XML/summary. |
| Old TEST_REPORT_PENDING.md | WARN | Tai lieu cu van co the ghi chua chay full-suite; chi nen giu la lich su va ghi ro trong REPORT_INDEX. |
| Playwright report output paths | WARN | Config dang dung filename JSON/XML co dinh. Chay lai se co nguy co ghi de ket qua cu: backup run truoc khi chay. |
| Evidence locations | WARN | Phat hien 6 khu vuc co report/evidence. Giu lai, phan loai bang REPORT_INDEX. |
| Git worktree | WARN | Co 8 dong thay doi, KHONG tu git add . |

## 2. Ban can xac nhan truoc khi chinh sua phan nhay cam

1. **Pham vi report cuoi ky:** 460 Function Tests (F01-F15) hay tat ca tests (co ASM09)? So luong thuc te lay tu `npm run test:list` tai thoi diem chay.
2. **Thu muc cua 4 thanh vien con lai:** Da duoc ca nhom dong y doi sang `MaSV_HoTen_TestScripts` chua? Script NAY khong dong toi code cua ho.
3. **Bao cao chinh thuc:** Run nao se duoc nop? Co du JSON, JUnit, HTML, Summary va metadata cung run chua?
4. **Link Online:** Da dien du Google Sheets 1/2/3, Slides, Drive va GitHub usernames trong `group08.txt`, da cap quyen giang vien chua?

## 3. Sau khi xac nhan

- Kiem tra trong thu muc `Automation Testing Project - Group08`:
  - `npm run test:list`
  - `npm run test:f07 -- --list`
  - `npm run test:f08 -- --list`
  - `npm run test:f09 -- --list`
- Khong chay lai full-suite cho den khi thong nhat config, pham vi va noi luu output.
- Khong xoa du lieu Assignment 7-9 cu; dung `Test Report - Group08/REPORT_INDEX.md` lam muc luc.
- Khong `git add .` neu file report tu dong sinh dang Modified/Untracked.

## 4. Git changes tai thoi diem audit

```text
 M README.md
 M "Test Report - Group08/group08-junit.xml"
 M "Test Report - Group08/group08-results.json"
RM Group08.txt -> group08.txt
?? "Automation Testing Project - Group08/test-data/"
?? "Test Report - Group08/html-report/"
?? docs/ASM10_REPOSITORY_MAP.md
?? docs/history/
```

**Gioi han:** Audit chi kiem tra su ton tai, do hop le so bo va su dong bo file. Khong thay the test run, manual review, GitHub PR review hay xac minh quyen Drive cua giang vien.