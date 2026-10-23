@echo off
rem FIDELITY Command Center: Multi-Agent Job Board, Roadmap Tracker & GitHub Monitor.
rem Double-click this file to start the Command Center on http://localhost:8090 and open it in your browser.
cd /d "%~dp0"
echo Starting FIDELITY Multi-Agent Command Center on http://localhost:8090...
start "" "http://localhost:8090"
node scripts\command-center.mjs
pause
