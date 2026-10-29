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
  } = await import('../packages/harness/src/auto-mimicry.ts');

  const summary = {
    dwarfFortressElements: [],
    kspParts: [],
    factorioRecipes: [],
    hadesCombatPresets: [],
    plasmaContraptions: [],
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

  console.log('=== AUTOMATED MULTI-GAME MIMICRY HARVEST ===');
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
