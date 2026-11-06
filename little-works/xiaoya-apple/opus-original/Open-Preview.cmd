@echo off
rem 小芽 · 铅笔与墨水 (Opus Original) — double-click to preview locally. Close this window to stop.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo 需要先安装 Node.js：https://nodejs.org/ & pause & exit /b 1)
node preview-server.mjs %*
pause
