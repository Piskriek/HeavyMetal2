// arena_relay.mjs - Playwright Sidecar Bridge to Arena Agent
// Connects to: https://arena.ai/agent/01a19f7f-179b-73bd-8e8c-b9e94852f658
// Sends prompt via window.__arenaSend, extracts response, loops back to Tetrahedral Holon.

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const AGENT_ID = '01a19f7f-179b-73bd-8e8c-b9e94852f658';
const AGENT_URL = `https://arena.ai/agent/${AGENT_ID}`;
const SEND_SCRIPT_FILE = path.join(HERE, 'arena-send.page.js');
const BRIDGE_API = 'http://127.0.0.1:5196/api/tetra/arena_recv';

const chromePaths = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'
];
const chromePath = chromePaths.find(fs.existsSync);

async function runRelay() {
  const query = process.argv.slice(2).join(' ').trim() || 'Ping from Tetrahedral Holon (Laptop + Sol + Apex)';
  console.log(`[ARENA RELAY] Initiating bridge to ${AGENT_URL}`);
  console.log(`[ARENA RELAY] Prompt: "${query}"`);

  if (!chromePath) {
    console.warn('[ARENA RELAY] Chrome executable not found. Operating via Seed State Bus fallback.');
    return;
  }

  const profileDir = path.join(ROOT, '.arena_browser_profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  let context = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      executablePath: chromePath,
      headless: true,
      viewport: { width: 1280, height: 800 },
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });

    const page = context.pages()[0] || await context.newPage();
    console.log(`[ARENA RELAY] Navigating to ${AGENT_URL}...`);
    await page.goto(AGENT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Inject arena-send helper
    if (fs.existsSync(SEND_SCRIPT_FILE)) {
      const sendScript = fs.readFileSync(SEND_SCRIPT_FILE, 'utf8');
      await page.evaluate(sendScript);
    }

    console.log(`[ARENA RELAY] Dispatching prompt to agent...`);
    const sendResult = await page.evaluate(async (text) => {
      if (typeof window.__arenaSend === 'function') {
        return await window.__arenaSend(text);
      }
      return { ok: false, why: '__arenaSend not defined' };
    }, query);

    console.log(`[ARENA RELAY] Dispatch result:`, sendResult);

    if (sendResult?.ok) {
      console.log(`[ARENA RELAY] Waiting for agent generation...`);
      await page.waitForTimeout(10000);

      // Extract last response
      const latestText = await page.evaluate(() => {
        const bubbles = [...document.querySelectorAll('.prose, [data-message-author-role="assistant"]')];
        if (bubbles.length > 0) return bubbles[bubbles.length - 1].innerText;
        return document.body.innerText.slice(-2000);
      });

      console.log(`\n=== EXTRACTED ARENA AGENT RESPONSE ===\n${latestText}\n======================================\n`);

      // Post back to local tetrahedral bridge
      try {
        await fetch(BRIDGE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `Arena Agent (${AGENT_ID})`,
            query,
            response: latestText,
            timestamp: new Date().toISOString()
          })
        });
        console.log(`[ARENA RELAY] Response successfully posted to local Tetrahedral Bridge.`);
      } catch (err) {
        console.warn(`[ARENA RELAY] Could not post to Bridge API: ${err.message}`);
      }
    }
  } catch (err) {
    console.error(`[ARENA RELAY ERROR] ${err.message}`);
  } finally {
    if (context) await context.close();
  }
}

runRelay().catch(console.error);

