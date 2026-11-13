"""Export verified ASM09 UI defects. Run from any directory after the final run.

Requires openpyxl and Pillow. Refuses to publish cases without two matching assertion failures.
"""
from __future__ import annotations

import base64
import json
import re
import shutil
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl
from openpyxl.drawing.image import Image
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.pagebreak import Break

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'Test Report - Group08/23130082_NguyenTruongGiang_ASM09'
RESULTS = ROOT / 'test-results/asm09-giang-manual-final.json'
SPEC = ROOT / 'Automation Testing Project - Group08/tests/23130082_NguyenTruongGiang/23130082_NguyenTruongGiang_ASM09.spec.ts'
BOOK = '23130082_NguyenTruongGiang_Defects.xlsx'
DATE = '2026-11-13'
URLS = {
    'samsung': 'https://didongviet.vn/dien-thoai/samsung-galaxy-s25-ultra-5g-256gb.html',
    'iphone16': 'https://didongviet.vn/dien-thoai/iphone-16-plus-256gb.html',
    'iphone17': 'https://didongviet.vn/dien-thoai/iphone-17-256gb.html',
    'pro': 'https://didongviet.vn/dien-thoai/iphone-17-pro-256gb.html',
    'promax': 'https://didongviet.vn/dien-thoai/iphone-17-pro-max-256gb.html',
}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def walk(suite):
    for spec in suite.get('specs', []):
        for test in spec['tests']:
            yield spec, test
    for child in suite.get('suites', []):
        yield from walk(child)


def attachment_bytes(attachment):
    if 'body' in attachment:
        return base64.b64decode(attachment['body'])
    return Path(attachment['path']).read_bytes()


def evidence(result):
    attachment = next(a for a in result['attachments'] if a['name'] == 'ASM09_evidence.json')
    return json.loads(attachment_bytes(attachment))


def style_sheet(sheet, widths):
    sheet.freeze_panes = 'B2'
    sheet.auto_filter.ref = sheet.dimensions
    sheet.sheet_view.zoomScale = 80
    for cell in sheet[1]:
        cell.fill = PatternFill('solid', fgColor='17365D')
        cell.font = Font(name='Calibri', size=11, color='FFFFFF', bold=True)
        cell.alignment = Alignment(vertical='center', wrap_text=True)
    sheet.row_dimensions[1].height = 32
    for i, width in enumerate(widths, 1):
        sheet.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width
    for row in sheet.iter_rows(min_row=2):
        sheet.row_dimensions[row[0].row].height = 210 if sheet.title == 'Defect List' else 95
        for cell in row:
            cell.font = Font(name='Calibri', size=11)
            cell.alignment = Alignment(vertical='top', wrap_text=True)
            if cell.row % 2 == 0:
                cell.fill = PatternFill('solid', fgColor='EDF3F8')
    sheet.print_options.horizontalCentered = True
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation = 'landscape'
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A3
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.print_title_rows = '1:1'


