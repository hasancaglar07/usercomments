@echo off
title Otomatik Indeksleme Gorevi Kurulumu
echo ---------------------------------------------------
echo UserReview.net Otomatik Indeksleme Botu
echo Windows Gorev Zamanlayicisi'na Ekleniyor...
echo ---------------------------------------------------
echo.

set TASK_NAME=UserReviewIndexerDaily
set SCRIPT_PATH=%~dp0run_indexer.bat

echo script yolu: %SCRIPT_PATH%

echo.
echo Mevcut bir gorev varsa siliniyor...
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1

echo.
echo Yeni gunluk gorev olusturuluyor (Her gun 03:00'te)...
schtasks /Create /SC DAILY /TN "%TASK_NAME%" /TR "\"%SCRIPT_PATH%\"" /ST 03:00 /F

echo.
if %errorlevel% equ 0 (
    echo [BASARILI] Gorev basariyla eklendi!
    echo Bilgisayariniz acik oldugu surece her gece 03:00'te bot calisacak.
) else (
    echo [HATA] Gorev eklenirken bir sorun olustu. Yonetici olarak calistirmayi deneyin.
)

echo.
echo Cikmak icin bir tusa basin...
pause
