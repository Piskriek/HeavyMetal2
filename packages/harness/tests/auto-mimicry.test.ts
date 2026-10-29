import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWireGraph } from '@hm/wiregraph';
import {
  createAutoMimicLiveState,
  stepAutoMimicLiveSession,
  transduceDfRawsToElements,
  transduceFactorioRecipes,
  transduceHadesLuaToCombatPresets,
  transduceKspCfgToPartPreset,
  transducePlasmaDevice,
} from '../src/index.js';

test('Plan 57 §20.1: transduceDfRawsToElements parses Dwarf Fortress raws and solves the inverse Four-Float derivation card', () => {
  const sampleRaw = `
[OBJECT:INORGANIC]
[INORGANIC:IRON]
  [USE_MATERIAL_TEMPLATE:METAL_TEMPLATE]
  [ITEMS_METAL]
  [SOLID_DENSITY:7850]
  [SPEC_HEAT:450]
  [MELTING_POINT:12768]
  [IMPACT_YIELD:542500]
[INORGANIC:SANDSTONE]
  [SOLID_DENSITY:2400]
  [SPEC_HEAT:800]
  [MELTING_POINT:11500]
  [IMPACT_YIELD:120000]
`;
  const elems = transduceDfRawsToElements(sampleRaw);
  assert.equal(elems.length, 2);
  const iron = elems.find((e) => e.rawId === 'IRON')!;
  const sandstone = elems.find((e) => e.rawId === 'SANDSTONE')!;

  assert.ok(iron.preset.id.startsWith('elem:'));
  assert.ok(iron.preset.vtx > sandstone.preset.vtx, 'iron has higher Vtx density than sandstone');
  assert.ok(iron.preset.pxd > sandstone.preset.pxd, 'iron has higher Pxd impact yield than sandstone');
  assert.ok(iron.preset.lx > sandstone.preset.lx, 'metallic iron has higher Lx conductivity than sandstone');
  // Round-trip density within 5% of measured 7850 kg/m³
  assert.equal(iron.derived.density, 7850);
});

test('Plan 57 §20.2: transduceKspCfgToPartPreset parses KSP PART .cfg into socketed kit + Four-Float stack + emergent role', () => {
  const kspCfg = `
PART
{
  name = liquidEngine3_v2
  module = Part
  category = Engine
  node_stack_top = 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1
  node_stack_bottom = 0.0, -0.83, 0.0, 0.0, -1.0, 0.0, 1
  mass = 0.5
  crashTolerance = 7
  maxTemp = 2000
  MODULE
  {
    name = ModuleEngines
    maxThrust = 60
    atmosphereCurve
    {
      key = 0 345
      key = 1 85
    }
  }
}
`;
  const part = transduceKspCfgToPartPreset(kspCfg)!;
  assert.ok(part);
  assert.equal(part.rawName, 'liquidEngine3_v2');
  assert.equal(part.emergentRole, 'thermal-thruster');
  assert.equal(part.thrustKn, 60);
  assert.equal(part.ispVacSec, 345);
  assert.equal(part.ispSeaSec, 85);
  assert.equal(part.sockets.length, 2);
  assert.deepEqual(part.sockets[0]!.normal, [0, 1, 0]);
  assert.ok(part.fourFloats.lx >= 5500, 'thruster carries strong Lx energy flux');
});

test('Plan 57 §20.3 & §20.4: transduceFactorioRecipes and transduceHadesLuaToCombatPresets extract synthesis throughput & combat timings', () => {
  const factorioLua = `
data:extend({
  {
    type = "recipe",
    name = "speed-module",
    energy_required = 15,
    ingredients = {
      {type = "item", name = "advanced-circuit", amount = 5},
      {type = "item", name = "electronic-circuit", amount = 5}
    },
    results = {{type="item", name="speed-module", amount=1}}
  }
})
`;
  const recipes = transduceFactorioRecipes(factorioLua);
  assert.equal(recipes.length, 1);
  assert.equal(recipes[0]!.rawName, 'speed-module');
  assert.equal(recipes[0]!.energyRequiredSec, 15);
  assert.equal(recipes[0]!.totalInputUnits, 10);
  assert.equal(recipes[0]!.throughputPerMin, 4);

  const hadesLua = `
WeaponData =
{
\tRangedWeapon =
\t{
\t\tScreenPreWait = 0.06,
\t\tDuration = 0.17,
\t\tCooldown = 0.42,
\t\tAmmoDropDelay = 16,
\t},
}
`;
  const combat = transduceHadesLuaToCombatPresets(hadesLua);
  assert.equal(combat.length, 1);
  assert.equal(combat[0]!.rawName, 'RangedWeapon');
  assert.equal(combat[0]!.preWaitSec, 0.06);
  assert.equal(combat[0]!.activeDurationSec, 0.17);
  assert.equal(combat[0]!.cooldownSec, 0.42);
  assert.equal(combat[0]!.ammoDropDelaySec, 16);
});

test('Plan 57 §20.5: transducePlasmaDevice converts an Odin SerializedDevice into a validated FIDELITY WireGraphSpec + kit summary', () => {
  const mockPlasmaDevice = {
    displayName: 'Auto Sliding Door',
    agents: {
      $items: [
        [
          { agentId: { displayName: 'Round Button', agentGestaltId: 201 } },
          { agentId: { displayName: 'Processor Sketch', agentGestaltId: 301 } },
          { agentId: { displayName: 'Sliding Door', agentGestaltId: 307 } },
          { agentId: { displayName: 'Status Lamp', agentGestaltId: 401 } },
        ],
      ],
    },
    components: {
      $items: [
        [
          { massMultiplier: 1.5, bounciness: 0.1, dynamicFriction: 0.6 },
          { massMultiplier: 2.5, bounciness: 0.3, dynamicFriction: 0.4 },
        ],
      ],
    },
  };

  const res = transducePlasmaDevice(mockPlasmaDevice)!;
  assert.ok(res);
  assert.equal(res.deviceName, 'Auto Sliding Door');
  assert.equal(res.componentCount, 2);
  assert.equal(res.agentCount, 4);
  assert.equal(res.totalMassMultiplier, 4);
  assert.equal(res.meanBounciness, 0.2);
  assert.equal(res.meanFriction, 0.5);
  assert.deepEqual(validateWireGraph(res.wiregraph), []);
  assert.equal(res.wiregraph.sensors[0]!.kind, 'proximity');
  assert.equal(res.wiregraph.nodes[0]!.kind, 'latch');
  assert.ok(res.wiregraph.actuators.some((a) => a.kind === 'open-door'));
});

test('Plan 57 §20.6: stepAutoMimicLiveSession buffers rolling bridge samples and automatically mints presets at confidence >= 0.75', () => {
  let state = createAutoMimicLiveState('live-sandbox');
  // Feed a clean jump parabola + ground run + burst shots
  for (let i = 0; i < 40; i++) {
    const t = i * 0.05;
    const x = t * 6.5;
    // Airborne arc for first 20 steps (t = 0..0.95s): y(t) = 4.5*t - 0.5*9.8*t^2
    const y = i < 20 ? Math.max(0, 4.5 * t - 4.9 * t * t) : 0;
    const shotFired = i === 5 || i === 7 || i === 9 || i === 25 || i === 27 || i === 29;
    state = stepAutoMimicLiveSession(state, { t, pos: [x, y, 0], shotFired });
  }

  assert.ok(state.latestResult);
  assert.ok(state.latestResult.confidence >= 0.75);
  assert.ok(state.mintedPresets.some((p) => p.startsWith('loc:')));
  assert.ok(state.mintedPresets.some((p) => p.startsWith('mot:')));
});
