#!/usr/bin/env node
/**
 * Plan 57 §20: Automated Multi-Game Mechanic & Preset Harvester (`scripts/auto-mimic-harvest.mjs`).
 *
 * Scans the owner's installed games on disk (`D:\SteamLibrary\steamapps\common` and Plasma User Data / Workshop)
 * in strictly READ-ONLY mode and runs `@hm/harness` automated transducers (`auto-mimicry.ts`):
// - Dwarf Fortress (`data/vanilla/vanilla_materials/objects/inorganic_*.txt`) -> Four-Float `elem:` presets
// - Kerbal Space Program (`GameData/Squad/Parts/<cat>/*.cfg`) -> Socketed `kit:` + Four-Float stacks
// - Factorio (`data/base/prototypes/recipe.lua`) -> Port-Hamiltonian `logic:` synthesis throughput presets
// - Hades (`Content/Scripts/WeaponData.lua`) -> Combat timing `mot:` presets
// - Plasma (`Worlds/Progress/*.world` + Workshop `1409160`) -> Validated `@hm/wiregraph` `logic:` + `kit:` contraptions
 *
 * Usage:
 *   node scripts/auto-mimic-harvest.mjs [--steam-dir "D:/SteamLibrary/steamapps/common"]
 */
import fs from 'node:fs';
import path from 'node:path';
import { readOdin } from './read-odin-save.mjs';

const steamDir = process.argv.includes('--steam-dir')
  ? process.argv[process.argv.indexOf('--steam-dir') + 1]
  : 'D:/SteamLibrary/steamapps/common';

const plasmaWorkshopDir = 'D:/SteamLibrary/steamapps/workshop/content/1409160';
const plasmaUserDir = path.join(process.env.USERPROFILE || '', 'AppData/LocalLow/DryLicorice/Plasma/User Data/Worlds/Progress');

function walkFiles(dir, extFilter, maxFiles = 250, out = []) {
  if (!fs.existsSync(dir) || out.length >= maxFiles) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (out.length >= maxFiles) break;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, extFilter, maxFiles, out);
    else if (extFilter(entry.name)) out.push(full);
  }
  return out;
}

