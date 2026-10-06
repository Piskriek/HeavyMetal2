// Which game this build is (owner, 2026-10-06 20:30; STATUS SM17): the SetMix version, or the Goblin Racing version, which lists
// Goblin Racing first on the menu. Two RUN launches, one code base (H6). The build sets it (vite.config.ts, HM_EDITION);
// `?edition=goblin-racing` in the address opens the other version of the same build, for testing both.

export type Edition = 'setmix' | 'goblin-racing';

declare const __HM_EDITION__: string | undefined;

/** The edition named by a build setting and an address query, the query winning; anything unknown is the SetMix version. */
export function pickEdition(built: string | undefined, search: string): Edition {
  const asked = new URLSearchParams(search).get('edition') ?? built;
  return asked === 'goblin-racing' ? 'goblin-racing' : 'setmix';
}

export const EDITION: Edition = pickEdition(
  typeof __HM_EDITION__ === 'undefined' ? undefined : __HM_EDITION__,
  typeof location === 'undefined' ? '' : location.search,
);
