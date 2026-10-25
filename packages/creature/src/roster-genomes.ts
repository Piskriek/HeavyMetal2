/**
 * Declarative creature genomes for the 38 roster monsters and the seven canonical biological archetypes (plan 44, part B).
 *
 * Zero closures: every genome is pure, deterministic static data. Each species binds its anatomy to an `@hm/matstack`
 * OKLab palette (`skinPaletteId`) and an `@hm/soundlab` vocal-tract resonant formant stem (`voiceStemId`).
 */
import type { CreatureGenomeSpec } from './creature-spec';

export const ARACHNID_GENOME: CreatureGenomeSpec = {
  "id": "arachnid",
  "archetype": "arachnid",
  "seed": 43180,
  "skinPaletteId": "mat:workshop-steel",
  "voiceStemId": "vo-arachnid",
  "strideFreqHz": 2.8,
  "dutyFactor": 0.68,
  "pelvis": {
    "restHeight": 0.62,
    "radius": [
      0.19,
      0.14,
      0.26
    ],
    "sacrumOffset": [
      0.01,
      0.22,
      0.02
    ],
    "matPresetId": "chitin-dark"
  },
  "torso": {
    "depth": 0.26,
    "material": "chitin-dark"
  },
  "spine": [
    {
      "id": "opisthosoma",
      "length": 0.16,
      "radiusX": 0.15,
      "radiusY": 0.13,
      "pitchRestDeg": 0,
      "direction": [
        0,
        0.05,
        1
      ],
      "matPresetId": "chitin-dark",
      "bone": "spine-0"
    },
    {
      "id": "prosoma",
      "length": 0.26,
      "radiusX": 0.17,
      "radiusY": 0.14,
      "pitchRestDeg": 0,
      "direction": [
        0,
        0.05,
        1
      ],
      "matPresetId": "chitin-dark",
      "bone": "spine-1"
    },
    {
      "id": "cervical",
      "length": 0.12,
      "radiusX": 0.07,
      "radiusY": 0.07,
      "pitchRestDeg": 0,
      "direction": [
        0,
        0.3,
        1
      ],
      "matPresetId": "chitin-dark",
      "kind": "neck",
      "bone": "spine-2"
    },
    {
      "id": "skull",
      "length": 0.16,
      "radiusX": 0.09,
      "radiusY": 0.08,
      "pitchRestDeg": 0,
      "direction": [
        0,
        0.05,
        1
      ],
      "matPresetId": "chitin-dark",
      "kind": "cranium",
      "bone": "spine-3"
    }
  ],
  "limbs": [
    {
      "id": "spinneret",
      "parentSegmentId": "pelvis",
      "symmetry": "medial",
      "mountOffset": [
        0,
        0.5,
        -0.24
      ],
      "upperLength": 0.24,
      "lowerLength": 0.26,
      "kneeBendDir": [
        0,
        1,
        0
      ],
      "gaitPhaseOffset": 0.25,
      "stepHeight": 0.02,
      "strideLength": 0.2,
      "effectorKind": "pincer",
      "upperDirection": [
        0,
        0.12,
        -1
      ],
      "lowerDirection": [
        0,
        -0.08,
        -1
      ],
      "effectorDirection": [
        0,
        -0.3,
        -1
      ],
      "effectorLength": 0.08,
      "upperRadius": 0.09,
      "lowerRadius": 0.07,
      "knuckleRadius": 0.06
    },
    {
      "id": "hindleg",
      "parentSegmentId": "pelvis",
      "symmetry": "bilateral",
      "mountOffset": [
        0.17,
        0.524,
        -0.22
      ],
      "upperLength": 0.3,
      "lowerLength": 0.38,
      "kneeBendDir": [
        0.3,
        0.2,
        0.2
      ],
      "gaitPhaseOffset": 0,
      "stepHeight": 0.1,
      "strideLength": 0.8,
      "effectorKind": "talon",
      "upperDirection": [
        0.85,
        -0.3,
        -0.2
      ],
      "lowerDirection": [
        0.35,
        -0.85,
        0.2
      ],
      "effectorDirection": [
        0,
        -1,
        0
      ],
      "effectorLength": 0.08,
      "upperRadius": 0.045,
      "lowerRadius": 0.035,
      "knuckleRadius": 0.045,
      "bones": {
        "upper": "legA{Side}Upper",
        "lower": "legA{Side}Lower",
        "effector": "legA{Side}Foot"
      }
    },
    {
      "id": "midleg",
      "parentSegmentId": "pelvis",
      "symmetry": "bilateral",
      "mountOffset": [
        0.18,
        0.544,
        0.04
      ],
      "upperLength": 0.3,
      "lowerLength": 0.4,
      "kneeBendDir": [
        1,
        0.2,
        0
      ],
      "gaitPhaseOffset": 0.5,
      "stepHeight": 0.1,
      "strideLength": 0.8,
      "effectorKind": "talon",
      "upperDirection": [
        0.9,
        -0.3,
        0
      ],
      "lowerDirection": [
        0.35,
        -0.87,
        0.1
      ],
      "effectorDirection": [
        0,
        -1,
        0
      ],
      "effectorLength": 0.08,
      "upperRadius": 0.045,
      "lowerRadius": 0.035,
      "knuckleRadius": 0.045,
      "bones": {
        "upper": "legB{Side}Upper",
        "lower": "legB{Side}Lower",
        "effector": "legB{Side}Foot"
      }
    },
    {
      "id": "foreleg",
      "parentSegmentId": "prosoma",
      "symmetry": "bilateral",
      "mountOffset": [
        0.25,
        0.02,
        0.12
      ],
      "upperLength": 0.28,
      "lowerLength": 0.34,
      "kneeBendDir": [
        0.3,
        0.2,
        -0.2
      ],
      "gaitPhaseOffset": 0.25,
      "stepHeight": 0.1,
      "strideLength": 0.8,
      "effectorKind": "talon",
      "role": "arm",
      "upperDirection": [
        0.85,
        -0.3,
        0.2
      ],
      "lowerDirection": [
        0.3,
        -0.88,
        -0.1
      ],
      "effectorDirection": [
        0,
        -1,
        0
      ],
      "effectorLength": 0.08,
      "upperRadius": 0.04,
      "lowerRadius": 0.032,
      "knuckleRadius": 0.042,
      "bones": {
        "upper": "legC{Side}Upper",
        "lower": "legC{Side}Lower",
        "effector": "legC{Side}Foot"
      }
    },
    {
      "id": "pedipalp",
      "parentSegmentId": "prosoma",
      "symmetry": "bilateral",
      "mountOffset": [
        0.24,
        0.04,
        0.32
      ],
      "upperLength": 0.22,
      "lowerLength": 0.24,
      "kneeBendDir": [
        0.3,
        0.2,
        0.2
      ],
      "gaitPhaseOffset": 0.75,
      "stepHeight": 0.06,
      "strideLength": 0.5,
      "effectorKind": "pincer",
      "role": "arm",
      "upperDirection": [
        0.65,
        -0.35,
        0.55
      ],
      "lowerDirection": [
        0.2,
        -0.75,
        0.55
      ],
      "effectorDirection": [
        0,
        -0.6,
        0.8
      ],
      "effectorLength": 0.07,
      "upperRadius": 0.036,
      "lowerRadius": 0.028,
      "knuckleRadius": 0.038,
      "bones": {
        "upper": "legD{Side}Upper",
        "lower": "legD{Side}Lower",
        "effector": "legD{Side}Foot"
      }
    }
  ],
  "armour": [
    {
      "id": "dorsal-shield",
      "gen": "panel",
      "params": {
        "width": 0.28,
        "depth": 0.34,
        "thickness": 0.03,
        "bevel": 0.012,
        "seam": 0.02,
        "boltsPerSide": 2,
        "boltHead": 0.018
      },
      "material": "chitin-plate",
      "mount": "cage.top",
      "at": [
        0,
        -0.02,
        -0.08
      ]
    }
  ],
  "sensoryControls": [
    {
      "id": "ocelli-left",
      "gen": "knuckle",
      "params": {
        "radius": 0.028,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "eye-glow",
      "mount": "skull.front",
      "at": [
        0.055,
        0,
        0
      ]
    },
    {
      "id": "ocelli-right",
      "gen": "knuckle",
      "params": {
        "radius": 0.028,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "eye-glow",
      "mount": "skull.front",
      "at": [
        -0.055,
        0,
        0
      ]
    }
  ],
  "subjectEffectors": [
    {
      "id": "chelicera-left",
      "gen": "knuckle",
      "params": {
        "radius": 0.028,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "talon-horn",
      "mount": "limb:left-pedipalp"
    },
    {
      "id": "chelicera-right",
      "gen": "knuckle",
      "params": {
        "radius": 0.028,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "talon-horn",
      "mount": "limb:right-pedipalp"
    }
  ]
};

export const SERPENTINE_GENOME: CreatureGenomeSpec = {
  "id": "serpentine",
  "archetype": "serpentine",
  "seed": 24185,
  "skinPaletteId": "mat:overgrown-relic",
  "voiceStemId": "vo-serpentine",
  "strideFreqHz": 2.1,
  "dutyFactor": 0.65,
  "pelvis": {
    "restHeight": 0.68,
    "radius": [
      0.17,
      0.14,
      0.22
    ],
    "sacrumOffset": [
      0.01,
      0.22,
      0.02
    ],
    "matPresetId": "hide-scales"
  },
  "torso": {
    "depth": 0.26,
    "material": "hide-scales"
  },
  "spine": [
    {
      "id": "caudal",
      "length": 0.18,
      "radiusX": 0.15,
      "radiusY": 0.13,
      "pitchRestDeg": 62,
      "matPresetId": "hide-scales",
      "bone": "spine-0"
    },
    {
      "id": "dorsal",
      "length": 0.22,
      "radiusX": 0.13,
      "radiusY": 0.12,
      "pitchRestDeg": -10,
      "matPresetId": "hide-scales",
      "bone": "spine-1"
    },
    {
      "id": "cervical",
      "length": 0.19,
      "radiusX": 0.1,
      "radiusY": 0.09,
      "pitchRestDeg": -14,
      "matPresetId": "hide-scales",
      "kind": "neck",
      "bone": "spine-2"
    },
    {
      "id": "skull",
      "length": 0.22,
      "radiusX": 0.11,
      "radiusY": 0.09,
      "pitchRestDeg": 58,
      "matPresetId": "hide-scales",
      "kind": "cranium",
      "bone": "spine-3"
    }
  ],
  "limbs": [
    {
      "id": "ventral-skid",
      "parentSegmentId": "pelvis",
      "symmetry": "bilateral",
      "mountOffset": [
        0.15,
        0.6988,
        0.02
      ],
      "upperLength": 0.32,
      "lowerLength": 0.34,
      "kneeBendDir": [
        0,
        0,
        1
      ],
      "gaitPhaseOffset": 0,
      "stepHeight": 0.09,
      "strideLength": 1,
      "effectorKind": "talon",
      "upperDirection": [
        0.08,
        -0.95,
        0.28
      ],
      "lowerDirection": [
        0.02,
        -0.88,
        -0.45
      ],
      "effectorDirection": [
        0,
        -1,
        0
      ],
      "effectorLength": 0.09,
      "upperRadius": 0.065,
      "lowerRadius": 0.05,
      "knuckleRadius": 0.06,
      "bones": {
        "upper": "skid{Side}Upper",
        "lower": "skid{Side}Lower",
        "effector": "skid{Side}Foot"
      }
    },
    {
      "id": "hood-rib",
      "parentSegmentId": "dorsal",
      "symmetry": "bilateral",
      "mountOffset": [
        0.22,
        -0.02,
        0.08
      ],
      "upperLength": 0.16,
      "lowerLength": 0.14,
      "kneeBendDir": [
        0,
        0,
        -1
      ],
      "gaitPhaseOffset": 0.5,
      "stepHeight": 0.04,
      "strideLength": 0.45,
      "effectorKind": "pincer",
      "role": "arm",
      "upperDirection": [
        0.35,
        -0.85,
        0.35
      ],
      "lowerDirection": [
        0.15,
        -0.82,
        0.5
      ],
      "effectorDirection": [
        0.1,
        -0.78,
        0.6
      ],
      "effectorLength": 0.09,
      "upperRadius": 0.036,
      "lowerRadius": 0.028,
      "knuckleRadius": 0.038,
      "bones": {
        "upper": "rib{Side}Upper",
        "lower": "rib{Side}Lower",
        "effector": "rib{Side}Tip"
      }
    },
    {
      "id": "tail-coil",
      "parentSegmentId": "pelvis",
      "symmetry": "medial",
      "mountOffset": [
        0,
        0.52,
        -0.25
      ],
      "upperLength": 0.36,
      "lowerLength": 0.38,
      "kneeBendDir": [
        0,
        1,
        0
      ],
      "gaitPhaseOffset": 0.25,
      "stepHeight": 0.04,
      "strideLength": 0.35,
      "effectorKind": "talon",
      "upperDirection": [
        0,
        0.1,
        -1
      ],
      "lowerDirection": [
        0,
        -0.12,
        -1
      ],
      "effectorDirection": [
        0,
        -0.28,
        -1
      ],
      "effectorLength": 0.11,
      "upperRadius": 0.072,
      "lowerRadius": 0.052,
      "knuckleRadius": 0.058
    }
  ],
  "armour": [
    {
      "id": "hood-crest",
      "gen": "panel",
      "params": {
        "width": 0.26,
        "depth": 0.36,
        "thickness": 0.026,
        "bevel": 0.01,
        "seam": 0.02,
        "boltsPerSide": 2,
        "boltHead": 0.016
      },
      "material": "hide-plate",
      "mount": "cage.top",
      "at": [
        0,
        -0.02,
        -0.06
      ]
    }
  ],
  "sensoryControls": [
    {
      "id": "pit-eye-left",
      "gen": "knuckle",
      "params": {
        "radius": 0.024,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.2
      },
      "material": "eye-glow",
      "mount": "skull.front",
      "at": [
        0.05,
        0,
        0
      ]
    },
    {
      "id": "pit-eye-right",
      "gen": "knuckle",
      "params": {
        "radius": 0.024,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.2
      },
      "material": "eye-glow",
      "mount": "skull.front",
      "at": [
        -0.05,
        0,
        0
      ]
    }
  ],
  "subjectEffectors": [
    {
      "id": "venom-maw",
      "gen": "chute",
      "params": {
        "length": 0.2,
        "mouthWidth": 0.11,
        "mouthHeight": 0.048,
        "throatWidth": 0.045,
        "wall": 0.012
      },
      "material": "talon-horn",
      "mount": "skull.front",
      "at": [
        0,
        -0.055,
        0.02
      ],
      "rot": [
        90,
        0,
        0
      ]
    }
  ]
};

export const AVIAN_DRONE_GENOME: CreatureGenomeSpec = {
  "id": "avian-drone",
  "archetype": "avian-drone",
  "seed": 42778,
  "skinPaletteId": "mat:hazard-chevron",
  "voiceStemId": "vo-avian-drone",
  "strideFreqHz": 2.4,
  "dutyFactor": 0.52,
  "pelvis": {
    "restHeight": 0.72,
    "radius": [
      0.16,
      0.14,
      0.2
    ],
    "sacrumOffset": [
      0.01,
      0.2,
      0.02
    ],
    "matPresetId": "drone-alloy"
  },
  "torso": {
    "depth": 0.24,
    "material": "drone-alloy"
  },
  "spine": [
    {
      "id": "keel",
      "length": 0.16,
      "radiusX": 0.15,
      "radiusY": 0.13,
      "pitchRestDeg": 58,
      "matPresetId": "drone-alloy",
      "bone": "spine-0"
    },
    {
      "id": "thorax",
      "length": 0.2,
      "radiusX": 0.13,
      "radiusY": 0.12,
      "pitchRestDeg": -8,
      "matPresetId": "drone-alloy",
      "bone": "spine-1"
    },
    {
      "id": "cervical",
      "length": 0.16,
      "radiusX": 0.08,
      "radiusY": 0.08,
      "pitchRestDeg": -12,
      "matPresetId": "drone-alloy",
      "kind": "neck",
      "bone": "spine-2"
    },
    {
      "id": "skull",
      "length": 0.18,
      "radiusX": 0.09,
      "radiusY": 0.08,
      "pitchRestDeg": 54,
      "matPresetId": "drone-alloy",
      "kind": "cranium",
      "bone": "spine-3"
    }
  ],
  "limbs": [
    {
      "id": "talon-leg",
      "parentSegmentId": "pelvis",
      "symmetry": "bilateral",
      "mountOffset": [
        0.14,
        0.6988,
        0.02
      ],
      "upperLength": 0.32,
      "lowerLength": 0.34,
      "kneeBendDir": [
        0,
        0,
        1
      ],
      "gaitPhaseOffset": 0,
      "stepHeight": 0.12,
      "strideLength": 0.95,
      "effectorKind": "talon",
      "upperDirection": [
        0.08,
        -0.95,
        0.28
      ],
      "lowerDirection": [
        0.02,
        -0.88,
        -0.45
      ],
      "effectorDirection": [
        0,
        -1,
        0
      ],
      "effectorLength": 0.09,
      "upperRadius": 0.055,
      "lowerRadius": 0.042,
      "knuckleRadius": 0.052,
      "bones": {
        "upper": "leg{Side}Upper",
        "lower": "leg{Side}Lower",
        "effector": "leg{Side}Foot"
      }
    },
    {
      "id": "wing",
      "parentSegmentId": "thorax",
      "symmetry": "bilateral",
      "mountOffset": [
        0.24,
        -0.02,
        0.06
      ],
      "upperLength": 0.26,
      "lowerLength": 0.28,
      "kneeBendDir": [
        0,
        1,
        -0.4
      ],
      "gaitPhaseOffset": 0.5,
      "stepHeight": 0.08,
      "strideLength": 0.7,
      "effectorKind": "thruster",
      "role": "arm",
      "upperDirection": [
        0.88,
        -0.25,
        -0.15
      ],
      "lowerDirection": [
        0.75,
        -0.55,
        -0.25
      ],
      "effectorDirection": [
        0.65,
        -0.65,
        -0.3
      ],
      "effectorLength": 0.09,
      "upperRadius": 0.04,
      "lowerRadius": 0.032,
      "knuckleRadius": 0.042,
      "bones": {
        "upper": "wing{Side}Upper",
        "lower": "wing{Side}Lower",
        "effector": "wing{Side}Tip"
      }
    },
    {
      "id": "tail-vane",
      "parentSegmentId": "pelvis",
      "symmetry": "medial",
      "mountOffset": [
        0,
        0.56,
        -0.23
      ],
      "upperLength": 0.26,
      "lowerLength": 0.28,
      "kneeBendDir": [
        0,
        1,
        0
      ],
      "gaitPhaseOffset": 0.25,
      "stepHeight": 0.03,
      "strideLength": 0.3,
      "effectorKind": "thruster",
      "upperDirection": [
        0,
        0.12,
        -1
      ],
      "lowerDirection": [
        0,
        -0.1,
        -1
      ],
      "effectorDirection": [
        0,
        -0.25,
        -1
      ],
      "effectorLength": 0.09,
      "upperRadius": 0.058,
      "lowerRadius": 0.044,
      "knuckleRadius": 0.048
    }
  ],
  "armour": [
    {
      "id": "dorsal-cowl",
      "gen": "panel",
      "params": {
        "width": 0.24,
        "depth": 0.32,
        "thickness": 0.026,
        "bevel": 0.01,
        "seam": 0.02,
        "boltsPerSide": 2,
        "boltHead": 0.016
      },
      "material": "drone-plate",
      "mount": "cage.top",
      "at": [
        0,
        -0.02,
        -0.05
      ]
    }
  ],
  "sensoryControls": [
    {
      "id": "optic-left",
      "gen": "knuckle",
      "params": {
        "radius": 0.024,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "eye-glow",
      "mount": "skull.front",
      "at": [
        0.048,
        0,
        0
      ]
    },
    {
      "id": "optic-right",
      "gen": "knuckle",
      "params": {
        "radius": 0.024,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "eye-glow",
      "mount": "skull.front",
      "at": [
        -0.048,
        0,
        0
      ]
    }
  ],
  "subjectEffectors": [
    {
      "id": "beak-lance",
      "gen": "chute",
      "params": {
        "length": 0.18,
        "mouthWidth": 0.09,
        "mouthHeight": 0.042,
        "throatWidth": 0.038,
        "wall": 0.01
      },
      "material": "talon-horn",
      "mount": "skull.front",
      "at": [
        0,
        -0.05,
        0.02
      ],
      "rot": [
        90,
        0,
        0
      ]
    },
    {
      "id": "wingtip-left",
      "gen": "knuckle",
      "params": {
        "radius": 0.028,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "eye-glow",
      "mount": "limb:left-wing"
    },
    {
      "id": "wingtip-right",
      "gen": "knuckle",
      "params": {
        "radius": 0.028,
        "sides": 8,
        "rings": 3,
        "bossFactor": 0.25
      },
      "material": "eye-glow",
      "mount": "limb:right-wing"
    }
  ]
};

export const ROSTER_MONSTER_GENOMES: readonly CreatureGenomeSpec[] = [
  {
    "id": "alien-q",
    "archetype": "theropod",
    "seed": 16641,
    "skinPaletteId": "mat:overgrown-relic",
    "voiceStemId": "vo-spitter",
    "strideFreqHz": 2,
    "dutyFactor": 0.52,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.19,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:overgrown-relic"
    },
    "torso": {
      "depth": 0.29,
      "material": "mat:overgrown-relic"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:overgrown-relic",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:carbon-racer",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:overgrown-relic",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:carbon-racer",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "alien-q-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:carbon-racer",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "alien-q-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "alien-q-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "alien-q-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "alien-q-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "alien-q-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "armabee-q",
    "archetype": "avian-drone",
    "seed": 16642,
    "skinPaletteId": "mat:hazard-chevron",
    "voiceStemId": "vo-swarmer",
    "strideFreqHz": 2.8,
    "dutyFactor": 0.48,
    "pelvis": {
      "restHeight": 0.72,
      "radius": [
        0.16,
        0.14,
        0.2
      ],
      "sacrumOffset": [
        0.01,
        0.2,
        0.02
      ],
      "matPresetId": "mat:hazard-chevron"
    },
    "torso": {
      "depth": 0.24,
      "material": "mat:hazard-chevron"
    },
    "spine": [
      {
        "id": "keel",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 58,
        "matPresetId": "mat:hazard-chevron",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.2,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -8,
        "matPresetId": "mat:carbon-racer",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.16,
        "radiusX": 0.08,
        "radiusY": 0.08,
        "pitchRestDeg": -12,
        "matPresetId": "mat:hazard-chevron",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.18,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 54,
        "matPresetId": "mat:carbon-racer",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "talon-leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.14,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 0.95,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.055,
        "lowerRadius": 0.042,
        "knuckleRadius": 0.052,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "wing",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          -0.02,
          0.06
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          -0.4
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.08,
        "strideLength": 0.7,
        "effectorKind": "thruster",
        "role": "arm",
        "upperDirection": [
          0.88,
          -0.25,
          -0.15
        ],
        "lowerDirection": [
          0.75,
          -0.55,
          -0.25
        ],
        "effectorDirection": [
          0.65,
          -0.65,
          -0.3
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "wing{Side}Upper",
          "lower": "wing{Side}Lower",
          "effector": "wing{Side}Tip"
        }
      },
      {
        "id": "tail-vane",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.56,
          -0.23
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.3,
        "effectorKind": "thruster",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.1,
          -1
        ],
        "effectorDirection": [
          0,
          -0.25,
          -1
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.058,
        "lowerRadius": 0.044,
        "knuckleRadius": 0.048
      }
    ],
    "armour": [
      {
        "id": "armabee-q-dorsal-cowl",
        "gen": "panel",
        "params": {
          "width": 0.24,
          "depth": 0.32,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:carbon-racer",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.05
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "armabee-q-optic-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.048,
          0,
          0
        ]
      },
      {
        "id": "armabee-q-optic-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.048,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "armabee-q-beak-lance",
        "gen": "chute",
        "params": {
          "length": 0.18,
          "mouthWidth": 0.09,
          "mouthHeight": 0.042,
          "throatWidth": 0.038,
          "wall": 0.01
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "armabee-q-wingtip-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-wing"
      },
      {
        "id": "armabee-q-wingtip-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-wing"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "beas-bl",
    "archetype": "theropod",
    "seed": 16643,
    "skinPaletteId": "mat:furnace",
    "voiceStemId": "vo-theropod",
    "strideFreqHz": 1.85,
    "dutyFactor": 0.54,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.195,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:furnace"
    },
    "torso": {
      "depth": 0.3,
      "material": "mat:furnace"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:furnace",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:rust-bucket",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:furnace",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:rust-bucket",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "beas-bl-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:rust-bucket",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "beas-bl-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "beas-bl-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "beas-bl-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "beas-bl-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "beas-bl-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "chicken-q",
    "archetype": "avian-drone",
    "seed": 16644,
    "skinPaletteId": "mat:field-worn-hazard",
    "voiceStemId": "vo-avian-drone",
    "strideFreqHz": 3,
    "dutyFactor": 0.5,
    "pelvis": {
      "restHeight": 0.72,
      "radius": [
        0.152,
        0.14,
        0.2
      ],
      "sacrumOffset": [
        0.01,
        0.2,
        0.02
      ],
      "matPresetId": "mat:field-worn-hazard"
    },
    "torso": {
      "depth": 0.23,
      "material": "mat:field-worn-hazard"
    },
    "spine": [
      {
        "id": "keel",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 58,
        "matPresetId": "mat:field-worn-hazard",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.2,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -8,
        "matPresetId": "mat:lab-fresh",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.16,
        "radiusX": 0.08,
        "radiusY": 0.08,
        "pitchRestDeg": -12,
        "matPresetId": "mat:field-worn-hazard",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.18,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 54,
        "matPresetId": "mat:lab-fresh",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "talon-leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.14,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 0.95,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.055,
        "lowerRadius": 0.042,
        "knuckleRadius": 0.052,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "wing",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          -0.02,
          0.06
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          -0.4
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.08,
        "strideLength": 0.7,
        "effectorKind": "thruster",
        "role": "arm",
        "upperDirection": [
          0.88,
          -0.25,
          -0.15
        ],
        "lowerDirection": [
          0.75,
          -0.55,
          -0.25
        ],
        "effectorDirection": [
          0.65,
          -0.65,
          -0.3
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "wing{Side}Upper",
          "lower": "wing{Side}Lower",
          "effector": "wing{Side}Tip"
        }
      },
      {
        "id": "tail-vane",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.56,
          -0.23
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.3,
        "effectorKind": "thruster",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.1,
          -1
        ],
        "effectorDirection": [
          0,
          -0.25,
          -1
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.058,
        "lowerRadius": 0.044,
        "knuckleRadius": 0.048
      }
    ],
    "armour": [
      {
        "id": "chicken-q-dorsal-cowl",
        "gen": "panel",
        "params": {
          "width": 0.24,
          "depth": 0.32,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:lab-fresh",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.05
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "chicken-q-optic-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.048,
          0,
          0
        ]
      },
      {
        "id": "chicken-q-optic-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.048,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "chicken-q-beak-lance",
        "gen": "chute",
        "params": {
          "length": 0.18,
          "mouthWidth": 0.09,
          "mouthHeight": 0.042,
          "throatWidth": 0.038,
          "wall": 0.01
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "chicken-q-wingtip-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-wing"
      },
      {
        "id": "chicken-q-wingtip-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-wing"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "clnk-bl",
    "archetype": "theropod",
    "seed": 16645,
    "skinPaletteId": "mat:slatted-grille-steel",
    "voiceStemId": "vo-sapper",
    "strideFreqHz": 2.1,
    "dutyFactor": 0.5,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.19,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:slatted-grille-steel"
    },
    "torso": {
      "depth": 0.285,
      "material": "mat:slatted-grille-steel"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:slatted-grille-steel",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:workshop-steel",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:slatted-grille-steel",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:workshop-steel",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "clnk-bl-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:workshop-steel",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "clnk-bl-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "clnk-bl-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "clnk-bl-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "clnk-bl-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "clnk-bl-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "dog-lq",
    "archetype": "quadruped",
    "seed": 16646,
    "skinPaletteId": "mat:rust-bucket",
    "voiceStemId": "vo-quadruped",
    "strideFreqHz": 2.4,
    "dutyFactor": 0.56,
    "pelvis": {
      "restHeight": 0.74,
      "radius": [
        0.2,
        0.17,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.25,
        0.02
      ],
      "matPresetId": "mat:rust-bucket"
    },
    "torso": {
      "depth": 0.3,
      "material": "mat:rust-bucket"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.3,
        "radiusX": 0.16,
        "radiusY": 0.15,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:rust-bucket",
        "bone": "spine-0"
      },
      {
        "id": "thoracic",
        "length": 0.3,
        "radiusX": 0.17,
        "radiusY": 0.16,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:oily-engine",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.35,
          1
        ],
        "matPresetId": "mat:rust-bucket",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:oily-engine",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.7,
          -0.18
        ],
        "upperLength": 0.32,
        "lowerLength": 0.32,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          -0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.075,
        "lowerRadius": 0.055,
        "knuckleRadius": 0.07,
        "bones": {
          "upper": "hind{Side}Upper",
          "lower": "hind{Side}Lower",
          "effector": "hind{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thoracic",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          -0.35885,
          0.04149
        ],
        "upperLength": 0.3,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          -0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.07,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.065,
        "bones": {
          "upper": "fore{Side}Upper",
          "lower": "fore{Side}Lower",
          "effector": "fore{Side}Foot"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.78,
          -0.34
        ],
        "upperLength": 0.28,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.15,
          -1
        ],
        "lowerDirection": [
          0,
          -0.2,
          -1
        ],
        "effectorDirection": [
          0,
          -0.35,
          -1
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.06,
        "lowerRadius": 0.04,
        "knuckleRadius": 0.05
      }
    ],
    "armour": [
      {
        "id": "dog-lq-saddle",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.44,
          "thickness": 0.028,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:oily-engine",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "dog-lq-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "dog-lq-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "dog-lq-muzzle",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "dog-q",
    "archetype": "quadruped",
    "seed": 16647,
    "skinPaletteId": "mat:field-worn-hazard",
    "voiceStemId": "vo-charger",
    "strideFreqHz": 2.5,
    "dutyFactor": 0.55,
    "pelvis": {
      "restHeight": 0.74,
      "radius": [
        0.205,
        0.17,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.25,
        0.02
      ],
      "matPresetId": "mat:field-worn-hazard"
    },
    "torso": {
      "depth": 0.29,
      "material": "mat:field-worn-hazard"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.3,
        "radiusX": 0.16,
        "radiusY": 0.15,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:field-worn-hazard",
        "bone": "spine-0"
      },
      {
        "id": "thoracic",
        "length": 0.3,
        "radiusX": 0.17,
        "radiusY": 0.16,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:workshop-steel",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.35,
          1
        ],
        "matPresetId": "mat:field-worn-hazard",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:workshop-steel",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.7,
          -0.18
        ],
        "upperLength": 0.32,
        "lowerLength": 0.32,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          -0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.075,
        "lowerRadius": 0.055,
        "knuckleRadius": 0.07,
        "bones": {
          "upper": "hind{Side}Upper",
          "lower": "hind{Side}Lower",
          "effector": "hind{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thoracic",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          -0.35885,
          0.04149
        ],
        "upperLength": 0.3,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          -0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.07,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.065,
        "bones": {
          "upper": "fore{Side}Upper",
          "lower": "fore{Side}Lower",
          "effector": "fore{Side}Foot"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.78,
          -0.34
        ],
        "upperLength": 0.28,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.15,
          -1
        ],
        "lowerDirection": [
          0,
          -0.2,
          -1
        ],
        "effectorDirection": [
          0,
          -0.35,
          -1
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.06,
        "lowerRadius": 0.04,
        "knuckleRadius": 0.05
      }
    ],
    "armour": [
      {
        "id": "dog-q-saddle",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.44,
          "thickness": 0.028,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:workshop-steel",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "dog-q-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "dog-q-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "dog-q-muzzle",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "enforcer-lq",
    "archetype": "biped-astro",
    "seed": 16648,
    "skinPaletteId": "mat:workshop-steel",
    "voiceStemId": "vo-spitter",
    "strideFreqHz": 1.6,
    "dutyFactor": 0.62,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.155,
        0.075,
        0.1
      ],
      "matPresetId": "mat:workshop-steel",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.215,
      "material": "mat:workshop-steel"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:workshop-steel",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:hazard-chevron",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:workshop-steel",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:hazard-chevron",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:workshop-steel",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "enforcer-lq-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:hazard-chevron",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "enforcer-lq-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:workshop-steel",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "enforcer-lq-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:hazard-chevron",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "enforcer-lq-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:workshop-steel",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "enforcer-lq-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "suit-gold",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "enforcer-lq-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "suit-gold",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "enforcer-lq-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "suit-gold",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "enforcer-lq-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "enforcer-lq-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "enforcer-lq-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:hazard-chevron",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "enforcer-lq-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:workshop-steel",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "fatt-fd",
    "archetype": "theropod",
    "seed": 16649,
    "skinPaletteId": "mat:oily-engine",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.4,
    "dutyFactor": 0.64,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.194,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:oily-engine"
    },
    "torso": {
      "depth": 0.292,
      "material": "mat:oily-engine"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:oily-engine",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:rust-bucket",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:oily-engine",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:rust-bucket",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "fatt-fd-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:rust-bucket",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "fatt-fd-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "fatt-fd-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "fatt-fd-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "fatt-fd-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "fatt-fd-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "fiend-lq",
    "archetype": "theropod",
    "seed": 16650,
    "skinPaletteId": "mat:rust-bucket",
    "voiceStemId": "vo-charger",
    "strideFreqHz": 2.3,
    "dutyFactor": 0.48,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.194,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:rust-bucket"
    },
    "torso": {
      "depth": 0.29,
      "material": "mat:rust-bucket"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:rust-bucket",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:furnace",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:rust-bucket",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:furnace",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "fiend-lq-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:furnace",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "fiend-lq-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "fiend-lq-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "fiend-lq-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "fiend-lq-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "fiend-lq-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "flesh-worm",
    "archetype": "quadruped",
    "seed": 16651,
    "skinPaletteId": "mat:furnace",
    "voiceStemId": "vo-charger",
    "strideFreqHz": 2.1,
    "dutyFactor": 0.6,
    "pelvis": {
      "restHeight": 0.74,
      "radius": [
        0.206,
        0.17,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.25,
        0.02
      ],
      "matPresetId": "mat:furnace"
    },
    "torso": {
      "depth": 0.31,
      "material": "mat:furnace"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.3,
        "radiusX": 0.16,
        "radiusY": 0.15,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:furnace",
        "bone": "spine-0"
      },
      {
        "id": "thoracic",
        "length": 0.3,
        "radiusX": 0.17,
        "radiusY": 0.16,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:old-copper",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.35,
          1
        ],
        "matPresetId": "mat:furnace",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:old-copper",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.7,
          -0.18
        ],
        "upperLength": 0.32,
        "lowerLength": 0.32,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          -0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.075,
        "lowerRadius": 0.055,
        "knuckleRadius": 0.07,
        "bones": {
          "upper": "hind{Side}Upper",
          "lower": "hind{Side}Lower",
          "effector": "hind{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thoracic",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          -0.35885,
          0.04149
        ],
        "upperLength": 0.3,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          -0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.07,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.065,
        "bones": {
          "upper": "fore{Side}Upper",
          "lower": "fore{Side}Lower",
          "effector": "fore{Side}Foot"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.78,
          -0.34
        ],
        "upperLength": 0.28,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.15,
          -1
        ],
        "lowerDirection": [
          0,
          -0.2,
          -1
        ],
        "effectorDirection": [
          0,
          -0.35,
          -1
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.06,
        "lowerRadius": 0.04,
        "knuckleRadius": 0.05
      }
    ],
    "armour": [
      {
        "id": "flesh-worm-saddle",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.44,
          "thickness": 0.028,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:old-copper",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "flesh-worm-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "flesh-worm-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "flesh-worm-muzzle",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "floater",
    "archetype": "avian-drone",
    "seed": 16652,
    "skinPaletteId": "mat:furnace",
    "voiceStemId": "vo-flyer",
    "strideFreqHz": 1.8,
    "dutyFactor": 0.55,
    "pelvis": {
      "restHeight": 0.72,
      "radius": [
        0.166,
        0.14,
        0.2
      ],
      "sacrumOffset": [
        0.01,
        0.2,
        0.02
      ],
      "matPresetId": "mat:furnace"
    },
    "torso": {
      "depth": 0.25,
      "material": "mat:furnace"
    },
    "spine": [
      {
        "id": "keel",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 58,
        "matPresetId": "mat:furnace",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.2,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -8,
        "matPresetId": "mat:old-copper",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.16,
        "radiusX": 0.08,
        "radiusY": 0.08,
        "pitchRestDeg": -12,
        "matPresetId": "mat:furnace",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.18,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 54,
        "matPresetId": "mat:old-copper",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "talon-leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.14,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 0.95,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.055,
        "lowerRadius": 0.042,
        "knuckleRadius": 0.052,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "wing",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          -0.02,
          0.06
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          -0.4
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.08,
        "strideLength": 0.7,
        "effectorKind": "thruster",
        "role": "arm",
        "upperDirection": [
          0.88,
          -0.25,
          -0.15
        ],
        "lowerDirection": [
          0.75,
          -0.55,
          -0.25
        ],
        "effectorDirection": [
          0.65,
          -0.65,
          -0.3
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "wing{Side}Upper",
          "lower": "wing{Side}Lower",
          "effector": "wing{Side}Tip"
        }
      },
      {
        "id": "tail-vane",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.56,
          -0.23
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.3,
        "effectorKind": "thruster",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.1,
          -1
        ],
        "effectorDirection": [
          0,
          -0.25,
          -1
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.058,
        "lowerRadius": 0.044,
        "knuckleRadius": 0.048
      }
    ],
    "armour": [
      {
        "id": "floater-dorsal-cowl",
        "gen": "panel",
        "params": {
          "width": 0.24,
          "depth": 0.32,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:old-copper",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.05
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "floater-optic-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.048,
          0,
          0
        ]
      },
      {
        "id": "floater-optic-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.048,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "floater-beak-lance",
        "gen": "chute",
        "params": {
          "length": 0.18,
          "mouthWidth": 0.09,
          "mouthHeight": 0.042,
          "throatWidth": 0.038,
          "wall": 0.01
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "floater-wingtip-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-wing"
      },
      {
        "id": "floater-wingtip-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-wing"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "ghost-skull-q",
    "archetype": "avian-drone",
    "seed": 16653,
    "skinPaletteId": "mat:moon-dusted",
    "voiceStemId": "vo-flyer",
    "strideFreqHz": 2.2,
    "dutyFactor": 0.5,
    "pelvis": {
      "restHeight": 0.72,
      "radius": [
        0.155,
        0.14,
        0.2
      ],
      "sacrumOffset": [
        0.01,
        0.2,
        0.02
      ],
      "matPresetId": "mat:moon-dusted"
    },
    "torso": {
      "depth": 0.24,
      "material": "mat:moon-dusted"
    },
    "spine": [
      {
        "id": "keel",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 58,
        "matPresetId": "mat:moon-dusted",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.2,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -8,
        "matPresetId": "mat:frozen-rig",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.16,
        "radiusX": 0.08,
        "radiusY": 0.08,
        "pitchRestDeg": -12,
        "matPresetId": "mat:moon-dusted",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.18,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 54,
        "matPresetId": "mat:frozen-rig",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "talon-leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.14,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 0.95,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.055,
        "lowerRadius": 0.042,
        "knuckleRadius": 0.052,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "wing",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          -0.02,
          0.06
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          -0.4
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.08,
        "strideLength": 0.7,
        "effectorKind": "thruster",
        "role": "arm",
        "upperDirection": [
          0.88,
          -0.25,
          -0.15
        ],
        "lowerDirection": [
          0.75,
          -0.55,
          -0.25
        ],
        "effectorDirection": [
          0.65,
          -0.65,
          -0.3
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "wing{Side}Upper",
          "lower": "wing{Side}Lower",
          "effector": "wing{Side}Tip"
        }
      },
      {
        "id": "tail-vane",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.56,
          -0.23
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.3,
        "effectorKind": "thruster",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.1,
          -1
        ],
        "effectorDirection": [
          0,
          -0.25,
          -1
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.058,
        "lowerRadius": 0.044,
        "knuckleRadius": 0.048
      }
    ],
    "armour": [
      {
        "id": "ghost-skull-q-dorsal-cowl",
        "gen": "panel",
        "params": {
          "width": 0.24,
          "depth": 0.32,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:frozen-rig",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.05
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "ghost-skull-q-optic-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.048,
          0,
          0
        ]
      },
      {
        "id": "ghost-skull-q-optic-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.048,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "ghost-skull-q-beak-lance",
        "gen": "chute",
        "params": {
          "length": 0.18,
          "mouthWidth": 0.09,
          "mouthHeight": 0.042,
          "throatWidth": 0.038,
          "wall": 0.01
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "ghost-skull-q-wingtip-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-wing"
      },
      {
        "id": "ghost-skull-q-wingtip-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-wing"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "glub-q",
    "archetype": "hexapod",
    "seed": 16654,
    "skinPaletteId": "mat:frozen-rig",
    "voiceStemId": "vo-sapper",
    "strideFreqHz": 2.5,
    "dutyFactor": 0.68,
    "pelvis": {
      "restHeight": 0.62,
      "radius": [
        0.19,
        0.14,
        0.26
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:frozen-rig"
    },
    "torso": {
      "depth": 0.26,
      "material": "mat:frozen-rig"
    },
    "spine": [
      {
        "id": "prothorax",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:frozen-rig",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.26,
        "radiusX": 0.17,
        "radiusY": 0.14,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:lab-fresh",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.12,
        "radiusX": 0.07,
        "radiusY": 0.07,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.3,
          1
        ],
        "matPresetId": "mat:frozen-rig",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.16,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:lab-fresh",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "abdomen",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.5,
          -0.24
        ],
        "upperLength": 0.24,
        "lowerLength": 0.26,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.02,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.08,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.06
      },
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.17,
          0.524,
          -0.2
        ],
        "upperLength": 0.3,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0.3,
          0.2,
          0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.85,
          -0.3,
          -0.2
        ],
        "lowerDirection": [
          0.35,
          -0.85,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legA{Side}Upper",
          "lower": "legA{Side}Lower",
          "effector": "legA{Side}Foot"
        }
      },
      {
        "id": "midleg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.544,
          0.04
        ],
        "upperLength": 0.3,
        "lowerLength": 0.4,
        "kneeBendDir": [
          1,
          0.2,
          0
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.9,
          -0.3,
          0
        ],
        "lowerDirection": [
          0.35,
          -0.87,
          0.1
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legB{Side}Upper",
          "lower": "legB{Side}Lower",
          "effector": "legB{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.25,
          0.02,
          0.26
        ],
        "upperLength": 0.28,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0.3,
          0.2,
          -0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "role": "arm",
        "upperDirection": [
          0.85,
          -0.3,
          0.25
        ],
        "lowerDirection": [
          0.3,
          -0.88,
          -0.15
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "legC{Side}Upper",
          "lower": "legC{Side}Lower",
          "effector": "legC{Side}Foot"
        }
      }
    ],
    "armour": [
      {
        "id": "glub-q-carapace",
        "gen": "panel",
        "params": {
          "width": 0.28,
          "depth": 0.34,
          "thickness": 0.03,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.018
        },
        "material": "mat:lab-fresh",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.08
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "glub-q-eye-cluster-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.06,
          0,
          0
        ]
      },
      {
        "id": "glub-q-eye-cluster-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.06,
          0,
          0
        ]
      },
      {
        "id": "glub-q-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.007,
          "length": 0.16,
          "sides": 6,
          "flangeWidth": 0.006,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "skull.top",
        "at": [
          0.03,
          0.02,
          0.05
        ],
        "rot": [
          -35,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "glub-q-mandible-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-foreleg"
      },
      {
        "id": "glub-q-mandible-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-foreleg"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "hell-knight",
    "archetype": "biped-astro",
    "seed": 16655,
    "skinPaletteId": "mat:furnace",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.45,
    "dutyFactor": 0.64,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.161,
        0.075,
        0.1
      ],
      "matPresetId": "mat:furnace",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.22,
      "material": "mat:furnace"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:furnace",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:old-copper",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:furnace",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:old-copper",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:furnace",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "hell-knight-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:old-copper",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "hell-knight-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:furnace",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "hell-knight-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:old-copper",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "hell-knight-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:furnace",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "hell-knight-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "eye-glow",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "hell-knight-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "eye-glow",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "hell-knight-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "hell-knight-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "hell-knight-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "hell-knight-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:old-copper",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "hell-knight-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:furnace",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "hell-lord",
    "archetype": "biped-astro",
    "seed": 16656,
    "skinPaletteId": "mat:rust-bucket",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.35,
    "dutyFactor": 0.66,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.163,
        0.075,
        0.1
      ],
      "matPresetId": "mat:rust-bucket",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.222,
      "material": "mat:rust-bucket"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:rust-bucket",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:furnace",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:rust-bucket",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:furnace",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:rust-bucket",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "hell-lord-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:furnace",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "hell-lord-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:rust-bucket",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "hell-lord-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:furnace",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "hell-lord-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:rust-bucket",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "hell-lord-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "eye-glow",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "hell-lord-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "eye-glow",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "hell-lord-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "hell-lord-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "hell-lord-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "hell-lord-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:furnace",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "hell-lord-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:rust-bucket",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "knight-lq",
    "archetype": "biped-astro",
    "seed": 16657,
    "skinPaletteId": "mat:brushed-lab-steel",
    "voiceStemId": "vo-charger",
    "strideFreqHz": 1.65,
    "dutyFactor": 0.6,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.155,
        0.075,
        0.1
      ],
      "matPresetId": "mat:brushed-lab-steel",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.215,
      "material": "mat:brushed-lab-steel"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:brushed-lab-steel",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:workshop-steel",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:brushed-lab-steel",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:workshop-steel",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:brushed-lab-steel",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "knight-lq-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:workshop-steel",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "knight-lq-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:brushed-lab-steel",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "knight-lq-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:workshop-steel",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "knight-lq-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:brushed-lab-steel",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "knight-lq-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "suit-gold",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "knight-lq-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "suit-gold",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "knight-lq-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "suit-gold",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "knight-lq-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "knight-lq-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "knight-lq-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:workshop-steel",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "knight-lq-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:brushed-lab-steel",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "mntr-bl",
    "archetype": "theropod",
    "seed": 16658,
    "skinPaletteId": "mat:old-copper",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.5,
    "dutyFactor": 0.58,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.196,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:old-copper"
    },
    "torso": {
      "depth": 0.295,
      "material": "mat:old-copper"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:old-copper",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:furnace",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:old-copper",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:furnace",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "mntr-bl-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:furnace",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "mntr-bl-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "mntr-bl-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "mntr-bl-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "mntr-bl-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "mntr-bl-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "mumm-bl",
    "archetype": "biped-astro",
    "seed": 16659,
    "skinPaletteId": "mat:crushed-ore-bed",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.4,
    "dutyFactor": 0.65,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.155,
        0.075,
        0.1
      ],
      "matPresetId": "mat:crushed-ore-bed",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.21,
      "material": "mat:crushed-ore-bed"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:crushed-ore-bed",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:moon-dusted",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:crushed-ore-bed",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:moon-dusted",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:crushed-ore-bed",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "mumm-bl-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:moon-dusted",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "mumm-bl-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:crushed-ore-bed",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "mumm-bl-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:moon-dusted",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "mumm-bl-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:crushed-ore-bed",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "mumm-bl-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "eye-glow",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "mumm-bl-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "eye-glow",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "mumm-bl-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "mumm-bl-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "mumm-bl-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "mumm-bl-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:moon-dusted",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "mumm-bl-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:crushed-ore-bed",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "mushnub-q",
    "archetype": "hexapod",
    "seed": 16660,
    "skinPaletteId": "mat:overgrown-relic",
    "voiceStemId": "vo-swarmer",
    "strideFreqHz": 2.7,
    "dutyFactor": 0.7,
    "pelvis": {
      "restHeight": 0.62,
      "radius": [
        0.194,
        0.14,
        0.26
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:overgrown-relic"
    },
    "torso": {
      "depth": 0.268,
      "material": "mat:overgrown-relic"
    },
    "spine": [
      {
        "id": "prothorax",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:overgrown-relic",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.26,
        "radiusX": 0.17,
        "radiusY": 0.14,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:field-worn-hazard",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.12,
        "radiusX": 0.07,
        "radiusY": 0.07,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.3,
          1
        ],
        "matPresetId": "mat:overgrown-relic",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.16,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:field-worn-hazard",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "abdomen",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.5,
          -0.24
        ],
        "upperLength": 0.24,
        "lowerLength": 0.26,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.02,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.08,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.06
      },
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.17,
          0.524,
          -0.2
        ],
        "upperLength": 0.3,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0.3,
          0.2,
          0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.85,
          -0.3,
          -0.2
        ],
        "lowerDirection": [
          0.35,
          -0.85,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legA{Side}Upper",
          "lower": "legA{Side}Lower",
          "effector": "legA{Side}Foot"
        }
      },
      {
        "id": "midleg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.544,
          0.04
        ],
        "upperLength": 0.3,
        "lowerLength": 0.4,
        "kneeBendDir": [
          1,
          0.2,
          0
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.9,
          -0.3,
          0
        ],
        "lowerDirection": [
          0.35,
          -0.87,
          0.1
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legB{Side}Upper",
          "lower": "legB{Side}Lower",
          "effector": "legB{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.25,
          0.02,
          0.26
        ],
        "upperLength": 0.28,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0.3,
          0.2,
          -0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "role": "arm",
        "upperDirection": [
          0.85,
          -0.3,
          0.25
        ],
        "lowerDirection": [
          0.3,
          -0.88,
          -0.15
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "legC{Side}Upper",
          "lower": "legC{Side}Lower",
          "effector": "legC{Side}Foot"
        }
      }
    ],
    "armour": [
      {
        "id": "mushnub-q-carapace",
        "gen": "panel",
        "params": {
          "width": 0.28,
          "depth": 0.34,
          "thickness": 0.03,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.018
        },
        "material": "mat:field-worn-hazard",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.08
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "mushnub-q-eye-cluster-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.06,
          0,
          0
        ]
      },
      {
        "id": "mushnub-q-eye-cluster-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.06,
          0,
          0
        ]
      },
      {
        "id": "mushnub-q-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.007,
          "length": 0.16,
          "sides": 6,
          "flangeWidth": 0.006,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "skull.top",
        "at": [
          0.03,
          0.02,
          0.05
        ],
        "rot": [
          -35,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "mushnub-q-mandible-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-foreleg"
      },
      {
        "id": "mushnub-q-mandible-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-foreleg"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "ogre-lq",
    "archetype": "biped-astro",
    "seed": 16661,
    "skinPaletteId": "mat:oily-engine",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.5,
    "dutyFactor": 0.63,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.161,
        0.075,
        0.1
      ],
      "matPresetId": "mat:oily-engine",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.22,
      "material": "mat:oily-engine"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:oily-engine",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:rust-bucket",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:oily-engine",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:rust-bucket",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:oily-engine",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "ogre-lq-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:rust-bucket",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "ogre-lq-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:oily-engine",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "ogre-lq-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:rust-bucket",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "ogre-lq-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:oily-engine",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "ogre-lq-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "suit-gold",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "ogre-lq-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "suit-gold",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "ogre-lq-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "suit-gold",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "ogre-lq-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "ogre-lq-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "ogre-lq-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:rust-bucket",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "ogre-lq-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:oily-engine",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "orc-q",
    "archetype": "biped-astro",
    "seed": 16662,
    "skinPaletteId": "mat:overgrown-relic",
    "voiceStemId": "vo-charger",
    "strideFreqHz": 1.7,
    "dutyFactor": 0.6,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.159,
        0.075,
        0.1
      ],
      "matPresetId": "mat:overgrown-relic",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.218,
      "material": "mat:overgrown-relic"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:overgrown-relic",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:rust-bucket",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:overgrown-relic",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:rust-bucket",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:overgrown-relic",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "orc-q-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:rust-bucket",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "orc-q-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:overgrown-relic",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "orc-q-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:rust-bucket",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "orc-q-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:overgrown-relic",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "orc-q-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "eye-glow",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "orc-q-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "eye-glow",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "orc-q-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "orc-q-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "orc-q-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "orc-q-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:rust-bucket",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "orc-q-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:overgrown-relic",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "pain-floater",
    "archetype": "avian-drone",
    "seed": 16663,
    "skinPaletteId": "mat:rust-bucket",
    "voiceStemId": "vo-flyer",
    "strideFreqHz": 1.75,
    "dutyFactor": 0.56,
    "pelvis": {
      "restHeight": 0.72,
      "radius": [
        0.166,
        0.14,
        0.2
      ],
      "sacrumOffset": [
        0.01,
        0.2,
        0.02
      ],
      "matPresetId": "mat:rust-bucket"
    },
    "torso": {
      "depth": 0.25,
      "material": "mat:rust-bucket"
    },
    "spine": [
      {
        "id": "keel",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 58,
        "matPresetId": "mat:rust-bucket",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.2,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -8,
        "matPresetId": "mat:furnace",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.16,
        "radiusX": 0.08,
        "radiusY": 0.08,
        "pitchRestDeg": -12,
        "matPresetId": "mat:rust-bucket",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.18,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 54,
        "matPresetId": "mat:furnace",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "talon-leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.14,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 0.95,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.055,
        "lowerRadius": 0.042,
        "knuckleRadius": 0.052,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "wing",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          -0.02,
          0.06
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          -0.4
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.08,
        "strideLength": 0.7,
        "effectorKind": "thruster",
        "role": "arm",
        "upperDirection": [
          0.88,
          -0.25,
          -0.15
        ],
        "lowerDirection": [
          0.75,
          -0.55,
          -0.25
        ],
        "effectorDirection": [
          0.65,
          -0.65,
          -0.3
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "wing{Side}Upper",
          "lower": "wing{Side}Lower",
          "effector": "wing{Side}Tip"
        }
      },
      {
        "id": "tail-vane",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.56,
          -0.23
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.3,
        "effectorKind": "thruster",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.1,
          -1
        ],
        "effectorDirection": [
          0,
          -0.25,
          -1
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.058,
        "lowerRadius": 0.044,
        "knuckleRadius": 0.048
      }
    ],
    "armour": [
      {
        "id": "pain-floater-dorsal-cowl",
        "gen": "panel",
        "params": {
          "width": 0.24,
          "depth": 0.32,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:furnace",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.05
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "pain-floater-optic-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.048,
          0,
          0
        ]
      },
      {
        "id": "pain-floater-optic-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.048,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "pain-floater-beak-lance",
        "gen": "chute",
        "params": {
          "length": 0.18,
          "mouthWidth": 0.09,
          "mouthHeight": 0.042,
          "throatWidth": 0.038,
          "wall": 0.01
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "pain-floater-wingtip-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-wing"
      },
      {
        "id": "pain-floater-wingtip-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-wing"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "pink-blob-q",
    "archetype": "quadruped",
    "seed": 16664,
    "skinPaletteId": "mat:lab-fresh",
    "voiceStemId": "vo-sapper",
    "strideFreqHz": 2,
    "dutyFactor": 0.62,
    "pelvis": {
      "restHeight": 0.74,
      "radius": [
        0.204,
        0.17,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.25,
        0.02
      ],
      "matPresetId": "mat:lab-fresh"
    },
    "torso": {
      "depth": 0.308,
      "material": "mat:lab-fresh"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.3,
        "radiusX": 0.16,
        "radiusY": 0.15,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:lab-fresh",
        "bone": "spine-0"
      },
      {
        "id": "thoracic",
        "length": 0.3,
        "radiusX": 0.17,
        "radiusY": 0.16,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:frozen-rig",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.35,
          1
        ],
        "matPresetId": "mat:lab-fresh",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:frozen-rig",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.7,
          -0.18
        ],
        "upperLength": 0.32,
        "lowerLength": 0.32,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          -0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.075,
        "lowerRadius": 0.055,
        "knuckleRadius": 0.07,
        "bones": {
          "upper": "hind{Side}Upper",
          "lower": "hind{Side}Lower",
          "effector": "hind{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thoracic",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          -0.35885,
          0.04149
        ],
        "upperLength": 0.3,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          -0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.07,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.065,
        "bones": {
          "upper": "fore{Side}Upper",
          "lower": "fore{Side}Lower",
          "effector": "fore{Side}Foot"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.78,
          -0.34
        ],
        "upperLength": 0.28,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.15,
          -1
        ],
        "lowerDirection": [
          0,
          -0.2,
          -1
        ],
        "effectorDirection": [
          0,
          -0.35,
          -1
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.06,
        "lowerRadius": 0.04,
        "knuckleRadius": 0.05
      }
    ],
    "armour": [
      {
        "id": "pink-blob-q-saddle",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.44,
          "thickness": 0.028,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:frozen-rig",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "pink-blob-q-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "pink-blob-q-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "pink-blob-q-muzzle",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "serpentipede",
    "archetype": "hexapod",
    "seed": 16665,
    "skinPaletteId": "mat:field-worn-hazard",
    "voiceStemId": "vo-hexapod",
    "strideFreqHz": 2.6,
    "dutyFactor": 0.68,
    "pelvis": {
      "restHeight": 0.62,
      "radius": [
        0.19,
        0.14,
        0.26
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:field-worn-hazard"
    },
    "torso": {
      "depth": 0.26,
      "material": "mat:field-worn-hazard"
    },
    "spine": [
      {
        "id": "prothorax",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:field-worn-hazard",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.26,
        "radiusX": 0.17,
        "radiusY": 0.14,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:overgrown-relic",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.12,
        "radiusX": 0.07,
        "radiusY": 0.07,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.3,
          1
        ],
        "matPresetId": "mat:field-worn-hazard",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.16,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:overgrown-relic",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "abdomen",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.5,
          -0.24
        ],
        "upperLength": 0.24,
        "lowerLength": 0.26,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.02,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.08,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.06
      },
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.17,
          0.524,
          -0.2
        ],
        "upperLength": 0.3,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0.3,
          0.2,
          0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.85,
          -0.3,
          -0.2
        ],
        "lowerDirection": [
          0.35,
          -0.85,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legA{Side}Upper",
          "lower": "legA{Side}Lower",
          "effector": "legA{Side}Foot"
        }
      },
      {
        "id": "midleg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.544,
          0.04
        ],
        "upperLength": 0.3,
        "lowerLength": 0.4,
        "kneeBendDir": [
          1,
          0.2,
          0
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.9,
          -0.3,
          0
        ],
        "lowerDirection": [
          0.35,
          -0.87,
          0.1
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legB{Side}Upper",
          "lower": "legB{Side}Lower",
          "effector": "legB{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.25,
          0.02,
          0.26
        ],
        "upperLength": 0.28,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0.3,
          0.2,
          -0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "role": "arm",
        "upperDirection": [
          0.85,
          -0.3,
          0.25
        ],
        "lowerDirection": [
          0.3,
          -0.88,
          -0.15
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "legC{Side}Upper",
          "lower": "legC{Side}Lower",
          "effector": "legC{Side}Foot"
        }
      }
    ],
    "armour": [
      {
        "id": "serpentipede-carapace",
        "gen": "panel",
        "params": {
          "width": 0.28,
          "depth": 0.34,
          "thickness": 0.03,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.018
        },
        "material": "mat:overgrown-relic",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.08
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "serpentipede-eye-cluster-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.06,
          0,
          0
        ]
      },
      {
        "id": "serpentipede-eye-cluster-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.06,
          0,
          0
        ]
      },
      {
        "id": "serpentipede-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.007,
          "length": 0.16,
          "sides": 6,
          "flangeWidth": 0.006,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "skull.top",
        "at": [
          0.03,
          0.02,
          0.05
        ],
        "rot": [
          -35,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "serpentipede-mandible-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-foreleg"
      },
      {
        "id": "serpentipede-mandible-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.03,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-foreleg"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "shalrath-lq",
    "archetype": "arachnid",
    "seed": 16666,
    "skinPaletteId": "mat:old-copper",
    "voiceStemId": "vo-arachnid",
    "strideFreqHz": 2.5,
    "dutyFactor": 0.66,
    "pelvis": {
      "restHeight": 0.62,
      "radius": [
        0.194,
        0.14,
        0.26
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:old-copper"
    },
    "torso": {
      "depth": 0.268,
      "material": "mat:old-copper"
    },
    "spine": [
      {
        "id": "opisthosoma",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:old-copper",
        "bone": "spine-0"
      },
      {
        "id": "prosoma",
        "length": 0.26,
        "radiusX": 0.17,
        "radiusY": 0.14,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:carbon-racer",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.12,
        "radiusX": 0.07,
        "radiusY": 0.07,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.3,
          1
        ],
        "matPresetId": "mat:old-copper",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.16,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:carbon-racer",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "spinneret",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.5,
          -0.24
        ],
        "upperLength": 0.24,
        "lowerLength": 0.26,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.02,
        "strideLength": 0.2,
        "effectorKind": "pincer",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.08,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.06
      },
      {
        "id": "hindleg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.17,
          0.524,
          -0.22
        ],
        "upperLength": 0.3,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0.3,
          0.2,
          0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.85,
          -0.3,
          -0.2
        ],
        "lowerDirection": [
          0.35,
          -0.85,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legA{Side}Upper",
          "lower": "legA{Side}Lower",
          "effector": "legA{Side}Foot"
        }
      },
      {
        "id": "midleg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.544,
          0.04
        ],
        "upperLength": 0.3,
        "lowerLength": 0.4,
        "kneeBendDir": [
          1,
          0.2,
          0
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.9,
          -0.3,
          0
        ],
        "lowerDirection": [
          0.35,
          -0.87,
          0.1
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legB{Side}Upper",
          "lower": "legB{Side}Lower",
          "effector": "legB{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "prosoma",
        "symmetry": "bilateral",
        "mountOffset": [
          0.25,
          0.02,
          0.12
        ],
        "upperLength": 0.28,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0.3,
          0.2,
          -0.2
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "role": "arm",
        "upperDirection": [
          0.85,
          -0.3,
          0.2
        ],
        "lowerDirection": [
          0.3,
          -0.88,
          -0.1
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "legC{Side}Upper",
          "lower": "legC{Side}Lower",
          "effector": "legC{Side}Foot"
        }
      },
      {
        "id": "pedipalp",
        "parentSegmentId": "prosoma",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          0.04,
          0.32
        ],
        "upperLength": 0.22,
        "lowerLength": 0.24,
        "kneeBendDir": [
          0.3,
          0.2,
          0.2
        ],
        "gaitPhaseOffset": 0.75,
        "stepHeight": 0.06,
        "strideLength": 0.5,
        "effectorKind": "pincer",
        "role": "arm",
        "upperDirection": [
          0.65,
          -0.35,
          0.55
        ],
        "lowerDirection": [
          0.2,
          -0.75,
          0.55
        ],
        "effectorDirection": [
          0,
          -0.6,
          0.8
        ],
        "effectorLength": 0.07,
        "upperRadius": 0.036,
        "lowerRadius": 0.028,
        "knuckleRadius": 0.038,
        "bones": {
          "upper": "legD{Side}Upper",
          "lower": "legD{Side}Lower",
          "effector": "legD{Side}Foot"
        }
      }
    ],
    "armour": [
      {
        "id": "shalrath-lq-dorsal-shield",
        "gen": "panel",
        "params": {
          "width": 0.28,
          "depth": 0.34,
          "thickness": 0.03,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.018
        },
        "material": "mat:carbon-racer",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.08
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "shalrath-lq-ocelli-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "shalrath-lq-ocelli-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "shalrath-lq-chelicera-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-pedipalp"
      },
      {
        "id": "shalrath-lq-chelicera-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-pedipalp"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "shambler-lq",
    "archetype": "theropod",
    "seed": 16667,
    "skinPaletteId": "mat:frozen-rig",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.55,
    "dutyFactor": 0.56,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.196,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:frozen-rig"
    },
    "torso": {
      "depth": 0.295,
      "material": "mat:frozen-rig"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:frozen-rig",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:moon-dusted",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:frozen-rig",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:moon-dusted",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "shambler-lq-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:moon-dusted",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "shambler-lq-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "shambler-lq-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "shambler-lq-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "shambler-lq-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "shambler-lq-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "skel-fd",
    "archetype": "biped-astro",
    "seed": 16668,
    "skinPaletteId": "mat:moon-dusted",
    "voiceStemId": "vo-charger",
    "strideFreqHz": 1.8,
    "dutyFactor": 0.58,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.15,
        0.075,
        0.1
      ],
      "matPresetId": "mat:moon-dusted",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.2,
      "material": "mat:moon-dusted"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:moon-dusted",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:slatted-grille-steel",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:moon-dusted",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:slatted-grille-steel",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:moon-dusted",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "skel-fd-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:slatted-grille-steel",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "skel-fd-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:moon-dusted",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "skel-fd-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:slatted-grille-steel",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "skel-fd-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:moon-dusted",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "skel-fd-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "eye-glow",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "skel-fd-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "eye-glow",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "skel-fd-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "skel-fd-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "skel-fd-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "skel-fd-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:slatted-grille-steel",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "skel-fd-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:moon-dusted",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "skull-flier",
    "archetype": "avian-drone",
    "seed": 16669,
    "skinPaletteId": "mat:furnace",
    "voiceStemId": "vo-swarmer",
    "strideFreqHz": 2.9,
    "dutyFactor": 0.46,
    "pelvis": {
      "restHeight": 0.72,
      "radius": [
        0.154,
        0.14,
        0.2
      ],
      "sacrumOffset": [
        0.01,
        0.2,
        0.02
      ],
      "matPresetId": "mat:furnace"
    },
    "torso": {
      "depth": 0.23,
      "material": "mat:furnace"
    },
    "spine": [
      {
        "id": "keel",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 58,
        "matPresetId": "mat:furnace",
        "bone": "spine-0"
      },
      {
        "id": "thorax",
        "length": 0.2,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -8,
        "matPresetId": "mat:moon-dusted",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.16,
        "radiusX": 0.08,
        "radiusY": 0.08,
        "pitchRestDeg": -12,
        "matPresetId": "mat:furnace",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.18,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 54,
        "matPresetId": "mat:moon-dusted",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "talon-leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.14,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 0.95,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.055,
        "lowerRadius": 0.042,
        "knuckleRadius": 0.052,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "wing",
        "parentSegmentId": "thorax",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          -0.02,
          0.06
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          -0.4
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.08,
        "strideLength": 0.7,
        "effectorKind": "thruster",
        "role": "arm",
        "upperDirection": [
          0.88,
          -0.25,
          -0.15
        ],
        "lowerDirection": [
          0.75,
          -0.55,
          -0.25
        ],
        "effectorDirection": [
          0.65,
          -0.65,
          -0.3
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "wing{Side}Upper",
          "lower": "wing{Side}Lower",
          "effector": "wing{Side}Tip"
        }
      },
      {
        "id": "tail-vane",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.56,
          -0.23
        ],
        "upperLength": 0.26,
        "lowerLength": 0.28,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.3,
        "effectorKind": "thruster",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.1,
          -1
        ],
        "effectorDirection": [
          0,
          -0.25,
          -1
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.058,
        "lowerRadius": 0.044,
        "knuckleRadius": 0.048
      }
    ],
    "armour": [
      {
        "id": "skull-flier-dorsal-cowl",
        "gen": "panel",
        "params": {
          "width": 0.24,
          "depth": 0.32,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:moon-dusted",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.05
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "skull-flier-optic-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.048,
          0,
          0
        ]
      },
      {
        "id": "skull-flier-optic-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.048,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "skull-flier-beak-lance",
        "gen": "chute",
        "params": {
          "length": 0.18,
          "mouthWidth": 0.09,
          "mouthHeight": 0.042,
          "throatWidth": 0.038,
          "wall": 0.01
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "skull-flier-wingtip-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-wing"
      },
      {
        "id": "skull-flier-wingtip-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-wing"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "snke-bl",
    "archetype": "serpentine",
    "seed": 16670,
    "skinPaletteId": "mat:overgrown-relic",
    "voiceStemId": "vo-serpentine",
    "strideFreqHz": 2.1,
    "dutyFactor": 0.65,
    "pelvis": {
      "restHeight": 0.68,
      "radius": [
        0.17,
        0.14,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:overgrown-relic"
    },
    "torso": {
      "depth": 0.26,
      "material": "mat:overgrown-relic"
    },
    "spine": [
      {
        "id": "caudal",
        "length": 0.18,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 62,
        "matPresetId": "mat:overgrown-relic",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -10,
        "matPresetId": "mat:old-copper",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.19,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": -14,
        "matPresetId": "mat:overgrown-relic",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.22,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 58,
        "matPresetId": "mat:old-copper",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "ventral-skid",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.09,
        "strideLength": 1,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.065,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06,
        "bones": {
          "upper": "skid{Side}Upper",
          "lower": "skid{Side}Lower",
          "effector": "skid{Side}Foot"
        }
      },
      {
        "id": "hood-rib",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.22,
          -0.02,
          0.08
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.04,
        "strideLength": 0.45,
        "effectorKind": "pincer",
        "role": "arm",
        "upperDirection": [
          0.35,
          -0.85,
          0.35
        ],
        "lowerDirection": [
          0.15,
          -0.82,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.78,
          0.6
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.036,
        "lowerRadius": 0.028,
        "knuckleRadius": 0.038,
        "bones": {
          "upper": "rib{Side}Upper",
          "lower": "rib{Side}Lower",
          "effector": "rib{Side}Tip"
        }
      },
      {
        "id": "tail-coil",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.52,
          -0.25
        ],
        "upperLength": 0.36,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.35,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.12,
          -1
        ],
        "effectorDirection": [
          0,
          -0.28,
          -1
        ],
        "effectorLength": 0.11,
        "upperRadius": 0.072,
        "lowerRadius": 0.052,
        "knuckleRadius": 0.058
      }
    ],
    "armour": [
      {
        "id": "snke-bl-hood-crest",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.36,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:old-copper",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "snke-bl-pit-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "snke-bl-pit-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "snke-bl-venom-maw",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.048,
          "throatWidth": 0.045,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.055,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "sor2-bl",
    "archetype": "biped-astro",
    "seed": 16671,
    "skinPaletteId": "mat:old-copper",
    "voiceStemId": "vo-spitter",
    "strideFreqHz": 1.6,
    "dutyFactor": 0.61,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.155,
        0.075,
        0.1
      ],
      "matPresetId": "mat:old-copper",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.215,
      "material": "mat:old-copper"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:old-copper",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:carbon-racer",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:old-copper",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:carbon-racer",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:old-copper",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "sor2-bl-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:carbon-racer",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "sor2-bl-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:old-copper",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "sor2-bl-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:carbon-racer",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "sor2-bl-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:old-copper",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "sor2-bl-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "suit-gold",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "sor2-bl-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "suit-gold",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "sor2-bl-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "suit-gold",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "sor2-bl-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "sor2-bl-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "sor2-bl-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:carbon-racer",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "sor2-bl-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:old-copper",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "srcr-bl",
    "archetype": "biped-astro",
    "seed": 16672,
    "skinPaletteId": "mat:carbon-racer",
    "voiceStemId": "vo-sapper",
    "strideFreqHz": 1.65,
    "dutyFactor": 0.61,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.155,
        0.075,
        0.1
      ],
      "matPresetId": "mat:carbon-racer",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.21,
      "material": "mat:carbon-racer"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:carbon-racer",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:old-copper",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:carbon-racer",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:old-copper",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:carbon-racer",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "srcr-bl-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:old-copper",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "srcr-bl-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:carbon-racer",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "srcr-bl-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:old-copper",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "srcr-bl-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:carbon-racer",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "srcr-bl-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "eye-glow",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "srcr-bl-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "eye-glow",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "srcr-bl-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "eye-glow",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "srcr-bl-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "srcr-bl-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "srcr-bl-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:old-copper",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "srcr-bl-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:carbon-racer",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "tarbaby-lq",
    "archetype": "quadruped",
    "seed": 16673,
    "skinPaletteId": "mat:rubber-seal",
    "voiceStemId": "vo-sapper",
    "strideFreqHz": 2.3,
    "dutyFactor": 0.6,
    "pelvis": {
      "restHeight": 0.74,
      "radius": [
        0.204,
        0.17,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.25,
        0.02
      ],
      "matPresetId": "mat:rubber-seal"
    },
    "torso": {
      "depth": 0.308,
      "material": "mat:rubber-seal"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.3,
        "radiusX": 0.16,
        "radiusY": 0.15,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:rubber-seal",
        "bone": "spine-0"
      },
      {
        "id": "thoracic",
        "length": 0.3,
        "radiusX": 0.17,
        "radiusY": 0.16,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:oily-engine",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.35,
          1
        ],
        "matPresetId": "mat:rubber-seal",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.1,
          1
        ],
        "matPresetId": "mat:oily-engine",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.7,
          -0.18
        ],
        "upperLength": 0.32,
        "lowerLength": 0.32,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          -0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.075,
        "lowerRadius": 0.055,
        "knuckleRadius": 0.07,
        "bones": {
          "upper": "hind{Side}Upper",
          "lower": "hind{Side}Lower",
          "effector": "hind{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "thoracic",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          -0.35885,
          0.04149
        ],
        "upperLength": 0.3,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.12,
        "strideLength": 1.1,
        "effectorKind": "hoof",
        "upperDirection": [
          0.1,
          -0.9,
          -0.25
        ],
        "lowerDirection": [
          0.03,
          -0.95,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.07,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.065,
        "bones": {
          "upper": "fore{Side}Upper",
          "lower": "fore{Side}Lower",
          "effector": "fore{Side}Foot"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.78,
          -0.34
        ],
        "upperLength": 0.28,
        "lowerLength": 0.3,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.03,
        "strideLength": 0.2,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.15,
          -1
        ],
        "lowerDirection": [
          0,
          -0.2,
          -1
        ],
        "effectorDirection": [
          0,
          -0.35,
          -1
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.06,
        "lowerRadius": 0.04,
        "knuckleRadius": 0.05
      }
    ],
    "armour": [
      {
        "id": "tarbaby-lq-saddle",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.44,
          "thickness": 0.028,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:oily-engine",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "tarbaby-lq-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "tarbaby-lq-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "tarbaby-lq-muzzle",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.05,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "technospider",
    "archetype": "arachnid",
    "seed": 16674,
    "skinPaletteId": "mat:workshop-steel",
    "voiceStemId": "vo-arachnid",
    "strideFreqHz": 2.7,
    "dutyFactor": 0.68,
    "pelvis": {
      "restHeight": 0.62,
      "radius": [
        0.195,
        0.14,
        0.26
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:workshop-steel"
    },
    "torso": {
      "depth": 0.27,
      "material": "mat:workshop-steel"
    },
    "spine": [
      {
        "id": "opisthosoma",
        "length": 0.16,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:workshop-steel",
        "bone": "spine-0"
      },
      {
        "id": "prosoma",
        "length": 0.26,
        "radiusX": 0.17,
        "radiusY": 0.14,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:hazard-chevron",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.12,
        "radiusX": 0.07,
        "radiusY": 0.07,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.3,
          1
        ],
        "matPresetId": "mat:workshop-steel",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.16,
        "radiusX": 0.09,
        "radiusY": 0.08,
        "pitchRestDeg": 0,
        "direction": [
          0,
          0.05,
          1
        ],
        "matPresetId": "mat:hazard-chevron",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "spinneret",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.5,
          -0.24
        ],
        "upperLength": 0.24,
        "lowerLength": 0.26,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.02,
        "strideLength": 0.2,
        "effectorKind": "pincer",
        "upperDirection": [
          0,
          0.12,
          -1
        ],
        "lowerDirection": [
          0,
          -0.08,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.06
      },
      {
        "id": "hindleg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.17,
          0.524,
          -0.22
        ],
        "upperLength": 0.3,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0.3,
          0.2,
          0.2
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.85,
          -0.3,
          -0.2
        ],
        "lowerDirection": [
          0.35,
          -0.85,
          0.2
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legA{Side}Upper",
          "lower": "legA{Side}Lower",
          "effector": "legA{Side}Foot"
        }
      },
      {
        "id": "midleg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.18,
          0.544,
          0.04
        ],
        "upperLength": 0.3,
        "lowerLength": 0.4,
        "kneeBendDir": [
          1,
          0.2,
          0
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "upperDirection": [
          0.9,
          -0.3,
          0
        ],
        "lowerDirection": [
          0.35,
          -0.87,
          0.1
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.045,
        "lowerRadius": 0.035,
        "knuckleRadius": 0.045,
        "bones": {
          "upper": "legB{Side}Upper",
          "lower": "legB{Side}Lower",
          "effector": "legB{Side}Foot"
        }
      },
      {
        "id": "foreleg",
        "parentSegmentId": "prosoma",
        "symmetry": "bilateral",
        "mountOffset": [
          0.25,
          0.02,
          0.12
        ],
        "upperLength": 0.28,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0.3,
          0.2,
          -0.2
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.1,
        "strideLength": 0.8,
        "effectorKind": "talon",
        "role": "arm",
        "upperDirection": [
          0.85,
          -0.3,
          0.2
        ],
        "lowerDirection": [
          0.3,
          -0.88,
          -0.1
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.08,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.042,
        "bones": {
          "upper": "legC{Side}Upper",
          "lower": "legC{Side}Lower",
          "effector": "legC{Side}Foot"
        }
      },
      {
        "id": "pedipalp",
        "parentSegmentId": "prosoma",
        "symmetry": "bilateral",
        "mountOffset": [
          0.24,
          0.04,
          0.32
        ],
        "upperLength": 0.22,
        "lowerLength": 0.24,
        "kneeBendDir": [
          0.3,
          0.2,
          0.2
        ],
        "gaitPhaseOffset": 0.75,
        "stepHeight": 0.06,
        "strideLength": 0.5,
        "effectorKind": "pincer",
        "role": "arm",
        "upperDirection": [
          0.65,
          -0.35,
          0.55
        ],
        "lowerDirection": [
          0.2,
          -0.75,
          0.55
        ],
        "effectorDirection": [
          0,
          -0.6,
          0.8
        ],
        "effectorLength": 0.07,
        "upperRadius": 0.036,
        "lowerRadius": 0.028,
        "knuckleRadius": 0.038,
        "bones": {
          "upper": "legD{Side}Upper",
          "lower": "legD{Side}Lower",
          "effector": "legD{Side}Foot"
        }
      }
    ],
    "armour": [
      {
        "id": "technospider-dorsal-shield",
        "gen": "panel",
        "params": {
          "width": 0.28,
          "depth": 0.34,
          "thickness": 0.03,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.018
        },
        "material": "mat:hazard-chevron",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.08
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "technospider-ocelli-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "technospider-ocelli-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "technospider-chelicera-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:left-pedipalp"
      },
      {
        "id": "technospider-chelicera-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.25
        },
        "material": "talon-horn",
        "mount": "limb:right-pedipalp"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "wizard-lq",
    "archetype": "serpentine",
    "seed": 16675,
    "skinPaletteId": "mat:moon-dusted",
    "voiceStemId": "vo-flyer",
    "strideFreqHz": 2.2,
    "dutyFactor": 0.62,
    "pelvis": {
      "restHeight": 0.68,
      "radius": [
        0.174,
        0.14,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:moon-dusted"
    },
    "torso": {
      "depth": 0.268,
      "material": "mat:moon-dusted"
    },
    "spine": [
      {
        "id": "caudal",
        "length": 0.18,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 62,
        "matPresetId": "mat:moon-dusted",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -10,
        "matPresetId": "mat:overgrown-relic",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.19,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": -14,
        "matPresetId": "mat:moon-dusted",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.22,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 58,
        "matPresetId": "mat:overgrown-relic",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "ventral-skid",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.09,
        "strideLength": 1,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.065,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06,
        "bones": {
          "upper": "skid{Side}Upper",
          "lower": "skid{Side}Lower",
          "effector": "skid{Side}Foot"
        }
      },
      {
        "id": "hood-rib",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.22,
          -0.02,
          0.08
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.04,
        "strideLength": 0.45,
        "effectorKind": "pincer",
        "role": "arm",
        "upperDirection": [
          0.35,
          -0.85,
          0.35
        ],
        "lowerDirection": [
          0.15,
          -0.82,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.78,
          0.6
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.036,
        "lowerRadius": 0.028,
        "knuckleRadius": 0.038,
        "bones": {
          "upper": "rib{Side}Upper",
          "lower": "rib{Side}Lower",
          "effector": "rib{Side}Tip"
        }
      },
      {
        "id": "tail-coil",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.52,
          -0.25
        ],
        "upperLength": 0.36,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.35,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.12,
          -1
        ],
        "effectorDirection": [
          0,
          -0.28,
          -1
        ],
        "effectorLength": 0.11,
        "upperRadius": 0.072,
        "lowerRadius": 0.052,
        "knuckleRadius": 0.058
      }
    ],
    "armour": [
      {
        "id": "wizard-lq-hood-crest",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.36,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:overgrown-relic",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "wizard-lq-pit-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "wizard-lq-pit-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "wizard-lq-venom-maw",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.048,
          "throatWidth": 0.045,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.055,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "wzrd-bl",
    "archetype": "serpentine",
    "seed": 16676,
    "skinPaletteId": "mat:carbon-racer",
    "voiceStemId": "vo-flyer",
    "strideFreqHz": 2.3,
    "dutyFactor": 0.6,
    "pelvis": {
      "restHeight": 0.68,
      "radius": [
        0.166,
        0.14,
        0.22
      ],
      "sacrumOffset": [
        0.01,
        0.22,
        0.02
      ],
      "matPresetId": "mat:carbon-racer"
    },
    "torso": {
      "depth": 0.252,
      "material": "mat:carbon-racer"
    },
    "spine": [
      {
        "id": "caudal",
        "length": 0.18,
        "radiusX": 0.15,
        "radiusY": 0.13,
        "pitchRestDeg": 62,
        "matPresetId": "mat:carbon-racer",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.13,
        "radiusY": 0.12,
        "pitchRestDeg": -10,
        "matPresetId": "mat:old-copper",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.19,
        "radiusX": 0.1,
        "radiusY": 0.09,
        "pitchRestDeg": -14,
        "matPresetId": "mat:carbon-racer",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.22,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 58,
        "matPresetId": "mat:old-copper",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "ventral-skid",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.15,
          0.6988,
          0.02
        ],
        "upperLength": 0.32,
        "lowerLength": 0.34,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.09,
        "strideLength": 1,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.28
        ],
        "lowerDirection": [
          0.02,
          -0.88,
          -0.45
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.065,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06,
        "bones": {
          "upper": "skid{Side}Upper",
          "lower": "skid{Side}Lower",
          "effector": "skid{Side}Foot"
        }
      },
      {
        "id": "hood-rib",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.22,
          -0.02,
          0.08
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.04,
        "strideLength": 0.45,
        "effectorKind": "pincer",
        "role": "arm",
        "upperDirection": [
          0.35,
          -0.85,
          0.35
        ],
        "lowerDirection": [
          0.15,
          -0.82,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.78,
          0.6
        ],
        "effectorLength": 0.09,
        "upperRadius": 0.036,
        "lowerRadius": 0.028,
        "knuckleRadius": 0.038,
        "bones": {
          "upper": "rib{Side}Upper",
          "lower": "rib{Side}Lower",
          "effector": "rib{Side}Tip"
        }
      },
      {
        "id": "tail-coil",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.52,
          -0.25
        ],
        "upperLength": 0.36,
        "lowerLength": 0.38,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.35,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.12,
          -1
        ],
        "effectorDirection": [
          0,
          -0.28,
          -1
        ],
        "effectorLength": 0.11,
        "upperRadius": 0.072,
        "lowerRadius": 0.052,
        "knuckleRadius": 0.058
      }
    ],
    "armour": [
      {
        "id": "wzrd-bl-hood-crest",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.36,
          "thickness": 0.026,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.016
        },
        "material": "mat:old-copper",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "wzrd-bl-pit-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.05,
          0,
          0
        ]
      },
      {
        "id": "wzrd-bl-pit-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.024,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.05,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "wzrd-bl-venom-maw",
        "gen": "chute",
        "params": {
          "length": 0.2,
          "mouthWidth": 0.11,
          "mouthHeight": 0.048,
          "throatWidth": 0.045,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.055,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "yeti-q",
    "archetype": "theropod",
    "seed": 16677,
    "skinPaletteId": "mat:frozen-rig",
    "voiceStemId": "vo-brute",
    "strideFreqHz": 1.6,
    "dutyFactor": 0.55,
    "pelvis": {
      "restHeight": 0.86,
      "radius": [
        0.196,
        0.16,
        0.24
      ],
      "sacrumOffset": [
        0.01,
        0.24,
        0.02
      ],
      "matPresetId": "mat:frozen-rig"
    },
    "torso": {
      "depth": 0.295,
      "material": "mat:frozen-rig"
    },
    "spine": [
      {
        "id": "sacral",
        "length": 0.18,
        "radiusX": 0.17,
        "radiusY": 0.15,
        "pitchRestDeg": 66,
        "matPresetId": "mat:frozen-rig",
        "bone": "spine-0"
      },
      {
        "id": "dorsal",
        "length": 0.22,
        "radiusX": 0.14,
        "radiusY": 0.13,
        "pitchRestDeg": -6,
        "matPresetId": "mat:lab-fresh",
        "bone": "spine-1"
      },
      {
        "id": "cervical",
        "length": 0.2,
        "radiusX": 0.1,
        "radiusY": 0.1,
        "pitchRestDeg": -12,
        "matPresetId": "mat:frozen-rig",
        "kind": "neck",
        "bone": "spine-2"
      },
      {
        "id": "skull",
        "length": 0.24,
        "radiusX": 0.11,
        "radiusY": 0.09,
        "pitchRestDeg": 62,
        "matPresetId": "mat:lab-fresh",
        "kind": "cranium",
        "bone": "spine-3"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.16,
          0.897,
          0.02
        ],
        "upperLength": 0.42,
        "lowerLength": 0.46,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.16,
        "strideLength": 1.4,
        "effectorKind": "talon",
        "upperDirection": [
          0.08,
          -0.95,
          0.3
        ],
        "lowerDirection": [
          0.02,
          -0.86,
          -0.5
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.09,
        "lowerRadius": 0.07,
        "knuckleRadius": 0.08,
        "bones": {
          "upper": "leg{Side}Upper",
          "lower": "leg{Side}Lower",
          "effector": "leg{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.2305,
          -0.0332,
          0.07556
        ],
        "upperLength": 0.16,
        "lowerLength": 0.14,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.05,
        "strideLength": 0.5,
        "effectorKind": "hand",
        "upperDirection": [
          0.2,
          -0.9,
          0.35
        ],
        "lowerDirection": [
          0.1,
          -0.85,
          0.5
        ],
        "effectorDirection": [
          0.1,
          -0.8,
          0.6
        ],
        "effectorLength": 0.1,
        "upperRadius": 0.04,
        "lowerRadius": 0.032,
        "knuckleRadius": 0.04,
        "bones": {
          "upper": "arm{Side}Upper",
          "lower": "arm{Side}Lower",
          "effector": "arm{Side}Hand"
        }
      },
      {
        "id": "tail",
        "parentSegmentId": "pelvis",
        "symmetry": "medial",
        "mountOffset": [
          0,
          0.7,
          -0.26
        ],
        "upperLength": 0.34,
        "lowerLength": 0.36,
        "kneeBendDir": [
          0,
          1,
          0
        ],
        "gaitPhaseOffset": 0.25,
        "stepHeight": 0.04,
        "strideLength": 0.3,
        "effectorKind": "talon",
        "upperDirection": [
          0,
          0.1,
          -1
        ],
        "lowerDirection": [
          0,
          -0.15,
          -1
        ],
        "effectorDirection": [
          0,
          -0.3,
          -1
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.075,
        "lowerRadius": 0.05,
        "knuckleRadius": 0.06
      }
    ],
    "armour": [
      {
        "id": "yeti-q-carapace",
        "gen": "panel",
        "params": {
          "width": 0.3,
          "depth": 0.4,
          "thickness": 0.03,
          "bevel": 0.01,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.02
        },
        "material": "mat:lab-fresh",
        "mount": "cage.top",
        "at": [
          0,
          -0.02,
          -0.06
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "yeti-q-eye-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          0.055,
          0,
          0
        ]
      },
      {
        "id": "yeti-q-eye-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.028,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "eye-glow",
        "mount": "skull.front",
        "at": [
          -0.055,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "yeti-q-jaw",
        "gen": "chute",
        "params": {
          "length": 0.22,
          "mouthWidth": 0.12,
          "mouthHeight": 0.05,
          "throatWidth": 0.05,
          "wall": 0.012
        },
        "material": "talon-horn",
        "mount": "skull.front",
        "at": [
          0,
          -0.06,
          0.02
        ],
        "rot": [
          90,
          0,
          0
        ]
      },
      {
        "id": "yeti-q-claw-left",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:left-arm",
        "bone": "armLeftHand"
      },
      {
        "id": "yeti-q-claw-right",
        "gen": "knuckle",
        "params": {
          "radius": 0.035,
          "sides": 8,
          "rings": 3,
          "bossFactor": 0.2
        },
        "material": "talon-horn",
        "mount": "limb:right-arm",
        "bone": "armRightHand"
      }
    ]
  } satisfies CreatureGenomeSpec,
  {
    "id": "zombie-trooper",
    "archetype": "biped-astro",
    "seed": 16678,
    "skinPaletteId": "mat:field-worn-hazard",
    "voiceStemId": "vo-spitter",
    "strideFreqHz": 1.5,
    "dutyFactor": 0.63,
    "pelvis": {
      "restHeight": 0.916,
      "radius": [
        0.155,
        0.075,
        0.1
      ],
      "matPresetId": "mat:field-worn-hazard",
      "bone": "mixamorigHips"
    },
    "torso": {
      "depth": 0.21,
      "material": "mat:field-worn-hazard"
    },
    "spine": [
      {
        "id": "lumbar",
        "length": 0.13259,
        "radiusX": 0.1,
        "radiusY": 0.082,
        "pitchRestDeg": -2.1,
        "matPresetId": "mat:field-worn-hazard",
        "kind": "vertebra",
        "bone": "mixamorigSpine"
      },
      {
        "id": "thoracic",
        "length": 0.13259,
        "radiusX": 0.105,
        "radiusY": 0.085,
        "pitchRestDeg": 0,
        "matPresetId": "mat:rust-bucket",
        "kind": "vertebra",
        "bone": "mixamorigSpine1"
      },
      {
        "id": "dorsal",
        "length": 0.13661,
        "radiusX": 0.108,
        "radiusY": 0.088,
        "pitchRestDeg": 0,
        "matPresetId": "mat:field-worn-hazard",
        "kind": "vertebra",
        "bone": "mixamorigSpine2"
      },
      {
        "id": "neck",
        "length": 0.09595,
        "radiusX": 0.058,
        "radiusY": 0.058,
        "pitchRestDeg": 0,
        "matPresetId": "mat:rust-bucket",
        "kind": "neck",
        "bone": "mixamorigNeck"
      },
      {
        "id": "cranium",
        "length": 0.07626,
        "radiusX": 0.078,
        "radiusY": 0.078,
        "pitchRestDeg": 0,
        "direction": [
          0.0925,
          0.9825,
          0.1615
        ],
        "matPresetId": "mat:field-worn-hazard",
        "kind": "cranium",
        "bone": "mixamorigHead"
      }
    ],
    "limbs": [
      {
        "id": "leg",
        "parentSegmentId": "pelvis",
        "symmetry": "bilateral",
        "mountOffset": [
          0.1087,
          0.8359,
          0.0067
        ],
        "upperLength": 0.33083,
        "lowerLength": 0.39957,
        "kneeBendDir": [
          0,
          0,
          1
        ],
        "gaitPhaseOffset": 0,
        "stepHeight": 0.085,
        "strideLength": 0.92,
        "effectorKind": "boot",
        "upperDirection": [
          0.1506,
          -0.9718,
          0.1815
        ],
        "lowerDirection": [
          0.0325,
          -0.9873,
          -0.1553
        ],
        "effectorDirection": [
          0,
          -1,
          0
        ],
        "effectorLength": 0.1197,
        "upperRadius": 0.062,
        "lowerRadius": 0.054,
        "knuckleRadius": 0.062,
        "bones": {
          "upper": "mixamorig{Side}UpLeg",
          "lower": "mixamorig{Side}Leg",
          "effector": "mixamorig{Side}Foot"
        }
      },
      {
        "id": "arm",
        "parentSegmentId": "dorsal",
        "symmetry": "bilateral",
        "mountOffset": [
          0.20455,
          0.1022,
          -0.01658
        ],
        "upperLength": 0.21765,
        "lowerLength": 0.21322,
        "kneeBendDir": [
          0,
          0,
          -1
        ],
        "gaitPhaseOffset": 0.5,
        "stepHeight": 0.03,
        "strideLength": 0.7,
        "effectorKind": "hand",
        "role": "arm",
        "upperDirection": [
          0.5169,
          -0.8539,
          -0.0603
        ],
        "lowerDirection": [
          0.6952,
          -0.6518,
          0.303
        ],
        "effectorDirection": [
          0.5005,
          -0.7456,
          0.44
        ],
        "effectorLength": 0.12,
        "upperRadius": 0.052,
        "lowerRadius": 0.046,
        "knuckleRadius": 0.055,
        "bones": {
          "upper": "mixamorig{Side}Arm",
          "lower": "mixamorig{Side}ForeArm",
          "effector": "mixamorig{Side}Hand"
        }
      }
    ],
    "armour": [
      {
        "id": "zombie-trooper-plss",
        "gen": "can",
        "params": {
          "width": 0.3,
          "depth": 0.12,
          "height": 0.42,
          "bevel": 0.02,
          "baseBand": 0.06,
          "bands": 2
        },
        "material": "mat:rust-bucket",
        "mount": "cage.back",
        "at": [
          0,
          0.06,
          -0.075
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "id": "zombie-trooper-plss-manifold",
        "gen": "panel",
        "params": {
          "width": 0.26,
          "depth": 0.1,
          "thickness": 0.02,
          "bevel": 0.006,
          "seam": 0.03,
          "boltsPerSide": 3,
          "boltHead": 0.018
        },
        "material": "mat:field-worn-hazard",
        "mount": "cage.back",
        "at": [
          0,
          0.42,
          -0.035
        ],
        "rot": [
          0,
          180,
          0
        ]
      },
      {
        "id": "zombie-trooper-neck-seal",
        "gen": "disc",
        "params": {
          "radius": 0.075,
          "thickness": 0.03,
          "sides": 12,
          "rimFactor": 0.45
        },
        "material": "mat:rust-bucket",
        "mount": "neck.segment",
        "at": [
          0,
          0.02,
          0
        ]
      },
      {
        "id": "zombie-trooper-helmet",
        "gen": "knuckle",
        "params": {
          "radius": 0.135,
          "sides": 12,
          "rings": 6,
          "bossFactor": 0.25
        },
        "material": "mat:field-worn-hazard",
        "mount": "cranium.mid",
        "at": [
          0,
          0.09,
          0.012
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "sensoryControls": [
      {
        "id": "zombie-trooper-visor",
        "gen": "panel",
        "params": {
          "width": 0.19,
          "depth": 0.15,
          "thickness": 0.022,
          "bevel": 0.012,
          "seam": 0.02,
          "boltsPerSide": 0,
          "boltHead": 0.01
        },
        "material": "suit-gold",
        "mount": "cranium.front",
        "at": [
          0,
          0.055,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigHead"
      },
      {
        "id": "zombie-trooper-telemetry",
        "gen": "panel",
        "params": {
          "width": 0.16,
          "depth": 0.09,
          "thickness": 0.018,
          "bevel": 0.006,
          "seam": 0.02,
          "boltsPerSide": 2,
          "boltHead": 0.012
        },
        "material": "suit-gold",
        "mount": "cage.front",
        "at": [
          0,
          0.02,
          0
        ],
        "rot": [
          90,
          0,
          0
        ],
        "bone": "mixamorigSpine2"
      },
      {
        "id": "zombie-trooper-antenna",
        "gen": "pipe",
        "params": {
          "radius": 0.008,
          "length": 0.26,
          "sides": 6,
          "flangeWidth": 0.008,
          "elbow": 0,
          "armLength": 0.1
        },
        "material": "suit-gold",
        "mount": "cage.top",
        "at": [
          0.11,
          0,
          -0.05
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ],
    "subjectEffectors": [
      {
        "id": "zombie-trooper-glove-left",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:left-arm",
        "bone": "mixamorigLeftHand"
      },
      {
        "id": "zombie-trooper-glove-right",
        "gen": "can",
        "params": {
          "width": 0.1,
          "depth": 0.11,
          "height": 0.15,
          "bevel": 0.02,
          "baseBand": 0.14,
          "bands": 1
        },
        "material": "effector-boot",
        "mount": "limb:right-arm",
        "bone": "mixamorigRightHand"
      }
    ],
    "harness": [
      {
        "id": "zombie-trooper-thruster-belt",
        "gen": "clamp",
        "params": {
          "width": 0.3,
          "length": 0.12,
          "thickness": 0.03,
          "bridgeHeight": 0.02,
          "ribs": 2
        },
        "material": "mat:rust-bucket",
        "mount": "pelvis",
        "at": [
          0,
          0.018,
          0.1
        ]
      },
      {
        "id": "zombie-trooper-battery",
        "gen": "can",
        "params": {
          "width": 0.12,
          "depth": 0.07,
          "height": 0.13,
          "bevel": 0.012,
          "baseBand": 0.1,
          "bands": 1
        },
        "material": "mat:field-worn-hazard",
        "mount": "pelvis",
        "at": [
          -0.1,
          0.016,
          -0.15
        ]
      }
    ]
  }
];

export const ROSTER_GENOMES_BY_ID: Readonly<Record<string, CreatureGenomeSpec>> = Object.freeze(
  Object.fromEntries(ROSTER_MONSTER_GENOMES.map((g) => [g.id, g])),
);

export function rosterGenomeById(id: string): CreatureGenomeSpec | undefined {
  return ROSTER_GENOMES_BY_ID[id];
}