async function main() {
  const {
    transduceDfRawsToElements,
    transduceKspCfgToPartPreset,
    transduceFactorioRecipes,
    transduceHadesLuaToCombatPresets,
    transducePlasmaDevice,
    transduceSpaceEngineersSbc,
    transduceSatisfactoryDocsJson,
    transduceTransportFeverLua,
  } = await import('../packages/harness/src/auto-mimicry.ts');

  const summary = {
    dwarfFortressElements: [],
    kspParts: [],
    factorioRecipes: [],
    hadesCombatPresets: [],
    plasmaContraptions: [],
    spaceEngineersBlocks: [],
    satisfactoryPresets: [],
    transportFeverPresets: [],
  };

  // 1. Dwarf Fortress Inorganic Materials
  const dfDir = path.join(steamDir, 'Dwarf Fortress/data/vanilla/vanilla_materials/objects');
  if (fs.existsSync(dfDir)) {
    for (const file of walkFiles(dfDir, (n) => n.startsWith('inorganic_') && n.endsWith('.txt'), 20)) {
      const elems = transduceDfRawsToElements(fs.readFileSync(file, 'utf8'));
      summary.dwarfFortressElements.push(...elems);
    }
  }

  // 2. Kerbal Space Program Parts
  const kspDir = path.join(steamDir, 'Kerbal Space Program/GameData/Squad/Parts');
  if (fs.existsSync(kspDir)) {
    for (const file of walkFiles(kspDir, (n) => n.endsWith('.cfg'), 120)) {
      const part = transduceKspCfgToPartPreset(fs.readFileSync(file, 'utf8'));
      if (part) summary.kspParts.push(part);
    }
  }

  // 3. Factorio Recipes
  const factRecipe = path.join(steamDir, 'Factorio/data/base/prototypes/recipe.lua');
  if (fs.existsSync(factRecipe)) {
    summary.factorioRecipes.push(...transduceFactorioRecipes(fs.readFileSync(factRecipe, 'utf8')));
  }

  // 4. Hades Weapon Timings
  const hadesWeapons = path.join(steamDir, 'Hades/Content/Scripts/WeaponData.lua');
  if (fs.existsSync(hadesWeapons)) {
    summary.hadesCombatPresets.push(...transduceHadesLuaToCombatPresets(fs.readFileSync(hadesWeapons, 'utf8')));
  }

  // 5. Plasma World & Workshop Contraptions
  const plasmaFiles = [
    ...walkFiles(plasmaUserDir, (n) => n.endsWith('.world') || n.endsWith('.device'), 10),
    ...walkFiles(plasmaWorkshopDir, (n) => n.endsWith('.world') || n.endsWith('.device'), 10),
  ];
  const seenDevices = new Set();
  for (const file of plasmaFiles) {
    try {
      const odin = readOdin(fs.readFileSync(file));
      const devs = odin.root?.devices?.$items?.[0] ?? [];
      for (const d of devs) {
        const c = transducePlasmaDevice(d);
        if (c && !seenDevices.has(c.kitOf)) {
          seenDevices.add(c.kitOf);
          summary.plasmaContraptions.push(c);
        }
      }
    } catch {
      // ignore unreadable binary
    }
  }

  // 6. Space Engineers CubeBlocks/*.sbc
  const seDir = path.join(steamDir, 'SpaceEngineers/Content/Data/CubeBlocks');
  if (fs.existsSync(seDir)) {
    for (const file of walkFiles(seDir, (n) => n.endsWith('.sbc'), 40)) {
      summary.spaceEngineersBlocks.push(...transduceSpaceEngineersSbc(fs.readFileSync(file, 'utf8')));
    }
  }

  // 7. Satisfactory CommunityResources/Docs/en-US.json
  const satDoc = path.join(steamDir, 'Satisfactory/CommunityResources/Docs/en-US.json');
  if (fs.existsSync(satDoc)) {
    const raw = fs.readFileSync(satDoc);
    const text = raw[0] === 0xff && raw[1] === 0xfe ? raw.toString('utf16le') : raw.toString('utf8');
    summary.satisfactoryPresets.push(...transduceSatisfactoryDocsJson(text));
  }

  // 8. Transport Fever 2 Track, Multiple-Unit Consists & Cargo
  const tf2ConfigDir = path.join(steamDir, 'Transport Fever 2/res/config');
  if (fs.existsSync(tf2ConfigDir)) {
    const tf2Dirs = ['track', 'multiple_unit', 'cargo_types'].map((d) => path.join(tf2ConfigDir, d));
    for (const dir of tf2Dirs) {
      for (const file of walkFiles(dir, (n) => n.endsWith('.lua'), 80)) {
        summary.transportFeverPresets.push(
          ...transduceTransportFeverLua(fs.readFileSync(file, 'utf8'), path.basename(file)),
        );
      }
    }
  }

  console.log('=== AUTOMATED MULTI-GAME MIMICRY HARVEST (8 GAMES) ===');
  console.log(`1. Dwarf Fortress Elements transduced : ${summary.dwarfFortressElements.length}`);
  if (summary.dwarfFortressElements.length > 0) {
    for (const e of summary.dwarfFortressElements.slice(0, 4)) {
      console.log(`   - ${e.rawId.padEnd(14)} -> ${e.preset.id} (Pxd=${e.preset.pxd}, Vtx=${e.preset.vtx}, Lx=${e.preset.lx}, Aq=${e.preset.aq}) | rho=${e.derived.density} kg/m³`);
    }
  }
  console.log(`2. KSP Socketed Parts transduced      : ${summary.kspParts.length}`);
  if (summary.kspParts.length > 0) {
    for (const p of summary.kspParts.slice(0, 4)) {
      console.log(`   - ${p.rawName.padEnd(22)} -> ${p.kitOf} [${p.emergentRole}] sockets=${p.sockets.length} thrust=${p.thrustKn}kN Isp=${p.ispVacSec}s`);
    }
  }
  console.log(`3. Factorio Synthesis Recipes         : ${summary.factorioRecipes.length}`);
  if (summary.factorioRecipes.length > 0) {
    for (const r of summary.factorioRecipes.slice(0, 4)) {
      console.log(`   - ${r.rawName.padEnd(22)} -> ${r.recipeOf} (${r.energyRequiredSec}s, ${r.throughputPerMin}/min)`);
    }
  }
  console.log(`4. Hades Combat Cadence Presets       : ${summary.hadesCombatPresets.length}`);
  if (summary.hadesCombatPresets.length > 0) {
    for (const c of summary.hadesCombatPresets.slice(0, 4)) {
      console.log(`   - ${c.rawName.padEnd(22)} -> ${c.presetOf} (pre=${c.preWaitSec}s, dur=${c.activeDurationSec}s, cd=${c.cooldownSec}s)`);
    }
  }
  console.log(`5. Plasma Contraptions & Wiregraphs   : ${summary.plasmaContraptions.length}`);
  if (summary.plasmaContraptions.length > 0) {
    for (const p of summary.plasmaContraptions.slice(0, 4)) {
      console.log(`   - ${p.deviceName.padEnd(22)} -> ${p.kitOf} / ${p.logicOf} (parts=${p.componentCount}, agents=${p.agentCount}, bounce=${p.meanBounciness})`);
    }
  }
  console.log(`6. Space Engineers Socketed Blocks    : ${summary.spaceEngineersBlocks.length}`);
  if (summary.spaceEngineersBlocks.length > 0) {
    for (const b of summary.spaceEngineersBlocks.slice(0, 4)) {
      console.log(`   - ${b.subtypeId.padEnd(22)} -> ${b.kitOf} [${b.role}] size=${b.cubeSize}(${b.dimensions.join('x')}) mounts=${b.mountSides.length} thrust=${b.forceMagnitudeN}N`);
    }
  }
  console.log(`7. Satisfactory Industrial Presets    : ${summary.satisfactoryPresets.length}`);
  if (summary.satisfactoryPresets.length > 0) {
    for (const s of summary.satisfactoryPresets.slice(0, 4)) {
      console.log(`   - ${s.className.padEnd(22)} -> ${s.presetOf} [${s.kind}] (${s.durationSec}s, ${s.throughputPerMin}/min, ${s.powerMW}MW)`);
    }
  }
  console.log(`8. Transport Fever 2 Logistics Curves : ${summary.transportFeverPresets.length}`);
  if (summary.transportFeverPresets.length > 0) {
    for (const t of summary.transportFeverPresets.slice(0, 4)) {
      console.log(`   - ${t.fileId.padEnd(22)} -> ${t.presetOf} [${t.kind}] (vMax=${t.topSpeedMps}m/s, cars=${t.carCount}, cargo=${t.cargoWeightKg}kg)`);
    }
  }
  const total =
    summary.dwarfFortressElements.length +
    summary.kspParts.length +
    summary.factorioRecipes.length +
    summary.hadesCombatPresets.length +
    summary.plasmaContraptions.length +
    summary.spaceEngineersBlocks.length +
    summary.satisfactoryPresets.length +
    summary.transportFeverPresets.length;
  console.log(`TOTAL TRANSDUCED PRESETS ACROSS 8 GAMES : ${total}`);

  if (process.argv.includes('--write-catalog')) {
    const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
    const f100 = (n) => Math.max(1, Math.min(100, Math.round((Number(n) || 0) / 100)));

    const allTuples = [];
    const seenIds = new Set();
    const pushTuple = (t) => {
      if (seenIds.has(t[0])) return;
      seenIds.add(t[0]);
      allTuples.push(t);
    };

    for (const e of summary.dwarfFortressElements) {
      pushTuple([
        e.preset.id,
        e.preset.name,
        'df',
        'el',
        f100(e.preset.pxd),
        f100(e.preset.vtx),
        f100(e.preset.lx),
        f100(e.preset.aq),
        round1(e.derived.density),
        0,
        0,
        0,
        0,
      ]);
    }
    for (const p of summary.kspParts) {
      const cat =
        p.emergentRole === 'thermal-thruster'
          ? 'th'
          : p.emergentRole === 'attitude-gyro'
            ? 'gy'
            : p.emergentRole === 'power-accumulator'
              ? 're'
              : 'st';
      pushTuple([
        p.kitOf,
        p.rawName,
        'ksp',
        cat,
        f100(p.fourFloats.pxd),
        f100(p.fourFloats.vtx),
        f100(p.fourFloats.lx),
        f100(p.fourFloats.aq),
        round1(p.massTons * 1000),
        round1(p.thrustKn),
        round1(p.torqueKnM),
        0,
        p.sockets.length,
      ]);
    }
    for (const r of summary.factorioRecipes) {
      pushTuple([
        r.recipeOf,
        r.rawName,
        'fac',
        'sy',
        65,
        55,
        75,
        45,
        0,
        0,
        round1(r.energyRequiredSec * 0.5),
        round1(r.throughputPerMin),
        r.totalInputUnits,
      ]);
    }
    for (const c of summary.hadesCombatPresets) {
      const cycPerMin = round1(60 / Math.max(0.1, c.preWaitSec + c.activeDurationSec + c.cooldownSec));
      pushTuple([
        c.presetOf,
        c.rawName,
        'had',
        'co',
        72,
        64,
        82,
        38,
        0,
        0,
        round1(c.preWaitSec),
        cycPerMin,
        1,
      ]);
    }
    for (const d of summary.plasmaContraptions) {
      pushTuple([
        d.kitOf,
        d.deviceName,
        'pla',
        'wg',
        78,
        74,
        84,
        52,
        round1(d.totalMassMultiplier),
        0,
        round1(d.agentCount),
        0,
        d.componentCount,
      ]);
    }
    for (const b of summary.spaceEngineersBlocks) {
      const cat =
        b.role === 'thermal-thruster'
          ? 'th'
          : b.role === 'fission-reactor'
            ? 're'
            : b.role === 'attitude-gyro'
              ? 'gy'
              : b.role === 'synthesis-assembler'
                ? 'sy'
                : 'st';
      pushTuple([
        b.kitOf,
        b.subtypeId,
        'se',
        cat,
        f100(b.fourFloats.pxd),
        f100(b.fourFloats.vtx),
        f100(b.fourFloats.lx),
        f100(b.fourFloats.aq),
        round1(b.dimensions[0] * b.dimensions[1] * b.dimensions[2] * (b.cubeSize === 'Large' ? 250 : 25)),
        round1(b.forceMagnitudeN / 1000),
        round1(b.maxPowerMW),
        0,
        b.mountSides.length,
      ]);
    }
    for (const s of summary.satisfactoryPresets) {
      const cat = s.kind === 'resource' ? 'el' : s.kind === 'generator' ? 're' : 'sy';
      pushTuple([
        s.presetOf,
        s.className.replace(/^Recipe_|^Desc_|^Build_|_C$/g, ''),
        'sat',
        cat,
        70,
        68,
        80,
        55,
        round1(s.energyValueMJ * 100),
        0,
        round1(s.powerMW),
        round1(s.throughputPerMin),
        s.ingredientCount + s.productCount,
      ]);
    }
    for (const t of summary.transportFeverPresets) {
      const cat = t.kind === 'cargo-density' ? 'el' : 'lo';
      pushTuple([
        t.presetOf,
        t.fileId.replace(/\.cargo\.lua$|\.lua$/g, ''),
        'tf2',
        cat,
        68,
        76,
        60,
        50,
        round1(t.cargoWeightKg || t.carCount * 42000),
        round1(t.topSpeedMps),
        0,
        round1(t.carCount),
        t.carCount,
      ]);
    }

    const byCategory = {
      element: 0,
      'thruster-propulsion': 0,
      'reactor-power': 0,
      'gyro-control': 0,
      'structural-hull': 0,
      'synthesis-recipe': 0,
      'combat-cadence': 0,
      'wiregraph-contraption': 0,
      'logistics-envelope': 0,
    };
    const catMap = {
      el: 'element',
      th: 'thruster-propulsion',
      re: 'reactor-power',
      gy: 'gyro-control',
      st: 'structural-hull',
      sy: 'synthesis-recipe',
      co: 'combat-cadence',
      wg: 'wiregraph-contraption',
      lo: 'logistics-envelope',
    };
    const byGame = {
      'Dwarf Fortress': summary.dwarfFortressElements.length,
      'Kerbal Space Program': summary.kspParts.length,
      Factorio: summary.factorioRecipes.length,
      Hades: summary.hadesCombatPresets.length,
      Plasma: summary.plasmaContraptions.length,
      'Space Engineers': summary.spaceEngineersBlocks.length,
      Satisfactory: summary.satisfactoryPresets.length,
      'Transport Fever 2': summary.transportFeverPresets.length,
    };
    for (const t of allTuples) {
      byCategory[catMap[t[3]]]++;
    }

    const outPath = path.resolve('packages/harness/src/harvested-catalog-data.ts');
    const tsContent = `/**
 * Auto-generated by \`scripts/auto-mimic-harvest.mjs --write-catalog\` (Plan 58 Wave 3).
 * Compact tuple table for the ${total} transduced presets across 8 games (${allTuples.length} unique preset IDs).
 * Tuple layout: [id, name, gameCode, catCode, pxd, vtx, lx, aq, massKg, thrustKn, powerMW, throughputPerMin, sockets]
 */
export type CompactHarvestTuple = readonly [
  string,
  string,
  'df' | 'ksp' | 'fac' | 'had' | 'pla' | 'se' | 'sat' | 'tf2',
  'el' | 'th' | 're' | 'gy' | 'st' | 'sy' | 'co' | 'wg' | 'lo',
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const HARVESTED_TOTAL_COUNTS = {
  total: ${total},
  uniqueIds: ${allTuples.length},
  byCategory: ${JSON.stringify(byCategory, null, 2)},
  byGame: ${JSON.stringify(byGame, null, 2)},
} as const;

export const HARVESTED_COMPACT_TUPLES: readonly CompactHarvestTuple[] = [\n${allTuples
      .map((t) => `  ${JSON.stringify(t)},`)
      .join('\n')}\n];\n`;

    fs.writeFileSync(outPath, tsContent, 'utf8');
    console.log(`Wrote ${allTuples.length} unique compact tuples (${total} total harvested) to ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
