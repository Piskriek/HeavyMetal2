import { capsuleById, riderById, type CapsuleId, type Loadout, type RiderId } from './loadouts';

const urls = new Map<string, string>();

function head(id: RiderId, prefix: string) {
  const accent = riderById(id).color;
  const jaw = id === 'grub' ? 'M44 65Q40 33 88 28Q141 27 139 71L149 121Q145 167 90 179Q36 166 33 124Z'
    : 'M48 64Q46 28 93 26Q139 30 137 72L135 120Q128 164 94 176Q55 160 45 124Z';
  const hair = id === 'nix' ? '<path d="M48 57 49 33 72 15 65 31 108 5 94 29 132 15 124 39 145 37 133 66Z" fill="#302a3a" stroke="#161e1c" stroke-width="4"/>'
    : id === 'sprocket' ? '<path d="m76 41 1-23 13 6 5-23 13 18 16-8-1 25 14 1-5 30Z" fill="#c9793c" stroke="#633c27" stroke-width="4"/>' : '';
  const cap = id === 'rivet' || id === 'grub' ? `<path d="M43 65Q34 23 89 19Q149 15 146 66L132 74 125 46 60 46 56 74Z" fill="url(#${prefix}-leather)" stroke="#201f14" stroke-width="4"/><path d="M80 23 79 48M107 22 109 48" stroke="#c29a5d" stroke-width="4"/>` : '';
  return `
    <defs>
      <linearGradient id="${prefix}-skin" x1="0" y1="0" x2=".75" y2="1"><stop stop-color="#afc970"/><stop offset=".4" stop-color="#7f9f4e"/><stop offset="1" stop-color="#385b35"/></linearGradient>
      <linearGradient id="${prefix}-leather" x1="0" x2="0" y2="1"><stop stop-color="#866044"/><stop offset="1" stop-color="#382c21"/></linearGradient>
    </defs>
    <path d="M43 77 2 57 18 110 48 123M137 76l42-23-15 55-33 18" fill="#6f9346" stroke="#243d28" stroke-width="5"/>
    <path d="m35 88-22-16 15 26m113-12 25-18-14 27" fill="#b2b077" opacity=".75"/>
    <path d="${jaw}" fill="url(#${prefix}-skin)" stroke="#283d28" stroke-width="5"/>
    ${hair}${cap}
    <path d="M47 71Q94 54 137 70" fill="none" stroke="#453528" stroke-width="14"/>
    <g stroke="#443a25" stroke-width="4"><ellipse cx="67" cy="71" rx="23" ry="20" fill="#bb9555"/><ellipse cx="118" cy="69" rx="22" ry="20" fill="#bb9555"/><path d="m89 68 9-1" stroke-width="6"/></g>
    <ellipse cx="67" cy="71" rx="15" ry="13" fill="#203b35"/><ellipse cx="118" cy="69" rx="14" ry="13" fill="#203b35"/>
    <path d="m57 65 11-5m40 2 13-4" stroke="#9ce0c6" stroke-width="4" stroke-linecap="round" opacity=".75"/>
    <path d="m55 101 21 3m32-3 20-4" stroke="#2a4729" stroke-width="7" stroke-linecap="round"/>
    <path d="m87 85-17 35q18 16 39-1l-12-29" fill="#93af5c" stroke="#405d30" stroke-width="4"/>
    <path d="m51 131q42 30 83-6l-13 25q-31 29-58 2Z" fill="#1d2d23" stroke="#3e592f" stroke-width="3"/>
    <path d="m58 133 11 2 5 14-11-4Zm65-5-12 5-2 14 12-7ZM82 142h10v10H82Zm15-1 11-2-2 10-9 3Z" fill="#eee0b9"/>
    <path d="M48 125q7 5 11 1m68-7 8-4M77 162l15 4 16-5" fill="none" stroke="#bdd385" stroke-width="3" opacity=".6"/>
    <path d="m49 155-20 31 23 15 43-22 40 22 24-19-25-33-18 24-41 3Z" fill="${accent}" stroke="#293323" stroke-width="4"/>
    <path d="m70 178 24 7 22-10" fill="none" stroke="#e9dbb080" stroke-width="3"/>`;
}

