@echo off
title SEO Pro Indexer Bot v2.0
chcp 65001 > nul
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║         🚀 UserReview.net SEO Pro Indexer Bot v2.0          ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  📊 Loglar:   tools/tools/logs/indexed_urls.log             ║
echo ║  📈 CSV:      tools/tools/logs/indexed_urls.csv             ║
echo ║  📉 Stats:    tools/tools/logs/daily_stats.json             ║
echo ║                                                              ║
echo ║  ✅ IndexNow API (Bing/Yandex) Aktif                        ║
echo ║  ✅ Google SEO Tools Aktif                                  ║
echo ║  ✅ Detaylı Dosya Loglama Aktif                             ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

python tools/tools/continuous_indexer_bot_pro.py

echo.
echo ══════════════════════════════════════════════════════════════
echo İşlem tamamlandı. Logları kontrol etmek için:
echo   - Metin Log: tools\tools\logs\indexed_urls.log
echo   - CSV Export: tools\tools\logs\indexed_urls.csv
echo ══════════════════════════════════════════════════════════════
pause
