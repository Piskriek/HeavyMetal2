@echo off
rem FIDELITY: build the game and play it in your browser.
rem Double-click this file. The game is served on http://localhost:8080 (the narration, music and HD models need a
rem server: a browser opening index.html straight from disk blocks them). Close this window to stop the game.
cd /d "%~dp0"
rem the music, voice and HD models come through Git LFS; a clone without it gets pointers and plays silent
node scripts\check-lfs.mjs
if errorlevel 1 (
  echo.
  echo Run the two git lfs commands above in this folder, then start PLAY.bat again.
  pause
  exit /b 1
)
echo Building FIDELITY (about a minute)...
call npm run build
if errorlevel 1 (
  echo.
  echo The build failed. Tell Claude what this window says.
  pause
  exit /b 1
)
start "" "http://localhost:8080"
node scripts\serve.mjs
pause
