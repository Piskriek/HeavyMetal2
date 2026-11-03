#!/usr/bin/env node
// wow_adapter.mjs - World of Warcraft SavedVariables Bridge & Telemetry Normalizer
// Parses WoW SavedVariables files (WTF/Account/<ACCOUNT>/SavedVariables/FidelityWoW.lua)
// and connects live client exports to the Syntropic Invariant Verifier (SIV) audit engine.
//
// Key Capabilities:
// 1. Robust Lua table tokenizer & parser for SavedVariables.
// 2. Strict opt-in verification: rejects unconsented telemetry.
// 3. Trajectory normalization: cleanly separates coordinate samples ({t, x, y, speed})
//    from discrete movement-state events ({t, state, speed}).
// 4. Feeds normalized session into auditWoWSession() with full 7-density verification.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWoWSession } from './wow_anticheat.mjs';

/**
 * Tokenizes WoW Lua SavedVariables syntax into stream of tokens.
 * @param {string} code Lua code string
 * @returns {Array<string|{type: string, value: any}>}
 */
export function tokenizeLua(code) {
  const tokens = [];
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ch = code[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Line comments: -- ...
    if (ch === '-' && code[i + 1] === '-') {
      i += 2;
      while (i < n && code[i] !== '\n' && code[i] !== '\r') i++;
      continue;
    }

    // Structural punctuation
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === '=' || ch === ',' || ch === ';') {
      tokens.push(ch);
      i++;
      continue;
    }

    // String literals: "..." or '...'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = '';
      i++;
      while (i < n && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < n) {
          i++;
          const next = code[i];
          if (next === 'n') str += '\n';
          else if (next === 't') str += '\t';
          else if (next === 'r') str += '\r';
          else str += next;
        } else {
          str += code[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Number literals: floats, integers, exponents, negative numbers
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(code[i + 1] || ''))) {
      let numStr = '';
      if (ch === '-') {
        numStr += '-';
        i++;
      }
      while (i < n && /[0-9.eE+-]/.test(code[i])) {
        numStr += code[i];
        i++;
      }
      tokens.push({ type: 'number', value: Number(numStr) });
      continue;
    }

    // Identifiers and keywords (true, false, nil, variable names)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < n && /[a-zA-Z0-9_]/.test(code[i])) {
        ident += code[i];
        i++;
      }
      if (ident === 'true') tokens.push({ type: 'boolean', value: true });
      else if (ident === 'false') tokens.push({ type: 'boolean', value: false });
      else if (ident === 'nil') tokens.push({ type: 'nil', value: null });
      else tokens.push({ type: 'ident', value: ident });
      continue;
    }

    i++;
  }
  return tokens;
}

/**
 * Parses token stream into JavaScript objects representing Lua global variables.
 * @param {Array<string|{type: string, value: any}>} tokens
 * @returns {Record<string, any>}
 */
export function parseLuaTokens(tokens) {
  let pos = 0;

  function parseTable() {
    if (tokens[pos] !== '{') throw new Error(`Expected '{' at token index ${pos}`);
    pos++;

    const obj = {};
    const arr = [];
    let isArrayOnly = true;

    while (pos < tokens.length && tokens[pos] !== '}') {
      if (tokens[pos] === '[') {
        pos++; // skip '['
        const keyToken = tokens[pos];
        const key = typeof keyToken === 'object' ? keyToken.value : keyToken;
        pos++;
        if (tokens[pos] !== ']') throw new Error(`Expected ']' at token index ${pos}`);
        pos++;
        if (tokens[pos] !== '=') throw new Error(`Expected '=' at token index ${pos}`);
        pos++;
        const val = parseValue();
        obj[key] = val;
        isArrayOnly = false;
      } else if (typeof tokens[pos] === 'object' && tokens[pos].type === 'ident' && tokens[pos + 1] === '=') {
        const key = tokens[pos].value;
        pos += 2; // skip ident and '='
        const val = parseValue();
        obj[key] = val;
        isArrayOnly = false;
      } else {
        const val = parseValue();
        arr.push(val);
      }

      if (tokens[pos] === ',' || tokens[pos] === ';') {
        pos++;
      }
    }

    if (tokens[pos] === '}') pos++;

    if (isArrayOnly && arr.length > 0) return arr;
    if (arr.length > 0) {
      arr.forEach((v, idx) => { obj[idx + 1] = v; });
      return obj;
    }
    return obj;
  }

  function parseValue() {
    const tok = tokens[pos];
    if (tok === '{') {
      return parseTable();
    }
    pos++;
    if (typeof tok === 'object') {
      return tok.value;
    }
    return tok;
  }

  const result = {};
  while (pos < tokens.length) {
    if (typeof tokens[pos] === 'object' && tokens[pos].type === 'ident') {
      const varName = tokens[pos].value;
      pos++;
      if (tokens[pos] === '=') {
        pos++;
        result[varName] = parseValue();
      }
    } else {
      pos++;
    }
  }
  return result;
}

