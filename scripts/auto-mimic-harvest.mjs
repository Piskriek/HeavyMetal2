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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
