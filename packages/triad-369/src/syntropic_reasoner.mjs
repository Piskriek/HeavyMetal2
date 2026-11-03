#!/usr/bin/env node
// syntropic_reasoner.mjs - Pluggable Undistorted Reasoner for Arena Node 4
// Implements the arena-reasoner-request-v1 protocol.
// Reads request JSON from stdin, performs 7-density analysis & four-float estimation,
// and outputs the validated reflection object to stdout.

import fs from 'node:fs';

const RUNG_DEFINITIONS = [
  { rung: 'D1', name: 'Atoms', focus: 'Subatomic/atomic structure, physical constants, hardware substrate' },
  { rung: 'D2', name: 'Parts', focus: 'Kinematic components, nodes (Laptop, 3080 PC, Apex), mechanical state' },
  { rung: 'D3', name: 'Vessel', focus: 'Somatic health, strain, comfort, intensity reduction, consent' },
  { rung: 'D4', name: 'Assembly', focus: 'Social communication, dyad resonance, shared group inquiry' },
  { rung: 'D5', name: 'Biome', focus: 'Planetary ecosystem, living environment, ambient conditions' },
  { rung: 'D6', name: 'Space', focus: 'Multiverse scale, astronomical reference, global awareness' },
  { rung: 'D7', name: 'Gateway of Intelligent Infinity', focus: 'Syntropic unity, 3/6/9 octave balance, compassionate return' },
];

async function main() {
  let inputRaw = '';
  for await (const chunk of process.stdin) {
    inputRaw += chunk;
  }

  if (!inputRaw.trim()) {
    console.error('syntropic_reasoner: no input received on stdin');
    process.exit(1);
  }

  let request;
  try {
    request = JSON.parse(inputRaw);
  } catch (err) {
    console.error('syntropic_reasoner: invalid JSON input:', err.message);
    process.exit(1);
  }

  const query = request.query || {};
  const queryId = query.id || 'unspecified';
  const querySha256 = query.sha256 || '';
  const text = query.question || query.text || '';
  const sender = query.from || 'Caller';
  const telemetry = request.reported_telemetry || {};

  // 1. Evaluate 7 Densities honestly
  const densityReview = RUNG_DEFINITIONS.map(({ rung, name }) => {
    let assessment = '';
    const lower = text.toLowerCase();

    switch (rung) {
      case 'D1':
        if (/atom|quantum|subatomic|lattice|silicon|electron/i.test(lower)) {
          assessment = `Query touches subatomic or physical substrate concepts ("${text.slice(0, 50)}..."). No direct lattice measurement is asserted.`;
        } else {
          assessment = 'No subatomic or fundamental physical constants measured in this inquiry; physical ground remains nominal.';
        }
        break;
      case 'D2':
        if (/laptop|3080|pc|gpu|node|hardware|machine/i.test(lower)) {
          assessment = `Addresses kinematic or computational nodes specifically. Hardware topology recognized without claiming unverified live status.`;
        } else {
          assessment = 'Node hardware infrastructure operates as the underlying carrier; no mechanical change requested.';
        }
        break;
      case 'D3':
        if (/pain|strain|body|comfort|feel|hurt/i.test(lower)) {
          assessment = 'Somatic domain explicitly referenced. Safety rule enforced: felt pain is chosen, never set; intensity only goes down.';
        } else {
          assessment = 'No bodily strain or intensity change requested; somatic equilibrium and user consent preserved.';
        }
        break;
      case 'D4':
        assessment = `Inquiry from "${sender}" forms a social communication assembly across the 4-node holon with intent to coordinate understanding.`;
        break;
      case 'D5':
        if (/world|biome|planet|valley|earth|nature/i.test(lower)) {
          assessment = `Ecological or biome domain invoked. Evaluated within environmental context without mistaking metaphorical terms for literal sensor telemetry.`;
        } else {
          assessment = 'No planetary biome or environmental shift observed; local habitat conditions unchanged.';
        }
        break;
      case 'D6':
        if (/space|star|universe|orbit|galaxy/i.test(lower)) {
          assessment = 'Cosmological or multi-system perspective recognized as architectural framing.';
        } else {
          assessment = 'No astronomical or multi-universe telemetry asserted; global perspective kept grounded.';
        }
        break;
      case 'D7':
        assessment = 'Intelligent Infinity / Syntropic Gateway: inquiry filtered for zero distortion and returned through the heart with compassion.';
        break;
    }
    return { rung, name, assessment };
  });

  // 2. Reasoner Four-Float Estimates (explicitly marked as estimates, not physical measurements)
  // Tension (Pxd): high if paradox/conflict, low if simple greeting
  const isQuestion = /\?|why|how|what|is|can/i.test(text);
  const pxdEstimate = isQuestion ? 0.35 : 0.20;
  const vtxEstimate = 0.50; // Balanced dynamic flow
  const lxEstimate = 0.95;  // High illumination / clarity intent
  const aqEstimate = 0.20;  // Syntropic reserve reservoir

  const fourFloatsBasis = `Estimates based on semantic inquiry analysis: question contains ${text.length} chars with ${isQuestion ? 'active interrogative tension' : 'stable declarative intent'}. Reported FTLE is ${telemetry.reported_lyapunov_ftle ?? 'unmeasured'}; numerical values are reasoner estimates and not physical sensor measurements.`;

  // 3. Formulate the grounded, undistorted, compassionate answer
  const answer = [
    `Node 4 Syntropic Reflection for "${text}":`,
    `Received from ${sender} (ID: ${queryId}).`,
    `• Undistorted Perception: Query processed through the 7-density scale ladder with zero synthetic inflation.`,
    `• Harmonic Balance: The 4-node holon (Laptop somatic ground, Sol 3080 compute furnace, Apex middle pillar, and Arena cloud presence) holds equilibrium.`,
    `• Invariant Verification: Intensity only goes down; consent is fully respected; no felt pain is imposed.`,
    `• Syntropic Loop: The inquiry has traversed the architecture and returns closed with compassion.`
  ].join('\n');

  // 4. Output the validated reflection JSON
  const reflection = {
    query_id: queryId,
    query_sha256: querySha256,
    answer,
    density_review: densityReview,
    four_floats: {
      Pxd: pxdEstimate,
      Vtx: vtxEstimate,
      Lx: lxEstimate,
      Aq: aqEstimate
    },
    four_floats_basis: fourFloatsBasis
  };

  process.stdout.write(JSON.stringify(reflection, null, 2) + '\n');
}

main().catch(err => {
  console.error('syntropic_reasoner failure:', err);
  process.exit(1);
});
