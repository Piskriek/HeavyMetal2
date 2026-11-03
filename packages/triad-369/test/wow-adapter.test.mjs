import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeLua,
  parseLuaSource,
  normalizeSavedVariables,
  auditSavedVariablesFile
} from '../src/wow_adapter.mjs';

test('WoW Adapter tokenizes and parses Lua SavedVariables table syntax', () => {
  const luaSample = `
-- SavedVariables test
FidelityWoW_Config = {
    ["enabled"] = true,
    ["optIn"] = true,
    ["hudVisible"] = false,
    ["sampleRateHz"] = 20,
}
FidelityWoW_Telemetry = {
    ["character"] = "Arthas",
    ["realm"] = "Icecrown",
    ["ticks"] = 120,
}
FidelityWoW_Export = {
    ["version"] = 2,
    ["trajectories"] = {
        { ["t"] = 100, ["state"] = "START", ["speed"] = 7.0 },
        { ["t"] = 200, ["x"] = 100.5, ["y"] = 200.5, ["speed"] = 7.0 },
        { ["t"] = 300, ["x"] = 101.2, ["y"] = 200.5, ["speed"] = 7.0 },
        { ["t"] = 400, ["x"] = 101.9, ["y"] = 200.5, ["speed"] = 7.0 },
    },
    ["interrupts"] = {
        { ["reactionTimeMs"] = 195.0, ["confirmedInterrupt"] = true, ["spellName"] = "Kick" },
    },
    ["castIntervals"] = {
        1200,
        1450,
        1300,
        1600,
        1250,
    },
}
`;

  const parsed = parseLuaSource(luaSample);
  assert.equal(parsed.FidelityWoW_Config.enabled, true);
  assert.equal(parsed.FidelityWoW_Config.optIn, true);
  assert.equal(parsed.FidelityWoW_Telemetry.character, "Arthas");
  assert.equal(parsed.FidelityWoW_Export.version, 2);
  assert.equal(parsed.FidelityWoW_Export.trajectories.length, 4);
  assert.equal(parsed.FidelityWoW_Export.castIntervals.length, 5);
});

test('WoW Adapter normalizes trajectory and separates movement state changes from coordinates', () => {
  const luaSample = `
FidelityWoW_Config = { ["enabled"] = true, ["optIn"] = true }
FidelityWoW_Telemetry = { ["character"] = "Jaina", ["realm"] = "Dalaran" }
FidelityWoW_Export = {
    ["trajectories"] = {
        { ["t"] = 100, ["state"] = "START", ["speed"] = 7.0 },
        { ["t"] = 200, ["x"] = 50.0, ["y"] = 60.0, ["speed"] = 7.0 },
        { ["t"] = 300, ["x"] = 50.7, ["y"] = 60.0, ["speed"] = 7.0 },
        { ["t"] = 400, ["x"] = 51.4, ["y"] = 60.0, ["speed"] = 7.0 },
        { ["t"] = 500, ["state"] = "STOP", ["speed"] = 0.0 },
    },
    ["interrupts"] = {
        { ["reactionTimeMs"] = 210.0, ["confirmedInterrupt"] = true }
    },
    ["castIntervals"] = { 1100, 1400, 1250, 1500, 1350 }
}
`;
  const parsed = parseLuaSource(luaSample);
  const normalized = normalizeSavedVariables(parsed);

  assert.equal(normalized.isOptedIn, true);
  assert.equal(normalized.character, 'Jaina');
  assert.equal(normalized.realm, 'Dalaran');
  // Trajectory should contain ONLY coordinate points (3 points)
  assert.equal(normalized.sessionData.trajectory.length, 3);
  assert.equal(normalized.sessionData.trajectory[0].x, 50.0);
  // Movement events should contain ONLY state changes (2 events: START, STOP)
  assert.equal(normalized.movementEvents.length, 2);
  assert.equal(normalized.movementEvents[0].state, 'START');
  assert.equal(normalized.movementEvents[1].state, 'STOP');
});

test('WoW Adapter enforces opt-in gate and audits consented session', () => {
  const optedOutLua = `
FidelityWoW_Config = { ["enabled"] = true, ["optIn"] = false }
FidelityWoW_Export = { ["castIntervals"] = { 1200, 1300 } }
`;
  const optOutAudit = auditSavedVariablesFile(optedOutLua);
  assert.equal(optOutAudit.overall_verdict, 'OPT_IN_REQUIRED');
  assert.equal(optOutAudit.confidence, 0.0);

  const optedInLua = `
FidelityWoW_Config = { ["enabled"] = true, ["optIn"] = true }
FidelityWoW_Telemetry = { ["character"] = "Thrall", ["realm"] = "Orgrimmar" }
FidelityWoW_Export = {
    ["trajectory"] = {
        { ["t"] = 100, ["x"] = 10.0, ["y"] = 20.0, ["speed"] = 7.0 },
        { ["t"] = 200, ["x"] = 10.7, ["y"] = 20.0, ["speed"] = 7.0 },
        { ["t"] = 300, ["x"] = 11.4, ["y"] = 20.0, ["speed"] = 7.0 },
    },
    ["interrupts"] = {
        { ["reactionTimeMs"] = 180.0, ["confirmedInterrupt"] = true }
    },
    ["castIntervals"] = { 1100, 1350, 1200, 1450, 1300, 1500, 1250 }
}
`;
  const optInAudit = auditSavedVariablesFile(optedInLua);
  assert.equal(optInAudit.overall_verdict, 'VERIFIED_HUMAN_FLOW');
  assert.ok(optInAudit.confidence > 0.8);
  assert.equal(optInAudit.character, 'Thrall');
});
