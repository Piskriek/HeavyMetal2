import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCapabilitiesFromAnatomy,
  createCrossGameEntityPacket,
  validateCrossGameEntityPacket,
  adaptEntityToGenre,
  CrossGameBuffer,
} from './cross-game-stream';

describe('Cross-Game Multiverse Streaming & Entity Transceiver (JOB-21)', () => {
  it('computes physical capabilities deterministically from anatomy without cheating', () => {
    // Hauler 6x6 truck
    const haulerCap = computeCapabilitiesFromAnatomy('vehicle', 53, 6, false, true);
    assert.equal(haulerCap.locomotionMode, 'wheeled-axle');
    assert.equal(haulerCap.baseTopSpeedMps, 18.0);
    assert.ok(haulerCap.cargoCapacitySlots >= 10);
    assert.ok(haulerCap.structuralIntegrityHp >= 2000);

    // Scout 4x4 rover
    const scoutCap = computeCapabilitiesFromAnatomy('vehicle', 32, 4, false, false);
    assert.equal(scoutCap.locomotionMode, 'wheeled-axle');
    assert.equal(scoutCap.baseTopSpeedMps, 24.0);
    assert.equal(scoutCap.cargoCapacitySlots, 0);

    // Crawler excavation rig with cutters
    const crawlerCap = computeCapabilitiesFromAnatomy('vehicle', 49, 2, true, false);
    assert.equal(crawlerCap.locomotionMode, 'tracked-sponson');
    assert.equal(crawlerCap.baseTopSpeedMps, 10.0);
    assert.ok(crawlerCap.combatThreatRating >= 15);

    // Quadruped creature
    const creatureCap = computeCapabilitiesFromAnatomy('creature', 28, 4, true, false);
    assert.equal(creatureCap.locomotionMode, 'legged-ik');
    assert.equal(creatureCap.baseTopSpeedMps, 16.0);
  });

  it('mints valid CrossGameEntityPacket with deterministic hash and Rule 8a audit signature', () => {
    const packet = createCrossGameEntityPacket({
      originWorld: {
        worldSeed: 42069,
        gamePresetId: 'game:survival-moon',
        authorTag: 'Piskriek',
        mintedAtSimTick: 1200,
      },
      domain: 'vehicle',
      anatomySpec: {
        kitSpec: {
          assemblies: {},
          parts: {},
        },
      },
      appearanceSpec: {
        matstackPresetId: 'mat:field-worn-hazard',
        skinPaletteId: 'skin:ega-16',
      },
      kinematicsSpec: {
        limbCount: 6,
      },
      audioSpec: {
        voiceOrEngineStemId: 'stem:diesel-turbo-hum',
      },
      brainSpec: {
        archetype: 'hauler-drone',
        weights: {
          seekTarget: 0.8,
          avoidHazard: 0.7,
          preserveEnergy: 0.5,
          packCohesion: 0.2,
          aggressionOrOvertake: 0.1,
        },
        perceptionRadiusM: 35.0,
        reactionRateHz: 30,
      },
      partCount: 53,
      limbOrWheelCount: 6,
      hasCutterOrWeapon: false,
      hasCargoBed: true,
    });

    assert.equal(packet.schema, 'hm2:entity-packet:v1');
    assert.ok(packet.packetId.startsWith('pkt-'));
    assert.equal(packet.auditSignature.looseEnds, 0);
    assert.equal(packet.auditSignature.collisionFaults, 0);
    assert.ok(packet.auditSignature.convexEdgeMetalMin >= 0.45);

    const validation = validateCrossGameEntityPacket(packet);
    assert.equal(validation.valid, true);
  });

  it('rejects tampered packets or Rule 8a violations', () => {
    // Unknown schema
    const invalidSchema = validateCrossGameEntityPacket({ schema: 'bad-schema' });
    assert.equal(invalidSchema.valid, false);

    // Collision faults > 0
    const invalidAudit = validateCrossGameEntityPacket({
      schema: 'hm2:entity-packet:v1',
      packetId: 'pkt-12345678',
      capabilities: {},
      auditSignature: {
        looseEnds: 0,
        collisionFaults: 2,
        convexEdgeMetalMin: 0.5,
      },
    });
    assert.equal(invalidAudit.valid, false);

    // Convex edge metal < 0.45
    const invalidMetal = validateCrossGameEntityPacket({
      schema: 'hm2:entity-packet:v1',
      packetId: 'pkt-12345678',
      capabilities: {},
      auditSignature: {
        looseEnds: 0,
        collisionFaults: 0,
        convexEdgeMetalMin: 0.35,
      },
    });
    assert.equal(invalidMetal.valid, false);
  });

  it('adapts entity into Circuit Racing without mutating the source packet', () => {
    const packet = createCrossGameEntityPacket({
      originWorld: { worldSeed: 101, gamePresetId: 'game:mining', authorTag: 'Miner', mintedAtSimTick: 10 },
      domain: 'vehicle',
      anatomySpec: {},
      appearanceSpec: { matstackPresetId: 'mat:steel', skinPaletteId: 'skin:vga' },
      kinematicsSpec: { limbCount: 4 },
      audioSpec: { voiceOrEngineStemId: 'stem:v8' },
      brainSpec: {
        archetype: 'patrol-scout',
        weights: { seekTarget: 0.5, avoidHazard: 0.5, preserveEnergy: 0.5, packCohesion: 0.5, aggressionOrOvertake: 0.3 },
        perceptionRadiusM: 50,
        reactionRateHz: 60,
      },
      partCount: 32,
      limbOrWheelCount: 4,
      hasCutterOrWeapon: false,
      hasCargoBed: false,
    });

    const adapted = adaptEntityToGenre(packet, 'race-lap-telemetry');
    assert.equal(adapted.colliderMode, 'chassis-bumper-obb');
    assert.equal(adapted.wiregraphRole, 'racer-drafting');
    assert.ok(adapted.effectiveSpeedMps >= 25.0);
    assert.ok(adapted.brainWeights.aggressionOrOvertake >= 0.6); // Drafting & overtake boosted
    assert.equal(adapted.weakpointMultiplier, 0.2); // Non-lethal

    // Source packet remains completely untouched
    assert.equal(packet.capabilities.baseTopSpeedMps, 24.0);
    assert.equal(packet.brainSpec.weights.aggressionOrOvertake, 0.3);
  });

  it('adapts entity into Factory Logistics with speed limits and courier role', () => {
    const packet = createCrossGameEntityPacket({
      originWorld: { worldSeed: 202, gamePresetId: 'game:survival', authorTag: 'Builder', mintedAtSimTick: 20 },
      domain: 'vehicle',
      anatomySpec: {},
      appearanceSpec: { matstackPresetId: 'mat:iron', skinPaletteId: 'skin:vga' },
      kinematicsSpec: { limbCount: 6 },
      audioSpec: { voiceOrEngineStemId: 'stem:hauler' },
      brainSpec: {
        archetype: 'hauler-drone',
        weights: { seekTarget: 0.5, avoidHazard: 0.5, preserveEnergy: 0.5, packCohesion: 0.5, aggressionOrOvertake: 0.8 },
        perceptionRadiusM: 30,
        reactionRateHz: 30,
      },
      partCount: 53,
      limbOrWheelCount: 6,
      hasCutterOrWeapon: false,
      hasCargoBed: true,
    });

    const adapted = adaptEntityToGenre(packet, 'sandbox-freeplay');
    assert.equal(adapted.colliderMode, 'logistics-lane-slot');
    assert.equal(adapted.wiregraphRole, 'logistics-courier');
    assert.equal(adapted.effectiveSpeedMps, 8.0); // Capped at 8 m/s for conveyor lane safety
    assert.equal(adapted.brainWeights.aggressionOrOvertake, 0.0); // Zero aggression in factory
  });

  it('adapts entity into Arena Combat with weakpoint vulnerability and aggressor role', () => {
    const packet = createCrossGameEntityPacket({
      originWorld: { worldSeed: 303, gamePresetId: 'game:arena', authorTag: 'Gladiator', mintedAtSimTick: 30 },
      domain: 'creature',
      anatomySpec: {},
      appearanceSpec: { matstackPresetId: 'mat:chitin', skinPaletteId: 'skin:pbr' },
      kinematicsSpec: { limbCount: 8 },
      audioSpec: { voiceOrEngineStemId: 'stem:arachnid-hiss' },
      brainSpec: {
        archetype: 'predator',
        weights: { seekTarget: 0.9, avoidHazard: 0.2, preserveEnergy: 0.1, packCohesion: 0.8, aggressionOrOvertake: 0.9 },
        perceptionRadiusM: 40,
        reactionRateHz: 60,
      },
      partCount: 42,
      limbOrWheelCount: 8,
      hasCutterOrWeapon: true,
      hasCargoBed: false,
    });

    const adapted = adaptEntityToGenre(packet, 'arena-wave-survivor');
    assert.equal(adapted.colliderMode, 'weakpoint-mesh-aabb');
    assert.equal(adapted.wiregraphRole, 'combat-aggressor');
    assert.equal(adapted.weakpointMultiplier, 2.0); // Weakpoints vulnerable
  });

  it('CrossGameBuffer stores up to 12 slots and evicts oldest on overflow', () => {
    const buffer = new CrossGameBuffer();
    buffer.clear();
    assert.equal(buffer.getSlots().length, 0);

    for (let i = 0; i < 15; i++) {
      const pkt = createCrossGameEntityPacket({
        originWorld: { worldSeed: i, gamePresetId: `game:${i}`, authorTag: `Author${i}`, mintedAtSimTick: i * 10 },
        domain: 'vehicle',
        anatomySpec: {},
        appearanceSpec: { matstackPresetId: 'mat:steel', skinPaletteId: 'skin:ega' },
        kinematicsSpec: { limbCount: 4 },
        audioSpec: { voiceOrEngineStemId: 'stem:hum' },
        brainSpec: {
          archetype: 'patrol-scout',
          weights: { seekTarget: 0.5, avoidHazard: 0.5, preserveEnergy: 0.5, packCohesion: 0.5, aggressionOrOvertake: 0.5 },
          perceptionRadiusM: 20,
          reactionRateHz: 30,
        },
        partCount: 20 + i,
        limbOrWheelCount: 4,
        hasCutterOrWeapon: false,
        hasCargoBed: false,
      });
      buffer.pushPacket(pkt);
    }

    const slots = buffer.getSlots();
    assert.equal(slots.length, 12); // Capped at 12
    // Oldest 3 (0, 1, 2) were evicted; first slot is seed 3
    assert.ok(slots[0]);
    assert.ok(slots[11]);
    assert.equal(slots[0].originWorld.worldSeed, 3);
    assert.equal(slots[11].originWorld.worldSeed, 14);
  });
});