const data = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function riderArt(id: RiderId) {
  const key = `portrait:${id}`;
  if (urls.has(key)) return urls.get(key)!;
  const accent = riderById(id).color;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="210" viewBox="0 0 200 210"><defs><radialGradient id="back"><stop stop-color="${accent}" stop-opacity=".25"/><stop offset="1" stop-color="#101e16"/></radialGradient></defs><circle cx="100" cy="103" r="96" fill="url(#back)"/><g transform="translate(10 6)">${head(id, id)}</g></svg>`;
  const result = data(svg); urls.set(key, result); return result;
}

export function loadoutArt(loadout: Loadout, raceColor?: string) {
  const key = `${loadout.rider}:${loadout.capsule}:${raceColor ?? ''}`;
  if (urls.has(key)) return urls.get(key)!;
  const capsule = capsuleById(loadout.capsule);
  const trim = raceColor ?? capsule.color;
  const metal = loadout.capsule === 'springsteel' ? ['#8aa9a2', '#344e4b', '#1c2e2c'] : loadout.capsule === 'siege' ? ['#a4a4a9', '#4b4c55', '#262a32'] : ['#a19b80', '#4c5046', '#252f28'];
  const bolts = Array.from({ length: 12 }, (_, i) => {
    const angle = i / 12 * Math.PI * 2;
    const x = 180 + Math.cos(angle) * 110;
    const y = 183 + Math.sin(angle) * 110;
    return `<circle cx="${x}" cy="${y}" r="5" fill="#171f1d" stroke="${trim}" stroke-width="2"/><path d="m${x - 2} ${y - 2} 3-1" stroke="#ebdbb4" stroke-width="1.4"/>`;
  }).join('');
  const armor = loadout.capsule === 'siege' ? `<g fill="#5a5a62" stroke="#252c2c" stroke-width="4"><path d="m62 89 20-19 15 29-23 20ZM266 70l27 25-30 24-20-23ZM49 192l35-11 2 34-31 11ZM277 197l32-11-5 42-30-12ZM120 284l24 6-4 28-28-12ZM224 289l20-12 18 29-30 15Z"/></g>` : '';
  const springs = loadout.capsule === 'springsteel' ? `<g fill="none" stroke="${trim}" stroke-width="5" opacity=".9"><path d="M73 110q-39 53 0 116M287 110q39 53 0 116"/><path d="M74 126h-16m12 21H53m15 21H49m20 21H53m18 21H57"/></g>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360">
    <defs>
      <radialGradient id="hull" cx=".31" cy=".2" r=".86"><stop stop-color="${metal[0]}"/><stop offset=".43" stop-color="${metal[1]}"/><stop offset="1" stop-color="${metal[2]}"/></radialGradient>
      <linearGradient id="trim" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#f0d6a1"/><stop offset=".28" stop-color="${trim}"/><stop offset=".73" stop-color="#695b3d"/><stop offset="1" stop-color="${trim}"/></linearGradient>
      <radialGradient id="glass"><stop stop-color="#526e46"/><stop offset="1" stop-color="#11251e"/></radialGradient>
      <clipPath id="port"><circle cx="187" cy="186" r="66"/></clipPath>
    </defs>
    ${armor}${springs}
    <circle cx="180" cy="183" r="128" fill="#1b2523" stroke="#0c1715" stroke-width="8"/>
    <circle cx="180" cy="180" r="123" fill="url(#hull)" stroke="url(#trim)" stroke-width="5"/>
    <path d="M119 75q-18 103 24 212M235 71q33 112-7 218" fill="none" stroke="#131f1d" stroke-width="18"/>
    <path d="M120 76q-18 99 22 208M235 72q33 110-7 215" fill="none" stroke="url(#trim)" stroke-width="8"/>
    <path d="M73 129q108-42 214 1M69 235q113 36 222-9" fill="none" stroke="#202d27" stroke-width="9"/>
    <path d="M75 126q110-37 208 4M72 236q118 28 213-9" fill="none" stroke="#c2c2a346" stroke-width="2"/>
    ${bolts}
    <circle cx="187" cy="187" r="79" fill="#13251f" stroke="#151e18" stroke-width="8"/>
    <circle cx="187" cy="184" r="76" fill="url(#trim)"/>
    <circle cx="187" cy="186" r="67" fill="url(#glass)" stroke="#22281c" stroke-width="4"/>
    <g clip-path="url(#port)"><g transform="translate(125 117) scale(.69)">${head(loadout.rider, 'pilot')}</g></g>
    <path d="M130 155q5-22 27-29" fill="none" stroke="#f3e7bb9c" stroke-width="4" stroke-linecap="round"/>
    <path d="M86 103q28-34 64-39" fill="none" stroke="#e4e3bb78" stroke-width="5" stroke-linecap="round"/>
    <path d="m101 252 9 6m154-3-10 10m-29 18-8 3" stroke="#c6baa556" stroke-width="3" stroke-linecap="round"/>
    <path d="m277 170 20 3v22l-22 2M82 178l-16 2v22l19 2" fill="#6c6f57" stroke="#27382c" stroke-width="3"/>
  </svg>`;
  const result = data(svg); urls.set(key, result); return result;
}

export function capsuleArt(id: CapsuleId) { return loadoutArt({ rider: 'rivet', capsule: id }); }

const raceSprites = new Map<string, Promise<HTMLCanvasElement[]>>();
export function prepareRaceCapsules(roster: Loadout[]): Promise<HTMLCanvasElement[]> {
  const key = roster.map((item) => `${item.rider}/${item.capsule}`).join('|');
  if (raceSprites.has(key)) return raceSprites.get(key)!;
  const colors = ['#f0a15b', '#87d7ba', '#b7a0e8', '#e4cc77'];
  const promise = Promise.all(roster.map((loadout, index) => new Promise<HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
      const context = canvas.getContext('2d');
      if (!context) { reject(new Error('Canvas is unavailable.')); return; }
      context.drawImage(image, 31, 31, 298, 298, 0, 0, 192, 192);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error('Could not prepare the selected capsule.'));
    image.src = loadoutArt(loadout, colors[index]);
  })));
  raceSprites.set(key, promise);
  if (raceSprites.size > 6) raceSprites.delete(raceSprites.keys().next().value!);
  void promise.catch(() => raceSprites.delete(key));
  return promise;
}