@echo off
title Tam Dengeli Index Botu
echo ---------------------------------------------------
echo UserReview.net Tam Dengeli Index Botu Baslatiliyor...
echo ---------------------------------------------------
echo.

cd /d "%~dp0"

echo Python scripti calistiriliyor...
python tools/tools/continuous_indexer_bot_balanced.py

echo.
echo ---------------------------------------------------
echo Islem tamamlandi.
echo Pencereyi kapatmak icin bir tusa basin.
pause
