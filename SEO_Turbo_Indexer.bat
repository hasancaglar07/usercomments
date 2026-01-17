@echo off
chcp 65001 >nul 2>&1
title 🚀 SEO MEGA Indexer Bot v4.0 - 500+ Kaynak

echo.
echo ╔═══════════════════════════════════════════════════════════════════════════════╗
echo ║               🚀 SEO MEGA INDEXER BOT v4.0 - 500+ KAYNAK                       ║
echo ╠═══════════════════════════════════════════════════════════════════════════════╣
echo ║  📊 MEGA MODE:  500+ SEO Kaynak ile Maksimum Indexleme                         ║
echo ║  ⚡ LIGHT:      220+ kaynak (AI, international, social, Google, news)         ║
echo ║  🔨 HEAVY:      190+ kaynak (Web 2.0, directories, video, podcast)            ║
echo ║  📡 PING:       65+ XML-RPC Ping Servisi                                       ║
echo ║  🤖 AI:         25+ AI Arama Motoru (ChatGPT, Claude, Gemini, Copilot)        ║
echo ║  🌍 GEO:        35+ Uluslararası Arama (Baidu, Yandex, Naver, Sogou)          ║
echo ╚═══════════════════════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0tools\tools"

if not exist "seo_mega_sources.py" (
    echo ❌ HATA: seo_mega_sources.py bulunamadı!
    echo    Bu dosya 500+ kaynak içerir ve gereklidir.
    pause
    exit /b 1
)

python continuous_indexer_bot_turbo.py

if errorlevel 1 (
    echo.
    echo ❌ Bot başlatılamadı. Python kurulu mu?
    echo    pip install requests
    pause
)

pause
