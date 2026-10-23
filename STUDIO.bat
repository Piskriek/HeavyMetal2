@echo off
rem FIDELITY Studio: the editor for the game's assets. Double-click this file.
rem It runs the development server on http://localhost:5173 and opens the Studio there (plus the Command Center on :8090).
rem Saved changes are written into the project (apps/web/src/studio-data), and the game takes them in at once.
rem Only this dev server can save: the built game (PLAY.bat) opens the Studio read-only. Close this window to stop the server.
cd /d "%~dp0"
start /b "" node scripts\command-center.mjs
echo Starting the FIDELITY Studio on http://localhost:5173 (and Command Center on http://localhost:8090)...
call npm run dev -w @hm/web -- --port 5173 --strictPort --open "/?studio"
if errorlevel 1 (
  echo.
  echo The Studio did not start. Tell Claude what this window says.
  pause
  exit /b 1
)
pause
