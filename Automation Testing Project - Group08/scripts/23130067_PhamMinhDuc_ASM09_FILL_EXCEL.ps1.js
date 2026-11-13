param(
    [string]$ProjectRoot = "E:\Group08-Software-Test",
    [string]$ExcelFile = "$HOME\Downloads\23130067_PhamMinhDuc_ASM09_Defect_Log.xlsx"
)
$ErrorActionPreference = "Stop"
$root = Join-Path $ProjectRoot "Test Report - Group08\23130067_PhamMinhDuc_ASM09\HUNT10_REAL\runs"
if (-not (Test-Path -LiteralPath $root)) { throw "Hay chay HUNT10 truoc." }
$run = Get-ChildItem -LiteralPath $root -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $run) { throw "Khong tim thay report." }
if (-not (Test-Path -LiteralPath $ExcelFile)) { throw "Khong tim thay file Excel: $ExcelFile. Truyen -ExcelFile duong dan dung." }


$excel = $null
$book = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $book = $excel.Workbooks.Open($ExcelFile)
    $sheet = $book.Worksheets.Item("23130067_PhamMinhDuc")
    for ($n = 1; $n -le 10; $n++) {
        $id = "DDV-DUC-{0:D2}" -f $n
        $row = 4 + $n
        if ([string]$sheet.Cells.Item($row, 1).Text -ne $id) {
            throw "Khong khop Defect ID o row $row"
        }
        $jsonFiles = @(Get-ChildItem -LiteralPath $run.FullName -File -Filter "$($id)_try*.json" | Sort-Object Name)
        $results = @(
            foreach ($j in $jsonFiles) {
            $data = Get-Content -LiteralPath $j.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
                [PSCustomObject]@{ data = $data; file = $j.FullName }
        }
    )
        $total = $results.Count
        $candidates = @($results | Where-Object { $_.data.status -eq "DEFECT_CANDIDATE" })
        $passed = @($results | Where-Object { $_.data.status -eq "PASS" })
        $unknown = $total - $candidates.Count - $passed.Count
        $repro = "Nghi van $($candidates.Count)/$total lan; PASS $($passed.Count); khong ket luan $unknown"
        $proofs = @(
            foreach ($r in $results) {
            "Try $($r.data.tryNumber): JSON=$($r.file); PNG=$($r.data.screenshot); video/trace=$($r.data.playwrightOutput)"
        }
    )
        $evidence = $proofs -join [Environment]::NewLine
        if ($candidates.Count -gt 0) {
            $actual = "Ghi nhan tin hieu: $($candidates[0].data.reason). Can doi chieu screenshot/video voi Expected Result."
            $status = "Candidate - Review"
        }
        elseif ($unknown -eq 0 -and $total -ge 3) {
            $actual = "Khong tai hien duoc sai lech trong $total lan chay."
            $status = "Not Reproduced"
        }
    else {
            $actual = "Chua du co so ket luan. Xem log de xac dinh selector, du lieu hoac loi moi truong."
            $status = "Inconclusive"
        }
        $sheet.Cells.Item($row, 9).Value2 = $actual
        $sheet.Cells.Item($row, 12).Value2 = $repro
        $sheet.Cells.Item($row, 13).Value2 = $evidence
        $sheet.Cells.Item($row, 15).Value2 = $status
        Write-Host "$id => $status ; $repro"
    }
    $out = Join-Path $run.FullName "23130067_PhamMinhDuc_Defect_Log_WITH_EVIDENCE.xlsx"
    $book.SaveAs($out, 51)
    Write-Host "Da tao Excel: $out" -ForegroundColor Green
}
finally {
    if ($book -ne $null) { $book.Close($false) | Out-Null }
    if ($excel -ne $null) { $excel.Quit() }
}