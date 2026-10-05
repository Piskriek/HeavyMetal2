/**
 * SetMix UI Layout Architect & Diagram Editor Server
 * Run with:
 *   npm run ui-editor
 * Or:
 *   node scripts/ui-editor.mjs
 *
 * Serves the interactive visual layout diagram at http://localhost:5195.
 * Saves edits directly to docs/UI_LAYOUT_SPEC.json and docs/UI_CHANGES.md.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const editorHtmlPath = join(root, 'tools', 'ui-editor', 'index.html');
const docsDir = join(root, 'docs');
const specPath = join(docsDir, 'UI_LAYOUT_SPEC.json');
const changesPath = join(docsDir, 'UI_CHANGES.md');

const port = Number(process.env.PORT ?? 5195);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  // Handle Save from UI
  if (req.method === 'POST' && url.pathname === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (!existsSync(docsDir)) {
          await mkdir(docsDir, { recursive: true });
        }

        // 1. Write the structured JSON spec
        await writeFile(specPath, JSON.stringify(payload, null, 2), 'utf-8');

        // 2. Write human- and agent-readable Markdown report
        const markdown = payload.markdownReport || '# UI Changes\n\nSpec updated.\n';
        await writeFile(changesPath, markdown, 'utf-8');

        console.log(`\n[UI Editor] ✓ Successfully saved updated interface layout:`);
        console.log(`  - Spec:    docs/UI_LAYOUT_SPEC.json`);
        console.log(`  - Changes: docs/UI_CHANGES.md`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, savedAt: new Date().toISOString() }));
      } catch (err) {
        console.error('[UI Editor] Failed to save spec:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(err) }));
      }
    });
    return;
  }

  // Handle GET /baseline or /spec
  if (req.method === 'GET' && url.pathname === '/baseline') {
    try {
      if (existsSync(specPath)) {
        const data = await readFile(specPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(data);
        return;
      }
    } catch {
      // Fallback
    }
    res.writeHead(404, { 'Content-Type': 'application/json' }).end(JSON.stringify({ found: false }));
    return;
  }

  // Serve the HTML Editor UI
  if (req.method === 'GET') {
    try {
      const content = await readFile(editorHtmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Error loading UI editor');
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  const url = `http://localhost:${port}`;
  console.log(`\n======================================================`);
  console.log(`  SetMix UI Layout Architect & Diagram Editor`);
  console.log(`  Running at: ${url}`);
  console.log(`  Edit the game interface visually, save, and Claude`);
  console.log(`  will read docs/UI_CHANGES.md to apply the code!`);
  console.log(`======================================================\n`);

  // Auto open browser on Windows
  if (process.platform === 'win32') {
    exec(`start ${url}`);
  } else if (process.platform === 'darwin') {
    exec(`open ${url}`);
  } else {
    exec(`xdg-open ${url}`);
  }
});
