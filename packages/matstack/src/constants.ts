/** Shared limits of @hm/matstack (plan 41). */

export const MAX_LAYERS = 6;
export const MAX_MASK_INPUTS = 6;
export const MAX_RAMP_STOPS = 8;
/** The widest edge or cavity band, in metres: the geometry carries distances up to this (`maskAttributes`). */
export const EDGE_BAND = 0.05;

/** Paint references a surface can use as its colour: the material's first and second paint. */
export const PAINT_REFS = ['paint1', 'paint2'] as const;
export const NOISE_KINDS = ['clouds', 'cells', 'speckle', 'scratches'] as const;
export const BLEND_MODES = ['normal', 'add', 'subtract', 'multiply', 'max', 'min'] as const;
/** The channel groups a layer can write. */
export const CHANNEL_GROUPS = ['colour', 'metal', 'rough', 'specular', 'height', 'coat', 'fuzz', 'aniso', 'film', 'emit'] as const;
