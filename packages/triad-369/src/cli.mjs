#!/usr/bin/env node
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { getBridgeRoot } from './bridge_paths.mjs';
import { BridgeError, MAX_QUESTION_LENGTH, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS, sendBridgeRequest } from './query_bridge.mjs';

const HELP = `Triad CLI — query the local 3/6/9 seed

Usage:
  npm run triad -- status [--json]
  npm run triad -- ask "your question" [--json]
  npm run triad -- relay --json --stdin
  npm run triad -- chat
  npm run triad -- help

Options:
  --json             Print structured JSON instead of the short response.
  --stdin            Read one complete question from standard input.
  --timeout <ms>     Response timeout (${MIN_TIMEOUT_MS}–${MAX_TIMEOUT_MS} ms).
  --bridge-root <p>  Use a bridge directory other than the default.
  --                 Treat remaining arguments as question text.

Relay sends a message without adding its contents to the Triad query history.

The Apex process must be running: npm run triad:start
The seed uses keyword routing, not a connected conversational model.
`;

function parseArguments(argv) {
  const options = { json: false, stdin: false, timeout: null, bridgeRoot: null };
  const words = [];
  let literal = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!literal && arg === '--') { literal = true; continue; }
    if (!literal && (arg === '--help' || arg === '-h')) { options.help = true; continue; }
    if (!literal && arg === '--json') { options.json = true; continue; }
    if (!literal && arg === '--stdin') { options.stdin = true; continue; }
    if (!literal && (arg === '--timeout' || arg === '--bridge-root')) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new BridgeError('INVALID_ARGUMENT', `${arg} needs a value.`);
      if (arg === '--timeout') {
        if (!/^\d+$/.test(value)) throw new BridgeError('INVALID_ARGUMENT', '--timeout must be a whole number of milliseconds.');
        options.timeout = Number(value);
      } else {
        options.bridgeRoot = path.resolve(value);
      }
      continue;
    }
    if (!literal && arg.startsWith('--')) throw new BridgeError('INVALID_ARGUMENT', `Unknown option: ${arg}`);
    words.push(arg);
  }
  if (options.timeout !== null && (!Number.isInteger(options.timeout) || options.timeout < MIN_TIMEOUT_MS || options.timeout > MAX_TIMEOUT_MS)) {
    throw new BridgeError('INVALID_TIMEOUT', `Timeout must be ${MIN_TIMEOUT_MS}–${MAX_TIMEOUT_MS} milliseconds.`);
  }
  if (options.help) return { command: 'help', options, words: [] };
  const first = words[0];
  if (!first) return { command: 'chat', options, words: [] };
  if (['help', 'status', 'ask', 'relay', 'chat'].includes(first)) return { command: first, options, words: words.slice(1) };
  return { command: 'ask', options, words };
}

function printResult(output, result, json) {
  output.write(json ? `${JSON.stringify(result, null, 2)}\n` : `${result.answer}\n`);
}

function printStatus(output, status, json) {
  if (json) {
    output.write(`${JSON.stringify(status, null, 2)}\n`);
    return;
  }
  output.write(`Triad query bridge: running (PID ${status.pid})\nBridge root: ${status.bridge_root}\nQuery mode: ${status.query_mode}\n`);
}

async function readQuestionFromStdin(input) {
  if (typeof input.setEncoding === 'function') input.setEncoding('utf8');
  let text = '';
  for await (const chunk of input) {
    text += chunk.toString();
    if (text.length > MAX_QUESTION_LENGTH) {
      throw new BridgeError('INVALID_REQUEST', `Question must be 1–${MAX_QUESTION_LENGTH} characters.`);
    }
  }
  return text;
}

async function interactive({ input, output, errorOutput, bridgeRoot, timeoutMs, sender, json }) {
  const terminal = Boolean(input.isTTY && output.isTTY);
  const rl = readline.createInterface({ input, output: terminal ? output : undefined, terminal });
  if (terminal && !json) output.write('Triad CLI. Type a question, /status, /help, or /quit.\n');
  const prompt = () => { if (terminal && !json) { rl.setPrompt('triad> '); rl.prompt(); } };
  prompt();
  for await (const line of rl) {
    const text = line.trim();
    if (!text) { prompt(); continue; }
    if (text === '/quit' || text === '/exit') break;
    if (text === '/help') {
      output.write('Enter a question, /status to check the bridge, or /quit to exit.\n');
      prompt();
      continue;
    }
    try {
      if (text === '/status') {
        const status = await sendBridgeRequest({ bridgeRoot, type: 'ping', timeoutMs: Math.min(timeoutMs, 2000) });
        printStatus(output, status, json);
      } else {
        const result = await sendBridgeRequest({ bridgeRoot, question: text, from: sender, timeoutMs });
        printResult(output, result, json);
      }
    } catch (error) {
      errorOutput.write(`Triad: ${error.message}\n`);
    }
    prompt();
  }
  rl.close();
  return 0;
}

export async function runCli(argv, { input = process.stdin, output = process.stdout, errorOutput = process.stderr } = {}) {
  try {
    const { command, options, words } = parseArguments(argv);
    if (command === 'help') { output.write(HELP); return 0; }
    if ((command === 'status' || command === 'chat') && words.length) {
      throw new BridgeError('INVALID_ARGUMENT', `${command} does not accept a question.`);
    }
    if (options.stdin && !['ask', 'relay'].includes(command)) {
      throw new BridgeError('INVALID_ARGUMENT', '--stdin is only available with ask or relay.');
    }
    if (options.stdin && words.length) {
      throw new BridgeError('INVALID_ARGUMENT', 'Use either --stdin or question arguments, not both.');
    }
    const bridgeRoot = options.bridgeRoot || getBridgeRoot();
    const sender = process.env.TRIAD_SENDER || process.env.USER || 'local-cli';
    if (command === 'status') {
      const status = await sendBridgeRequest({ bridgeRoot, type: 'ping', timeoutMs: options.timeout ?? 2000 });
      printStatus(output, status, options.json);
      return 0;
    }
    if (command === 'chat') {
      return await interactive({ input, output, errorOutput, bridgeRoot, timeoutMs: options.timeout ?? 15000, sender, json: options.json });
    }
    const joined = words.join(' ');
    const question = options.stdin ? await readQuestionFromStdin(input) : (command === 'relay' ? joined : joined.trim());
    if (!question.trim()) throw new BridgeError('INVALID_ARGUMENT', `Provide a question after ${command}.`);
    const result = await sendBridgeRequest({ bridgeRoot, question, from: sender, record: command !== 'relay', timeoutMs: options.timeout ?? 15000 });
    printResult(output, result, options.json);
    return 0;
  } catch (error) {
    errorOutput.write(`Triad: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runCli(process.argv.slice(2));
}
