@echo off
rem FIDELITY with the AI companion beside you. Double-click this file.
rem It starts everything (the Neural Bridge, the companion's brain, FIDELITY, and Capital Empire if it is in c:\CapitalEmpire),
rem opens the browser, and tells you what to do next. Close this window to stop everything.
rem For a real AI brain, put ANTHROPIC_API_KEY=... or GEMINI_API_KEY=... in a file named .env.local in this folder.
cd /d "%~dp0"
node scripts\launch.mjs %*
if errorlevel 1 (
  echo.
  echo Something did not start. Tell Claude what this window says.
)
pause

