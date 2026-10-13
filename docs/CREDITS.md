# Credits and notices

The game ships monster art only from the sources below. Each one is free to use with the notice kept. Nothing from id Software is in the packed monsters.

The machine-readable list is `apps/web/public/monsters/credits.json` (written by `scripts/pack-monsters.mjs`).

## Freedoom (sprite monsters)

Source: Freedoom 0.13.0, `freedoom2.wad`, the sprites used by the packed monsters. Licence: BSD-3-Clause.

> Copyright © 2001-2024 Contributors to the Freedoom project. All rights reserved.
>
> Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
> * Neither the name of the Freedoom project nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Thanks to the Freedoom contributors (see the project's CREDITS file).

## LibreQuake (early 3D monsters, Quake MDL)

Source: LibreQuake lite, `id1/pak0.pak` and `pak1.pak`, models and palette. Licence: BSD-3-Clause for the models, textures and sounds. The GPL-2 files in the same archive (`progs.dat`, `pop.lmp`, the QuakeC source) are not used.

> Copyright © 2019-2023 Contributors to the LibreQuake project. All rights reserved.
>
> Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
> * Neither the name of the LibreQuake project nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

No LibreQuake monster is in the packed set yet (the two Quake models were dropped at the look check; see the roster). This notice is kept for when they return.

## Quaternius (modern 3D monsters, glTF)

Source: Quaternius, Ultimate Monsters packs (Big, Blob, Flying). Licence: CC0 1.0 Universal (public domain dedication, https://creativecommons.org/publicdomain/zero/1.0/). Thanks to Quaternius (https://quaternius.com/) for the free packs.

Note: the `License.txt` inside the downloaded folder is headed "Ultimate Platformer Pack", though its licence line reads CC0 1.0. The pack name does not match the monster folders, so check the Quaternius page before a release.

## Blasphemer (held, not shipped)

The Blasphemer WAD (`zips/monsters/blasphemer/blasphem-0.1.8.zip`) has no licence text in its archive, so its BSD-3 status cannot be verified from the files. Nothing from it is packed. Its entry in `docs/monsters/roster.json` says why.

## Not used

No id Software asset is in the packed monsters. The DOOM shareware WAD and the Quake MD2 Ogro are not used by the monster pack.