def main():
    report = read(RESULTS)
    manifest = read(DEST / 'defect-list.json')
    defects = [d for d in manifest['distinctDefects'] if d['number'] not in {'39', '11'}]
    if not any(d['number'] == '45' for d in defects):
        defects.append({
            'id': 'DDV-GIANG-11', 'number': '45', 'caseId': 'ASM09_TV2_45', 'feature': 'F05',
            'title': 'Đổi màu cùng model âm thầm xóa gói dịch vụ vẫn áp dụng cho màu mới',
            'kind': 'Functional / Data Consistency', 'severity': 'Medium', 'priority': 'P2',
            'description': 'Đổi riêng màu iPhone 17 256GB từ Đen sang Trắng xóa gói D.TradePlus đã chọn, không hỏi xác nhận. Chọn gói ở màu Trắng vẫn cung cấp cùng dịch vụ. Người mua có thể tiếp tục mà mất dịch vụ mong muốn.',
            'preconditions': 'Phiên guest sạch; iPhone 17 256GB màu Đen và Trắng còn mua được; D.TradePlus được cung cấp ở cả hai màu.',
            'data': 'iPhone 17 256GB; Đen → Trắng; D.TradePlus - Thu Cũ Vượt Trội (Giữ giá 75% trong 18 Tháng).',
            'expected': 'Giữ dịch vụ còn áp dụng khi chỉ đổi màu cùng model, hoặc hỏi xác nhận rõ trước khi xóa dịch vụ đã chọn.',
            'actual': 'Gói đang chọn biến mất, giỏ hiển thị Chọn gói; số gói đã lưu từ 1 thành 0. Mở Chọn gói vẫn thấy D.TradePlus khả dụng cho Trắng, nhưng website không tự giữ lựa chọn và không hỏi xác nhận xóa.',
            'group_note': 'Khác DDV-GIANG-08: một dòng duy nhất, mất gói ngay tại thao tác đổi màu ở F05. Ca 37 chuẩn bị lại đủ hai gói rồi mới kiểm tra F06 mất gói khi gộp dòng. Không khẳng định chung nguyên nhân kỹ thuật khi chưa có mã nguồn.',
        })
    if not any(d['number'] == '46' for d in defects):
        defects.append({
            'id': 'DDV-GIANG-12', 'number': '46', 'caseId': 'ASM09_TV2_46', 'feature': 'F06',
            'title': 'Không mua được một dòng đã chọn khi giỏ có hai dòng cùng SKU',
            'kind': 'Functional / Integration / State Management', 'severity': 'High', 'priority': 'P1',
            'description': 'Sau đổi màu tạo hai dòng Bạc x1 cùng SKU, bỏ chọn một dòng: giỏ vẫn báo đúng tiền một máy và cho bấm MUA NGAY (1). Khi bấm, website quay về giỏ và bỏ chọn cả hai dòng, không mở được checkout cho lựa chọn hợp lệ.',
            'preconditions': 'Phiên guest sạch; S25 Ultra 256GB/Bạc và Titan Đen đều mua được. Tạo hai dòng Bạc x1 qua thao tác đổi màu, không sửa DOM hoặc dữ liệu.',
            'data': 'Hai dòng S25 Ultra 256GB/Bạc, mỗi dòng x1; chỉ chọn dòng thứ hai. Tổng máy chọn là 1, không vượt giới hạn mua.',
            'expected': 'MUA NGAY (1) mở checkout cho đúng một máy đã chọn; không tự quay về giỏ và xóa lựa chọn.',
            'actual': 'Giỏ tính tiền đúng một máy nhưng sau MUA NGAY lại về /cart, cả hai checkbox đều bỏ chọn và không có sản phẩm checkout.',
            'group_note': 'Khác ca 30: tổng chỉ hai máy, mua một máy nên không vượt giới hạn. Khác ca 37: không có gói dịch vụ, một dòng bị bỏ chọn khiến không vào được checkout; ca 37 chọn cả hai dòng và vào checkout nhưng mất gói. Chưa khẳng định nguyên nhân trong mã nguồn.',
        })
    steps = {
        '30': [
            'Mở trang S25 Ultra, chọn Bạc, nhấn Thêm vào giỏ hàng. Mở /cart.',
            'Nhấn + từng lần đến 3; chờ mỗi lần cập nhật và xác nhận nút + đã bị khóa. Nếu chưa khóa ở 3 thì tiền điều kiện không còn đúng, không kết luận lỗi theo mốc cũ.',
            'Quay lại trang sản phẩm trong cùng cửa sổ, chọn Titan Đen và thêm 1 máy. Mở lại giỏ có hai dòng.',
            'Bấm màu Titan Đen tại dòng thứ hai, chọn Bạc. Tải lại giỏ bằng F5.',
            'Cộng số lượng hai dòng Bạc: 3 + 1 = 4, vượt giới hạn 3 vừa quan sát. Không nhấn đặt hàng.',
        ],
        '19': [
            'Mở trang S25 Ultra, chọn Titan Đen rồi thêm vào giỏ. Mở /cart.',
            'Tăng số lượng đến 3, chờ mỗi lần cập nhật hoàn tất.',
            'Bấm màu Titan Đen của dòng máy, chọn Titan Xanh trong hộp thoại.',
            'Chờ ít nhất 3 giây; quan sát hộp thoại vẫn mở, màu cũ vẫn được giữ và không có thông báo lý do hoặc cách xử lý.',
            'Chỉ để đối chiếu thêm: Network có PUT /api/fe/carts/items/variant trả 400 PRODUCT_OUT_OF_STOCK. Không cần mở DevTools để tái hiện hành vi thiếu phản hồi trên UI.',
        ],
        '21': [
            'Mở trang iPhone 17 256GB, chọn Đen. Ghi giá bán và giá gốc của máy.',
            'Chọn D.TradePlus; ghi giá gốc 2.990.000đ và giá ưu đãi 1.112.000đ tại thời điểm kiểm tra.',
            'Nhấn MUA NGAY; dừng ở checkout trước ĐẶT HÀNG.',
            'So Tiết kiệm với tổng hai chênh lệch: máy 1.200.000đ + dịch vụ 1.878.000đ = 3.078.000đ. Thực tế chỉ hiển thị 1.200.000đ. Tổng thanh toán không bị tính sai trong ca này.',
        ],
        '26': [
            'Thêm S25 Ultra/Titan Đen x1 và mở /cart ở tab A.',
            'Mở tab B trong cùng cửa sổ, nhập https://didongviet.vn/cart. Tăng lên x2, chờ cập nhật xong.',
            'Quay lại tab A; giữ nguyên trang cũ, không F5. Bấm MUA NGAY (1).',
            'Tại checkout của tab A quan sát số lượng x1. Tab B vẫn hiển thị x2; F5 tab B để xác nhận x2 đã được lưu.',
            'Đối chiếu số lượng và tổng tiền giữa hai tab. Không nhấn ĐẶT HÀNG.',
        ],
        '31': [
            'Mở trang iPhone 16 Plus 256GB. Cuộn đến phần mô tả; mở Xem thêm nếu nội dung đang thu gọn.',
            'Tìm đoạn mô tả màn hình 120Hz và hệ thống camera ba ống kính.',
            'Mở Thông số kỹ thuật của cùng sản phẩm để đối chiếu tần số quét 60Hz.',
            'Đối chiếu thông số camera với trang Apple chính thức được dẫn trong Nguồn Expected: model dùng hệ thống camera kép. Các tuyên bố sai trong cùng đoạn được gộp thành một defect.',
        ],
        '32': [
            'Mở đúng trang iPhone 17 Pro 256GB, kiểm tra tiêu đề không phải Pro Max.',
            'Bấm Thông số kỹ thuật, cuộn trong hộp thoại đến Pin & Sạc / Dung lượng pin.',
            'Quan sát thông số thời gian xem video đang hiển thị 37 giờ.',
            'Đối chiếu trang Apple VN cho iPhone 17 Pro: tối đa 31 giờ xem video. Không dùng thông số thị trường/model khác.',
        ],
        '37': [
            'Mở iPhone 17 256GB, chọn Đen và D.TradePlus, nhấn Thêm vào giỏ hàng.',
            'Vẫn trong cửa sổ đó, chọn Trắng và D.TradePlus rồi thêm vào giỏ. Mở /cart có hai dòng.',
            'Tại dòng Đen, mở chọn màu và đổi sang Trắng. Tải lại giỏ; lúc này có hai dòng cùng màu Trắng.',
            'Nếu dòng vừa đổi bị mất gói, bấm Chọn gói của dòng đó, chọn D.TradePlus và Xác nhận. Tải lại giỏ, kiểm tra cả hai dòng đều có một gói.',
            'Chọn cả hai dòng, ghi tổng giỏ 58.004.000đ tại thời điểm kiểm tra. Bấm MUA NGAY.',
            'Checkout gộp hai máy nhưng chỉ giữ một gói; tổng còn 56.892.000đ, thiếu 1.112.000đ so với giỏ. Không nhấn ĐẶT HÀNG.',
        ],
        '38': [
            'Mở trang S25 Ultra 256GB, cuộn đến Câu hỏi thường gặp.',
            'Mở câu Samsung Galaxy S25 Ultra 5G bảo mật bằng cách nào?',
            'Đọc câu trả lời có tuyên bố mở khóa bằng mống mắt.',
            'Đối chiếu nguồn Samsung: S25 Ultra có vân tay/khuôn mặt; Iris Scan chỉ có trên các model cũ được liệt kê. Đây là thông tin tính năng sai, không phải lỗ hổng đăng nhập website.',
        ],
        '45': [
            'Mở iPhone 17 256GB, chọn Đen, chọn D.TradePlus và nhấn Thêm vào giỏ hàng.',
            'Mở /cart. Kiểm tra một máy Đen và gói D.TradePlus đang được chọn; ghi tổng tiền.',
            'Bấm Đen trong dòng máy, chọn Trắng. Không thao tác xóa hoặc bỏ chọn dịch vụ.',
            'Chờ cập nhật: gói đã chọn biến mất, giỏ hiện Chọn gói; không có bước hỏi xác nhận xóa dịch vụ.',
            'Bấm Chọn gói của máy Trắng: D.TradePlus vẫn khả dụng. Chụp ảnh rồi đóng hộp thoại, không cần chọn lại để thấy lỗi.',
        ],
    }
    source_page = {'30': 'samsung', '19': 'samsung', '21': 'iphone17',
                   '26': 'samsung', '31': 'iphone16', '32': 'pro', '37': 'iphone17',
                   '38': 'samsung', '45': 'iphone17'}
    steps['46'] = [
        'Mở S25 Ultra 256GB, chọn Titan Đen và thêm 1 máy vào giỏ.',
        'Trở lại trang sản phẩm trong cùng cửa sổ, chọn Bạc và thêm 1 máy. Mở /cart có hai dòng.',
        'Tại dòng Titan Đen, bấm màu và đổi sang Bạc. F5 giỏ; quan sát hai dòng Bạc, mỗi dòng x1.',
        'Bỏ chọn checkbox của dòng đầu, giữ dòng thứ hai được chọn. Kiểm tra còn đúng một checkbox được chọn, tổng bằng giá một máy và nút MUA NGAY (1).',
        'Bấm MUA NGAY (1), chờ tải xong. Website quay về giỏ, cả hai dòng bị bỏ chọn và không có checkout để tiếp tục. Không cần DevTools hoặc script.',
    ]
    source_page['46'] = 'samsung'
    # A later fixture recheck replaces the old two-machine flash-sale scenario.
    # Keep both raw reports intact and identify exactly which runs were accepted.
    recheck_path = ROOT / 'test-results/asm09-giang-service-valid.json'
    fixture_report = read(recheck_path) if recheck_path.exists() else None
    if fixture_report and fixture_report['stats']['startTime'] <= report['stats']['startTime']:
        fixture_report = None
    entries = [(spec, test) for spec, test in walk(report)
               if not (fixture_report and 'ASM09_TV2_37 ' in spec['title'])]
    if fixture_report:
        entries.extend(walk(fixture_report))
    source_page['37'] = 'promax'
    steps['37'] = [
        'Mở iPhone 17 Pro Max 256GB, chọn Bạc và D.TradePlus rồi thêm vào giỏ.',
        'Tại giỏ tăng Bạc lên x2, chờ lưu xong để xác nhận hai máy thực sự mua được. Nếu bị giới hạn x1 thì ghi Blocked; không sử dụng lỗi vượt giới hạn làm tiền điều kiện. Giảm về x1 sau khi xác minh.',
        'Trở lại trang sản phẩm cùng cửa sổ, chọn Cam Vũ Trụ và D.TradePlus, thêm 1 máy. Mở giỏ có hai dòng.',
        'Đổi Cam Vũ Trụ sang Bạc. Tải lại giỏ; nếu gói ở dòng vừa đổi bị mất thì Chọn gói, chọn D.TradePlus, Xác nhận và tải lại. Kiểm tra hai dòng Bạc x1, mỗi dòng có một gói.',
        'Chọn cả hai dòng, ghi tổng giỏ và bấm MUA NGAY.',
        'Đối chiếu số gói và tổng tiền checkout với giỏ. Dừng trước ĐẶT HÀNG.',
    ]
    confirmation_stats = report['stats']
    sources = [{'path': str(RESULTS.relative_to(ROOT)).replace('\\', '/'),
                'acceptedCases': [f'ASM09_TV2_{n}' for n in steps if not (fixture_report and n == '37')],
                'rawStats': report['stats']}]
    if fixture_report:
        sources.append({'path': str(recheck_path.relative_to(ROOT)).replace('\\', '/'),
                        'acceptedCases': ['ASM09_TV2_37'], 'rawStats': fixture_report['stats']})
        confirmation_stats = {'reviewedRuns': 20, 'failedAtReviewedAssertions': 20, 'skipped': 0,
                              'note': '18 lượt cho 9 ca từ run chính + 2 lượt ca 37 dùng dữ liệu hợp lệ từ run kiểm chứng sau. Hai lượt ca 37 flash sale cũ không được dùng.',
                              'sources': sources}
    grouped = defaultdict(list)
    for spec, test in entries:
        number = re.search(r'ASM09_TV2_(\d+)', spec['title']).group(1)
        result = test['results'][-1]
        run = evidence(result)
        assert result['status'] == 'failed', (number, result['status'])
        assert run['classification'].startswith('CANDIDATE'), (number, run['classification'])
        assert not run['forbidden'], (number, 'transaction request')
        assert any('DEFECT CANDIDATE:' in e.get('message', '') for e in result.get('errors', []))
        if number == '37':
            proof = next(o['value'] for o in run['observations'] if o['label'] == 'Tiền điều kiện hai máy cùng SKU được UI chấp nhận')
            assert len(proof['server']) == 1 and proof['server'][0]['quantity'] == 2, 'Ca 37 cần bằng chứng mua hai máy hợp lệ, không vượt giới hạn flash sale.'
        grouped[number].append((test.get('repeatEachIndex', 0), result, run))
    assert len(defects) == 10 and set(grouped) == set(steps)
    for number, runs in grouped.items():
        assert len(runs) == 2, (number, len(runs))
        # Compare the actual failing invariant rather than the count of failed tests.
        checks = [[o for o in r[2]['observations'] if isinstance(o['value'], dict)
                   and set(o['value']) == {'actual', 'expected'}][-1] for r in runs]
        assert checks[0] == checks[1], (number, checks)

    removed = next((d for d in manifest['distinctDefects'] if d['number'] == '39'), None)
    if removed:
        removed['status'] = 'Excluded – không tái hiện bằng thao tác tay thông thường'
        removed['exclusionReason'] = 'Phụ thuộc script giữ request x2 và thả sau x3. Đã xóa ca 39 khỏi spec và không tính vào 10 defect nộp.'
        write(DEST / 'excluded-defects.json', [removed])
        old = DEST / 'evidence/DDV-GIANG-10'
        archive = DEST / 'history/excluded-DDV-GIANG-10'
        assert old.resolve().is_relative_to(DEST.resolve()) and archive.resolve().is_relative_to(DEST.resolve())
        if old.exists() and not archive.exists():
            archive.parent.mkdir(exist_ok=True)
            shutil.move(str(old), str(archive))
    removed_refresh = next((d for d in manifest['distinctDefects'] if d['number'] == '11'), None)
    if removed_refresh:
        removed_refresh['status'] = 'Excluded – thiếu căn cứ Expected và minh chứng lượt chạy mới không khớp báo cáo'
        removed_refresh['exclusionReason'] = 'Lượt chạy người dùng: assertion URL /checkout đã Passed rồi lỗi chờ locator; sau đó mới về /cart. Báo cáo cũ kết luận quá sớm và chưa có yêu cầu sản phẩm bảo đảm phục hồi checkout sau F5. Xóa ca 11 khỏi spec và danh sách nộp; thay bằng ca 46 có lựa chọn hợp lệ nhưng không mua được.'
        exclusions_path = DEST / 'excluded-defects.json'
        exclusions = read(exclusions_path) if exclusions_path.exists() else []
        exclusions = [d for d in exclusions if d['number'] != '11'] + [removed_refresh]
        write(exclusions_path, exclusions)
        old = DEST / 'evidence/DDV-GIANG-02'
        archive = DEST / 'history/excluded-DDV-GIANG-02'
        assert old.resolve().is_relative_to(DEST.resolve()) and archive.resolve().is_relative_to(DEST.resolve())
        if old.exists() and not archive.exists():
            archive.parent.mkdir(exist_ok=True)
            shutil.move(str(old), str(archive))

    manual = ['# ASM09 – Nguyễn Trường Giang (23130082): tái hiện bằng tay', '',
              'Ngày kiểm chứng: 13/11/2026 (Asia/Saigon). Mỗi lỗi được chạy lại hai lần bằng Playwright qua các thao tác UI tương ứng. Hướng dẫn dưới đây không cần chạy script, gửi API hoặc sửa dữ liệu.', '',
              'Chuẩn bị cho từng lỗi: mở cửa sổ ẩn danh mới, vào trang sản phẩm được dẫn, từ chối cookie nếu có. Các tab của cùng một lỗi phải nằm trong cùng cửa sổ. Đóng cửa sổ khi xong để tách giỏ guest. Dừng trước ĐẶT HÀNG. Giá/tồn kho có thể thay đổi; không đủ tiền điều kiện thì ghi Blocked.', '']
    matrix = []
    for defect in defects:
        number, ident = defect['number'], defect['id']
        defect['steps'] = steps[number]
        defect['url'] = URLS[source_page[number]]
        defect['caseId'] = f'ASM09_TV2_{number}'
        defect['reproducibility'] = 'Always trong điều kiện đã ghi (2/2 lần chạy UI độc lập)'
        defect['status'] = 'Open – Reproduced'
        defect['manualReproducible'] = True
        if number == '26':
            defect['group_note'] = 'Tab B đã lưu số lượng mới; tab A vào checkout vẫn dùng số lượng cũ. Có đối chiếu server và hai tab. Không dùng ca 11 đã loại làm căn cứ xác nhận.'
        if number == '30':
            defect['title'] = 'Đổi biến thể cho phép tổng số máy cùng SKU vượt giới hạn mua đang áp dụng'
            defect['description'] = 'Bạc bị khóa tăng tại x3, nhưng đổi dòng Titan Đen x1 sang Bạc vẫn lưu tổng Bạc x4 và tính tiền cả bốn máy. Báo lỗi vượt giới hạn mua vừa quan sát; không suy ra số tồn kho vật lý từ nút UI.'
            defect['group_note'] = 'Ca 05 sau sửa oracle đã bảo toàn số lượng/tiền, không phải defect. Chỉ ca 30 chứng minh vượt giới hạn mua mới tính một lỗi; không báo việc tách dòng cùng SKU tự nó là sai.'
        defect['verificationMethod'] = 'Playwright điều khiển UI thật; hướng dẫn tương đương để người dùng tự thao tác tay. API chỉ đọc/ghi log xác minh, không là bước bắt buộc.'
        folder = DEST / 'evidence' / ident
        folder.mkdir(exist_ok=True)
        runs = sorted(grouped[number], key=lambda x: x[0])
        for index, (_, result, run) in enumerate(runs):
            prefix = 'first' if index == 0 else 'recheck'
            write(folder / f'{prefix}.json', run)
            for att in result['attachments']:
                if att['contentType'] == 'image/png':
                    name = att['name'].replace('ASM09_', '')
                    if not name.endswith('.png'):
                        continue
                    out = name if index == 1 else f'first_{name}'
                    (folder / out).write_bytes(attachment_bytes(att))
                if index == 1 and att['name'] == 'video':
                    shutil.copyfile(att['path'], folder / Path(att['path']).name)
                if index == 1 and att['name'] == 'error-context':
                    shutil.copyfile(att['path'], folder / 'error-context.md')
        final = runs[1][1]
        defect['evidence'] = f'evidence/{ident}/'
        defect['fullLocalTrace'] = next(a['path'] for a in final['attachments'] if a['name'] == 'trace')
        context_path = Path(defect['fullLocalTrace']).parent / 'error-context.md'
        if context_path.is_file():
            shutil.copyfile(context_path, folder / 'error-context.md')
        defect['fullLocalVideo'] = [a['path'] for a in final['attachments'] if a['name'] == 'video']
        defect.pop('prior', None)
        defect['latestAssertion'] = [o for o in runs[1][2]['observations'] if isinstance(o['value'], dict)
                                     and set(o['value']) == {'actual', 'expected'}][-1]
        def vnd(value):
            return f'{int(value):,}'.replace(',', '.') + 'đ'
        if number == '21':
            check = defect['latestAssertion']['value']
            cart = next(o['value']['data'] for o in runs[1][2]['observations'] if o['label'] == 'GET giỏ guest (kiểm chứng server)')
            defect['data'] = f"iPhone 17 256GB/Đen: giá bán {vnd(cart[0]['price'])}, giá gốc {vnd(cart[0]['listedPrice'])}; gói D.TradePlus đang được chọn, chênh lệch ưu đãi {vnd(check['expected'] - check['actual'])}."
            defect['expected'] = f"Tiết kiệm phải gồm ưu đãi máy và dịch vụ: {vnd(check['expected'])} theo giá của lần kiểm chứng."
            defect['actual'] = f"Checkout chỉ hiển thị {vnd(check['actual'])}; thiếu {vnd(check['expected'] - check['actual'])} ưu đãi dịch vụ. Không khẳng định tổng thanh toán bị tính sai."
            defect['steps'][1] = 'Chọn D.TradePlus; ghi giá gốc và giá ưu đãi đang hiển thị. Dữ liệu giá có thể thay đổi theo khuyến mại.'
            defect['steps'][-1] = f"Cộng chênh lệch giá gốc/giá bán của máy và dịch vụ, đối chiếu Tiết kiệm. Lượt kiểm chứng: Expected {vnd(check['expected'])}, Actual {vnd(check['actual'])}."
        if number == '37':
            defect['preconditions'] = 'iPhone 17 Pro Max 256GB/Bạc mua được hai máy: phải tăng từ x1 lên x2 thành công qua UI, sau đó giảm lại x1. Cam Vũ Trụ còn mua được; D.TradePlus áp dụng cho cả hai màu. Giỏ cuối có hai dòng Bạc x1 và hai gói.'
            defect['description'] = 'Giỏ đã có đủ hai máy cùng SKU và hai gói D.TradePlus, trong giới hạn mua đã xác minh qua UI. Chuyển sang checkout chỉ giữ một gói và thay đổi tổng tiền. Không dùng dữ liệu iPhone 17 256GB đang bị giới hạn flash sale x1 để xác nhận lỗi này.'
            check = defect['latestAssertion']['value']
            before = next(o['value'] for o in runs[1][2]['observations'] if o['label'] == 'Giá và dịch vụ trước checkout')
            defect['expected'] = f"Bảo toàn cả hai gói và tổng tiền đã chọn tại giỏ: {vnd(check['expected'])}."
            defect['actual'] = f"Checkout chỉ giữ một gói, tổng {vnd(check['actual'])}; mất một gói và lệch {vnd(check['expected'] - check['actual'])} so với giỏ."
            defect['data'] = f"Hai dòng cùng SKU iPhone 17 Pro Max 256GB/Bạc, mỗi dòng x1 và một gói D.TradePlus. Giá máy trong lần kiểm chứng: {vnd(before['server'][0]['price'])}; tổng giỏ {vnd(check['expected'])}."
            defect['steps'][-2] = f"Chọn cả hai dòng, ghi tổng tiền giỏ (lượt kiểm chứng: {vnd(check['expected'])}). Bấm MUA NGAY."
            defect['steps'][-1] = f"Checkout gộp hai máy nhưng chỉ giữ một gói; tổng còn {vnd(check['actual'])}, thiếu {vnd(check['expected'] - check['actual'])}. Không nhấn ĐẶT HÀNG."
        chapter = [f"## {ident} – {defect['title']}", '', f"Chức năng: {defect['feature']} · {defect['severity']} · {defect['priority']}", '',
                   f"Trang: {defect['url']}", '', f"Tiền điều kiện: {defect['preconditions']}", '']
        chapter += [f'{i}. {step}' for i, step in enumerate(defect['steps'], 1)]
        chapter += ['', f"Expected: {defect['expected']}", '', f"Actual: {defect['actual']}", '',
                    f"Minh chứng: [ảnh sau thao tác]({defect['evidence']}after_tab1.png), [log lần 1]({defect['evidence']}first.json), [log lần 2]({defect['evidence']}recheck.json).", '']
        if defect.get('source'):
            chapter += [f"Nguồn Expected: {defect['source']}", '']
        manual += chapter
        (folder / 'README.md').write_text('\n'.join(chapter).replace(f'{defect["evidence"]}', ''), encoding='utf-8')
        matrix.append([ident, defect['caseId'], 'Lần 1: assertion lỗi', 'Lần 2: cùng assertion / actual',
                       defect['evidence'] + 'after_tab1.png', defect['evidence'] + 'recheck.json',
                       defect.get('source', 'Đối chiếu trạng thái/giá hiển thị giữa các bước UI'), defect.get('group_note', '')])

    dedup = [
        'Loại kết luận lỗi ca 05: hai dòng cùng SKU tự nó không sai nếu bảo toàn số lượng/tiền. Chỉ ca 30 chứng minh vượt giới hạn mua mới tính DDV-GIANG-01.',
        'Ca 31 gộp các tuyên bố sai trong cùng đoạn mô tả iPhone 16 Plus.',
        'Ca 11 / DDV-GIANG-02 bị loại: thiếu căn cứ Expected, lượt người dùng lỗi chờ locator và không xác nhận cùng assertion redirect. Đã xóa khỏi spec; thay bằng ca 46 không mua được lựa chọn hợp lệ.',
        'Ca 45: mất gói tại đổi màu với một dòng ở F05. Ca 37: đã chọn lại đủ hai gói, sau đó checkout F06 làm mất một gói khi gộp dòng. Chưa xác định nguyên nhân trong mã nguồn.',
        'Ca 37 đã bỏ dữ liệu iPhone 17 256GB bị giới hạn flash sale x1. Minh chứng hiện hành dùng Pro Max 256GB/Bạc và xác nhận tăng x2 thành công qua UI trước khi tạo hai dòng.',
        'Ca 39 bị loại hoàn toàn khỏi danh sách nộp vì phụ thuộc đảo request bằng script; giữ ID DDV-GIANG-11 cho lỗi thay thế để không tái sử dụng ID cũ.',
        'Loại kết luận lỗi ca 18: flash sale có thể cho hai màu cùng giá. Đã thay điều kiện giá mới > giá cũ bằng đối chiếu báo giá màu thực chọn.',
        'Ca 40 thiếu tiền điều kiện vì UI chặn thêm lại SKU flash sale. Ca 16/24/44 cũng không đủ số lượng để test; không tính defect. Ca 41/42/43 Passed. Ca 28 phục hồi online; ca 33 sửa locator rồi Passed.',
        'Đã rà phạm vi F04/F05/F06 và báo cáo chung local; cần nhóm đối chiếu thêm Google Sheets nếu có các bản chưa lưu trong repository.',
    ]
    manifest.update(date=DATE, count=10, features=dict(Counter(d['feature'] for d in defects)),
                    distinctDefects=defects, confirmationRun=str(RESULTS.relative_to(ROOT)).replace('\\', '/'),
                    confirmationStats=confirmation_stats, verificationSources=sources, deduplication=dedup,
                    manualGuide='MANUAL_REPRODUCTION.md')
    write(DEST / 'defect-list.json', manifest)
    (DEST / 'MANUAL_REPRODUCTION.md').write_text('\n'.join(manual), encoding='utf-8')

    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = 'Defect List'
    sheet.append(['Defect ID', 'Defect Title', 'Module / Function', 'Defect Description', 'Preconditions',
                  'Steps to Reproduce', 'Test Data / Input', 'Expected Result', 'Actual Result', 'Severity',
                  'Priority', 'Reproducibility', 'Evidence (Screenshot / Video / Log)', 'Reported By', 'Defect Status'])
    for d in defects:
        evidence_text = f"{d['caseId']} | {d['evidence']}\nẢnh nhúng trong sheet Screenshots.\nfirst.json / recheck.json / before.png / after_tab1.png / video.webm trong ZIP\nChi tiết thao tác: MANUAL_REPRODUCTION.md"
        if d['number'] == '45':
            evidence_text += '\nlost_service.png / service_still_available.png'
        if d['number'] == '46':
            evidence_text += '\nselected_one.png: một checkbox được chọn trước MUA NGAY'
        sheet.append([d['id'], d['title'], d['feature'], f"[{d['kind']}]\n{d['description']}",
                      f"{d['preconditions']}\nURL: {d['url']}",
                      '\n'.join(f'{i}. {s}' for i, s in enumerate(d['steps'], 1)), d['data'], d['expected'],
                      d['actual'], d['severity'], d['priority'], d['reproducibility'], evidence_text,
                      manifest['tester'], d['status']])
        sheet.cell(sheet.max_row, 13).hyperlink = d['evidence'] + 'README.md'
    style_sheet(sheet, [20, 48, 14, 65, 60, 100, 48, 65, 65, 12, 10, 30, 55, 32, 24])
    summary = workbook.create_sheet('Summary')
    summary.append(['Thông tin', 'Kết quả'])
    summary_rows = [
        ('Reported By', manifest['tester']), ('Ngày kiểm chứng', '13/11/2026 (Asia/Saigon)'),
        ('Số defect khác nhau', 10), ('F04 / F05 / F06', '3 / 3 / 4'),
        ('Tái hiện', '2/2 lần cho từng ca, qua UI thật bằng Playwright; có hướng dẫn thao tác tay, không yêu cầu chạy script.'),
        ('Kết quả 20 lượt kiểm chứng', '20 assertion nghiệp vụ thất bại; đã so cùng invariant/actual giữa hai lượt. Không đếm lỗi locator/setup thành defect.'),
        ('Môi trường', 'Windows; Chromium; viewport 1440x900; Playwright 1.64.1; 1 worker; retries=0; context guest riêng mỗi lượt.'),
        ('Ca bị loại', 'DDV-GIANG-02 / ca 11: thiếu căn cứ Expected và lỗi chờ trang. DDV-GIANG-10 / ca 39: cần script giữ và đảo request. Không nằm trong 10 defect.'),
        ('Đối chứng', 'Ca 05/18 sửa oracle sai và Passed; ca 40 UI chặn thêm SKU flash sale nên Blocked, không phải defect.'),
        ('Loại trùng', '\n'.join(dedup)),
        ('Hướng dẫn tay', 'MANUAL_REPRODUCTION.md: URL, tiền điều kiện, từng bước và Expected/Actual cho đủ 10 lỗi.'),
        ('Minh chứng', 'Ảnh trước/sau được nhúng trong sheet Screenshots để xem ngay trong Excel. Hai log, ảnh gốc và video lần chạy lại trong evidence/ của ZIP. Trace đầy đủ giữ local.'),
        ('Bảng chung', 'Có thể nhập sheet Defect List vào Google Sheets/Excel Online chung của nhóm; chưa cập nhật dịch vụ online trong lượt làm việc này.'),
    ]
    for row in summary_rows:
        summary.append(row)
    style_sheet(summary, [32, 140])
    summary.cell(12, 2).hyperlink = 'MANUAL_REPRODUCTION.md'
    matrix_sheet = workbook.create_sheet('Evidence Matrix')
    matrix_sheet.append(['Defect ID', 'Case ID', 'Lần 1', 'Lần 2', 'Screenshot', 'Log', 'Nguồn Expected', 'Loại trùng / phân biệt'])
    for row in matrix:
        matrix_sheet.append(row)
        matrix_sheet.cell(matrix_sheet.max_row, 5).hyperlink = row[4]
        matrix_sheet.cell(matrix_sheet.max_row, 6).hyperlink = row[5]
        if row[6].startswith('https://'):
            matrix_sheet.cell(matrix_sheet.max_row, 7).hyperlink = row[6]
    style_sheet(matrix_sheet, [20, 22, 28, 35, 65, 65, 70, 90])
    screenshots = workbook.create_sheet('Screenshots')
    screenshots.sheet_view.showGridLines = False
    for column in range(1, 19):
        screenshots.column_dimensions[openpyxl.utils.get_column_letter(column)].width = 10
    for index, d in enumerate(defects):
        row = index * 22 + 1
        screenshots.merge_cells(start_row=row, start_column=1, end_row=row, end_column=18)
        title = screenshots.cell(row, 1, f"{d['id']} | {d['caseId']} | {d['title']}")
        title.font = Font(name='Calibri', bold=True, size=12, color='FFFFFF')
        title.fill = PatternFill('solid', fgColor='17365D')
        title.alignment = Alignment(wrap_text=True, vertical='center')
        screenshots.row_dimensions[row].height = 36
        screenshots.cell(row + 1, 1, 'Trước thao tác / lựa chọn hợp lệ')
        screenshots.cell(row + 1, 10, 'Kết quả thực tế sau thao tác')
        folder = DEST / d['evidence']
        before_name = 'selected_one.png' if d['number'] == '46' else 'before.png'
        for column, filename in [('A', before_name), ('J', 'after_tab1.png')]:
            picture = Image(folder / filename)
            scale = min(600 / picture.width, 410 / picture.height)
            picture.width *= scale
            picture.height *= scale
            screenshots.add_image(picture, f'{column}{row + 2}')
        for line in range(row + 1, row + 22):
            screenshots.row_dimensions[line].height = 20
        screenshots.row_breaks.append(Break(id=row + 21))
    screenshots.sheet_properties.pageSetUpPr.fitToPage = True
    screenshots.page_setup.orientation = 'landscape'
    screenshots.page_setup.paperSize = screenshots.PAPERSIZE_A3
    screenshots.page_setup.fitToWidth = 1
    screenshots.page_setup.fitToHeight = 0
    screenshots.print_area = f'A1:R{len(defects) * 22}'
    workbook.save(DEST / BOOK)

    verification = dict(date=DATE, timezone='Asia/Saigon', confirmedDefectCount=10,
                        distinctGroups=[d['id'] for d in defects], caseIds=[d['caseId'] for d in defects],
                        confirmationStats=confirmation_stats, verificationSources=sources, rules=dedup, reproducedAtLeastTwice=True,
                        manualReproducible=True, verificationMethod='Playwright UI + manual reproduction guide',
                        excludedCaseIds=['ASM09_TV2_11', 'ASM09_TV2_39'], workbook=BOOK)
    verification['audit'] = {
        'userRun': {'total': 44, 'failed': 13, 'skipped': 3, 'passed': 28},
        'removedReportIds': ['DDV-GIANG-02', 'DDV-GIANG-10'],
        'correctedFalseAssertions': ['ASM09_TV2_05', 'ASM09_TV2_18'],
        'setupFailureReclassifiedBlocked': ['ASM09_TV2_40'],
        'newConfirmedCase': 'ASM09_TV2_46',
        'newExploratoryCasesWithoutDefect': ['ASM09_TV2_47', 'ASM09_TV2_48'],
        'details': 'AUDIT_ASM09.md',
    }
    write(DEST / 'verification.json', verification)
    readme = f"""# Assignment 9 – Nguyễn Trường Giang (23130082)

Đã xác minh **10 defect có thể tái hiện bằng thao tác tay** trên F04/F05/F06 (3/3/4), ngày 13/11/2026 (Asia/Saigon). Mỗi ca chạy hai lần qua UI bằng Playwright, context guest độc lập; cùng assertion và Actual ở cả hai lượt. Không đồng nhất mọi test Failed với defect.

- File nộp: [{BOOK}]({BOOK}) – đủ 15 cột, Severity, Priority, Always (2/2 trong điều kiện ghi rõ), Evidence, Reported By, Status; ảnh trước/sau nhúng trong sheet Screenshots.
- [Hướng dẫn thao tác tay cho cả 10 lỗi](MANUAL_REPRODUCTION.md): mở URL, thao tác từng bước, đối chiếu Expected/Actual. Không cần script/API/DevTools để gây lỗi.
- [Manifest](defect-list.json), [kiểm chứng](verification.json), thư mục `evidence/`: ảnh trước/sau, hai log thật và video của lần chạy lại. Trace lớn giữ ở local; đường dẫn trong manifest.
- Đã loại **DDV-GIANG-02 / ca 11** sau audit log người dùng: thiếu căn cứ Expected và lỗi chờ trang. Thay bằng **DDV-GIANG-12 / ca 46**: chọn một dòng hợp lệ nhưng không mua được khi có hai dòng cùng SKU.
- Đã bỏ **DDV-GIANG-10 / ca 39** vì cần script đảo request. Bằng chứng bị loại nằm trong `history/`, không đóng gói nộp. Không tái sử dụng ID cũ.
- Đã sửa ca 05 (không bắt buộc gộp dòng) và ca 18 (không giả định màu mới luôn đắt hơn). Ca 40 phải Blocked khi SKU flash sale đã có trong giỏ; ca 16/24/44 thiếu tiền điều kiện, ca 41/42/43 Passed. Không tính các ca này vào defect.
- Ca 37 hiện dùng iPhone 17 Pro Max 256GB/Bạc, có bước tăng x2 thành công để xác minh giới hạn mua. Đã thay bằng chứng hai máy của bản 256GB đang flash sale x1. Nguồn từng lượt kiểm chứng được ghi rõ trong `verification.json`.
- Xem [kết quả rà soát log bạn gửi](AUDIT_ASM09.md) để phân biệt lỗi website và lỗi test.

| ID | Ca | Chức năng | Hành vi |
|---|---|---|---|
"""
    readme += '\n'.join(f"| {d['id']} | {d['number']} | {d['feature']} | {d['title']} |" for d in defects)
    readme += """

Chạy lại từ thư mục `Automation Testing Project - Group08` (PowerShell):

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = "$PWD\\..\\test-results\\asm09-giang-manual-final.json"
$env:PLAYWRIGHT_HTML_OUTPUT_DIR = "$PWD\\..\\test-results\\asm09-giang-manual-final-report"
npx playwright test tests/23130082_NguyenTruongGiang/23130082_NguyenTruongGiang_ASM09.spec.ts --grep 'ASM09_TV2_(19|21|26|30|31|32|37|38|45|46)' --repeat-each=2 --workers=1 --reporter=line,json,html --output=../test-results/asm09-giang-manual-final
python scripts/export-asm09-giang.py
```

Assertion kiểm tra hành vi đúng nên website còn lỗi sẽ cho kết quả Failed. Export chỉ tạo báo cáo khi đủ hai lần cùng lỗi và không có request giao dịch. Không nhấn ĐẶT HÀNG, không gửi form thông tin khách hàng. API chỉ đọc để kiểm chứng giỏ guest hoặc ghi log những request UI thật phát sinh.

Giá/tồn kho production có thể đổi. Thiếu tiền điều kiện thì ghi Blocked và tìm lại dữ liệu; không sửa Expected để ép lỗi. Các tuyên bố sai cấu hình ảnh hưởng lựa chọn mua, không phải lỗi chính tả/hình thức nhỏ. Nguồn Apple/Samsung trong từng defect và Evidence Matrix. Chưa xác định nguyên nhân kỹ thuật khi không có mã nguồn.

Đã rà báo cáo local; nhóm cần đối chiếu thêm các bản trên Google Sheets chưa có trong repository. Workbook sẵn để nhập vào bảng chung; không có thao tác cập nhật online trong lượt này.
"""
    (DEST / 'README.md').write_text(readme, encoding='utf-8')
    package = DEST / '23130082_NguyenTruongGiang_ASM09_Evidence.zip'
    with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in [BOOK, 'README.md', 'MANUAL_REPRODUCTION.md', 'defect-list.json', 'verification.json', 'AUDIT_ASM09.md', 'excluded-defects.json']:
            archive.write(DEST / name, name)
        for d in defects:
            for file in (DEST / d['evidence']).iterdir():
                if file.is_file():
                    archive.write(file, file.relative_to(DEST))
        archive.write(SPEC, 'spec/' + SPEC.name)
        archive.write(Path(__file__), 'scripts/' + Path(__file__).name)
    with zipfile.ZipFile(package) as archive:
        assert archive.testzip() is None
        assert not any('DDV-GIANG-10' in name for name in archive.namelist())
        assert not any('DDV-GIANG-02' in name for name in archive.namelist())
    check = openpyxl.load_workbook(DEST / BOOK)
    assert check['Defect List'].max_row == 11
    assert check['Defect List'].max_column == 15
    assert len(check['Screenshots']._images) == 20
    assert len({check['Defect List'].cell(i, 1).value for i in range(2, 12)}) == 10
    for d in defects:
        for name in ['first.json', 'recheck.json', 'before.png', 'after_tab1.png', 'video.webm']:
            assert (DEST / d['evidence'] / name).is_file(), (d['id'], name)
    print(json.dumps({'defects': 10, 'verifiedRuns': 20, 'features': manifest['features'],
                      'workbook': str(DEST / BOOK), 'zipBytes': package.stat().st_size}, ensure_ascii=False))


if __name__ == '__main__':
    main()
