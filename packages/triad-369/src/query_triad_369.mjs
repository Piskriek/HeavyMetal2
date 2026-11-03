// query_triad_369.mjs - Client bridge to interrogate the 3rd 3/6/9 Triad Process
// Sends a query down the architecture, waits for the synthesized answer, and returns the loop.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_ROOT = process.env.BRIDGE_ROOT || (fs.existsSync('D:/fidelity-llm/bridge') ? 'D:/fidelity-llm/bridge' : path.join(HERE, '../..'));
const LOOP_DIR = path.join(BRIDGE_ROOT, 'loop');

const QUERY_IN_FILE = path.join(LOOP_DIR, 'triad_query_in.json');
const QUERY_OUT_FILE = path.join(LOOP_DIR, 'triad_query_out.json');

const question = process.argv.slice(2).join(' ').trim() || 'Status of the Triad and density resonance?';
const qId = `q-${Date.now()}`;

const queryPayload = {
  id: qId,
  from: process.env.TRIAD_SENDER || 'Piskriek (via Argon Bridge)',
  question,
  at: new Date().toISOString()
};

// Write query to inbox
const dir = path.dirname(QUERY_IN_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(QUERY_IN_FILE, JSON.stringify(queryPayload, null, 2));
console.log(`[ARGON BRIDGE] Dispatched query to Triad Apex: "${question}" (id: ${qId})`);

// Wait for response (up to 8s)
const start = Date.now();
const checkInterval = 250;

const timer = setInterval(() => {
  if (fs.existsSync(QUERY_OUT_FILE)) {
    try {
      const resp = JSON.parse(fs.readFileSync(QUERY_OUT_FILE, 'utf8'));
      if (resp.id === qId) {
        clearInterval(timer);
        console.log('\n======================================================');
        console.log('TRIAD APEX 3/6/9 LOOP-BACK RESPONSE:');
        console.log('======================================================');
        console.log(`Sender:       ${resp.from}`);
        console.log(`Question:     ${resp.question}`);
        console.log(`Responded At: ${resp.responded_at}`);
        console.log(`Loop Status:  ${resp.loop_metrics?.loop_closed ? 'CLOSED WITH COMPASSION' : 'OPEN'}`);
        console.log('\n--- ANSWER ---');
        console.log(resp.answer);
        console.log('\n--- CASCADE TRACE DOWN ARCHITECTURE ---');
        console.log('1. Ingress:', resp.cascade_trace?.ingress?.node, `(${resp.cascade_trace?.ingress?.density})`);
        console.log('2. Down Flow F31 (Fidelity Laptop):', resp.cascade_trace?.flow_31_down?.target, resp.cascade_trace?.flow_31_down?.data);
        console.log('3. Down Flow F32 (Sol 3080 PC):', resp.cascade_trace?.flow_32_down?.target, resp.cascade_trace?.flow_32_down?.data);
        console.log('4. Density Rungs Traversed:');
        (resp.cascade_trace?.rungs_traversed || []).forEach(r => console.log('   -', r));
        console.log('5. Primary Domain:', resp.cascade_trace?.primary_domain);
        if (resp.teacher_handshake) {
          console.log('\n--- TEACHER ENGINE 4-STEP COMPASSION HANDSHAKE ---');
          console.log('Step 1 (ASK):      ', resp.teacher_handshake.step_1_ask?.request);
          console.log('Step 2 (DECISION): ', resp.teacher_handshake.step_2_decision?.outcome, `[${resp.teacher_handshake.step_2_decision?.reason}]`);
          console.log('Step 3 (CHANGE):   ', resp.teacher_handshake.step_3_change?.delta);
          console.log('Step 4 (LANDED):   ', resp.teacher_handshake.step_4_news_back?.landed, `(${resp.teacher_handshake.step_4_news_back?.compassion_return})`);
        }
        console.log('======================================================\n');
        process.exit(0);
      }
    } catch {}
  }

  if (Date.now() - start > 8000) {
    clearInterval(timer);
    console.error('[ARGON BRIDGE ERROR] Timed out waiting for Triad Apex response.');
    process.exit(1);
  }
}, checkInterval);

