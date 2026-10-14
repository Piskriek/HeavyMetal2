// ============================================================================
// File: scripts/apply-argo-drop.mjs
// Purpose: One-command extractor that parses any Markdown transcript containing
//          "// File: <path>" blocks and writes them directly into the repo.
// Usage:
//   node scripts/apply-argo-drop.mjs <path-to-chat-export.md> --dry-run
//   node scripts/apply-argo-drop.mjs <path-to-chat-export.md> --apply
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

export function extractFilesFromMarkdown(markdownText) {
  const extracted = [];
  const lines = markdownText.split(/\r?\n/);
  let inFence = false;
  let currentBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (!inFence) {
        inFence = true;
        currentBuffer = [];
      } else {
        inFence = false;
        const blockText = currentBuffer.join('\n');
        const match = blockText.match(/^\s*(?:\/\/|#)\s*File:\s*([^\r\n]+)/m);
        if (match && match[1]) {
          const targetRelPath = match[1].trim();
          extracted.push({
            targetRelPath,
            content: blockText + '\n',
            lineCount: currentBuffer.length,
          });
        }
      }
    } else if (inFence) {
      currentBuffer.push(line);
    }
  }

  return extracted;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith('--'));
  const applyWrite = args.includes('--apply');

  if (!inputPath || !fs.existsSync(inputPath)) {
    console.log(
      'Usage: node scripts/apply-argo-drop.mjs <chat-export.md> [--dry-run | --apply]'
    );
    process.exit(0);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const files = extractFilesFromMarkdown(raw);
  console.log(
    `[apply-argo-drop] Found ${files.length} drop-in source files in ${inputPath} (mode: ${
      applyWrite ? 'APPLY' : 'DRY-RUN'
    }):`
  );

  for (const file of files) {
    const absPath = path.resolve(file.targetRelPath);
    console.log(`  -> ${file.targetRelPath} (${file.lineCount} lines)`);
    if (applyWrite) {
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, file.content, 'utf8');
    }
  }
}
