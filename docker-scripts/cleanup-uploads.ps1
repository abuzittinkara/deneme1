# uploads-cleanup.ps1
# uploads klasöründeki 30 günden eski dosyaları siler
$uploadPath = "./uploads"
$days = 30
if (Test-Path $uploadPath) {
    Get-ChildItem -Path $uploadPath -File -Recurse | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$days) } | Remove-Item -Force
    Write-Host "Eski upload dosyaları temizlendi."
} else {
    Write-Host "uploads klasörü bulunamadı."
}
