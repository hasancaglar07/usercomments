@echo off
cd /d "%~dp0"
set PYTHONPATH=%PYTHONPATH%;%~dp0tools\tools\ingestor
call c:\Users\ihsan\anaconda3\Scripts\activate.bat c:\Users\ihsan\anaconda3
python -m ingestor.main_async
pause
