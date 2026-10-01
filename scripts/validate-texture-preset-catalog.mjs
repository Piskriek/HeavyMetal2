#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const refsDir = path.join(root, 'art-src/meshy/material-refs');
const catalogPath = path.join(refsDir, 'texture-preset-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const errors = [];
const seenIds = new Set();
const seenCodes = new Set();

const channelTokens = new Map([
  ['BaseColor', 'BC'], ['Normal', 'N'], ['Roughness', 'R'], ['Metallic', 'M'],
  ['AO', 'O'], ['Height', 'H'], ['Alpha', 'A'], ['Emissive', 'E'],
  ['Transmission', 'T'], ['Distortion', 'D'], ['Subsurface', 'S']
]);
const channelOrder = ['BaseColor', 'Normal', 'Roughness', 'Metallic', 'AO', 'Height', 'Alpha', 'Emissive', 'Transmission', 'Distortion', 'Subsurface'];

function expectedChannelCode(channels) {
  return channelOrder.filter((name) => channels.includes(name)).map((name) => channelTokens.get(name)).join('');
}

for (const preset of catalog.presets) {
  const tag = preset.registryId ?? '<missing-id>';
  if (seenIds.has(tag)) errors.push(`${tag}: duplicate registryId`);
  if (seenCodes.has(preset.canonicalCode)) errors.push(`${tag}: duplicate canonicalCode`);
  seenIds.add(tag);
  seenCodes.add(preset.canonicalCode);

  const parts = String(preset.canonicalCode).split('-');
  if (parts.length !== 14) {
    errors.push(`${tag}: canonicalCode must contain 14 tokens, got ${parts.length}`);
    continue;
  }
  const [project, kind, rid, domain, material, form, channels, style, tier, layout, condition, palette, sampling, revision] = parts;
  const checks = [
    [project, 'HM2', 'project'], [kind, 'TXP', 'kind'], [rid, preset.registryId, 'registryId'],
    [domain, preset.domain, 'domain'], [material, preset.material, 'material'], [form, preset.form, 'form'],
    [channels, expectedChannelCode(preset.channels), 'channels'], [style, preset.style, 'style'],
    [tier, preset.targetTier, 'targetTier'], [layout, preset.layout, 'layout'],
    [condition, preset.condition, 'condition'], [palette, preset.palette?.token, 'palette'],
    [sampling, preset.sampling, 'sampling'], [revision, `R${String(preset.recipeRevision).padStart(2, '0')}`, 'revision']
  ];
  for (const [actual, expected, field] of checks) {
    if (actual !== expected) errors.push(`${tag}: code ${field}=${actual}, catalog=${expected}`);
  }

  if (!preset.sourceFile.startsWith(`${tag}-`)) errors.push(`${tag}: sourceFile must start with ${tag}-`);
  if (!fs.existsSync(path.join(refsDir, preset.sourceFile))) errors.push(`${tag}: sourceFile does not exist: ${preset.sourceFile}`);
  if (!Array.isArray(preset.intendedUses) || preset.intendedUses.length === 0) errors.push(`${tag}: intendedUses required`);
  if (!Array.isArray(preset.prohibitedUses) || preset.prohibitedUses.length === 0) errors.push(`${tag}: prohibitedUses required`);
  if (!preset.recipe?.intent || !preset.recipe?.required?.length || !preset.recipe?.forbidden?.length || !preset.recipe?.frequency) {
    errors.push(`${tag}: incomplete reconstruction recipe`);
  }
}

const mandatoryStart = Number(catalog.coverage.newRecordsMandatoryFrom.replace(/^M/, ''));
const sourceIds = fs.readdirSync(refsDir)
  .map((name) => name.match(/^M(\d+)-.*\.(png|jpg|jpeg|webp)$/i))
  .filter(Boolean)
  .map((match) => Number(match[1]))
  .filter((id) => id >= mandatoryStart);
for (const id of new Set(sourceIds)) {
  const rid = `M${String(id).padStart(3, '0')}`;
  if (!seenIds.has(rid)) errors.push(`${rid}: source exists but mandatory catalog record is missing`);
}

if (errors.length) {
  console.error(`Texture preset catalog validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Texture preset catalog valid: ${catalog.presets.length} records; mandatory coverage from ${catalog.coverage.newRecordsMandatoryFrom}.`);