/**
 * Parses Lua source code directly into JS object.
 * @param {string} luaSource
 * @returns {Record<string, any>}
 */
export function parseLuaSource(luaSource) {
  const tokens = tokenizeLua(luaSource);
  return parseLuaTokens(tokens);
}

/**
 * Normalizes parsed SavedVariables data into clean SIV engine input.
 * Resolves trajectories/trajectory alias and separates movement events from coordinate samples.
 * @param {object} parsed
 * @returns {object}
 */
export function normalizeSavedVariables(parsed) {
  const exportData = parsed.FidelityWoW_Export || {};
  const config = parsed.FidelityWoW_Config || {};
  const telemetry = parsed.FidelityWoW_Telemetry || {};

  const isOptedIn = config.optIn === true;

  // Accept both 'trajectory' (singular) and 'trajectories' (plural)
  const rawTrajectory = exportData.trajectory || exportData.trajectories || [];

  const cleanTrajectory = [];
  const movementEvents = [];

  for (const item of rawTrajectory) {
    if (!item) continue;
    // Check if this item is a coordinate sample
    if (typeof item.x === 'number' && Number.isFinite(item.x) &&
        typeof item.y === 'number' && Number.isFinite(item.y)) {
      cleanTrajectory.push({
        t: item.t,
        x: item.x,
        y: item.y,
        z: item.z ?? 0,
        speed: item.speed ?? 0,
        mapID: item.mapID
      });
    } else if (item.state) {
      // Movement state change event (e.g. START/STOP)
      movementEvents.push({
        t: item.t,
        state: item.state,
        speed: item.speed ?? 0
      });
    }
  }

  const cleanInterrupts = (exportData.interrupts || []).map(ev => ({
    reactionTimeMs: ev.reactionTimeMs,
    confirmedInterrupt: ev.confirmedInterrupt !== false,
    spellName: ev.spellName,
    interruptedSpell: ev.interruptedSpell
  }));

  const cleanIntervals = (exportData.castIntervals || [])
    .filter(n => typeof n === 'number' && Number.isFinite(n));

  return {
    character: telemetry.character || 'Player',
    realm: telemetry.realm || 'Azeroth',
    isOptedIn,
    config,
    telemetry,
    movementEvents,
    sessionData: {
      trajectory: cleanTrajectory,
      interrupts: cleanInterrupts,
      castIntervals: cleanIntervals,
      character: telemetry.character || 'Player',
      realm: telemetry.realm || 'Azeroth'
    }
  };
}

/**
 * Loads a WoW SavedVariables file from disk or parses Lua string content,
 * verifies opt-in consent, and conducts the full 7-Density audit.
 * @param {string} filePathOrContent File path or raw Lua string
 * @returns {object} Audit result
 */
export function auditSavedVariablesFile(filePathOrContent) {
  let content = filePathOrContent;
  if (typeof filePathOrContent === 'string' && fs.existsSync(filePathOrContent)) {
    content = fs.readFileSync(filePathOrContent, 'utf-8');
  }

  const parsed = parseLuaSource(content);
  const normalized = normalizeSavedVariables(parsed);

  if (!normalized.isOptedIn) {
    return {
      schema: 'wow-syntropic-audit-v3',
      character: normalized.character,
      realm: normalized.realm,
      overall_verdict: 'OPT_IN_REQUIRED',
      confidence: 0.0,
      evidence_score: '0/3',
      basis: 'Telemetry export is disabled. User must explicitly opt in (/fidelity optin) before session telemetry can be audited.',
      audited_at: new Date().toISOString()
    };
  }

  return auditWoWSession(normalized.sessionData);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node wow_adapter.mjs <path-to-FidelityWoW.lua>');
    console.log('Example: node wow_adapter.mjs "C:/Program Files (x86)/World of Warcraft/_retail_/WTF/Account/<ACCOUNT>/SavedVariables/FidelityWoW.lua"');
    process.exit(0);
  }

  const targetFile = args[0];
  if (!fs.existsSync(targetFile)) {
    console.error(`Error: File not found: ${targetFile}`);
    process.exit(1);
  }

  console.log(`[WoW Adapter] Parsing SavedVariables from: ${targetFile}`);
  const audit = auditSavedVariablesFile(targetFile);
  console.log(JSON.stringify(audit, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(console.error);
}
