@echo off
chcp 65001 >nul
color 0b
title Urun Birlestirme ve Toparlama Araci
cls

:menu
cls
echo ==========================================================
echo    URUN BIRLESTIRME VE MUKERRER KAYIT TEMIZLEME ARACI
echo ==========================================================
echo.
echo  Bu arac veritabanindaki ayni isimli urunleri tespit eder.
echo  Sectiginiz moda gore yorumlari, resimleri ve verileri
echo  kaybetmeden bunlari tek bir "Ana Urun"de birlestirir.
echo.
echo  ----------------------------------------------------------
echo  [1] ANALIZ ET (Risk Yok)
echo      - Sadece hangi urunlerin cift oldugunu listeler.
echo      - Veritabaninda hicbir degisiklik yapmaz.
echo.
echo  [2] MANUEL BIRLESTIR (Onerilen)
echo      - Her grup icin hangisinin ana urun olacagini size sorar.
echo      - Kontrollu bir sekilde birlestirme yapar.
echo.
echo  [3] OTOMATIK BIRLESTIR (Hizli)
echo      - En eski ve en cok yorumu olani otomatik secip birlestirir.
echo      - Toplu temizlik icin uygundur.
echo.
echo  [X] CIKIS
echo  ----------------------------------------------------------
echo.

set /p secim="Lutfen bir islem secin [1,2,3,X]: "

if /i "%secim%"=="1" goto analiz
if /i "%secim%"=="2" goto manuel
if /i "%secim%"=="3" goto otomatik
if /i "%secim%"=="x" goto exit
goto menu

:analiz
cls
echo [BILGI] Analiz modu calistiriliyor... Veritabani taranıyor...
echo ----------------------------------------------------------------
python tools/tools/merge_duplicates.py
echo.
echo ----------------------------------------------------------------
echo Analiz tamamlandi. Veritabaninda degisiklik yapilmadi.
pause
goto menu

:manuel
cls
echo [BILGI] Manuel birlestirme modu baslatiliyor...
echo ----------------------------------------------------------------
python tools/tools/merge_duplicates.py --run
echo.
echo ----------------------------------------------------------------
echo Islem tamamlandi.
pause
goto menu

:otomatik
cls
color 0c
echo ==============================================================
echo [DIKKAT] OTOMATIK BIRLESTIRME MODU
echo ==============================================================
echo Bu islem, kopya urunleri otomatik algoritmaya gore birlestirir.
echo Geri alinamayabilir. Devam etmek istiyor musunuz?
echo.
pause
color 0b
echo Islem baslatiliyor...
python tools/tools/merge_duplicates.py --run --auto
echo.
echo Islem tamamlandi.
pause
goto menu

:exit
exit
